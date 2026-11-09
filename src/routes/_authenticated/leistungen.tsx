import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ServiceForm } from "@/components/ServiceForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SERVICE_TYPES, SERVICE_TYPE_ORDER, formatMoney, type ServiceType } from "@/lib/fees";
import { errorMessage, profileQuery, servicesQuery, type Service } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/leistungen")({
  head: () => ({
    meta: [
      { title: "Leistungen – Kanzleiakte" },
      { name: "description", content: "Alle dokumentierten anwaltlichen Leistungen gem. §3 RAVO." },
      { property: "og:title", content: "Leistungen – Kanzleiakte" },
      { property: "og:description", content: "Alle dokumentierten anwaltlichen Leistungen gem. §3 RAVO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(servicesQuery()),
      context.queryClient.ensureQueryData(profileQuery()),
    ]),
  component: Leistungen,
});

function Leistungen() {
  const { data: services } = useSuspenseQuery(servicesQuery());
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<ServiceType | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return services.filter(
      (s) =>
        (type === "all" || s.service_type === type) &&
        (!needle ||
          s.client_name.toLowerCase().includes(needle) ||
          s.client_phone.toLowerCase().includes(needle) ||
          s.description.toLowerCase().includes(needle)),
    );
  }, [services, q, type]);

  const total = filtered.reduce((sum, s) => sum + Number(s.fee), 0);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <AppShell
      eyebrow="§3 Abs. 5 RAVO"
      title="Leistungsdokumentation"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> Neue Leistung
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Mandant, Telefon, Notiz…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as ServiceType | "all")}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Leistungsarten</SelectItem>
            {SERVICE_TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {SERVICE_TYPES[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} Einträge · Summe <span className="font-mono text-foreground">{formatMoney(total)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Mandant</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Leistung</TableHead>
              <TableHead className="text-right">Dauer</TableHead>
              <TableHead className="text-right">Gebühr</TableHead>
              <TableHead className="text-right">Höchstbetrag</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(s.service_date), "dd.MM.yyyy HH:mm")}</TableCell>
                <TableCell className="font-medium">{s.client_name}</TableCell>
                <TableCell className="font-mono text-xs">{s.client_phone}</TableCell>
                <TableCell>
                  <div>{SERVICE_TYPES[s.service_type].label}</div>
                  {s.description && <div className="max-w-xs truncate text-xs text-muted-foreground">{s.description}</div>}
                </TableCell>
                <TableCell className="text-right">{s.duration_minutes ? `${s.duration_minutes} Min.` : "—"}</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(Number(s.fee))}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatMoney(Number(s.max_fee))}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Bearbeiten"
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Löschen" onClick={() => setDeleting(s)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  Keine Einträge gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ServiceForm open={open} onOpenChange={setOpen} service={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Fehlende oder unvollständige Dokumentation kann berufsrechtliche Maßnahmen nach sich ziehen (§3 RAVO). Nur fehlerhafte Einträge löschen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
