import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, FileSignature, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyDocument } from "@/components/FamilyDocument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, maxFee } from "@/lib/fees";
import { STATUS_LABELS, applicationsQuery, errorMessage, profileComplete, profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/familienlizenz/")({
  head: () => ({
    meta: [
      { title: "Familienlizenz-Anträge – Kanzleiakte" },
      { name: "description", content: "Anträge auf eine Familienlizenz gem. §7 RAVO erstellen und verwalten." },
      { property: "og:title", content: "Familienlizenz-Anträge – Kanzleiakte" },
      { property: "og:description", content: "Anträge auf eine Familienlizenz gem. §7 RAVO erstellen und verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(applicationsQuery()),
      context.queryClient.ensureQueryData(profileQuery()),
    ]),
  component: Familienlizenz,
});

const STATUS_VARIANT = {
  entwurf: "secondary",
  eingereicht: "outline",
  genehmigt: "default",
  abgelehnt: "destructive",
} as const;

function Familienlizenz() {
  const { data: applications } = useSuspenseQuery(applicationsQuery());
  const { data: profile } = useSuspenseQuery(profileQuery());
  const [open, setOpen] = useState(false);
  const complete = profileComplete(profile);

  return (
    <AppShell
      eyebrow="§7 RAVO · Beurkundungen"
      title="Familienlizenz-Anträge"
      actions={
        <Button onClick={() => setOpen(true)} disabled={!complete}>
          <Plus /> Neuer Antrag
        </Button>
      }
    >
      {!complete && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-warning/50 bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            Für den Antrag werden deine Anwaltsdaten benötigt (§7 lit. d).{" "}
            <Link to="/profil" className="font-semibold underline">Profil vervollständigen</Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {applications.map((a) => (
          <Link
            key={a.id}
            to="/familienlizenz/$id"
            params={{ id: a.id }}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold"
          >
            <div className="flex items-start justify-between gap-3">
              <FileSignature className="h-5 w-5 text-gold" />
              <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABELS[a.status]}</Badge>
            </div>
            <div className="mt-4 font-display text-2xl font-semibold">Familie {a.family_name}</div>
            <div className="text-sm text-muted-foreground">
              {a.applicant_name} · Haus {a.house_number}
            </div>
            <div className="mt-4 flex justify-between text-xs text-muted-foreground">
              <span>{format(new Date(a.application_date), "dd.MM.yyyy")}</span>
              <span className="font-mono">{formatMoney(Number(a.fee))}</span>
            </div>
          </Link>
        ))}
        {applications.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
            Noch keine Anträge erstellt.
          </div>
        )}
      </div>

      {complete && <NewApplicationDialog open={open} onOpenChange={setOpen} />}
    </AppShell>
  );
}

function NewApplicationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const limit = maxFee("familienantrag", null, profile?.lawyer_type ?? "rechtsanwalt");

  const [f, setF] = useState({
    application_date: today,
    applicant_name: "",
    applicant_passport: "",
    applicant_phone: "",
    family_name: "",
    house_number: "",
    client_signature: "",
    lawyer_signature: profile?.full_name ?? "",
  });
  const [sworn, setSworn] = useState(false);
  const [fee, setFee] = useState(String(limit));
  const [logService, setLogService] = useState(true);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const docData = {
    ...f,
    lawyer_name: profile?.full_name ?? "",
    lawyer_passport: profile?.passport_number ?? "",
    lawyer_phone: profile?.phone ?? "",
  };
  const feeNum = Math.floor(Number(fee || 0));
  const tooHigh = feeNum > limit;

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("family_applications")
        .insert({
          ...docData,
          applicant_name: f.applicant_name.trim(),
          family_name: f.family_name.trim(),
          sworn_statement: sworn,
          fee: feeNum,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (logService) {
        const { error: sErr } = await supabase.from("services").insert({
          client_name: f.applicant_name.trim(),
          client_phone: f.applicant_phone.trim(),
          service_type: "familienantrag",
          service_date: new Date().toISOString(),
          fee: feeNum,
          description: `Antrag auf Familienlizenz – Familie ${f.family_name.trim()}, Haus ${f.house_number}`,
          family_application_id: data.id,
        });
        if (sErr) throw sErr;
      }
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Antrag erstellt");
      queryClient.invalidateQueries({ queryKey: ["family_applications"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onOpenChange(false);
      navigate({ to: "/familienlizenz/$id", params: { id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const valid =
    f.applicant_name.trim() &&
    f.applicant_passport.trim() &&
    f.applicant_phone.trim() &&
    f.family_name.trim() &&
    f.house_number.trim() &&
    sworn &&
    !tooHigh;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Antrag auf eine Familienlizenz</DialogTitle>
          <DialogDescription>Alle Pflichtangaben a) bis i) gem. §7 RAVO.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <form onSubmit={submit} className="space-y-5">
            <Field label="b) Datum">
              <Input type="date" value={f.application_date} onChange={set("application_date")} required />
            </Field>
            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold">c) Antragsteller (Mandant)</legend>
              <Field label="Name"><Input value={f.applicant_name} onChange={set("applicant_name")} required /></Field>
              <Field label="Reisepassnummer"><Input value={f.applicant_passport} onChange={set("applicant_passport")} required /></Field>
              <Field label="Telefonnummer"><Input value={f.applicant_phone} onChange={set("applicant_phone")} required /></Field>
            </fieldset>
            <div className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
              d) Anwaltsdaten aus deinem Profil: {profile?.full_name} · Pass {profile?.passport_number} · Tel. {profile?.phone}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="e) Name der zukünftigen Familie"><Input value={f.family_name} onChange={set("family_name")} required /></Field>
              <Field label="f) Hausnummer"><Input value={f.house_number} onChange={set("house_number")} required /></Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Der Familienname darf keine eindeutige oder direkte Assoziation mit kriminellen Aktivitäten in San Andreas haben.
            </p>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox checked={sworn} onCheckedChange={(v) => setSworn(v === true)} className="mt-0.5" />
              <span>g) Der Mandant gibt die eidesstattliche Versicherung ab, dass die Familie rein legalen Zwecken dient.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="h) Unterschrift Mandant"><Input value={f.client_signature} onChange={set("client_signature")} placeholder="Name des Mandanten" /></Field>
              <Field label="i) Unterschrift Anwalt"><Input value={f.lawyer_signature} onChange={set("lawyer_signature")} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <Field label={`Gebühr (max. ${formatMoney(limit)})`}>
                <Input type="number" min={0} max={limit} value={fee} onChange={(e) => setFee(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={logService} onCheckedChange={(v) => setLogService(v === true)} />
                Auch als Leistung dokumentieren
              </label>
            </div>
            {tooHigh && <p className="text-sm text-destructive">Gebühr über dem Höchstbetrag von {formatMoney(limit)} (§4 lit. d).</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={!valid || create.isPending}>
              {create.isPending ? "Wird erstellt…" : "Antrag erstellen"}
            </Button>
          </form>
          <div className="hidden lg:block scale-[0.9] origin-top">
            <FamilyDocument data={docData} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
