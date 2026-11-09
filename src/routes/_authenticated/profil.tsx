import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LawyerType } from "@/lib/fees";
import { errorMessage, profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Anwaltsprofil – Kanzleiakte" },
      { name: "description", content: "Persönliche Daten, Anwaltsart und Lizenzgültigkeit verwalten." },
      { property: "og:title", content: "Anwaltsprofil – Kanzleiakte" },
      { property: "og:description", content: "Persönliche Daten, Anwaltsart und Lizenzgültigkeit verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: Profil,
});

function Profil() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [passport, setPassport] = useState(profile?.passport_number ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [lawyerType, setLawyerType] = useState<LawyerType>(profile?.lawyer_type ?? "rechtsanwalt");
  const [organization, setOrganization] = useState(profile?.organization ?? "");
  const [validUntil, setValidUntil] = useState(profile?.license_valid_until ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        passport_number: passport.trim(),
        phone: phone.trim(),
        lawyer_type: lawyerType,
        organization: lawyerType === "orgaanwalt" ? organization.trim() || null : null,
        license_valid_until: validUntil || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil gespeichert");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <AppShell eyebrow="Persönliche Daten" title="Anwaltsprofil">
      <form onSubmit={submit} className="max-w-2xl space-y-8">
        <section className="rounded-lg border border-border bg-card p-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="passport">Reisepassnummer *</Label>
            <Input id="passport" value={passport} onChange={(e) => setPassport(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefonnummer *</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Diese Angaben erscheinen auf Familienlizenz-Anträgen (§7 lit. d) und in der 14-Tage-Einsicht.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Tätigkeit</h2>
          <RadioGroup value={lawyerType} onValueChange={(v) => setLawyerType(v as LawyerType)} className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer gap-3 rounded-md border border-border p-4 has-[[data-state=checked]]:border-gold">
              <RadioGroupItem value="rechtsanwalt" />
              <div>
                <div className="font-medium">Rechtsanwalt</div>
                <div className="text-xs text-muted-foreground">Vertritt Bürger gegen Gebühr nach §4.</div>
              </div>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-md border border-border p-4 has-[[data-state=checked]]:border-gold">
              <RadioGroupItem value="orgaanwalt" />
              <div>
                <div className="font-medium">Organisationsanwalt</div>
                <div className="text-xs text-muted-foreground">Vertritt nur staatliche Organisationen kostenfrei (§8).</div>
              </div>
            </label>
          </RadioGroup>
          {lawyerType === "orgaanwalt" && (
            <div className="space-y-1.5">
              <Label htmlFor="org">Staatliche Organisation</Label>
              <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="z. B. LSPD" />
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Anwaltslizenz</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valid">Gültig bis</Label>
              <Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={() => setValidUntil(format(addDays(new Date(), 30), "yyyy-MM-dd"))}>
              Heute verlängert (+30 Tage)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Eintrag in die Anwaltsliste gilt 30 Tage. Verlängerung: 100.000 $ (§2 RAVO).</p>
        </section>

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Speichert…" : "Profil speichern"}
        </Button>
      </form>
    </AppShell>
  );
}
