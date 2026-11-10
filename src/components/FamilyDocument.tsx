import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Scale } from "lucide-react";
import type { FamilyApplication } from "@/lib/queries";

type DocData = Pick<
  FamilyApplication,
  | "application_date"
  | "applicant_name"
  | "applicant_passport"
  | "applicant_phone"
  | "lawyer_name"
  | "lawyer_passport"
  | "lawyer_phone"
  | "family_name"
  | "house_number"
  | "client_signature"
  | "lawyer_signature"
>;

export function swornStatement(d: Pick<DocData, "applicant_name" | "family_name">) {
  return `Hiermit versichere ich, ${d.applicant_name || "[Name]"}, an Eides statt, dass die zu gründende Familie „${
    d.family_name || "[Familienname]"
  }“ ausschließlich legalen Zwecken dient und keinerlei Verbindung zu kriminellen Aktivitäten im Staate San Andreas aufweist. Mir ist bekannt, dass eine falsche eidesstattliche Versicherung strafrechtlich verfolgt wird.`;
}

const fmtDate = (d: string) => format(new Date(d), "dd. MMMM yyyy", { locale: de });

export function familyDocumentText(d: DocData): string {
  return [
    "ANTRAG AUF EINE FAMILIENLIZENZ",
    "",
    `Datum: ${fmtDate(d.application_date)}`,
    "",
    "Antragsteller:",
    `  Name: ${d.applicant_name}`,
    `  Reisepassnummer: ${d.applicant_passport}`,
    `  Telefonnummer: ${d.applicant_phone}`,
    "",
    "Bevollmächtigter Rechtsanwalt:",
    `  Name: ${d.lawyer_name}`,
    `  Reisepassnummer: ${d.lawyer_passport}`,
    `  Telefonnummer: ${d.lawyer_phone}`,
    "",
    `Name der zukünftigen Familie: ${d.family_name}`,
    `Hausnummer der zukünftigen Familie: ${d.house_number}`,
    "",
    "Eidesstattliche Versicherung:",
    swornStatement(d),
    "",
    `Unterschrift Mandant: ${d.client_signature || "____________________"}`,
    `Unterschrift Anwalt: ${d.lawyer_signature || "____________________"}`,
  ].join("\n");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-3 py-1 text-sm">
      <div className="text-ink/60">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

export function FamilyDocument({ data }: { data: DocData }) {
  return (
    <article className="paper-sheet print-area mx-auto max-w-3xl rounded-sm px-10 py-12 md:px-14">
      <header className="flex items-start justify-between border-b-2 border-gold pb-5">
        <div>
          <div className="eyebrow">Alles oder nichts</div>
          <div className="text-xs text-ink/60 mt-1">Department of Justice · Los Santos City</div>
        </div>
        <Scale className="h-8 w-8 text-gold" />
      </header>

      <h1 className="mt-8 text-center font-display text-3xl font-bold uppercase tracking-wide">Antrag auf eine Familienlizenz</h1>
      <p className="mt-2 text-center text-sm text-ink/70">gem. §7 RAVO · Datum: {fmtDate(data.application_date)}</p>

      <section className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold border-b border-border pb-1">Antragsteller</h2>
          <Row label="Name" value={data.applicant_name} />
          <Row label="Reisepassnummer" value={data.applicant_passport} />
          <Row label="Telefonnummer" value={data.applicant_phone} />
        </div>
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold border-b border-border pb-1">Rechtsanwalt</h2>
          <Row label="Name" value={data.lawyer_name} />
          <Row label="Reisepassnummer" value={data.lawyer_passport} />
          <Row label="Telefonnummer" value={data.lawyer_phone} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold border-b border-border pb-1">Zukünftige Familie</h2>
        <Row label="Name der Familie" value={data.family_name} />
        <Row label="Hausnummer" value={data.house_number} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold border-b border-border pb-1">Eidesstattliche Versicherung</h2>
        <p className="text-sm leading-relaxed italic">{swornStatement(data)}</p>
      </section>

      <section className="mt-14 grid gap-10 md:grid-cols-2">
        {[
          { label: "Unterschrift Mandant", value: data.client_signature },
          { label: "Unterschrift Anwalt", value: data.lawyer_signature },
        ].map((s) => (
          <div key={s.label}>
            <div className="h-10 font-display text-2xl italic">{s.value}</div>
            <div className="border-t border-ink/50 pt-1 text-xs text-ink/60">{s.label}</div>
          </div>
        ))}
      </section>
    </article>
  );
}
