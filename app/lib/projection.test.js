import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM_VALUES,
  DEFAULT_PERSONAL_TAX_STEPS,
  DEFAULT_RELATIONSHIP_ID,
  applyEtfYear,
  calculateGiftTaxByBrackets,
  calculateProjection,
  computePartialEtfSale,
  createProjectionInput,
  getEffectiveFormValues,
  getRelationshipOption,
  validateFormValues,
  validatePersonalTaxSteps,
} from "./projection";

describe("calculateGiftTaxByBrackets", () => {
  it("returns 0 for zero or negative taxable amount", () => {
    expect(calculateGiftTaxByBrackets(0, "I")).toBe(0);
    expect(calculateGiftTaxByBrackets(-1000, "I")).toBe(0);
  });

  it("applies lowest bracket rate for amounts within first bracket (class I)", () => {
    // 50,000 € ≤ 75,000 € → 7 %
    expect(calculateGiftTaxByBrackets(50_000, "I")).toBeCloseTo(3_500, 2);
  });

  it("applies correct rate for amounts within second bracket (class I)", () => {
    // 200,000 € in 11 %-Stufe (75,000–300,000 €); Härteklausel greift nicht
    // Grenzwert vorige Stufe: 75,000 × 7 % = 5,250 €
    // Steuer: 200,000 × 11 % = 22,000 €
    // Mehrbetrag: 22,000 − 5,250 = 16,750 €; 50 % des Überschusses: 0.5 × 125,000 = 62,500 € → kein Cap
    expect(calculateGiftTaxByBrackets(200_000, "I")).toBeCloseTo(22_000, 2);
  });

  it("applies § 19 Abs. 3 ErbStG hardship clause at bracket boundary (class I)", () => {
    // 76,000 € liegt knapp über der 75,000 €-Grenze
    // Reguläre Steuer: 76,000 × 11 % = 8,360 €
    // Steuer in vorletzter Stufe: 75,000 × 7 % = 5,250 €
    // Mehrbetrag: 8,360 − 5,250 = 3,110 €; 50 % des Überschusses: 0.5 × 1,000 = 500 € → Cap greift!
    // Härtebetrag: 5,250 + 500 = 5,750 €
    expect(calculateGiftTaxByBrackets(76_000, "I")).toBeCloseTo(5_750, 2);
  });

  it("applies correct flat rate for class III within first bracket", () => {
    // 1,000,000 € ≤ 6,000,000 € → 30 %
    expect(calculateGiftTaxByBrackets(1_000_000, "III")).toBeCloseTo(300_000, 2);
  });

  it("applies higher rate for class III above 6,000,000 € boundary", () => {
    // 6,000,001 € → 50 %; Härteklausel: 6,000,000 × 30 % = 1,800,000 €; excess = 1 €; cap = 0.5 €
    // 6,000,001 × 50 % = 3,000,000.50 €; Mehrbetrag = 1,200,000.50 € >> 0.5 € → Cap greift
    expect(calculateGiftTaxByBrackets(6_000_001, "III")).toBeCloseTo(1_800_000.5, 1);
  });

  it("applies class II rates correctly", () => {
    // 400,000 € in Steuerklasse II → Stufe 300,000–600,000 €: 25 %
    // Grenzwert vorige Stufe: 300,000 × 20 % = 60,000 €
    // Steuer: 400,000 × 25 % = 100,000 €; Mehrbetrag: 40,000 €; 50 % Überschuss: 0.5 × 100,000 = 50,000 → kein Cap
    expect(calculateGiftTaxByBrackets(400_000, "II")).toBeCloseTo(100_000, 2);
  });
});

describe("computePartialEtfSale", () => {
  it("returns zero sale for non-positive inputs", () => {
    expect(
      computePartialEtfSale(1000, 0, 0, 0, 0.25, 0.3),
    ).toEqual({ fraction: 0, grossSale: 0, saleTax: 0, netProceeds: 0 });
  });

  it("calculates proportional partial sale", () => {
    const result = computePartialEtfSale(5000, 10000, 8000, 100, 0.25, 0.3);
    expect(result.fraction).toBeGreaterThan(0);
    expect(result.fraction).toBeLessThanOrEqual(1);
    expect(result.grossSale).toBeGreaterThan(0);
    expect(result.netProceeds).toBeGreaterThan(0);
    expect(result.saleTax).toBeGreaterThanOrEqual(0);
  });
});

