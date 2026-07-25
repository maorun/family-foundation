import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM_VALUES,
  DEFAULT_PERSONAL_TAX_STEPS,
  DEFAULT_RELATIONSHIP_ID,
  applyEtfYear,
  calculateProjection,
  computePartialEtfSale,
  createProjectionInput,
  getEffectiveFormValues,
  getRelationshipOption,
  validateFormValues,
  validatePersonalTaxSteps,
} from "./projection";

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
      taxRate: 0.25,
      partialExemptionRate: 0.3,
      saverAllowance: 0,
    });

    expect(result.cashAfterInvestment).toBe(0);
    expect(result.etfBalanceAfterTax).toBeGreaterThan(10000);
    expect(result.vorabTax).toBeGreaterThanOrEqual(0);
    expect(result.etfLiquidationValue).toBeGreaterThan(0);
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
});
