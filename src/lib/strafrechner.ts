import { BUSSGELDKATALOG, EXCLUSIONS_MAP, type LawCategory, type LawParagraph } from "./bussgeldkatalog";
import { formatMoney } from "./fees";
import { FIRM_NAME } from "./brand";

export const NOT_GIVEN = "Nicht angegeben";
export const MAX_STAR_LEVEL = 5;
export const LAW_CATEGORIES: LawCategory[] = ["StGB", "WaffG", "BtMG", "StVO"];

export const LAW_LABELS: Record<LawCategory, string> = {
  StGB: "Strafgesetzbuch",
  WaffG: "Waffengesetz",
  BtMG: "Betäubungsmittelgesetz",
  StVO: "Straßenverkehrsordnung",
};

export interface PenaltyOptions {
  /** §5.2a StVO: Wiederholung ab dem 3. Verstoß */
  thirdRepeat52a?: boolean;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Haft-/Sterne-Stufe eines Delikts unter Berücksichtigung des §5.2a-Sonderfalls. */
export function itemStars(item: LawParagraph, options: PenaltyOptions = {}): number | undefined {
  if (!isNum(item.stars)) return undefined;
  if (options.thirdRepeat52a && isNum(item.repeatStars)) return Math.max(item.stars, item.repeatStars);
  return item.stars;
}

/** 1 Stern = 1 Wanted. */
export function itemWanteds(item: LawParagraph, options: PenaltyOptions = {}): number | undefined {
  return itemStars(item, options);
}

// ---------- Anzeige-Formatierung (niemals "true"/"false" anzeigen) ----------

export function formatYesNo(v: boolean | null | undefined): string {
  if (v === true) return "Ja";
  if (v === false) return "Nein";
  return NOT_GIVEN;
}

export function formatText(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : NOT_GIVEN;
}

export function formatFine(v: number | null | undefined): string {
  return isNum(v) ? formatMoney(v) : NOT_GIVEN;
}

export function formatWanteds(n: number | null | undefined): string {
  if (!isNum(n)) return NOT_GIVEN;
  return n === 1 ? "1 Wanted" : `${n} Wanteds`;
}

export function formatStarLevel(n: number | null | undefined): string {
  if (!isNum(n)) return NOT_GIVEN;
  if (n === 0) return "Keine Haft (–)";
  return `${"⭐".repeat(Math.min(n, MAX_STAR_LEVEL))} (${n} ${n === 1 ? "Stern" : "Sterne"})`;
}

/** Kaution eines einzelnen Delikts: ohne Haft entfällt sie, sonst Ja/Nein aus dem Katalog. */
export function formatItemBail(item: LawParagraph, options: PenaltyOptions = {}): string {
  const stars = itemStars(item, options);
  if (stars === undefined) return NOT_GIVEN;
  if (stars === 0) return "Entfällt – keine Haft";
  return formatYesNo(item.bail);
}

/** Zusätzliche Maßnahmen eines Delikts (Einziehung, Entzüge). */
export function itemMeasures(item: LawParagraph): string[] {
  const m: string[] = [];
  if (item.confiscate) m.push(`Einziehung: ${item.confiscate}`);
  if (item.revokeDriverLicense) m.push("Führerscheinentzug");
  if (item.revokeWeaponLicense) m.push("Entzug der Waffenlizenz");
  if (item.revokePilotLicense) m.push("Flugscheinentzug");
  return m;
}

// ---------- Filter ----------

const normParagraph = (p: string) => p.toLowerCase().replace(/§/g, "").replace(/\s+/g, "");

/** "5" trifft §5, §5.1, §5.2a – aber nicht §50. */
export function matchesParagraph(paragraph: string, query: string): boolean {
  const q = normParagraph(query);
  if (!q) return true;
  const p = normParagraph(paragraph);
  if (!p.startsWith(q)) return false;
  const next = p.charAt(q.length);
  return next === "" || !/\d/.test(next) || /\d/.test(q.charAt(q.length - 1)) === false;
}

export function matchesSearch(item: LawParagraph, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.paragraph, item.title, item.info, item.remarks ?? "", item.exclusion, item.category, item.confiscate ?? ""]
    .some((f) => f.toLowerCase().includes(q));
}