describe("applyEtfYear", () => {
  it("invests positive cash and applies return/tax", () => {
    const result = applyEtfYear({
      cash: 10000,
      etfBalance: 0,
      etfContributions: 0,
      etfTaxedGains: 0,
      returnRate: 0.05,
      basisInterestRate: 0.025,
      taxRate: 0.25,
      partialExemptionRate: 0.3,
      saverAllowance: 0,
    });

    expect(result.cashAfterInvestment).toBe(0);
    expect(result.etfBalanceAfterTax).toBeGreaterThan(10000);
    expect(result.vorabTax).toBeGreaterThanOrEqual(0);
    expect(result.etfLiquidationValue).toBeGreaterThan(0);
  });

  it("caps taxable Vorabpauschale at statutory base yield", () => {
    const result = applyEtfYear({
      cash: 10000,
      etfBalance: 0,
      etfContributions: 0,
      etfTaxedGains: 0,
      returnRate: 0.05,
      basisInterestRate: 0.02,
      taxRate: 0.25,
      partialExemptionRate: 0.3,
      saverAllowance: 0,
    });

    expect(result.vorabTax).toBeCloseTo(24.5, 2);
  });

  it("keeps Vorabpauschale capped by actual value increase", () => {
    const result = applyEtfYear({
      cash: 10000,
      etfBalance: 0,
      etfContributions: 0,
      etfTaxedGains: 0,
      returnRate: 0.01,
      basisInterestRate: 0.05,
      taxRate: 0.25,
      partialExemptionRate: 0.3,
      saverAllowance: 0,
    });

    expect(result.vorabTax).toBeCloseTo(17.5, 2);
  });
});

describe("calculateProjection", () => {
  it("produces timeline rows from validated defaults", () => {
    const validation = validateFormValues(getEffectiveFormValues(DEFAULT_FORM_VALUES, false), false);
    const taxValidation = validatePersonalTaxSteps(DEFAULT_PERSONAL_TAX_STEPS);
    if (!validation.input || !taxValidation.parsedSteps) {
      throw new Error("default inputs must be valid");
    }
    const input = createProjectionInput(
      validation.input,
      getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
      false,
      taxValidation.parsedSteps,
      false,
      false,
      false,
      false,
      [],
      false,
    );

    const result = calculateProjection(input);
    expect(result.rows.length).toBe(input.projectionYears + 1);
    expect(result.rows[0].year).toBe(0);
    expect(result.rows.at(-1)?.year).toBe(input.projectionYears);
  });

  it("deducts one-time foundation setup costs at year 0", () => {
    const baseValues = {
      ...DEFAULT_FORM_VALUES,
      foundationSetupCost: "0",
    };
    const withCostValues = {
      ...DEFAULT_FORM_VALUES,
      foundationSetupCost: "12000",
    };

    const baseValidation = validateFormValues(getEffectiveFormValues(baseValues, false), false);
    const withCostValidation = validateFormValues(getEffectiveFormValues(withCostValues, false), false);
    const taxValidation = validatePersonalTaxSteps(DEFAULT_PERSONAL_TAX_STEPS);
    if (!baseValidation.input || !withCostValidation.input || !taxValidation.parsedSteps) {
      throw new Error("inputs must be valid");
    }

    const baseResult = calculateProjection(
      createProjectionInput(
        baseValidation.input,
        getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
        false,
        taxValidation.parsedSteps,
        false,
      ),
    );
    const withCostResult = calculateProjection(
      createProjectionInput(
        withCostValidation.input,
        getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
        false,
        taxValidation.parsedSteps,
        false,
      ),
    );

    expect(withCostResult.foundationSetupCost).toBe(12000);
    expect(withCostResult.initialCash).toBeCloseTo(baseResult.initialCash - 12000, 2);
    expect(withCostResult.rows[0].taxableResult).toBeCloseTo(baseResult.rows[0].taxableResult - 12000, 2);
  });
});
