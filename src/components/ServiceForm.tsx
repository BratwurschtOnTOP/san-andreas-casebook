import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERVICE_TYPES, SERVICE_TYPE_ORDER, billableUnits, formatMoney, isTimed, maxFee, type ServiceType } from "@/lib/fees";
import { errorMessage, profileQuery, servicesQuery, type Service } from "@/lib/queries";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
}

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function ServiceForm({ open, onOpenChange, service }: Props) {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery());
  const { data: services = [] } = useQuery(servicesQuery());
  const lawyerType = profile?.lawyer_type ?? "rechtsanwalt";

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [type, setType] = useState<ServiceType>("beratung");
  const [date, setDate] = useState(toLocalInput(new Date()));
  const [minutes, setMinutes] = useState<string>("15");
  const [fee, setFee] = useState<string>("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (service) {
      setClientName(service.client_name);
      setClientPhone(service.client_phone);
      setType(service.service_type);
      setDate(toLocalInput(new Date(service.service_date)));
      setMinutes(service.duration_minutes ? String(service.duration_minutes) : "15");
      setFee(String(service.fee));
      setDescription(service.description);
    } else {
      setClientName("");
      setClientPhone("");
      setType("beratung");
      setDate(toLocalInput(new Date()));
      setMinutes("15");
      setFee("");
      setDescription("");
    }
  }, [open, service]);

  const knownClients = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) if (!map.has(s.client_name)) map.set(s.client_name, s.client_phone);
    return map;
  }, [services]);

  const timed = isTimed(type);
  const mins = timed ? Number(minutes) || 0 : null;
  const limit = maxFee(type, mins, lawyerType);
  const feeNum = Number(fee || 0);
  const tooHigh = feeNum > limit;
  const info = SERVICE_TYPES[type];

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        service_type: type,
        service_date: new Date(date).toISOString(),
        duration_minutes: timed ? Math.max(1, Math.floor(Number(minutes))) : null,
        fee: Math.floor(feeNum),
        description: description.trim(),
      };
      if (service) {
        const { error } = await supabase.from("services").update(payload).eq("id", service.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(service ? "Leistung aktualisiert" : "Leistung dokumentiert");
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSave =
    clientName.trim() && clientPhone.trim() && date && fee !== "" && !tooHigh && (!timed || Number(minutes) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {service ? "Leistung bearbeiten" : "Neue Leistung dokumentieren"}
          </DialogTitle>
          <DialogDescription>Pflichtangaben gem. §3 Abs. 5 RAVO: Mandant, Telefon, Leistung, Datum, Gebühr.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="client_name">a) Name des Mandanten *</Label>
            <Input
              id="client_name"
              list="known-clients"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                const phone = knownClients.get(e.target.value);
                if (phone && !clientPhone) setClientPhone(phone);
              }}
              placeholder="z. B. John Doe"
              required
            />
            <datalist id="known-clients">
              {[...knownClients.keys()].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_phone">a) Telefonnummer *</Label>
            <Input id="client_phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="z. B. 555-1234" required />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>b) Erbrachte Leistung *</Label>
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
            <p className="text-xs text-muted-foreground">
              {info.paragraph} RAVO · {info.rule}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service_date">c) Datum der Leistung *</Label>
            <Input id="service_date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          {timed ? (
            <div className="space-y-1.5">
              <Label htmlFor="minutes">Dauer in Minuten *</Label>
              <Input id="minutes" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
              <p className="text-xs text-muted-foreground">
                {billableUnits(type, mins)} angefangene Einheit(en) à {info.unitMinutes} Min.
              </p>
            </div>
          ) : (
            <div />
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fee">d) Verlangte / vereinbarte Gebühr ($) *</Label>
            <div className="flex gap-2">
              <Input id="fee" type="number" min={0} step={1} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" required />
              <Button type="button" variant="outline" onClick={() => setFee(String(limit))}>
                Höchstbetrag
              </Button>
            </div>
            <div
              className={`mt-2 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                tooHigh ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success"
              }`}
            >
              {tooHigh ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
              <span>
                Zulässiger Höchstbetrag: <strong>{formatMoney(limit)}</strong>
                {lawyerType === "orgaanwalt" && type !== "familienantrag" && " – Organisationsanwälte vertreten kostenfrei (§1 RAVO)."}
                {tooHigh && " – Vereinbarungen über dem Höchstbetrag sind unwirksam (§4 Abs. 3)."}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Beschreibung / Notizen</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="z. B. Verteidigung wegen §… StGB, Aktenzeichen …" />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!canSave || save.isPending}>
              {save.isPending ? "Speichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
