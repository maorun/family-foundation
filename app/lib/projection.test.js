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
  validateMaintenanceEvents,
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
    // No Vorabpauschale when etfBalance at start of year is 0 (all cash is new investment)
    expect(result.vorabTax).toBe(0);
    expect(result.etfLiquidationValue).toBeGreaterThan(0);
  });

  it("caps taxable Vorabpauschale at statutory base yield", () => {
    // etfBalance = 10000 (start of year), cash = 0 (no new investment)
    // baseYield = 10000 × 0.02 × 0.7 = 140; grossReturn = 10000 × 0.05 = 500
    // taxableVorab = min(500, 140) × (1 - 0.3) = 98; vorabTax = 98 × 0.25 = 24.5
    const result = applyEtfYear({
      cash: 0,
      etfBalance: 10000,
      etfContributions: 10000,
      etfTaxedGains: 0,
      returnRate: 0.05,
      basisInterestRate: 0.02,
      taxRate: 0.25,
      partialExemptionRate: 0.3,
      saverAllowance: 0,
    });

    expect(result.vorabTax).toBeCloseTo(24.5, 2);
    expect(result.vorabTaxableGain).toBeCloseTo(98, 2);
  });

  it("keeps Vorabpauschale capped by actual value increase", () => {
    // etfBalance = 10000 (start of year), cash = 0 (no new investment)
    // baseYield = 10000 × 0.05 × 0.7 = 350; grossReturn = 10000 × 0.01 = 100
    // taxableVorab = min(100, 350) × (1 - 0.3) = 70; vorabTax = 70 × 0.25 = 17.5
    const result = applyEtfYear({
      cash: 0,
      etfBalance: 10000,
      etfContributions: 10000,
      etfTaxedGains: 0,
      returnRate: 0.01,
      basisInterestRate: 0.05,
      taxRate: 0.25,
      partialExemptionRate: 0.3,
      saverAllowance: 0,
    });

    expect(result.vorabTax).toBeCloseTo(17.5, 2);
    expect(result.vorabTaxableGain).toBeCloseTo(70, 2);
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

describe("calculateProjection – Destinatärszahlungen", () => {
  function makeInput(overrides = {}) {
    const formValues = { ...DEFAULT_FORM_VALUES, ...overrides };
    const validation = validateFormValues(
      getEffectiveFormValues(formValues, false, true),
      false,
    );
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

  it("zero distribution (default) results in no distribution fields", () => {
    const input = makeInput({ annualDistribution: "0" });
    const result = calculateProjection(input);
    for (const row of result.rows.slice(1)) {
      expect(row.distributionGross).toBe(0);
      expect(row.distributionTax).toBe(0);
      expect(row.distributionNet).toBe(0);
    }
  });

  it("gross/net distribution computed correctly with saver allowance", () => {
    // 2 Destinatäre, je 6.000 € Brutto → gesamt 12.000 €
    // Sparerpauschbetrag 1.000 € je Person → steuerpflichtiger Anteil je 5.000 €
    // Steuer: 5.000 × 26,375 % = 1.318,75 € × 2 = 2.637,50 €
    // Netto: 12.000 − 2.637,50 = 9.362,50 €
    const input = makeInput({
      annualDistribution: "12000",
      destinatarCount: "2",
      destinatarTaxRate: "26.375",
      destinatarSaverAllowance: "1000",
    });
    const result = calculateProjection(input);
    const row1 = result.rows[1];
    expect(row1.distributionGross).toBeCloseTo(12_000, 2);
    expect(row1.distributionTax).toBeCloseTo(2_637.5, 2);
    expect(row1.distributionNet).toBeCloseTo(9_362.5, 2);
  });

  it("gross/net distribution without saver allowance (allowance = 0)", () => {
    // 1 Destinatär, 10.000 € Brutto, kein Freibetrag, 26,375 % Steuer
    // Netto: 10.000 × (1 − 0,26375) = 7.362,50 €
    const input = makeInput({
      annualDistribution: "10000",
      destinatarCount: "1",
      destinatarTaxRate: "26.375",
      destinatarSaverAllowance: "0",
    });
    const result = calculateProjection(input);
    const row1 = result.rows[1];
    expect(row1.distributionGross).toBeCloseTo(10_000, 2);
    expect(row1.distributionTax).toBeCloseTo(2_637.5, 2);
    expect(row1.distributionNet).toBeCloseTo(7_362.5, 2);
  });

  it("foundation wealth decreases by gross distribution each year", () => {
    const baseInput = makeInput({ annualDistribution: "0" });
    const distInput = makeInput({
      annualDistribution: "5000",
      destinatarCount: "1",
      destinatarTaxRate: "0",
      destinatarSaverAllowance: "0",
    });
    const baseResult = calculateProjection(baseInput);
    const distResult = calculateProjection(distInput);
    const lastBase = baseResult.rows[baseResult.rows.length - 1];
    const lastDist = distResult.rows[distResult.rows.length - 1];
    expect(lastDist.foundationWealth).toBeLessThan(lastBase.foundationWealth);
  });
});

describe("bullet loan – income tax deferral", () => {
  // Overrides ensuring immediate property ownership (initialCash >= 0):
  // initialCash = 500 000 - 0 - 0 + 300 000 - 200 000 - 0 = 600 000 > 0
  const baseOverrides = {
    initialCapital: "500000",
    foundationSetupCost: "0",
    loanAmount: "300000",
    buildingValue: "200000",
    landValue: "0",
    realEstateTaxRate: "0",
    loanInterestRate: "5",   // 5 % p.a. → 15 000 € interest per year on 300 000 €
    loanTermYears: "3",
    projectionYears: "5",
    saverAllowance: "0",     // disable saver allowance for simpler tax arithmetic
  };

  function buildBulletInput(overrides = {}) {
    const values = { ...DEFAULT_FORM_VALUES, ...baseOverrides, ...overrides };
    const validation = validateFormValues(getEffectiveFormValues(values, true), true);
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
      true,  // bulletLoan
    );
  }

  it("no income tax on interest during the loan term (years 1 to T-1)", () => {
    const input = buildBulletInput();
    const result = calculateProjection(input);

    // Years 1 and 2 are within the term (loanTermYears = 3); no tax should be charged.
    expect(result.rows[1].personGuvTax).toBe(0);
    expect(result.rows[2].personGuvTax).toBe(0);
  });

  it("lender receives full gross interest in non-repayment years", () => {
    // loanAmount = 300 000, rate = 5 % → annualInterest = 15 000
    const input = buildBulletInput();
    const result = calculateProjection(input);

    expect(result.rows[1].personGuvInterest).toBeCloseTo(15000, 2);
    // personGuvResult = interest - tax = 15 000 - 0 = 15 000
    expect(result.rows[1].personGuvResult).toBeCloseTo(15000, 2);
  });

  it("all accumulated interest tax is paid in the repayment year", () => {
    // 3 years × 15 000 € × 42 % (DEFAULT_PERSONAL_TAX_STEPS rate) = 18 900 €
    const input = buildBulletInput();
    const result = calculateProjection(input);
    const repaymentRow = result.rows[3]; // year === loanTermYears

    expect(repaymentRow.personGuvTax).toBeCloseTo(18900, 2);
  });

  it("total net interest over the term equals gross minus total tax (same as annual taxation)", () => {
    // Non-bullet: tax paid each year. Bullet: same total, different timing.
    // Compare against a non-bullet loan with 0 % repayment so the outstanding balance is identical.
    const bulletInput = buildBulletInput();

    const annualValues = { ...DEFAULT_FORM_VALUES, ...baseOverrides, loanRepaymentRate: "0" };
    const annualValidation = validateFormValues(getEffectiveFormValues(annualValues, true), false);
    const taxValidation = validatePersonalTaxSteps(DEFAULT_PERSONAL_TAX_STEPS);
    if (!annualValidation.input || !taxValidation.parsedSteps) {
      throw new Error("inputs must be valid");
    }
    const annualInput = createProjectionInput(
      annualValidation.input,
      getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
      false,
      taxValidation.parsedSteps,
      false,
      false, // NOT a bullet loan
    );

    const bulletResult = calculateProjection(bulletInput);
    const annualResult = calculateProjection(annualInput);

    // Cumulative tax at the repayment year (year 3) must equal what annual taxation would have charged.
    expect(bulletResult.rows[3].personCumulativeInterestTax).toBeCloseTo(
      annualResult.rows[3].personCumulativeInterestTax,
      2,
    );
  });

  it("no tax in any year after the loan is fully repaid", () => {
    const input = buildBulletInput({ projectionYears: "5" });
    const result = calculateProjection(input);

    // Years 4 and 5 have no remaining loan → no interest, no tax
    expect(result.rows[4].personGuvTax).toBe(0);
    expect(result.rows[5].personGuvTax).toBe(0);
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

describe("validateMaintenanceEvents", () => {
  it("accepts full type events", () => {
    const { invalidIndices, parsedEvents } = validateMaintenanceEvents([
      { year: "2", amount: "3000", type: "full" },
    ]);
    expect(invalidIndices).toEqual([]);
    expect(parsedEvents).toHaveLength(1);
    expect(parsedEvents[0]).toMatchObject({ year: 2, amount: 3000, type: "full" });
  });

  it("accepts spread type with valid spreadYears", () => {
    const { invalidIndices, parsedEvents } = validateMaintenanceEvents([
      { year: "3", amount: "5000", type: "spread", spreadYears: "3" },
    ]);
    expect(invalidIndices).toEqual([]);
    expect(parsedEvents[0]).toMatchObject({ year: 3, amount: 5000, type: "spread", spreadYears: 3 });
  });

  it("defaults spreadYears to 5 when omitted for spread type", () => {
    const { invalidIndices, parsedEvents } = validateMaintenanceEvents([
      { year: "1", amount: "1000", type: "spread" },
    ]);
    expect(invalidIndices).toEqual([]);
    expect(parsedEvents[0].spreadYears).toBe(5);
  });

  it("rejects spread type with spreadYears > 5", () => {
    const { invalidIndices } = validateMaintenanceEvents([
      { year: "1", amount: "1000", type: "spread", spreadYears: "6" },
    ]);
    expect(invalidIndices).toEqual([0]);
  });

  it("rejects spread type with spreadYears < 1", () => {
    const { invalidIndices } = validateMaintenanceEvents([
      { year: "1", amount: "1000", type: "spread", spreadYears: "0" },
    ]);
    expect(invalidIndices).toEqual([0]);
  });

  it("rejects afa type (removed)", () => {
    const { invalidIndices } = validateMaintenanceEvents([
      { year: "1", amount: "1000", type: "afa" },
    ]);
    expect(invalidIndices).toEqual([0]);
  });
});

describe("spread maintenance deduction", () => {
  // Overrides that guarantee immediate property ownership with no inflation or loan.
  const baseOverrides = {
    initialCapital: "1000000",
    foundationSetupCost: "0",
    loanAmount: "0",
    buildingValue: "200000",
    landValue: "0",
    realEstateTaxRate: "0",
    depreciationRate: "2",
    monthlyRent: "0",
    annualAdminCost: "0",
    inflationRate: "0",
    projectionYears: "10",
    saverAllowance: "0",
  };

  function buildInputWithMaintenance(maintenanceEvents) {
    const values = { ...DEFAULT_FORM_VALUES, ...baseOverrides };
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
      false,
      false,
      false,
      maintenanceEvents,
    );
  }

  it("spread over 5 years deducts 1/5 of amount each year for 5 years", () => {
    const events = [{ year: 1, amount: 5000, type: "spread", spreadYears: 5 }];
    const input = buildInputWithMaintenance(events);
    const result = calculateProjection(input);

    expect(result.rows[1].guvMaintenanceSpreadDeduction).toBeCloseTo(1000, 2);
    expect(result.rows[2].guvMaintenanceSpreadDeduction).toBeCloseTo(1000, 2);
    expect(result.rows[3].guvMaintenanceSpreadDeduction).toBeCloseTo(1000, 2);
    expect(result.rows[4].guvMaintenanceSpreadDeduction).toBeCloseTo(1000, 2);
    expect(result.rows[5].guvMaintenanceSpreadDeduction).toBeCloseTo(1000, 2);
    expect(result.rows[6].guvMaintenanceSpreadDeduction).toBeCloseTo(0, 2);
  });

  it("spread over 1 year deducts full amount only in the event year", () => {
    const events = [{ year: 2, amount: 6000, type: "spread", spreadYears: 1 }];
    const input = buildInputWithMaintenance(events);
    const result = calculateProjection(input);

    expect(result.rows[1].guvMaintenanceSpreadDeduction).toBeCloseTo(0, 2);
    expect(result.rows[2].guvMaintenanceSpreadDeduction).toBeCloseTo(6000, 2);
    expect(result.rows[3].guvMaintenanceSpreadDeduction).toBeCloseTo(0, 2);
  });

  it("spread deduction reduces taxableResult (guvResult) in each spread year", () => {
    const events = [{ year: 1, amount: 3000, type: "spread", spreadYears: 3 }];
    const input = buildInputWithMaintenance(events);
    const result = calculateProjection(input);

    // rent = 0, adminCost = 0, interest = 0, depreciation = building * 2%
    const depreciation = 200000 * 0.02;
    const spreadPortion = 3000 / 3;
    expect(result.rows[1].guvResult).toBeCloseTo(-depreciation - spreadPortion, 2);
    expect(result.rows[2].guvResult).toBeCloseTo(-depreciation - spreadPortion, 2);
    expect(result.rows[3].guvResult).toBeCloseTo(-depreciation - spreadPortion, 2);
    expect(result.rows[4].guvResult).toBeCloseTo(-depreciation, 2);
  });

  it("full type deducts entire amount in the event year only", () => {
    const events = [{ year: 2, amount: 4000, type: "full", spreadYears: 5 }];
    const input = buildInputWithMaintenance(events);
    const result = calculateProjection(input);

    expect(result.rows[1].guvMaintenanceFullDeduction).toBeCloseTo(0, 2);
    expect(result.rows[2].guvMaintenanceFullDeduction).toBeCloseTo(4000, 2);
    expect(result.rows[3].guvMaintenanceFullDeduction).toBeCloseTo(0, 2);
    expect(result.rows[2].guvMaintenanceSpreadDeduction).toBeCloseTo(0, 2);
  });
});