// ---------- Gesamtberechnung ----------

export interface PenaltyCalculation {
  count: number;
  totalFine: number;
  /** Summe aller Wanteds (1 Stern = 1 Wanted) */
  totalWanteds: number;
  /** Haft-/Sterne-Stufe der Fallakte, begrenzt auf 5 Sterne */
  starLevel: number;
  hasJail: boolean;
  /** null = entfällt (keine Haft) */
  bailPossible: boolean | null;
  bailBlockers: string[];
  hasFIB: boolean;
  fibReasons: string[];
  hasStA: boolean;
  staReasons: string[];
  revokeDriver: boolean;
  driverReasons: string[];
  revokeWeapon: boolean;
  weaponReasons: string[];
  revokePilot: boolean;
  pilotReasons: string[];
  confiscations: string[];
  exclusionWarnings: string[];
  selectedItems: LawParagraph[];
}

export function calculatePenalty(selectedIds: Iterable<string>, options: PenaltyOptions = {}): PenaltyCalculation {
  const ids = new Set(selectedIds);
  const selectedItems = BUSSGELDKATALOG.filter((item) => ids.has(item.id));

  let totalFine = 0;
  let totalWanteds = 0;
  const fibReasons: string[] = [];
  const staReasons: string[] = [];
  const driverReasons: string[] = [];
  const weaponReasons: string[] = [];
  const pilotReasons: string[] = [];
  const confiscations: string[] = [];
  const bailBlockers: string[] = [];

  for (const item of selectedItems) {
    const label = `${item.paragraph} ${item.category}`;
    totalFine += isNum(item.fine) ? item.fine : 0;
    const stars = itemStars(item, options) ?? 0;
    totalWanteds += stars;
    if (item.fib) fibReasons.push(`${label} (${item.title})`);
    if (item.sta) staReasons.push(`${label} (${item.title})`);
    if (item.revokeDriverLicense) driverReasons.push(label);
    if (item.revokeWeaponLicense) weaponReasons.push(label);
    if (item.revokePilotLicense) pilotReasons.push(label);
    if (item.confiscate) confiscations.push(`${label}: ${item.confiscate}`);
    if (stars > 0 && item.bail !== true) bailBlockers.push(label);
  }

  const hasJail = totalWanteds > 0;

  const exclusionWarnings = EXCLUSIONS_MAP.filter((r) => ids.has(r.p1) && ids.has(r.p2)).map((r) => r.text);
  if (ids.has("stvo-5")) {
    const conflicting = selectedItems.filter(
      (i) => i.category === "StVO" && !["stvo-5", "stvo-2-8", "stvo-15", "stvo-16"].includes(i.id),
    );
    if (conflicting.length > 0) {
      exclusionWarnings.push(
        `§5 StVO schließt alle weiteren StVO-Delikte bei derselben Tat aus (außer §2.8, §15, §16). Betroffen: ${conflicting
          .map((i) => i.paragraph)
          .join(", ")}`,
      );
    }
  }

  return {
    count: selectedItems.length,
    totalFine,
    totalWanteds,
    starLevel: Math.min(totalWanteds, MAX_STAR_LEVEL),
    hasJail,
    bailPossible: hasJail ? bailBlockers.length === 0 : null,
    bailBlockers,
    hasFIB: fibReasons.length > 0,
    fibReasons,
    hasStA: staReasons.length > 0,
    staReasons,
    revokeDriver: driverReasons.length > 0,
    driverReasons,
    revokeWeapon: weaponReasons.length > 0,
    weaponReasons,
    revokePilot: pilotReasons.length > 0,
    pilotReasons,
    confiscations,
    exclusionWarnings,
    selectedItems,
  };
}

export function formatTotalBail(calc: PenaltyCalculation): string {
  if (calc.bailPossible === null) return "Entfällt – keine Haft";
  return calc.bailPossible ? "Ja" : `Nein (ausgeschlossen durch ${calc.bailBlockers.join(", ")})`;
}

