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

describe("selfUse KfW loan", () => {
  function buildInput(overrides = {}) {
    const values = { ...DEFAULT_FORM_VALUES, ...overrides };
    const validation = validateFormValues(getEffectiveFormValues(values, true), false);
    const taxValidation = validatePersonalTaxSteps(DEFAULT_PERSONAL_TAX_STEPS);
    if (!validation.input || !taxValidation.parsedSteps) {
      throw new Error("inputs must be valid");
    }
    return createProjectionInput(
      validation.input,
      getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
      false,
      taxValidation.parsedSteps,
      false,
    );
  }

  it("without KfW loan, selfUseRemainingKfwLoan is 0 at year 0", () => {
    const input = buildInput({ selfUseKfwLoanAmount: "0" });
    const result = calculateProjection(input);
    const row0 = result.rows[0];
    expect(row0.selfUseRemainingKfwLoan).toBe(0);
    expect(row0.selfUseKfwInterest).toBe(0);
    expect(row0.selfUseKfwRepayment).toBe(0);
  });

  it("KfW loan boosts initial cash but keeps selfUseWealth neutral at year 0", () => {
    const withoutKfw = buildInput({ selfUseKfwLoanAmount: "0" });
    const withKfw = buildInput({ selfUseKfwLoanAmount: "100000", selfUseKfwLoanInterestRate: "0.01", selfUseKfwLoanTermYears: "10" });

    const withoutResult = calculateProjection(withoutKfw);
    const withResult = calculateProjection(withKfw);

    // Wealth at year 0 should be the same (loan increases cash but is a liability)
    expect(withResult.rows[0].selfUseWealth).toBeCloseTo(withoutResult.rows[0].selfUseWealth, 2);
    expect(withResult.rows[0].selfUseRemainingKfwLoan).toBe(100000);
  });

  it("KfW loan is repaid evenly over the term", () => {
    const input = buildInput({ selfUseKfwLoanAmount: "100000", selfUseKfwLoanInterestRate: "0.01", selfUseKfwLoanTermYears: "10" });
    const result = calculateProjection(input);

    // Each year should repay 10,000 (100,000 / 10 years)
    expect(result.rows[1].selfUseKfwRepayment).toBeCloseTo(10000, 2);
    expect(result.rows[1].selfUseRemainingKfwLoan).toBeCloseTo(90000, 2);

    // After term, loan should be fully repaid
    expect(result.rows[10].selfUseRemainingKfwLoan).toBeCloseTo(0, 2);
  });

  it("KfW annual interest is charged on the remaining balance", () => {
    // Interest rate "1" is a form value string representing 1 % p.a. (divided by 100 in validateFormValues)
    const input = buildInput({ selfUseKfwLoanAmount: "100000", selfUseKfwLoanInterestRate: "1", selfUseKfwLoanTermYears: "10" });
    const result = calculateProjection(input);

    // Year 1: interest = 100,000 * 1% = 1,000
    expect(result.rows[1].selfUseKfwInterest).toBeCloseTo(1000, 2);
    // Year 2: remaining = 90,000; interest = 90,000 * 1% = 900
    expect(result.rows[2].selfUseKfwInterest).toBeCloseTo(900, 2);
  });

  it("after KfW loan is repaid, no more KfW payments occur", () => {
    const input = buildInput({ selfUseKfwLoanAmount: "100000", selfUseKfwLoanInterestRate: "0.01", selfUseKfwLoanTermYears: "10", projectionYears: "15" });
    const result = calculateProjection(input);

    // Year 11 onwards: no KfW payments
    expect(result.rows[11].selfUseKfwRepayment).toBe(0);
    expect(result.rows[11].selfUseKfwInterest).toBe(0);
    expect(result.rows[11].selfUseRemainingKfwLoan).toBe(0);
  });
});

describe("inflation rate", () => {
  // Overrides that guarantee immediate property ownership (no deferred purchase):
  // initialCash = 1 000 000 - 0 - 0 + 0 - 200 000 - 0 = 800 000 > 0
  const immediateOwnershipOverrides = {
    initialCapital: "1000000",
    foundationSetupCost: "0",
    loanAmount: "0",
    buildingValue: "200000",
    landValue: "0",
    realEstateTaxRate: "0",
  };

  function buildInflationInput(inflationRatePct, overrides = {}) {
    const values = {
      ...DEFAULT_FORM_VALUES,
      ...immediateOwnershipOverrides,
      ...overrides,
      inflationRate: String(inflationRatePct),
    };
    const validation = validateFormValues(getEffectiveFormValues(values, true), false);
    const taxValidation = validatePersonalTaxSteps(DEFAULT_PERSONAL_TAX_STEPS);
    if (!validation.input || !taxValidation.parsedSteps) {
      throw new Error("inputs must be valid");
    }
    return createProjectionInput(
      validation.input,
      getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
      false,
      taxValidation.parsedSteps,
      false,
    );
  }

  it("with inflationRate 0, year-1 guvRent equals base annualRent", () => {
    const input = buildInflationInput(0, { monthlyRent: "1000" });
    const result = calculateProjection(input);
    expect(result.rows[1].guvRent).toBeCloseTo(12000, 2);
  });

  it("guvRent grows by inflation factor each year", () => {
    const input = buildInflationInput(10, { monthlyRent: "1000" });
    const result = calculateProjection(input);
    // Year 1: factor = (1.10)^0 = 1 → rent = 12 000
    expect(result.rows[1].guvRent).toBeCloseTo(12000, 2);
    // Year 2: factor = (1.10)^1 = 1.10 → rent = 13 200
    expect(result.rows[2].guvRent).toBeCloseTo(13200, 2);
    // Year 3: factor = (1.10)^2 = 1.21 → rent = 14 520
    expect(result.rows[3].guvRent).toBeCloseTo(14520, 2);
  });

  it("guvAdminCost grows by inflation factor each year", () => {
    const input = buildInflationInput(10, { annualAdminCost: "1000" });
    const result = calculateProjection(input);
    // Year 1: factor = 1 → cost = 1 000
    expect(result.rows[1].guvAdminCost).toBeCloseTo(1000, 2);
    // Year 2: factor = 1.10 → cost = 1 100
    expect(result.rows[2].guvAdminCost).toBeCloseTo(1100, 2);
  });

  it("inflation increases foundationWealth over no-inflation baseline when rent exceeds admin cost", () => {
    // monthly rent 1 000 → annual rent 12 000, admin cost 1 500 → net positive, so inflation helps
    const baseInput = buildInflationInput(0, { monthlyRent: "1000", annualAdminCost: "1500" });
    const inflatedInput = buildInflationInput(2, { monthlyRent: "1000", annualAdminCost: "1500" });
    const baseResult = calculateProjection(baseInput);
    const inflatedResult = calculateProjection(inflatedInput);
    const lastYear = inflatedResult.rows.length - 1;
    expect(inflatedResult.rows[lastYear].foundationWealth).toBeGreaterThan(
      baseResult.rows[lastYear].foundationWealth,
    );
  });
});
