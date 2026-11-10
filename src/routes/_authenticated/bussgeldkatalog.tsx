import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Gavel, 
  Search, 
  Share2, 
  Users, 
  Copy, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  ShieldAlert, 
  Scale, 
  Radio,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { profileQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/fees";
import { 
  BUSSGELDKATALOG, 
  calculatePenalty, 
  type LawCategory, 
  type LawParagraph 
} from "@/lib/bussgeldkatalog";

export const Route = createFileRoute("/_authenticated/bussgeldkatalog")({
  head: () => ({
    meta: [
      { title: "Bußgeldkatalog & Strafrechner – Kanzleiakte" },
      { name: "description", content: "Bußgeldkatalog, Strafmaß- und Wanted-Rechner mit Echtzeit-Kollaboration für Kanzleipartner." },
      { property: "og:title", content: "Bußgeldkatalog & Strafrechner – Kanzleiakte" },
      { property: "og:description", content: "Bußgeldkatalog, Strafmaß- und Wanted-Rechner mit Echtzeit-Kollaboration für Kanzleipartner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: BussgeldkatalogPage,
});

interface CollaborativeState {
  selectedIds: string[];
  thirdRepeat52a: boolean;
  clientName: string;
  lawyerNotes: string;
  caseNumber: string;
  lastEditedBy: string;
  timestamp: number;
}

function BussgeldkatalogPage() {
  const { data: profile } = useQuery(profileQuery());
  const userName = profile?.full_name || "Kanzlei-Anwalt";

  // URL-Parameter für gemeinsamen Raum (Standard: kanzlei-zentrale)
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("raum") || "kanzlei-zentrale";
    }
    return "kanzlei-zentrale";
  });

  // State für Delikte & Fallakte
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [thirdRepeat52a, setThirdRepeat52a] = useState(false);
  const [clientName, setClientName] = useState("");
  const [lawyerNotes, setLawyerNotes] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [lastEditor, setLastEditor] = useState<string>("");

  // Filter & UI
  const [category, setCategory] = useState<LawCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [onlyWanteds, setOnlyWanteds] = useState(false);

  // Online Partner
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const isBroadcastingRef = useRef(false);

  // ==========================================================
  // ECHTZEIT-KOLLABORATION (SUPABASE REALTIME CHANNELS)
  // ==========================================================
  useEffect(() => {
    const channelName = `kanzlei-case-${roomId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: userName },
      },
    });

    // 1. Broadcasts von Partnern empfangen
    channel.on("broadcast", { event: "case_sync" }, ({ payload }) => {
      const data = payload as CollaborativeState;
      if (!data) return;

      isBroadcastingRef.current = true;
      setSelectedIds(new Set(data.selectedIds || []));
      setThirdRepeat52a(!!data.thirdRepeat52a);
      setClientName(data.clientName || "");
      setLawyerNotes(data.lawyerNotes || "");
      setCaseNumber(data.caseNumber || "");
      setLastEditor(data.lastEditedBy || "Partner");

      toast.info(`Eintrag aktualisiert von: ${data.lastEditedBy || "Partner"}`, {
        duration: 2000,
      });

      setTimeout(() => {
        isBroadcastingRef.current = false;
      }, 50);
    });

    // 2. Anwesenheit (Presence) synchronisieren
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const users: string[] = [];
      Object.keys(state).forEach((key) => {
        users.push(key);
      });
      setOnlineUsers(users);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          onlineAt: new Date().toISOString(),
          name: userName,
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userName]);

  // Broadcast-Funktion bei Änderungen
  const broadcastChange = (updates: Partial<CollaborativeState>) => {
    if (isBroadcastingRef.current) return;

    const payload: CollaborativeState = {
      selectedIds: updates.selectedIds !== undefined ? updates.selectedIds : Array.from(selectedIds),
      thirdRepeat52a: updates.thirdRepeat52a !== undefined ? updates.thirdRepeat52a : thirdRepeat52a,
      clientName: updates.clientName !== undefined ? updates.clientName : clientName,
      lawyerNotes: updates.lawyerNotes !== undefined ? updates.lawyerNotes : lawyerNotes,
      caseNumber: updates.caseNumber !== undefined ? updates.caseNumber : caseNumber,
      lastEditedBy: userName,
      timestamp: Date.now(),
    };

    const channelName = `kanzlei-case-${roomId}`;
    supabase.channel(channelName).send({
      type: "broadcast",
      event: "case_sync",
      payload,
    });
  };

  // Paragraphen umschalten
  const toggleParagraph = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    broadcastChange({ selectedIds: Array.from(next) });
  };

  // Alles zurücksetzen
  const handleReset = () => {
    if (selectedIds.size === 0 && !clientName && !lawyerNotes) return;
    if (confirm("Möchtest du die gesamte Fallakte wirklich zurücksetzen? Dies wird auch für deinen Partner geleert.")) {
      setSelectedIds(new Set());
      setThirdRepeat52a(false);
      setClientName("");
      setLawyerNotes("");
      setCaseNumber("");
      broadcastChange({
        selectedIds: [],
        thirdRepeat52a: false,
        clientName: "",
        lawyerNotes: "",
        caseNumber: "",
      });
      toast.success("Akte zurückgesetzt");
    }
  };

  // Berechnungen
  const calc = useMemo(() => {
    return calculatePenalty(selectedIds, { thirdRepeat52a });
  }, [selectedIds, thirdRepeat52a]);

  // Filterung der Paragraphen
  const filteredList = useMemo(() => {
    return BUSSGELDKATALOG.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (onlySelected && !selectedIds.has(item.id)) return false;
      if (onlyWanteds && item.stars === 0 && !item.repeatStars) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const mP = item.paragraph.toLowerCase().includes(q);
        const mT = item.title.toLowerCase().includes(q);
        const mI = item.info.toLowerCase().includes(q);
        const mR = (item.remarks || "").toLowerCase().includes(q);
        const mC = item.category.toLowerCase().includes(q);
        if (!mP && !mT && !mI && !mR && !mC) return false;
      }
      return true;
    });
  }, [category, search, onlySelected, onlyWanteds, selectedIds]);

  // Link für Partner kopieren
  const copyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("raum", roomId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      toast.success("Kollaborations-Link in Zwischenablage kopiert! Schicke ihn deinem Partner.");
    });
  };

  // Fallakte für Discord/MDC kopieren
  const copyReport = () => {
    if (calc.selectedItems.length === 0) {
      toast.error("Wähle zuerst mindestens ein Delikt aus!");
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("de-DE") + " " + now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const client = clientName.trim() || "Unbekannt / Noch nicht erfasst";
    const caseRef = caseNumber.trim() ? ` [Az: ${caseNumber.trim()}]` : "";

    let report = `
======================================================
     ALLES ODER NICHTS · SAN ANDREAS
                 FALL- & STRAFBERECHNUNG
======================================================
DATUM / ZEIT    : ${dateStr}
BEARBEITER      : ${userName}
MANDANT/BESCH.  : ${client}${caseRef}
${lawyerNotes.trim() ? `SACHVERHALT     : ${lawyerNotes.trim()}\n` : ""}------------------------------------------------------
VERLETZTE PARAGRAPHEN (${calc.selectedItems.length}):
${calc.selectedItems
  .map((item) => {
    let s = item.stars;
    if (item.id === "stvo-5-2a" && thirdRepeat52a) s += 2;
    return ` • [${item.category}] ${item.paragraph} ${item.title} | ${formatMoney(item.fine)} | ${s > 0 ? "⭐".repeat(s) : "Keine Haft"}`;
  })
  .join("\n")}

------------------------------------------------------
GESAMTERGEBNIS:
 • GELDSTRAFE    : ${formatMoney(calc.totalFine)}
 • HAFTSTRAFE    : ${calc.totalStars} Wanteds (${calc.totalStars > 0 ? "⭐".repeat(Math.min(calc.totalStars, 5)) : "Keine"})
 • KAUTION       : ${calc.totalStars === 0 ? "Entfällt (Keine Haft)" : calc.bailPossible ? "ERLAUBT" : `VERWEHRT (${calc.bailBlockers.join(", ")})`}
 • ÜBERGABE FIB  : ${calc.hasFIB ? "JA (FIB erforderlich)" : "Nein"}
 • ÜBERGABE StA  : ${calc.hasStA ? "JA (StA erforderlich)" : "Nein"}
${calc.revokeDriver ? " • MASSNAHME    : Führerscheinentzug\n" : ""}${calc.revokeWeapon ? " • MASSNAHME    : Entzug der Waffenlizenz\n" : ""}${calc.revokePilot ? " • MASSNAHME    : Flugscheinentzug\n" : ""}${calc.confiscations.length > 0 ? ` • EINZIEHUNG   : ${calc.confiscations.join(", ")}\n` : ""}======================================================
`.trim();

    navigator.clipboard.writeText(report).then(() => {
      toast.success("Fallakte erfolgreich kopiert (für Discord / Funk / MDC)!");
    });
  };

  return (
    <AppShell
      eyebrow="San Andreas Straf- & Bußgeldkatalog"
      title="Bußgeldkatalog & Strafrechner"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyShareLink} title="Gemeinsamen Raum-Link kopieren">
            <Share2 className="h-4 w-4 mr-1 text-gold" /> Partner einladen
          </Button>
          <Button variant="gold" size="sm" onClick={copyReport}>
            <Copy className="h-4 w-4 mr-1" /> Fallakte kopieren
          </Button>
        </div>
      }
    >
      {/* Kollaborations-Banner */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Radio className="h-5 w-5 animate-pulse text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              Echtzeit-Kanzleisitzung: <span className="font-mono text-sm text-gold">#{roomId}</span>
              <Badge variant="outline" className="border-emerald-600/40 bg-emerald-50 text-emerald-800 text-xs">
                ● Live aktiv
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Alle Partner im selben Raum sehen und bearbeiten diese Fallakte zeitgleich.
              {lastEditor && <span className="ml-2 italic text-foreground/80">Zuletzt aktualisiert von {lastEditor}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
            <Users className="h-4 w-4 text-gold" />
            <span>{onlineUsers.length} Anwalt/Partner im Raum</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            const next = prompt("Raumname eingeben (z. B. kanzlei-1, fall-mueller):", roomId);
            if (next && next.trim()) {
              setRoomId(next.trim());
              const url = new URL(window.location.href);
              url.searchParams.set("raum", next.trim());
              window.history.replaceState({}, "", url.toString());
            }
          }}>
            Raum wechseln
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_390px] items-start">
        {/* Linke Spalte: Filter, Suche und Paragraphenliste */}
        <section className="space-y-4 min-w-0">
          
          {/* Suche & Filter Toolbar */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Paragraph suchen (z. B. §8, Mord, Waffe, Alkohol, Führerscheinentzug)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-1">
                {(["ALL", "StGB", "WaffG", "BtMG", "StVO"] as const).map((cat) => (
                  <Button
                    key={cat}
                    variant={category === cat ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCategory(cat)}
                  >
                    {cat === "ALL" ? "Alle Gesetze" : cat}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={onlySelected ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs border border-border"
                  onClick={() => setOnlySelected(!onlySelected)}
                >
                  {onlySelected ? "✓ Nur Ausgewählte" : "Nur Ausgewählte"}
                </Button>
                <Button
                  variant={onlyWanteds ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs border border-border"
                  onClick={() => setOnlyWanteds(!onlyWanteds)}
                >
                  ⭐ Mit Wanteds
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredList.length} Paragraphen gefunden</span>
            <span>Klicke auf eine Karte, um sie zur Akte hinzuzufügen</span>
          </div>

          {/* Paragraphen-Karten */}
          <div className="space-y-2">
            {filteredList.map((item) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleParagraph(item.id)}
                  className={`group relative flex items-start gap-4 rounded-lg border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? "border-gold bg-gold/5 shadow-sm"
                      : "border-border bg-card hover:border-gold/50 hover:bg-muted/30"
                  }`}
                >
                  <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleParagraph(item.id)}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono font-bold text-base text-primary">
                        {item.paragraph}
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        {item.title}
                      </span>
                      <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wider py-0">
                        {item.category}
                      </Badge>
                    </div>

                    {/* Badges / Merkmale */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.info && (
                        <Badge variant="secondary" className="text-xs">
                          {item.info}
                        </Badge>
                      )}
                      {item.fib && (
                        <Badge variant="destructive" className="text-xs">
                          🚨 FIB
                        </Badge>
                      )}
                      {item.sta && (
                        <Badge className="bg-amber-600 text-white text-xs">
                          ⚖️ StA
                        </Badge>
                      )}
                      {item.bail ? (
                        <Badge className="bg-emerald-700 text-white text-xs">
                          ✓ Kaution
                        </Badge>
                      ) : item.stars > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          ✗ Keine Kaution
                        </Badge>
                      ) : null}
                      {item.revokeDriverLicense && (
                        <Badge variant="outline" className="border-blue-600 text-blue-700 dark:text-blue-400 text-xs">
                          🚗 Führerscheinentzug
                        </Badge>
                      )}
                      {item.revokeWeaponLicense && (
                        <Badge variant="outline" className="border-rose-600 text-rose-700 dark:text-rose-400 text-xs">
                          🔫 Waffenlizenzentzug
                        </Badge>
                      )}
                      {item.confiscate && (
                        <Badge variant="outline" className="border-orange-600 text-orange-700 dark:text-orange-400 text-xs">
                          📦 Konfiszierung
                        </Badge>
                      )}
                    </div>

                    {item.exclusion && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <strong className="text-foreground">Ausschluss:</strong> {item.exclusion}
                      </div>
                    )}

                    {item.remarks && (
                      <div className="mt-1 text-xs text-muted-foreground italic">
                        {item.remarks}
                      </div>
                    )}

                    {/* Sonderoption für §5.2a */}
                    {item.id === "stvo-5-2a" && isSelected && (
                      <div
                        className="mt-3 p-2.5 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          id="repeat52a"
                          checked={thirdRepeat52a}
                          onCheckedChange={(checked) => {
                            const val = !!checked;
                            setThirdRepeat52a(val);
                            broadcastChange({ thirdRepeat52a: val });
                          }}
                        />
                        <label htmlFor="repeat52a" className="text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer">
                          Ab dem 3. Verstoß? (+2 Wanteds ⭐⭐)
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <div className="font-mono font-bold text-base text-foreground">
                      {formatMoney(item.fine)}
                    </div>
                    <div className="text-sm mt-0.5">
                      {item.stars > 0 ? (
                        <span title={`${item.stars} Wanteds`}>{"⭐".repeat(item.stars)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredList.length === 0 && (
              <div className="p-12 text-center text-muted-foreground border border-dashed rounded-lg">
                Keine Paragraphen gefunden. Suche oder Filter zurücksetzen.
              </div>
            )}
          </div>
        </section>

        {/* Rechte Spalte: Live-Zusammenfassung & Fallakte */}
        <aside className="sticky top-6 space-y-4">
          <Card className="border-gold/40 shadow-paper">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-xl">Strafmaß & Berechnung</CardTitle>
                <Badge variant="outline" className="font-mono text-gold border-gold">
                  {calc.count} Delikt{calc.count === 1 ? "" : "e"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              
              {/* Hauptmetriken */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                  <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground font-semibold">
                    Geldstrafe
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(calc.totalFine)}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                  <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground font-semibold">
                    Wanteds / Haft
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-gold">
                    {calc.totalStars} ⭐
                  </div>
                  <div className="text-[0.7rem] text-muted-foreground mt-0.5">
                    {calc.totalStars > 0 ? "⭐".repeat(Math.min(calc.totalStars, 5)) : "Keine Haft"}
                  </div>
                </div>
              </div>

              {/* Status Übersicht */}
              <div className="rounded-md border border-border divide-y divide-border text-xs">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground font-medium">Kaution:</span>
                  <span className="font-semibold">
                    {!calc.hasJail ? (
                      <span className="text-muted-foreground">Entfällt</span>
                    ) : calc.bailPossible ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓ Erlaubt</span>
                    ) : (
                      <span className="text-destructive font-bold">✗ Verwehrt</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground font-medium">Übergabe FIB:</span>
                  <span className="font-semibold">
                    {calc.hasFIB ? (
                      <span className="text-destructive font-bold">🚨 Erforderlich</span>
                    ) : (
                      <span className="text-muted-foreground">Nein</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground font-medium">Übergabe StA:</span>
                  <span className="font-semibold">
                    {calc.hasStA ? (
                      <span className="text-amber-600 font-bold">⚖️ Erforderlich</span>
                    ) : (
                      <span className="text-muted-foreground">Nein</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Gesetzliche Ausschlüsse Warnung */}
              {calc.exclusionWarnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 text-xs space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    Gesetzlicher Ausschluss (bei derselben Tat):
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-amber-800 dark:text-amber-300">
                    {calc.exclusionWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Zusatzmaßnahmen & Lizenzen */}
              {(calc.revokeDriver || calc.revokeWeapon || calc.revokePilot || calc.confiscations.length > 0) && (
                <div className="rounded-md border border-border bg-card p-3 text-xs space-y-1">
                  <div className="font-semibold text-foreground">Besondere Maßnahmen:</div>
                  <ul className="space-y-1 text-muted-foreground">
                    {calc.revokeDriver && <li>🚗 Führerscheinentzug ({calc.driverReasons.join(", ")})</li>}
                    {calc.revokeWeapon && <li>🔫 Waffenlizenzentzug ({calc.weaponReasons.join(", ")})</li>}
                    {calc.revokePilot && <li>✈️ Flugscheinentzug (§13.1 StVO)</li>}
                    {calc.confiscations.map((c, i) => (
                      <li key={i}>📦 {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mandanten / Akten-Metadaten */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Mandant / Beschuldigter..."
                    value={clientName}
                    className="text-xs h-8"
                    onChange={(e) => {
                      setClientName(e.target.value);
                      broadcastChange({ clientName: e.target.value });
                    }}
                  />
                  <Input
                    placeholder="Aktenzeichen / Notiz..."
                    value={caseNumber}
                    className="text-xs h-8"
                    onChange={(e) => {
                      setCaseNumber(e.target.value);
                      broadcastChange({ caseNumber: e.target.value });
                    }}
                  />
                </div>
                <Input
                  placeholder="Sachverhalt / Festnahmeort..."
                  value={lawyerNotes}
                  className="text-xs h-8"
                  onChange={(e) => {
                    setLawyerNotes(e.target.value);
                    broadcastChange({ lawyerNotes: e.target.value });
                  }}
                />
              </div>

              {/* Ausgewählte Delikte Liste */}
              {calc.selectedItems.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1 text-xs">
                  <div className="text-muted-foreground font-semibold">Ausgewählt:</div>
                  {calc.selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
                    >
                      <span className="font-mono font-medium truncate mr-2">
                        {item.paragraph} {item.title}
                      </span>
                      <button
                        onClick={() => toggleParagraph(item.id)}
                        className="text-destructive hover:underline text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Aktionen */}
              <div className="space-y-2 pt-2">
                <Button className="w-full" variant="gold" onClick={copyReport}>
                  <Copy className="h-4 w-4 mr-2" /> Fallakte kopieren
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Zurücksetzen
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    Drucken / PDF
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