// ---------- Fallakte als Text ----------

export interface CaseReportInput {
  calc: PenaltyCalculation;
  options: PenaltyOptions;
  clientName: string;
  caseNumber: string;
  notes: string;
  editor: string;
  date: Date;
}

export function caseReportText({ calc, options, clientName, caseNumber, notes, editor, date }: CaseReportInput): string {
  const line = "=".repeat(54);
  const thin = "-".repeat(54);
  const dateStr = `${date.toLocaleDateString("de-DE")} ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  const out: string[] = [
    line,
    `RECHTSANWALTSKANZLEI „${FIRM_NAME.toUpperCase()}“`,
    "FALLAKTE · STRAF- & BUSSGELDBERECHNUNG",
    line,
    `Datum / Zeit   : ${dateStr}`,
    `Bearbeiter     : ${formatText(editor)}`,
    `Mandant        : ${formatText(clientName)}`,
    `Aktenzeichen   : ${formatText(caseNumber)}`,
  ];
  if (notes.trim()) out.push(`Sachverhalt    : ${notes.trim()}`);
  out.push(thin, `DELIKTE (${calc.count}):`);
  calc.selectedItems.forEach((item, i) => {
    const stars = itemStars(item, options);
    out.push(
      "",
      `${i + 1}. ${item.paragraph} ${item.category} – ${item.title}`,
      `   Geldstrafe        : ${formatFine(item.fine)}`,
      `   Wanteds           : ${formatWanteds(itemWanteds(item, options))}`,
      `   Haft-/Sterne-Stufe: ${formatStarLevel(stars)}`,
      `   Kaution           : ${formatItemBail(item, options)}`,
      `   Übergabe FIB      : ${formatYesNo(item.fib)}`,
      `   Übergabe StA      : ${formatYesNo(item.sta)}`,
      `   Ausschlüsse       : ${formatText(item.exclusion)}${item.exclusion.trim() ? " (nur bei derselben Tat)" : ""}`,
      `   Info              : ${formatText(item.info)}`,
      `   Bemerkungen       : ${formatText(item.remarks)}`,
    );
    if (item.id === "stvo-5-2a") out.push(`   Wiederholung      : ${options.thirdRepeat52a ? "Ab dem 3. Verstoß" : "Unter 3 Verstößen"}`);
    const measures = itemMeasures(item);
    if (measures.length) out.push(`   Maßnahmen         : ${measures.join(", ")}`);
  });
  out.push(
    thin,
    "GESAMTERGEBNIS:",
    `Geldstrafe gesamt : ${formatMoney(calc.totalFine)}`,
    `Wanteds gesamt    : ${formatWanteds(calc.totalWanteds)}`,
    `Haft-/Sterne-Stufe: ${calc.hasJail ? formatStarLevel(calc.starLevel) : "Keine Haft (–)"}${
      calc.totalWanteds > MAX_STAR_LEVEL ? " – Höchststufe erreicht" : ""
    }`,
    `Kaution           : ${formatTotalBail(calc)}`,
    `Übergabe FIB      : ${calc.hasFIB ? `Ja – ${calc.fibReasons.join("; ")}` : "Nein"}`,
    `Übergabe StA      : ${calc.hasStA ? `Ja – ${calc.staReasons.join("; ")}` : "Nein"}`,
  );
  if (calc.revokeDriver) out.push(`Führerscheinentzug: Ja (${calc.driverReasons.join(", ")})`);
  if (calc.revokeWeapon) out.push(`Waffenlizenzentzug: Ja (${calc.weaponReasons.join(", ")})`);
  if (calc.revokePilot) out.push(`Flugscheinentzug  : Ja (${calc.pilotReasons.join(", ")})`);
  if (calc.confiscations.length) out.push(`Einziehung        : ${calc.confiscations.join("; ")}`);
  if (calc.exclusionWarnings.length) {
    out.push("", "AUSSCHLÜSSE (nur bei derselben Tat):", ...calc.exclusionWarnings.map((w) => ` • ${w}`));
  }
  out.push(line);
  return out.join("\n");
}
