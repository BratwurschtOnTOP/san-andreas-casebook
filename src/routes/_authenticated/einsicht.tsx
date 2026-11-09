import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Copy, Printer, Scale } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { REVIEW_WINDOW_DAYS, SERVICE_TYPES, formatMoney, reviewWindowStart } from "@/lib/fees";
import { profileQuery, servicesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/einsicht")({
  head: () => ({
    meta: [
      { title: "14-Tage-Einsicht – Kanzleiakte" },
      { name: "description", content: "Dokumentationsbericht der letzten 14 Tage für Justiz, Kammer und Gouverneursbüro." },
      { property: "og:title", content: "14-Tage-Einsicht – Kanzleiakte" },
      { property: "og:description", content: "Dokumentationsbericht der letzten 14 Tage für Justiz, Kammer und Gouverneursbüro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery()),
      context.queryClient.ensureQueryData(servicesQuery()),
    ]),
  component: Einsicht,
});

function Einsicht() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: services } = useSuspenseQuery(servicesQuery());
  const now = new Date();
  const since = reviewWindowStart(now);
  const rows = services
    .filter((s) => new Date(s.service_date) >= since && new Date(s.service_date) <= now)
    .sort((a, b) => +new Date(a.service_date) - +new Date(b.service_date));
  const total = rows.reduce((sum, s) => sum + Number(s.fee), 0);
  const lawyerLabel = profile?.lawyer_type === "orgaanwalt" ? `Organisationsanwalt${profile.organization ? ` (${profile.organization})` : ""}` : "Rechtsanwalt";

  async function copy() {
    const lines = [
      `DOKUMENTATION ANWALTLICHER LEISTUNGEN gem. §3 RAVO`,
      `Zeitraum: ${format(since, "dd.MM.yyyy")} – ${format(now, "dd.MM.yyyy")}`,
      `${lawyerLabel}: ${profile?.full_name ?? ""} · Pass ${profile?.passport_number ?? ""} · Tel. ${profile?.phone ?? ""}`,
      "",
      ...rows.map(
        (s) =>
          `${format(new Date(s.service_date), "dd.MM.yyyy HH:mm")} | ${s.client_name} (${s.client_phone}) | ${SERVICE_TYPES[s.service_type].label}${
            s.duration_minutes ? ` (${s.duration_minutes} Min.)` : ""
          } | ${formatMoney(Number(s.fee))}`,
      ),
      "",
      `Summe: ${formatMoney(total)} · ${rows.length} Leistung(en)`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Bericht kopiert");
  }

  return (
    <AppShell
      eyebrow="§3 RAVO · Einsichtnahme"
      title="14-Tage-Einsicht"
      actions={
        <>
          <Button variant="outline" onClick={copy}>
            <Copy /> Als Text kopieren
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Drucken / PDF
          </Button>
        </>
      }
    >
      <p className="no-print mb-6 max-w-2xl text-sm text-muted-foreground">
        Justizministerium, Rechtsanwaltskammer und Gouverneursbüro dürfen durch Beschluss Einsicht verlangen – dabei dürfen nur die letzten{" "}
        {REVIEW_WINDOW_DAYS} Tage beachtet werden. Dieser Bericht enthält genau diesen Zeitraum.
      </p>

      <article className="paper-sheet print-area mx-auto max-w-5xl rounded-sm px-8 py-10 md:px-12">
        <header className="flex items-start justify-between border-b-2 border-gold pb-5">
          <div>
            <div className="eyebrow">Rechtsanwaltskammer San Andreas</div>
            <h2 className="mt-2 font-display text-3xl font-bold">Dokumentation anwaltlicher Leistungen</h2>
            <p className="text-sm text-ink/70">
              gem. §3 RAVO · Zeitraum {format(since, "dd.MM.yyyy")} – {format(now, "dd.MM.yyyy")}
            </p>
          </div>
          <Scale className="h-9 w-9 text-gold" />
        </header>

        <section className="mt-6 grid gap-2 text-sm sm:grid-cols-4">
          <Info label={lawyerLabel} value={profile?.full_name} />
          <Info label="Reisepassnummer" value={profile?.passport_number} />
          <Info label="Telefonnummer" value={profile?.phone} />
          <Info label="Lizenz gültig bis" value={profile?.license_valid_until ? format(new Date(profile.license_valid_until), "dd.MM.yyyy") : undefined} />
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-ink/30 text-left text-xs uppercase tracking-wider text-ink/60">
              <th className="py-2 pr-3">Datum</th>
              <th className="py-2 pr-3">Mandant</th>
              <th className="py-2 pr-3">Telefon</th>
              <th className="py-2 pr-3">Leistung</th>
              <th className="py-2 text-right">Gebühr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{format(new Date(s.service_date), "dd.MM.yyyy HH:mm")}</td>
                <td className="py-2 pr-3 font-medium">{s.client_name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{s.client_phone}</td>
                <td className="py-2 pr-3">
                  {SERVICE_TYPES[s.service_type].label}
                  {s.duration_minutes ? ` · ${s.duration_minutes} Min.` : ""}
                  {s.description && <div className="text-xs text-ink/60">{s.description}</div>}
                </td>
                <td className="py-2 text-right font-mono whitespace-nowrap">{formatMoney(Number(s.fee))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-ink/60">
                  Keine Leistungen im Einsichtszeitraum.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-4 text-right font-semibold">
                Summe ({rows.length} Leistungen)
              </td>
              <td className="pt-4 text-right font-mono font-semibold">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="mt-14 flex items-end justify-between gap-8 text-xs text-ink/60">
          <div>
            Erstellt am {format(now, "dd. MMMM yyyy, HH:mm", { locale: de })} Uhr
            <br />
            Vertraulich – unterliegt dem Anwaltsgeheimnis (§5 RAVO)
          </div>
          <div className="w-56 text-center">
            <div className="h-8 font-display text-xl italic text-ink">{profile?.full_name}</div>
            <div className="border-t border-ink/50 pt-1">Unterschrift Anwalt</div>
          </div>
        </footer>
      </article>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-ink/60">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
