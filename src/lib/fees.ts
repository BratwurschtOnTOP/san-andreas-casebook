// Gebührenordnung gem. §4 Abs. 2 RAVO (Höchstbeträge). Mirrors public.ravo_max_fee in the database.

export type ServiceType =
  | "beratung"
  | "verteidigung"
  | "revisionsantrag"
  | "familienantrag"
  | "sonstiger_antrag"
  | "schnellverfahren";

export type LawyerType = "rechtsanwalt" | "orgaanwalt";

export interface ServiceTypeInfo {
  label: string;
  paragraph: string;
  /** Betrag pro Einheit bzw. Pauschale */
  rate: number;
  /** Länge einer angefangenen Einheit in Minuten; null = Pauschale */
  unitMinutes: number | null;
  rule: string;
}

export const SERVICE_TYPES: Record<ServiceType, ServiceTypeInfo> = {
  beratung: {
    label: "Beratung eines Mandanten",
    paragraph: "§4 Abs. 2 lit. a",
    rate: 25_000,
    unitMinutes: 15,
    rule: "max. 25.000 $ pro angefangener Viertelstunde",
  },
  verteidigung: {
    label: "Verteidigung vor ordentlichem Gericht / Revisionsgericht",
    paragraph: "§4 Abs. 2 lit. b",
    rate: 115_000,
    unitMinutes: 30,
    rule: "max. 115.000 $ pro angefangener halber Stunde",
  },
  revisionsantrag: {
    label: "Schriftlicher Revisionsantrag",
    paragraph: "§4 Abs. 2 lit. c",
    rate: 125_000,
    unitMinutes: null,
    rule: "max. 125.000 $ pauschal",
  },
  familienantrag: {
    label: "Schriftlicher Antrag auf Familiengründung",
    paragraph: "§4 Abs. 2 lit. d",
    rate: 75_000,
    unitMinutes: null,
    rule: "max. 75.000 $ pauschal",
  },
  sonstiger_antrag: {
    label: "Sonstiger schriftlicher Antrag",
    paragraph: "§4 Abs. 2 lit. e",
    rate: 100_000,
    unitMinutes: null,
    rule: "max. 100.000 $ pauschal",
  },
  schnellverfahren: {
    label: "Verteidigung im Schnellverfahren",
    paragraph: "§4 Abs. 2 lit. f",
    rate: 125_000,
    unitMinutes: 30,
    rule: "max. 125.000 $ pro angefangener halber Stunde",
  },
};

export const SERVICE_TYPE_ORDER: ServiceType[] = [
  "beratung",
  "verteidigung",
  "schnellverfahren",
  "revisionsantrag",
  "familienantrag",
  "sonstiger_antrag",
];

export function isTimed(type: ServiceType): boolean {
  return SERVICE_TYPES[type].unitMinutes !== null;
}

/** Anzahl angefangener Einheiten (mindestens 1). */
export function billableUnits(type: ServiceType, minutes: number | null | undefined): number {
  const unit = SERVICE_TYPES[type].unitMinutes;
  if (unit === null) return 1;
  const m = Math.max(1, Math.floor(Number(minutes) || 0));
  return Math.max(1, Math.ceil(m / unit));
}

/** Zulässiger Höchstbetrag. Orgaanwälte vertreten kostenfrei, außer beim Familienantrag (§1, §8). */
export function maxFee(
  type: ServiceType,
  minutes: number | null | undefined,
  lawyerType: LawyerType = "rechtsanwalt",
): number {
  if (lawyerType === "orgaanwalt" && type !== "familienantrag") return 0;
  return SERVICE_TYPES[type].rate * billableUnits(type, minutes);
}

export function feeAllowed(
  fee: number,
  type: ServiceType,
  minutes: number | null | undefined,
  lawyerType: LawyerType = "rechtsanwalt",
): boolean {
  return fee >= 0 && fee <= maxFee(type, minutes, lawyerType);
}

const money = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
export function formatMoney(value: number | null | undefined): string {
  return `${money.format(Number(value) || 0)} $`;
}

/** Einsichtszeitraum gem. §3 RAVO: nur die letzten 14 Tage. */
export const REVIEW_WINDOW_DAYS = 14;
export function reviewWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
