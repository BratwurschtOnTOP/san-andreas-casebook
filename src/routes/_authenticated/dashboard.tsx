import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { AlertTriangle, ArrowRight, FileSignature, Plus, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ServiceForm } from "@/components/ServiceForm";
import { Button } from "@/components/ui/button";
import { SERVICE_TYPES, formatMoney, reviewWindowStart } from "@/lib/fees";
import { applicationsQuery, profileComplete, profileQuery, servicesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Übersicht – Kanzleiakte" },
      { name: "description", content: "Überblick über Mandate, Umsätze und Anträge der letzten 14 Tage." },
      { property: "og:title", content: "Übersicht – Kanzleiakte" },
      { property: "og:description", content: "Überblick über Mandate, Umsätze und Anträge der letzten 14 Tage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery()),
      context.queryClient.ensureQueryData(servicesQuery()),
      context.queryClient.ensureQueryData(applicationsQuery()),
    ]),
  component: Dashboard,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Dashboard() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: services } = useSuspenseQuery(servicesQuery());
  const { data: applications } = useSuspenseQuery(applicationsQuery());
  const [open, setOpen] = useState(false);

  const since = reviewWindowStart();
  const recent = services.filter((s) => new Date(s.service_date) >= since);
  const revenue = recent.reduce((sum, s) => sum + Number(s.fee), 0);
  const openApps = applications.filter((a) => a.status === "entwurf" || a.status === "eingereicht").length;

  const licenseDays = profile?.license_valid_until
    ? differenceInCalendarDays(new Date(profile.license_valid_until), new Date())
    : null;

  return (
    <AppShell
      eyebrow={format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
      title={profile?.full_name ? `Willkommen, ${profile.full_name}` : "Willkommen in der Kanzlei"}
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus /> Leistung erfassen
        </Button>
      }
    >
      <div className="space-y-3 mb-8">
        {!profileComplete(profile) && (
          <Notice>
            Dein Anwaltsprofil ist unvollständig. Name, Reisepassnummer und Telefonnummer werden für Anträge benötigt.{" "}
            <Link to="/profil" className="font-semibold underline">Profil ergänzen</Link>
          </Notice>
        )}
        {licenseDays !== null && licenseDays < 0 && (
          <Notice tone="danger">Deine Anwaltslizenz ist abgelaufen. Verlängerung bei der Justiz beantragen (§2 RAVO).</Notice>
        )}
        {licenseDays !== null && licenseDays >= 0 && licenseDays <= 5 && (
          <Notice>Deine Anwaltslizenz läuft in {licenseDays} Tag(en) ab. Rechtzeitig verlängern (§2 RAVO).</Notice>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leistungen · 14 Tage" value={String(recent.length)} hint="Einsichtszeitraum §3 RAVO" />
        <Stat label="Gebühren · 14 Tage" value={formatMoney(revenue)} />
        <Stat label="Offene Anträge" value={String(openApps)} hint="Familienlizenz §7" />
        <Stat
          label="Lizenz gültig bis"
          value={profile?.license_valid_until ? format(new Date(profile.license_valid_until), "dd.MM.yyyy") : "—"}
          hint="Gültigkeit 30 Tage"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Zuletzt dokumentiert</h2>
            <Link to="/leistungen" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Alle Leistungen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {services.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.client_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {SERVICE_TYPES[s.service_type].label} · {format(new Date(s.service_date), "dd.MM.yyyy HH:mm")}
                  </div>
                </div>
                <div className="font-mono text-sm whitespace-nowrap">{formatMoney(Number(s.fee))}</div>
              </div>
            ))}
            {services.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Noch keine Leistungen dokumentiert.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Schnellzugriff</h2>
          <QuickLink to="/familienlizenz" icon={<FileSignature className="h-5 w-5" />} title="Familienlizenz-Antrag" text="Antrag nach §7 erstellen" />
          <QuickLink to="/einsicht" icon={<ShieldCheck className="h-5 w-5" />} title="14-Tage-Einsicht" text="Bericht für Justiz & Kammer" />
        </section>
      </div>

      <ServiceForm open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function Notice({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "danger" }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
        tone === "danger" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/50 bg-warning/15 text-warning-foreground"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function QuickLink({ to, icon, title, text }: { to: "/familienlizenz" | "/einsicht"; icon: ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">{icon}</div>
      <div>
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{text}</div>
      </div>
    </Link>
  );
}
