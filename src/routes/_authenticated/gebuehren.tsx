import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERVICE_TYPES, SERVICE_TYPE_ORDER, billableUnits, formatMoney, isTimed, maxFee, type ServiceType } from "@/lib/fees";
import { profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/gebuehren")({
  head: () => ({
    meta: [
      { title: "Gebührenrechner – Kanzleiakte" },
      { name: "description", content: "Höchstbeträge nach der Gebührenordnung §4 RAVO berechnen." },
      { property: "og:title", content: "Gebührenrechner – Kanzleiakte" },
      { property: "og:description", content: "Höchstbeträge nach der Gebührenordnung §4 RAVO berechnen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: Gebuehren,
});

function Gebuehren() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const lawyerType = profile?.lawyer_type ?? "rechtsanwalt";
  const [type, setType] = useState<ServiceType>("verteidigung");
  const [minutes, setMinutes] = useState("45");
  const [agreed, setAgreed] = useState("");

  const timed = isTimed(type);
  const mins = timed ? Number(minutes) || 0 : null;
  const units = billableUnits(type, mins);
  const limit = maxFee(type, mins, lawyerType);
  const agreedNum = Number(agreed || 0);
  const info = SERVICE_TYPES[type];

  return (
    <AppShell eyebrow="§4 RAVO" title="Gebührenrechner">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Leistung</Label>
            <Select value={type} onValueChange={(v) => setType(v as ServiceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SERVICE_TYPES[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {timed && (
            <div className="space-y-1.5">
              <Label htmlFor="mins">Dauer in Minuten</Label>
              <Input id="mins" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="agreed">Vereinbarte Gebühr prüfen (optional)</Label>
            <Input id="agreed" type="number" min={0} value={agreed} onChange={(e) => setAgreed(e.target.value)} placeholder="z. B. 200000" />
          </div>

          <div className="rounded-md bg-primary p-5 text-primary-foreground">
            <div className="eyebrow">Zulässiger Höchstbetrag</div>
            <div className="mt-1 font-display text-4xl font-semibold">{formatMoney(limit)}</div>
            <div className="mt-2 text-sm opacity-80">
              {timed
                ? `${units} angefangene Einheit(en) à ${info.unitMinutes} Min. × ${formatMoney(info.rate)}`
                : `Pauschale · ${info.paragraph}`}
            </div>
            {lawyerType === "orgaanwalt" && type !== "familienantrag" && (
              <div className="mt-2 text-sm">Als Organisationsanwalt vertrittst du staatliche Organisationen kostenfrei.</div>
            )}
          </div>

          {agreed !== "" && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                agreedNum <= limit ? "border-success/30 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {agreedNum <= limit
                ? `${formatMoney(agreedNum)} ist zulässig.`
                : `${formatMoney(agreedNum)} überschreitet den Höchstbetrag um ${formatMoney(agreedNum - limit)}. Die Vereinbarung wäre unwirksam (§4 Abs. 3).`}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Gebührenordnung §4 Abs. 2</h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {SERVICE_TYPE_ORDER.map((t) => (
              <div key={t} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="font-medium">{SERVICE_TYPES[t].label}</div>
                  <div className="text-xs text-muted-foreground">{SERVICE_TYPES[t].paragraph}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-mono font-medium">{formatMoney(SERVICE_TYPES[t].rate)}</div>
                  <div className="text-xs text-muted-foreground">
                    {SERVICE_TYPES[t].unitMinutes ? `pro angef. ${SERVICE_TYPES[t].unitMinutes} Min.` : "pauschal"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Die festgelegten Höchstbeträge dürfen nicht überschritten werden. Ein Verstoß stellt einen Verstoß gegen die RAVO dar (§4 Abs. 1).
          </p>
        </section>
      </div>
    </AppShell>
  );
}
