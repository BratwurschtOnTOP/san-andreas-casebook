import { describe, expect, it } from "vitest";
import { maxFee, feeAllowed, reviewWindowStart } from "./fees";

describe("Gebührenordnung §4 RAVO", () => {
  it("Beratung: 25.000 $ pro angefangener Viertelstunde", () => {
    expect(maxFee("beratung", 15)).toBe(25_000);
    expect(maxFee("beratung", 16)).toBe(50_000);
    expect(maxFee("beratung", 45)).toBe(75_000);
  });

  it("Verteidigung vor ordentlichem Gericht: 115.000 $ pro angefangener halber Stunde", () => {
    expect(maxFee("verteidigung", 30)).toBe(115_000);
    expect(maxFee("verteidigung", 31)).toBe(230_000);
  });

  it("Schnellverfahren: 125.000 $ pro angefangener halber Stunde", () => {
    expect(maxFee("schnellverfahren", 10)).toBe(125_000);
    expect(maxFee("schnellverfahren", 61)).toBe(375_000);
  });

  it("Pauschalen: Revision 125.000 $, Familie 75.000 $, Sonstige 100.000 $", () => {
    expect(maxFee("revisionsantrag", null)).toBe(125_000);
    expect(maxFee("familienantrag", null)).toBe(75_000);
    expect(maxFee("sonstiger_antrag", null)).toBe(100_000);
  });

  it("Gebühr über dem Höchstbetrag ist unzulässig", () => {
    expect(feeAllowed(75_000, "familienantrag", null)).toBe(true);
    expect(feeAllowed(75_001, "familienantrag", null)).toBe(false);
  });

  it("Orgaanwalt vertritt kostenfrei, außer beim Familienantrag", () => {
    expect(maxFee("beratung", 30, "orgaanwalt")).toBe(0);
    expect(maxFee("familienantrag", null, "orgaanwalt")).toBe(75_000);
  });

  it("Einsicht umfasst nur die letzten 14 Tage", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(reviewWindowStart(now).toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });
});
