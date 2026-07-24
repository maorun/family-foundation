"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const FIELD_DEFINITIONS = [
  {
    id: "initialCapital",
    label: "Stiftungskapital bei Gründung (€)",
    min: 0,
    step: "1000",
    defaultValue: 100000,
  },
  {
    id: "annualAdminCost",
    label: "Verwaltungskosten p.a. (€)",
    min: 0,
    step: "100",
    defaultValue: 1500,
  },
  {
    id: "loanAmount",
    label: "Darlehensbetrag (€)",
    min: 0,
    step: "1000",
    defaultValue: 300000,
  },
  {
    id: "loanInterestRate",
    label: "Darlehenszins p.a. (%)",
    min: 0,
    step: "0.1",
    defaultValue: 3,
  },
  {
    id: "loanRepaymentRate",
    label: "Tilgung p.a. (% vom Ursprungsdarlehen)",
    min: 0,
    step: "0.1",
    defaultValue: 2,
  },
  {
    id: "loanTermYears",
    label: "Laufzeit des Darlehens (Jahre)",
    min: 1,
    max: 200,
    step: "1",
    integer: true,
    defaultValue: 10,
    conditionalField: "bulletLoan",
  },
  {
    id: "buildingValue",
    label: "Gebäudewert (€)",
    min: 0,
    step: "1000",
    defaultValue: 200000,
    realEstate: true,
  },
  {
    id: "landValue",
    label: "Grundstückswert (€)",
    min: 0,
    step: "1000",
    defaultValue: 200000,
    realEstate: true,
  },
  {
    id: "realEstateTaxRate",
    label: "Grunderwerbsteuer (%)",
    min: 0,
    max: 10,
    step: "0.5",
    defaultValue: 5.0,
    realEstate: true,
  },
  {
    id: "monthlyRent",
    label: "Monatliche Miete (€)",
    min: 0,
    step: "50",
    defaultValue: 1500,
    realEstate: true,
  },
  {
    id: "depreciationRate",
    label: "AfA auf das Gebäude p.a. (%)",
    min: 0,
    step: "0.1",
    defaultValue: 2,
    realEstate: true,
  },
  {
    id: "etfReturnRate",
    label: "ETF-Rendite p.a. (%)",
    min: 0,
    step: "0.1",
    defaultValue: 5,
  },
  {
    id: "foundationEtfTaxRate",
    label: "ETF-Steuersatz Stiftung (%)",
    min: 0,
    max: 100,
    step: "0.1",
    defaultValue: 15,
  },
  {
    id: "privateEtfTaxRate",
    label: "ETF-Steuersatz Privat/Vergleich (%)",
    min: 0,
    max: 100,
    step: "0.1",
    defaultValue: 26.375,
  },
  {
    id: "saverAllowance",
    label: "Sparerpauschbetrag Privatperson (€/Jahr)",
    min: 0,
    step: "100",
    defaultValue: 1000,
  },
  {
    id: "projectionYears",
    label: "Betrachtungszeitraum (Jahre)",
    min: 1,
    max: 200,
    step: "1",
    integer: true,
    defaultValue: 10,
  },
];

// Modellannahme: Vereinfachte feste Schenkungssteuer je Begünstigtenkreis
// mit pauschalem Freibetrag gemäß gewählter Verwandtschaftsgruppe.
// (ohne Stufenlogik und Sonderfälle).
const RELATIONSHIP_OPTIONS = [
  {
    id: "class1-children-only",
    label: "Reine Kinder-Stiftung: ausschließlich Ehe-/Lebenspartner oder eigene Kinder (Steuerklasse I, Freibetrag 400.000 €)",
    shortLabel: "Steuerklasse I (400.000 €)",
    giftTaxRate: 0.15,
    giftTaxAllowance: 400_000,
  },
  {
    id: "class1-multigeneration",
    label: "Mehrgenerationen-Stiftung: auch Enkel/Urenkel als (spätere) Begünstigte (Steuerklasse I, Freibetrag 100.000 €)",
    shortLabel: "Steuerklasse I (100.000 €)",
    giftTaxRate: 0.15,
    giftTaxAllowance: 100_000,
  },
  {
    id: "class2",
    label: "Erweiterte Familie: z. B. Geschwister, Nichten/Neffen, Schwiegerkinder (Steuerklasse II, Freibetrag 20.000 €)",
    shortLabel: "Steuerklasse II (20.000 €)",
    giftTaxRate: 0.25,
    giftTaxAllowance: 20_000,
  },
  {
    id: "class3",
    label: "Nicht verwandt / Dritte (Steuerklasse III, Freibetrag 20.000 €)",
    shortLabel: "Steuerklasse III (20.000 €)",
    giftTaxRate: 0.3,
    giftTaxAllowance: 20_000,
  },
];

const DEFAULT_RELATIONSHIP_ID = RELATIONSHIP_OPTIONS[0].id;

const DEFAULT_PERSONAL_TAX_STEPS = [{ fromYear: "1", rate: "42" }];

// Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG): fiktive Erbschaft alle 30 Jahre
const ERBERSATZ_CYCLE_YEARS = 30;
const ERBERSATZ_CHILDREN = 2;
const ERBERSATZ_CHILD_ALLOWANCE = 400_000; // Freibetrag je Kind, Steuerklasse I
const ERBERSATZ_TAX_RATE = 0.15; // vereinfachter Pauschalsatz, Steuerklasse I (Kinder)
const FOUNDATION_ETF_PARTIAL_EXEMPTION_RATE = 0.8; // 80 % gem. § 20 InvStG für körperschaftsteuerpflichtige Anleger (Aktienfonds)
const PRIVATE_ETF_PARTIAL_EXEMPTION_RATE = 0.3; // 30 % gem. § 20 InvStG für private Anleger (Aktienfonds)
// Körperschaftsteuer (§ 23 Abs. 1 KStG) für Familienstiftungen
const KST_RATE = 0.15;
const SOLZ_ON_KST = 0.055; // Solidaritätszuschlag auf KSt
const KST_COMBINED_RATE = KST_RATE * (1 + SOLZ_ON_KST); // 15,825 %

const BUNDESLAENDER = [
  { name: "Baden-Württemberg", rate: 5.0 },
  { name: "Bayern", rate: 3.5 },
  { name: "Berlin", rate: 6.0 },
  { name: "Brandenburg", rate: 6.5 },
  { name: "Bremen", rate: 5.0 },
  { name: "Hamburg", rate: 5.5 },
  { name: "Hessen", rate: 6.0 },
  { name: "Mecklenburg-Vorpommern", rate: 6.0 },
  { name: "Niedersachsen", rate: 5.0 },
  { name: "Nordrhein-Westfalen", rate: 6.5 },
  { name: "Rheinland-Pfalz", rate: 5.0 },
  { name: "Saarland", rate: 6.5 },
  { name: "Sachsen", rate: 5.5 },
  { name: "Sachsen-Anhalt", rate: 5.0 },
  { name: "Schleswig-Holstein", rate: 6.5 },
  { name: "Thüringen", rate: 6.5 },
];

const currency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const CHART_COORDINATE_PRECISION = 2;
const CHART_Y_TICK_COUNT = 5;
const CHART_MAX_X_TICKS = 8;
const CHART_X_AXIS_LABEL_OFFSET = 24;
const CHART_MIN_VALUE_FLOOR = 0;

const DEFAULT_FORM_VALUES = Object.fromEntries(
  FIELD_DEFINITIONS.map((field) => [field.id, String(field.defaultValue)]),
);

const REAL_ESTATE_FIELD_IDS = new Set(
  FIELD_DEFINITIONS.filter((f) => f.realEstate).map((f) => f.id),
);

function getEffectiveFormValues(formValues, includeRealEstate) {
  if (includeRealEstate) return formValues;
  const zeros = Object.fromEntries([...REAL_ESTATE_FIELD_IDS].map((id) => [id, "0"]));
  return { ...formValues, ...zeros };
}

function formatCurrency(value) {
  return currency.format(value);
}

function formatPercent(value) {
  return `${percent.format(value)} %`;
}

function formatDecimalAsPercent(rate) {
  return formatPercent(rate * 100);
}

function createSvgLinePath(points) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(CHART_COORDINATE_PRECISION)} ${point.y.toFixed(CHART_COORDINATE_PRECISION)}`,
    )
    .join(" ");
}

function parseNumber(value) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateFormValues(formValues, bulletLoan = false) {
  const invalidIds = [];
  const parsedValues = {};

  for (const field of FIELD_DEFINITIONS) {
    // For conditional fields where condition is not met, substitute the default value
    const useDefault = field.conditionalField === "bulletLoan" && !bulletLoan;
    const rawValue = useDefault ? String(field.defaultValue) : (formValues[field.id] ?? "");
    const parsedValue = parseNumber(rawValue);

    if (parsedValue === null) {
      if (!useDefault) invalidIds.push(field.id);
      continue;
    }

    if (parsedValue < field.min || (field.max !== undefined && parsedValue > field.max)) {
      if (!useDefault) invalidIds.push(field.id);
      continue;
    }

    if (field.integer && !Number.isInteger(parsedValue)) {
      if (!useDefault) invalidIds.push(field.id);
      continue;
    }

    parsedValues[field.id] = parsedValue;
  }

  if (invalidIds.length > 0) {
    return { invalidIds, input: null };
  }

  return {
    invalidIds,
    input: {
      initialCapital: parsedValues.initialCapital,
      annualAdminCost: parsedValues.annualAdminCost,
      loanAmount: parsedValues.loanAmount,
      loanInterestRate: parsedValues.loanInterestRate / 100,
      loanRepaymentRate: parsedValues.loanRepaymentRate / 100,
      loanTermYears: parsedValues.loanTermYears,
      buildingValue: parsedValues.buildingValue,
      landValue: parsedValues.landValue,
      realEstateTaxRate: parsedValues.realEstateTaxRate / 100,
      monthlyRent: parsedValues.monthlyRent,
      depreciationRate: parsedValues.depreciationRate / 100,
      etfReturnRate: parsedValues.etfReturnRate / 100,
      foundationEtfTaxRate: parsedValues.foundationEtfTaxRate / 100,
      foundationEtfPartialExemptionRate: FOUNDATION_ETF_PARTIAL_EXEMPTION_RATE,
      privateEtfTaxRate: parsedValues.privateEtfTaxRate / 100,
      privateEtfPartialExemptionRate: PRIVATE_ETF_PARTIAL_EXEMPTION_RATE,
      saverAllowance: parsedValues.saverAllowance,
      projectionYears: parsedValues.projectionYears,
    },
  };
}

function getRelationshipOption(relationshipId) {
  return (
    RELATIONSHIP_OPTIONS.find((option) => option.id === relationshipId) ??
    RELATIONSHIP_OPTIONS[0]
  );
}

function validatePersonalTaxSteps(steps) {
  if (!steps || steps.length === 0) {
    return { invalidIndices: [], parsedSteps: null };
  }

  const invalidIndices = [];
  const parsed = [];
  const fromYears = new Set();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const fromYear = parseNumber(String(step.fromYear ?? ""));
    const rate = parseNumber(String(step.rate ?? ""));

    let valid = true;
    if (fromYear === null || !Number.isInteger(fromYear) || fromYear < 1) valid = false;
    if (rate === null || rate < 0 || rate > 100) valid = false;
    if (fromYear !== null && fromYears.has(fromYear)) valid = false;

    if (!valid) {
      invalidIndices.push(i);
    } else {
      fromYears.add(fromYear);
      parsed.push({ fromYear, rate: rate / 100 });
    }
  }

  if (invalidIndices.length > 0) {
    return { invalidIndices, parsedSteps: null };
  }

  parsed.sort((a, b) => a.fromYear - b.fromYear);
  return { invalidIndices: [], parsedSteps: parsed };
}

function getPersonalTaxRateForYear(personalTaxSteps, year) {
  // personalTaxSteps is sorted ascending by fromYear; iterate in reverse for efficiency
  for (let i = personalTaxSteps.length - 1; i >= 0; i--) {
    if (personalTaxSteps[i].fromYear <= year) {
      return personalTaxSteps[i].rate;
    }
  }
  return personalTaxSteps[0].rate;
}

function validateMaintenanceEvents(events) {
  if (!events || events.length === 0) {
    return { invalidIndices: [], parsedEvents: [] };
  }

  const invalidIndices = [];
  const parsed = [];

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    const year = parseNumber(String(evt.year ?? ""));
    const amount = parseNumber(String(evt.amount ?? ""));

    let valid = true;
    if (year === null || !Number.isInteger(year) || year < 1) valid = false;
    if (amount === null || amount < 0.01) valid = false;
    if (evt.type !== "full" && evt.type !== "afa") valid = false;

    if (!valid) {
      invalidIndices.push(i);
    } else {
      parsed.push({ year, amount, type: evt.type });
    }
  }

  return { invalidIndices, parsedEvents: parsed };
}

function createProjectionInput(
  validatedInput,
  relationship,
  surplusToRepayment,
  personalTaxSteps,
  comparePaysRealEstateTax,
  bulletLoan = false,
  lenderIsTenant = false,
  tenantRentFromExternalFunds = false,
  maintenanceEvents = [],
) {
  return {
    ...validatedInput,
    giftTaxRate: relationship.giftTaxRate,
    giftTaxAllowance: relationship.giftTaxAllowance,
    surplusToRepayment,
    personalTaxSteps,
    comparePaysRealEstateTax,
    bulletLoan,
    lenderIsTenant,
    tenantRentFromExternalFunds,
    maintenanceEvents,
  };
}

function computeEtfSaleTaxData(
  balanceAfterTax,
  contributionsAfterInvestment,
  taxedGainsAfterYear,
  taxRate,
  partialExemptionRate,
) {
  const taxableRatio = Math.max(0, 1 - partialExemptionRate);
  const taxableSaleGain = Math.max(
    0,
    (balanceAfterTax - contributionsAfterInvestment) * taxableRatio - taxedGainsAfterYear,
  );
  const saleTax = taxableSaleGain * taxRate;
  const etfLiquidationValue = balanceAfterTax - saleTax;

  return { taxableSaleGain, saleTax, etfLiquidationValue };
}

function computePartialEtfSale(
  neededNetProceeds,
  etfBalance,
  etfContributions,
  etfTaxedGains,
  taxRate,
  partialExemptionRate,
) {
  if (etfBalance <= 0 || neededNetProceeds <= 0) {
    return { fraction: 0, grossSale: 0, saleTax: 0, netProceeds: 0 };
  }

  const taxableRatio = Math.max(0, 1 - partialExemptionRate);
  const taxableGainBase = Math.max(
    0,
    (etfBalance - etfContributions) * taxableRatio - etfTaxedGains,
  );
  const fullLiquidationValue = etfBalance - taxableGainBase * taxRate;

  if (fullLiquidationValue <= 0) {
    return { fraction: 1, grossSale: etfBalance, saleTax: 0, netProceeds: 0 };
  }

  const fraction = Math.min(1, neededNetProceeds / fullLiquidationValue);
  const grossSale = fraction * etfBalance;
  const saleTax = fraction * taxableGainBase * taxRate;
  const netProceeds = grossSale - saleTax;

  return { fraction, grossSale, saleTax, netProceeds };
}

function applyEtfYear({
  cash,
  etfBalance,
  etfContributions,
  etfTaxedGains,
  returnRate,
  taxRate,
  partialExemptionRate,
  saverAllowance = 0,
}) {
  const taxableRatio = Math.max(0, 1 - partialExemptionRate);
  let currentCash = cash;
  let currentEtfBalance = etfBalance;
  let currentEtfContributions = etfContributions;
  let currentEtfTaxedGains = etfTaxedGains;
  let etfDeficitSaleGross = 0;
  let etfDeficitSaleTax = 0;
  let etfDeficitSaleNet = 0;

  if (currentCash < 0 && currentEtfBalance > 0) {
    const deficitSale = computePartialEtfSale(
      -currentCash,
      currentEtfBalance,
      currentEtfContributions,
      currentEtfTaxedGains,
      taxRate,
      partialExemptionRate,
    );
    etfDeficitSaleGross = deficitSale.grossSale;
    etfDeficitSaleTax = deficitSale.saleTax;
    etfDeficitSaleNet = deficitSale.netProceeds;
    currentCash += etfDeficitSaleNet;
    currentEtfBalance -= etfDeficitSaleGross;
    currentEtfContributions *= 1 - deficitSale.fraction;
    currentEtfTaxedGains *= 1 - deficitSale.fraction;
  }

  const etfCashInvestment = Math.max(0, currentCash);
  const cashAfterInvestment = currentCash - etfCashInvestment;
  const etfBalanceAfterInvestment = currentEtfBalance + etfCashInvestment;
  const etfContributionsAfterInvestment = currentEtfContributions + etfCashInvestment;
  const grossEtfReturn = etfBalanceAfterInvestment * returnRate;
  const taxableVorabGainBeforeAllowance = grossEtfReturn * taxableRatio;
  const taxableVorabGain = Math.max(0, taxableVorabGainBeforeAllowance - saverAllowance);
  const vorabTax = taxableVorabGain * taxRate;
  const etfBalanceAfterTax = etfBalanceAfterInvestment + grossEtfReturn - vorabTax;
  const etfTaxedGainsAfterYear = currentEtfTaxedGains + taxableVorabGain;
  const { taxableSaleGain, saleTax, etfLiquidationValue } = computeEtfSaleTaxData(
    etfBalanceAfterTax,
    etfContributionsAfterInvestment,
    etfTaxedGainsAfterYear,
    taxRate,
    partialExemptionRate,
  );

  return {
    cashAfterInvestment,
    etfBalanceAfterTax,
    etfContributionsAfterInvestment,
    etfTaxedGainsAfterYear,
    etfInvestment: etfCashInvestment,
    etfDeficitSaleGross,
    etfDeficitSaleTax,
    etfDeficitSaleNet,
    grossEtfReturn,
    vorabTax,
    taxableSaleGain,
    saleTax,
    etfLiquidationValue,
  };
}

function calculateProjection(input) {
  const propertyValue = input.buildingValue + input.landValue;
  const annualRent = input.monthlyRent * 12;
  const giftTaxAllowance = Math.max(0, input.giftTaxAllowance ?? 0);
  const taxableGiftBase = Math.max(0, input.initialCapital - giftTaxAllowance);
  const giftTax = taxableGiftBase * input.giftTaxRate;
  const realEstateTax = propertyValue * input.realEstateTaxRate;

  // Grunderwerbsteuer aufgeteilt auf Gebäude und Grundstück (proportional zum Kaufpreis)
  const buildingRatio = propertyValue > 0 ? input.buildingValue / propertyValue : 0;
  const realEstateTaxBuildingPortion = realEstateTax * buildingRatio;
  const realEstateTaxLandPortion = realEstateTax - realEstateTaxBuildingPortion;

  // Die anteilige GrESt am Gebäude erhöht die abschreibungsfähige Anschaffungskostenbasis
  const depreciableBuildingBase = input.buildingValue + realEstateTaxBuildingPortion;
  // Buchwert des Grundstücks inkl. GrESt-Anteil (nicht abschreibungsfähig)
  const landBookBase = input.landValue + realEstateTaxLandPortion;
  const privateRealEstateTax = input.comparePaysRealEstateTax ? realEstateTax : 0;
  const privateDepreciableBuildingBase =
    input.buildingValue +
    (input.comparePaysRealEstateTax ? realEstateTaxBuildingPortion : 0);

  const initialCash =
    input.initialCapital - giftTax + input.loanAmount - propertyValue - realEstateTax;

  // Deferred purchase: if there is not enough money even with the loan, invest in ETF first
  // and buy the property once the ETF has grown enough to cover property + transfer tax
  const deferredPurchase = initialCash < 0;

  let foundationOwnsProperty = !deferredPurchase;
  let purchaseYear = deferredPurchase ? null : 0;

  // In deferred mode: start with equity only (no loan taken, no property bought yet)
  let foundationCash = deferredPurchase ? input.initialCapital - giftTax : initialCash;
  let foundationEtfBalance = 0;
  let foundationEtfContributions = 0;
  let foundationEtfTaxedGains = 0;
  let remainingLoan = deferredPurchase ? 0 : input.loanAmount;
  let remainingDepreciableBuildingValue = deferredPurchase ? 0 : depreciableBuildingBase;
  // Tracks the total depreciable base including AfA-qualifying maintenance additions
  let effectiveDepreciableBase = deferredPurchase ? 0 : depreciableBuildingBase;
  let personCash = 0;
  let personEtfBalance = 0;
  let personEtfContributions = 0;
  let personEtfTaxedGains = 0;

  // Erbersatzsteuer-Tracking (§ 1 Abs. 1 Nr. 4 ErbStG)
  let erbsRemainingLiability = 0;
  let erbsCurrentInstallment = 0;
  let erbsCurrentCycleAmount = 0;

  // Körperschaftsteuer-Verlustvortrag (§ 10d EStG i.V.m. § 8 KStG)
  let taxLossCarryforward = 0;

  // Kumulierte Zinsen/Steuer der darlehensgebenden Person (für endfälliges Darlehen)
  let personCumulativeGrossInterest = 0;
  let personCumulativeInterestTax = 0;

  // Vergleichsszenario: Privatvermietung ohne Stiftung
  // Kein Schenkungssteuerabzug, Mieteinnahmen zum persönlichen Steuersatz besteuert,
  // kein Darlehen, keine Verwaltungskosten
  let privateCash =
    input.initialCapital + input.loanAmount - propertyValue - privateRealEstateTax;
  let compareEtfBalance = 0;
  let compareEtfContributions = 0;
  let compareEtfTaxedGains = 0;
  let privateRemainingDepreciableBuilding = privateDepreciableBuildingBase;
  // Tracks the total depreciable base for the private comparison including AfA-qualifying maintenance
  let privateEffectiveDepreciableBase = privateDepreciableBuildingBase;

  // Vergleichsszenario: Gleiches Vermögen komplett in ETF (keine Immobilie)
  // Startet mit demselben Stiftungskapital, kein Darlehen, keine Immobilie, nur ETF
  let etfOnlyCash = input.initialCapital;
  let etfOnlyEtfBalance = 0;
  let etfOnlyEtfContributions = 0;
  let etfOnlyEtfTaxedGains = 0;

  const buildingBookValue0 = deferredPurchase ? 0 : depreciableBuildingBase + landBookBase;

  const rows = [
    {
      year: 0,
      foundationCash,
      foundationEtfBalance,
      foundationEtfLiquidationValue: 0,
      foundationVorabTax: 0,
      foundationEtfSaleTax: 0,
      foundationEtfDeficitSaleGross: 0,
      foundationEtfDeficitSaleTax: 0,
      foundationEtfDeficitSaleNet: 0,
      taxableResult: -giftTax,
      foundationWealth: deferredPurchase
        ? foundationCash
        : foundationCash + propertyValue - remainingLoan,
      remainingLoan,
      personNetCashFlow: 0,
      personAssetPosition: deferredPurchase ? 0 : remainingLoan,
      personCash,
      personEtfBalance,
      personEtfLiquidationValue: 0,
      personVorabTax: 0,
      personEtfSaleTax: 0,
      personalTaxRate: getPersonalTaxRateForYear(input.personalTaxSteps, 1),
      // Bilanz Jahr 0
      buildingBookValue: buildingBookValue0,
      totalAssets: deferredPurchase ? foundationCash : foundationCash + buildingBookValue0,
      equity: deferredPurchase ? foundationCash : foundationCash + buildingBookValue0 - remainingLoan,
      // Erbersatzsteuer
      erbsTriggeredAmount: 0,
      erbsInstallmentShare: 0,
      erbsCurrentCycleAmount: 0,
      erbsInstallmentPaid: 0,
      erbsRemainingLiability: 0,
      // Vergleichsvermögen Privatvermietung Jahr 0
      compareWealth: privateCash + propertyValue,
      compareEtfBalance,
      compareEtfLiquidationValue: 0,
      compareVorabTax: 0,
      compareEtfSaleTax: 0,
      // Vergleichsvermögen ETF-only (ohne Immobilie) Jahr 0
      etfOnlyWealth: etfOnlyCash,
      etfOnlyEtfBalance,
      etfOnlyEtfLiquidationValue: 0,
      etfOnlyVorabTax: 0,
      etfOnlyEtfSaleTax: 0,
      propertyOwned: !deferredPurchase,
      propertyBoughtThisYear: false,
      etfSaleForPurchase: 0,
      etfSaleTaxForPurchase: 0,
      etfSaleNetForPurchase: 0,
      personCumulativeGrossInterest: 0,
      personCumulativeInterestTax: 0,
      guvKstAmount: 0,
      guvKstBase: 0,
      guvKstUsedCarryforward: 0,
      guvLossCarryforward: 0,
      guvMaintenanceEtfSaleGross: 0,
      guvMaintenanceEtfSaleTax: 0,
      guvMaintenanceEtfSaleNet: 0,
      compareMaintenanceCashOut: 0,
      compareMaintenanceFullDeduction: 0,
      compareMaintenanceAfaAddition: 0,
      compareMaintenanceEtfSaleGross: 0,
      compareMaintenanceEtfSaleTax: 0,
      compareMaintenanceEtfSaleNet: 0,
    },
  ];

  for (let year = 1; year <= input.projectionYears; year += 1) {
    const yearPersonalTaxRate = getPersonalTaxRateForYear(input.personalTaxSteps, year);

    // Deferred-purchase check: buy property if ETF + loan now covers the full acquisition cost
    let propertyBoughtThisYear = false;
    let etfSaleForPurchase = 0;
    let etfSaleTaxForPurchase = 0;
    let etfSaleNetForPurchase = 0;

    if (deferredPurchase && !foundationOwnsProperty) {
      const { etfLiquidationValue: currentEtfLiq } = computeEtfSaleTaxData(
        foundationEtfBalance,
        foundationEtfContributions,
        foundationEtfTaxedGains,
        input.foundationEtfTaxRate,
        input.foundationEtfPartialExemptionRate,
      );

      if (currentEtfLiq + input.loanAmount >= propertyValue + realEstateTax) {
        // Sell the portion of ETF needed to cover what the loan does not
        const neededFromEtf = Math.max(0, propertyValue + realEstateTax - input.loanAmount);
        if (neededFromEtf > 0 && foundationEtfBalance > 0) {
          const saleResult = computePartialEtfSale(
            neededFromEtf,
            foundationEtfBalance,
            foundationEtfContributions,
            foundationEtfTaxedGains,
            input.foundationEtfTaxRate,
            input.foundationEtfPartialExemptionRate,
          );
          etfSaleForPurchase = saleResult.grossSale;
          etfSaleTaxForPurchase = saleResult.saleTax;
          etfSaleNetForPurchase = saleResult.netProceeds;
          foundationCash += saleResult.netProceeds;
          foundationEtfBalance -= saleResult.grossSale;
          foundationEtfContributions *= (1 - saleResult.fraction);
          foundationEtfTaxedGains *= (1 - saleResult.fraction);
        }

        // Take loan and buy property
        foundationCash += input.loanAmount;
        foundationCash -= propertyValue + realEstateTax;
        remainingLoan = input.loanAmount;
        remainingDepreciableBuildingValue = depreciableBuildingBase;
        effectiveDepreciableBase = depreciableBuildingBase;
        foundationOwnsProperty = true;
        purchaseYear = year;
        propertyBoughtThisYear = true;
      }
    }

    // Annual cash flows – branch on whether the foundation now owns the property
    let annualInterest;
    let scheduledRepaymentTarget;
    let annualDepreciation;
    let taxableResult;
    let foundationCashFlow;
    let scheduledRepayment = 0;
    let extraRepayment = 0;
    let lenderTax = 0;
    let lenderNetCashFlow = 0;
    let personRentPaidFromAssets = 0;
    let maintenanceCashOut = 0;
    let maintenanceFullDeduction = 0;
    let maintenanceAfaAddition = 0;
    let maintenanceEtfSaleGross = 0;
    let maintenanceEtfSaleTax = 0;
    let maintenanceEtfSaleNet = 0;

    const loanAtStartOfYear = remainingLoan;
    const prevFoundationCash = foundationCash;

    if (foundationOwnsProperty) {
      // Process maintenance events for this year
      const yearMaintenanceEvents = (input.maintenanceEvents ?? []).filter(
        (e) => e.year === year,
      );
      for (const evt of yearMaintenanceEvents) {
        maintenanceCashOut += evt.amount;
        if (evt.type === "full") {
          maintenanceFullDeduction += evt.amount;
        } else {
          // AfA-qualifying maintenance: added to depreciable base
          maintenanceAfaAddition += evt.amount;
          effectiveDepreciableBase += evt.amount;
          remainingDepreciableBuildingValue += evt.amount;
        }
      }

      // Maintenance must be funded before year-end ETF operations.
      // If the current cash balance is insufficient, sell ETF first so the
      // payment is explicitly covered and ETF returns are not earned on the
      // portion that must be liquidated.
      if (maintenanceCashOut > 0 && maintenanceCashOut > foundationCash && foundationEtfBalance > 0) {
        const maintenanceShortfall = maintenanceCashOut - foundationCash;
        const maintSale = computePartialEtfSale(
          maintenanceShortfall,
          foundationEtfBalance,
          foundationEtfContributions,
          foundationEtfTaxedGains,
          input.foundationEtfTaxRate,
          input.foundationEtfPartialExemptionRate,
        );
        maintenanceEtfSaleGross = maintSale.grossSale;
        maintenanceEtfSaleTax = maintSale.saleTax;
        maintenanceEtfSaleNet = maintSale.netProceeds;
        foundationCash += maintSale.netProceeds;
        foundationEtfBalance -= maintSale.grossSale;
        foundationEtfContributions *= (1 - maintSale.fraction);
        foundationEtfTaxedGains *= (1 - maintSale.fraction);
      }

      annualInterest = remainingLoan * input.loanInterestRate;
      annualDepreciation = Math.min(
        remainingDepreciableBuildingValue,
        effectiveDepreciableBase * input.depreciationRate,
      );
      taxableResult =
        annualRent -
        input.annualAdminCost -
        annualInterest -
        annualDepreciation -
        maintenanceFullDeduction;
      // Operativer Liquiditätsüberschuss (ohne Tilgung, da Tilgung eine
      // reine Bilanzumschichtung ist und die operative Liquidität nicht mindert)
      foundationCashFlow =
        annualRent -
        input.annualAdminCost -
        annualInterest -
        maintenanceCashOut;
      const availableCashBeforeRepayment = foundationCash + foundationCashFlow;

      if (input.bulletLoan) {
        // Endfälliges Darlehen: kein Tilgungsplan, volle Rückzahlung am Laufzeitende
        scheduledRepaymentTarget = year === input.loanTermYears ? remainingLoan : 0;
        scheduledRepayment = scheduledRepaymentTarget;
        extraRepayment = 0;
      } else {
        scheduledRepaymentTarget = Math.min(
          remainingLoan,
          input.loanAmount * input.loanRepaymentRate,
        );
        // Business rule: normal repayment is always paid each year, even with negative cash.
        scheduledRepayment = scheduledRepaymentTarget;
        // Jährlichen Überschuss als Sondertilgung verwenden
        extraRepayment = input.surplusToRepayment
          ? Math.min(
              Math.max(0, availableCashBeforeRepayment - scheduledRepayment),
              remainingLoan - scheduledRepayment,
            )
          : 0;
      }

      const interestAllowanceUsed = Math.min(annualInterest, input.saverAllowance);
      lenderTax = (annualInterest - interestAllowanceUsed) * yearPersonalTaxRate;
      lenderNetCashFlow =
        scheduledRepayment + extraRepayment + (annualInterest - lenderTax);

      personCumulativeGrossInterest += annualInterest;
      personCumulativeInterestTax += lenderTax;

      foundationCash = availableCashBeforeRepayment - scheduledRepayment - extraRepayment;
      remainingLoan -= scheduledRepayment + extraRepayment;
      remainingDepreciableBuildingValue = Math.max(
        0,
        remainingDepreciableBuildingValue - annualDepreciation,
      );
      personCash += lenderNetCashFlow;
      if (input.lenderIsTenant && !input.tenantRentFromExternalFunds) {
        personRentPaidFromAssets = annualRent;
        personCash -= annualRent;
      }
    } else {
      // No property yet – only annual admin costs; ETF returns cover operating costs
      annualInterest = 0;
      scheduledRepaymentTarget = 0;
      annualDepreciation = 0;
      taxableResult = -input.annualAdminCost;
      foundationCashFlow = -input.annualAdminCost;
      foundationCash += foundationCashFlow;
    }

    // Körperschaftsteuer (KSt 15 % + SolZ 5,5 %) mit Verlustvortrag (§ 10d EStG i.V.m. § 8 KStG)
    let kstUsedCarryforward = 0;
    let kstBase = 0;
    let kstAmount = 0;
    if (taxableResult >= 0) {
      kstUsedCarryforward = Math.min(taxLossCarryforward, taxableResult);
      kstBase = taxableResult - kstUsedCarryforward;
      taxLossCarryforward -= kstUsedCarryforward;
      kstAmount = kstBase * KST_COMBINED_RATE;
      foundationCash -= kstAmount;
    } else {
      taxLossCarryforward += Math.abs(taxableResult);
    }

    // Vergleichsszenario: Privatvermietung – Instandhaltungsereignisse
    let privateMaintCashOut = 0;
    let privateMaintFullDeduction = 0;
    let privateMaintAfaAddition = 0;
    let privateMaintEtfSaleGross = 0;
    let privateMaintEtfSaleTax = 0;
    let privateMaintEtfSaleNet = 0;

    for (const evt of (input.maintenanceEvents ?? []).filter((e) => e.year === year)) {
      privateMaintCashOut += evt.amount;
      if (evt.type === "full") {
        privateMaintFullDeduction += evt.amount;
      } else {
        privateMaintAfaAddition += evt.amount;
        privateEffectiveDepreciableBase += evt.amount;
        privateRemainingDepreciableBuilding += evt.amount;
      }
    }

    // Fund private maintenance from compare ETF if cash is insufficient
    if (privateMaintCashOut > 0 && privateMaintCashOut > privateCash && compareEtfBalance > 0) {
      const privateMaintenanceShortfall = privateMaintCashOut - privateCash;
      const privateMaintSale = computePartialEtfSale(
        privateMaintenanceShortfall,
        compareEtfBalance,
        compareEtfContributions,
        compareEtfTaxedGains,
        input.privateEtfTaxRate,
        input.privateEtfPartialExemptionRate,
      );
      privateMaintEtfSaleGross = privateMaintSale.grossSale;
      privateMaintEtfSaleTax = privateMaintSale.saleTax;
      privateMaintEtfSaleNet = privateMaintSale.netProceeds;
      privateCash += privateMaintSale.netProceeds;
      compareEtfBalance -= privateMaintSale.grossSale;
      compareEtfContributions *= 1 - privateMaintSale.fraction;
      compareEtfTaxedGains *= 1 - privateMaintSale.fraction;
    }

    privateCash -= privateMaintCashOut;

    // Vergleichsszenario: Privatvermietung – kein Darlehen, keine Verwaltungskosten, Steuern auf Miete
    const privateDepreciation = Math.min(
      privateRemainingDepreciableBuilding,
      privateEffectiveDepreciableBase * input.depreciationRate,
    );
    const privateTaxableRentalIncome = annualRent - privateDepreciation - privateMaintFullDeduction;
    const privateIncomeTax = privateTaxableRentalIncome * yearPersonalTaxRate;
    privateCash += annualRent - privateIncomeTax;
    privateRemainingDepreciableBuilding = Math.max(
      0,
      privateRemainingDepreciableBuilding - privateDepreciation,
    );

    const buildingDepreciableValue = remainingDepreciableBuildingValue;
    const buildingBookValue = foundationOwnsProperty
      ? buildingDepreciableValue + landBookBase
      : 0;

    // Erbersatzsteuer: Auslösung alle 30 Jahre (frühestens Jahr 30, nie Jahr 0)
    let erbsTriggeredAmount = 0;
    if (year > 0 && year % ERBERSATZ_CYCLE_YEARS === 0) {
      const { etfLiquidationValue: foundationEtfLiquidationForErbs } = computeEtfSaleTaxData(
        foundationEtfBalance,
        foundationEtfContributions,
        foundationEtfTaxedGains,
        input.foundationEtfTaxRate,
        input.foundationEtfPartialExemptionRate,
      );
      const netWealthForErbs = foundationOwnsProperty
        ? foundationCash + foundationEtfLiquidationForErbs + propertyValue - remainingLoan
        : foundationCash + foundationEtfLiquidationForErbs;
      const perChildTaxable = Math.max(
        0,
        netWealthForErbs / ERBERSATZ_CHILDREN - ERBERSATZ_CHILD_ALLOWANCE,
      );
      erbsTriggeredAmount = ERBERSATZ_CHILDREN * perChildTaxable * ERBERSATZ_TAX_RATE;
      // Ratenzahlung über 30 Jahre (§ 24 ErbStG)
      erbsRemainingLiability += erbsTriggeredAmount;
      erbsCurrentCycleAmount = erbsTriggeredAmount;
      erbsCurrentInstallment = erbsTriggeredAmount / ERBERSATZ_CYCLE_YEARS;
    }

    // Erbersatzsteuer: Jahresrate auszahlen
    let erbsInstallmentPaid = 0;
    if (erbsRemainingLiability > 0) {
      erbsInstallmentPaid = Math.min(erbsCurrentInstallment, erbsRemainingLiability);
      foundationCash -= erbsInstallmentPaid;
      erbsRemainingLiability -= erbsInstallmentPaid;
      if (erbsRemainingLiability <= 0) {
        erbsRemainingLiability = 0;
        erbsCurrentInstallment = 0;
        erbsCurrentCycleAmount = 0;
      }
    }
    const erbsInstallmentShare =
      erbsCurrentCycleAmount > 0 ? erbsInstallmentPaid / erbsCurrentCycleAmount : 0;

    const foundationEtf = applyEtfYear({
      cash: foundationCash,
      etfBalance: foundationEtfBalance,
      etfContributions: foundationEtfContributions,
      etfTaxedGains: foundationEtfTaxedGains,
      returnRate: input.etfReturnRate,
      taxRate: input.foundationEtfTaxRate,
      partialExemptionRate: input.foundationEtfPartialExemptionRate,
    });
    foundationCash = foundationEtf.cashAfterInvestment;
    foundationEtfBalance = foundationEtf.etfBalanceAfterTax;
    foundationEtfContributions = foundationEtf.etfContributionsAfterInvestment;
    foundationEtfTaxedGains = foundationEtf.etfTaxedGainsAfterYear;

    const interestAllowanceUsed = Math.min(annualInterest, input.saverAllowance);
    const personEtfSaverAllowance = input.saverAllowance - interestAllowanceUsed;
    const personEtf = applyEtfYear({
      cash: personCash,
      etfBalance: personEtfBalance,
      etfContributions: personEtfContributions,
      etfTaxedGains: personEtfTaxedGains,
      returnRate: input.etfReturnRate,
      taxRate: input.privateEtfTaxRate,
      partialExemptionRate: input.privateEtfPartialExemptionRate,
      saverAllowance: personEtfSaverAllowance,
    });
    personCash = personEtf.cashAfterInvestment;
    personEtfBalance = personEtf.etfBalanceAfterTax;
    personEtfContributions = personEtf.etfContributionsAfterInvestment;
    personEtfTaxedGains = personEtf.etfTaxedGainsAfterYear;

    const compareEtf = applyEtfYear({
      cash: privateCash,
      etfBalance: compareEtfBalance,
      etfContributions: compareEtfContributions,
      etfTaxedGains: compareEtfTaxedGains,
      returnRate: input.etfReturnRate,
      taxRate: input.privateEtfTaxRate,
      partialExemptionRate: input.privateEtfPartialExemptionRate,
      saverAllowance: input.saverAllowance,
    });
    privateCash = compareEtf.cashAfterInvestment;
    compareEtfBalance = compareEtf.etfBalanceAfterTax;
    compareEtfContributions = compareEtf.etfContributionsAfterInvestment;
    compareEtfTaxedGains = compareEtf.etfTaxedGainsAfterYear;

    const etfOnlyEtf = applyEtfYear({
      cash: etfOnlyCash,
      etfBalance: etfOnlyEtfBalance,
      etfContributions: etfOnlyEtfContributions,
      etfTaxedGains: etfOnlyEtfTaxedGains,
      returnRate: input.etfReturnRate,
      taxRate: input.privateEtfTaxRate,
      partialExemptionRate: input.privateEtfPartialExemptionRate,
      saverAllowance: input.saverAllowance,
    });
    etfOnlyCash = etfOnlyEtf.cashAfterInvestment;
    etfOnlyEtfBalance = etfOnlyEtf.etfBalanceAfterTax;
    etfOnlyEtfContributions = etfOnlyEtf.etfContributionsAfterInvestment;
    etfOnlyEtfTaxedGains = etfOnlyEtf.etfTaxedGainsAfterYear;

    rows.push({
      year,
      foundationCash,
      foundationEtfBalance,
      foundationEtfLiquidationValue: foundationEtf.etfLiquidationValue,
      foundationEtfInvestment: foundationEtf.etfInvestment,
      foundationEtfDeficitSaleGross: foundationEtf.etfDeficitSaleGross,
      foundationEtfDeficitSaleTax: foundationEtf.etfDeficitSaleTax,
      foundationEtfDeficitSaleNet: foundationEtf.etfDeficitSaleNet,
      foundationEtfTaxableSaleGain: foundationEtf.taxableSaleGain,
      foundationGrossEtfReturn: foundationEtf.grossEtfReturn,
      foundationVorabTax: foundationEtf.vorabTax,
      foundationEtfSaleTax: foundationEtf.saleTax,
      foundationCashFlow,
      taxableResult,
      foundationWealth:
        foundationCash +
        foundationEtf.etfLiquidationValue +
        (foundationOwnsProperty ? propertyValue : 0) -
        remainingLoan -
        erbsRemainingLiability,
      remainingLoan,
      personNetCashFlow: lenderNetCashFlow - personRentPaidFromAssets,
      personAssetPosition: remainingLoan + personCash + personEtf.etfLiquidationValue,
      personCash,
      personEtfBalance,
      personEtfLiquidationValue: personEtf.etfLiquidationValue,
      personEtfInvestment: personEtf.etfInvestment,
      personEtfTaxableSaleGain: personEtf.taxableSaleGain,
      personGrossEtfReturn: personEtf.grossEtfReturn,
      personVorabTax: personEtf.vorabTax,
      personEtfSaleTax: personEtf.saleTax,
      // GuV Stiftung
      guvRent: foundationOwnsProperty ? annualRent : 0,
      guvAdminCost: input.annualAdminCost,
      guvInterest: annualInterest,
      guvDepreciation: annualDepreciation,
      guvResult: taxableResult,
      guvMaintenanceCashOut: maintenanceCashOut,
      guvMaintenanceFullDeduction: maintenanceFullDeduction,
      guvMaintenanceAfaAddition: maintenanceAfaAddition,
      guvMaintenanceEtfSaleGross: maintenanceEtfSaleGross,
      guvMaintenanceEtfSaleTax: maintenanceEtfSaleTax,
      guvMaintenanceEtfSaleNet: maintenanceEtfSaleNet,
      guvKstAmount: kstAmount,
      guvKstBase: kstBase,
      guvKstUsedCarryforward: kstUsedCarryforward,
      guvLossCarryforward: taxLossCarryforward,
      loanAtStartOfYear,
      scheduledRepayment,
      extraRepayment,
      prevFoundationCash,
      // GuV Person
      personGuvInterest: annualInterest,
      personGuvTax: lenderTax,
      personGuvResult: annualInterest - lenderTax,
      personRentPaidFromAssets,
      personalTaxRate: yearPersonalTaxRate,
      // Bilanz
      buildingDepreciableValue,
      buildingBookValue,
      totalAssets: foundationCash + foundationEtf.etfLiquidationValue + buildingBookValue,
      equity:
        foundationCash +
        foundationEtf.etfLiquidationValue +
        buildingBookValue -
        remainingLoan -
        erbsRemainingLiability,
      // Erbersatzsteuer
      erbsTriggeredAmount,
      erbsInstallmentShare,
      erbsCurrentCycleAmount,
      erbsInstallmentPaid,
      erbsRemainingLiability,
      // Vergleichsvermögen Privatvermietung
      compareWealth: privateCash + compareEtf.etfLiquidationValue + propertyValue,
      compareEtfBalance,
      compareEtfLiquidationValue: compareEtf.etfLiquidationValue,
      compareEtfInvestment: compareEtf.etfInvestment,
      compareEtfTaxableSaleGain: compareEtf.taxableSaleGain,
      compareGrossEtfReturn: compareEtf.grossEtfReturn,
      compareVorabTax: compareEtf.vorabTax,
      compareEtfSaleTax: compareEtf.saleTax,
      compareMaintenanceCashOut: privateMaintCashOut,
      compareMaintenanceFullDeduction: privateMaintFullDeduction,
      compareMaintenanceAfaAddition: privateMaintAfaAddition,
      compareMaintenanceEtfSaleGross: privateMaintEtfSaleGross,
      compareMaintenanceEtfSaleTax: privateMaintEtfSaleTax,
      compareMaintenanceEtfSaleNet: privateMaintEtfSaleNet,
      // Vergleichsvermögen ETF-only (ohne Immobilie, gleiches Startkapital)
      etfOnlyWealth: etfOnlyCash + etfOnlyEtf.etfLiquidationValue,
      etfOnlyEtfBalance,
      etfOnlyEtfLiquidationValue: etfOnlyEtf.etfLiquidationValue,
      etfOnlyVorabTax: etfOnlyEtf.vorabTax,
      etfOnlyEtfSaleTax: etfOnlyEtf.saleTax,
      // Deferred-purchase fields
      propertyOwned: foundationOwnsProperty,
      propertyBoughtThisYear,
      etfSaleForPurchase,
      etfSaleTaxForPurchase,
      etfSaleNetForPurchase,
      personCumulativeGrossInterest,
      personCumulativeInterestTax,
    });
  }

  return {
    input,
    giftTaxAllowance,
    taxableGiftBase,
    annualRent,
    giftTax,
    realEstateTax,
    realEstateTaxBuildingPortion,
    realEstateTaxLandPortion,
    depreciableBuildingBase,
    privateRealEstateTax,
    privateDepreciableBuildingBase,
    propertyValue,
    initialCash,
    deferredPurchase,
    purchaseYear,
    annualDepreciationBase: depreciableBuildingBase * input.depreciationRate,
    rows,
  };
}

const DEFAULT_RESULT = calculateProjection({
  ...createProjectionInput(
    validateFormValues(getEffectiveFormValues(DEFAULT_FORM_VALUES, false), false).input,
    getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
    false,
    validatePersonalTaxSteps(DEFAULT_PERSONAL_TAX_STEPS).parsedSteps,
    true,
    false,
    false,
    false,
    [],
  ),
});

const STORAGE_KEY = "familienstiftung-rechner-v1";

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}

export default function Home() {
  const [
    {
      formValues,
      relationshipId,
      surplusToRepayment,
      comparePaysRealEstateTax,
      bundesland,
      personalTaxSteps,
      selectedOverviewYear,
      includeRealEstate,
      bulletLoan,
      bulletLoanShowReturn,
      lenderIsTenant,
      tenantRentFromExternalFunds,
      maintenanceEvents,
      result,
    },
    setState,
  ] = useState({
    formValues: DEFAULT_FORM_VALUES,
    relationshipId: DEFAULT_RELATIONSHIP_ID,
    surplusToRepayment: false,
    comparePaysRealEstateTax: false,
    bundesland: null,
    personalTaxSteps: DEFAULT_PERSONAL_TAX_STEPS,
    selectedOverviewYear: "all",
    includeRealEstate: false,
    bulletLoan: false,
    bulletLoanShowReturn: false,
    lenderIsTenant: false,
    tenantRentFromExternalFunds: false,
    maintenanceEvents: [],
    result: DEFAULT_RESULT,
  });

  // Load saved values from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const nextFormValues = { ...DEFAULT_FORM_VALUES, ...parsed.formValues };
      const nextRelationshipId = parsed.relationshipId ?? DEFAULT_RELATIONSHIP_ID;
      const nextSurplusToRepayment = parsed.surplusToRepayment ?? false;
      const nextComparePaysRealEstateTax = parsed.comparePaysRealEstateTax ?? false;
      const nextBundesland = parsed.bundesland ?? null;
      const nextPersonalTaxSteps = parsed.personalTaxSteps ?? DEFAULT_PERSONAL_TAX_STEPS;
      const nextSelectedOverviewYear = parsed.selectedOverviewYear ?? "all";
      const nextIncludeRealEstate = parsed.includeRealEstate ?? false;
      const nextBulletLoan = parsed.bulletLoan ?? false;
      const nextBulletLoanShowReturn = parsed.bulletLoanShowReturn ?? false;
      const nextLenderIsTenant = parsed.lenderIsTenant ?? false;
      const nextTenantRentFromExternalFunds = parsed.tenantRentFromExternalFunds ?? false;
      const nextMaintenanceEvents = parsed.maintenanceEvents ?? [];
      const nextValidation = validateFormValues(getEffectiveFormValues(nextFormValues, nextIncludeRealEstate), nextBulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(nextPersonalTaxSteps);
      const nextMaintenanceValidation = validateMaintenanceEvents(nextMaintenanceEvents);
      const nextRelationship = getRelationshipOption(nextRelationshipId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        formValues: nextFormValues,
        relationshipId: nextRelationship.id,
        surplusToRepayment: nextSurplusToRepayment,
        comparePaysRealEstateTax: nextComparePaysRealEstateTax,
        bundesland: nextBundesland,
        personalTaxSteps: nextPersonalTaxSteps,
        selectedOverviewYear: nextSelectedOverviewYear,
        includeRealEstate: nextIncludeRealEstate,
        bulletLoan: nextBulletLoan,
        bulletLoanShowReturn: nextBulletLoanShowReturn,
        lenderIsTenant: nextLenderIsTenant,
        tenantRentFromExternalFunds: nextTenantRentFromExternalFunds,
        maintenanceEvents: nextMaintenanceEvents,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                nextRelationship,
                nextSurplusToRepayment,
                nextTaxValidation.parsedSteps,
                nextIncludeRealEstate ? nextComparePaysRealEstateTax : false,
                nextBulletLoan,
                nextLenderIsTenant,
                nextTenantRentFromExternalFunds,
                nextMaintenanceValidation.parsedEvents,
              ),
            )
          : DEFAULT_RESULT,
      });
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist values to localStorage whenever they change (debounced to 300 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            formValues,
            relationshipId,
            surplusToRepayment,
            comparePaysRealEstateTax,
            bundesland,
            personalTaxSteps,
            selectedOverviewYear,
            includeRealEstate,
            bulletLoan,
            bulletLoanShowReturn,
            lenderIsTenant,
            tenantRentFromExternalFunds,
            maintenanceEvents,
          }),
        );
      } catch {
        // ignore storage errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    formValues,
    relationshipId,
    surplusToRepayment,
    comparePaysRealEstateTax,
    bundesland,
    personalTaxSteps,
    selectedOverviewYear,
    includeRealEstate,
    bulletLoan,
    bulletLoanShowReturn,
    lenderIsTenant,
    tenantRentFromExternalFunds,
    maintenanceEvents,
  ]);

  const validation = useMemo(
    () => validateFormValues(getEffectiveFormValues(formValues, includeRealEstate), bulletLoan),
    [formValues, includeRealEstate, bulletLoan],
  );
  const taxStepsValidation = useMemo(() => validatePersonalTaxSteps(personalTaxSteps), [personalTaxSteps]);
  const maintenanceValidation = useMemo(() => validateMaintenanceEvents(maintenanceEvents), [maintenanceEvents]);
  const hasInvalidFields = validation.invalidIds.length > 0;
  const hasInvalidTaxSteps = taxStepsValidation.parsedSteps === null;
  const hasInvalidMaintenanceEvents = maintenanceValidation.invalidIndices.length > 0;
  const selectedRelationship = useMemo(
    () => getRelationshipOption(relationshipId),
    [relationshipId],
  );
  const compareTaxCardDetail = result.input.comparePaysRealEstateTax
    ? ", inkl. Grunderwerbsteuer"
    : ", ohne Grunderwerbsteuer";
  const compareTaxFormulaDetail = result.input.comparePaysRealEstateTax
    ? `, mit ${formatCurrency(result.privateRealEstateTax)} GrESt`
    : ", ohne GrESt";
  const overviewYearOptions = useMemo(
    () => result.rows.map((row) => row.year),
    [result.rows],
  );
  const normalizedOverviewYear = selectedOverviewYear !== "all"
    && !overviewYearOptions.includes(Number(selectedOverviewYear))
    ? "all"
    : selectedOverviewYear;
  const visibleOverviewRows = useMemo(
    () => (normalizedOverviewYear === "all"
      ? result.rows
      : result.rows.filter((row) => row.year === Number(normalizedOverviewYear))),
    [normalizedOverviewYear, result.rows],
  );

  const firstYear = result.rows[1] ?? result.rows[0];
  const lastYear = result.rows[result.rows.length - 1];

  const compareScenarioLabel = includeRealEstate ? "Privatvermietung" : "Privates ETF-Investment";

  const cards = [
    {
      title: "Schenkungssteuer bei Gründung",
      value: formatCurrency(result.giftTax),
      detail: `${selectedRelationship.shortLabel}: ${formatDecimalAsPercent(result.input.giftTaxRate)}, Freibetrag ${formatCurrency(result.giftTaxAllowance)}`,
    },
    {
      title: "Grunderwerbsteuer",
      value: formatCurrency(result.realEstateTax),
      detail: `${formatPercent(result.input.realEstateTaxRate * 100)} auf ${formatCurrency(result.propertyValue)}`,
      realEstateOnly: true,
    },
    {
      title: "Kaufpreis Immobilie",
      value: formatCurrency(result.propertyValue),
      detail: `Gebäude ${formatCurrency(result.input.buildingValue)} + Grundstück ${formatCurrency(result.input.landValue)}`,
      realEstateOnly: true,
    },
    {
      title: result.input.bulletLoan
        ? `Endfälliges Darlehen (${result.input.loanTermYears} Jahre)`
        : (result.deferredPurchase
            ? `Annuitätsdarlehen (ab Immobilienkauf${result.purchaseYear !== null ? ` Jahr ${result.purchaseYear}` : ""})`
            : "Annuitätsdarlehen (Jahr 1)"),
      value: result.input.bulletLoan
        ? formatCurrency(result.input.loanAmount * result.input.loanInterestRate)
        : formatCurrency(result.input.loanAmount * (result.input.loanInterestRate + result.input.loanRepaymentRate)),
      detail: result.input.bulletLoan
        ? `Zinszahlung p.a.: ${formatPercent(result.input.loanInterestRate * 100)} auf ${formatCurrency(result.input.loanAmount)}, Rückzahlung in Jahr ${result.input.loanTermYears}`
        : `Zinsrate ${formatPercent(result.input.loanInterestRate * 100)} + Tilgungsrate ${formatPercent(result.input.loanRepaymentRate * 100)} auf ${formatCurrency(result.input.loanAmount)}`,
      loanOnly: true,
    },
    ...(result.input.bulletLoan && bulletLoanShowReturn ? (() => {
      const loanFullyRepaid = result.input.loanTermYears <= result.input.projectionYears;
      const termYear = Math.min(result.input.loanTermYears, result.input.projectionYears);
      const termRow = result.rows.find((r) => r.year === termYear) ?? lastYear;
      const netReturn = (loanFullyRepaid ? result.input.loanAmount : 0) + termRow.personCumulativeGrossInterest - termRow.personCumulativeInterestTax;
      return [{
        title: loanFullyRepaid
          ? `Endfälliges Darlehen: Netto-Gesamtrückfluss (Jahr ${termYear})`
          : `Endfälliges Darlehen: Netto-Zwischenbilanz (Jahr ${termYear}, Laufzeit endet erst Jahr ${result.input.loanTermYears})`,
        value: formatCurrency(netReturn),
        detail: loanFullyRepaid
          ? `${formatCurrency(result.input.loanAmount)} (Kapitalrückzahlung) + ${formatCurrency(termRow.personCumulativeGrossInterest)} (kum. Zinsen) − ${formatCurrency(termRow.personCumulativeInterestTax)} (kum. Steuer auf Zinsen)`
          : `Achtung: Laufzeitende (Jahr ${result.input.loanTermYears}) liegt außerhalb des Betrachtungszeitraums – Kapital noch nicht zurückgezahlt. ${formatCurrency(termRow.personCumulativeGrossInterest)} (kum. Zinsen bis Jahr ${termYear}) − ${formatCurrency(termRow.personCumulativeInterestTax)} (kum. Steuer auf Zinsen)`,
        loanOnly: true,
      }];
    })() : []),
    {
      title: "Mieteinnahmen p.a.",
      value: formatCurrency(result.annualRent),
      detail: result.deferredPurchase && result.purchaseYear === null
        ? "Immobilie nicht erworben im Betrachtungszeitraum – keine Mieteinnahmen"
        : `${formatCurrency(result.input.monthlyRent)} pro Monat${result.deferredPurchase && result.purchaseYear !== null ? ` (ab Jahr ${result.purchaseYear})` : ""}`,
      realEstateOnly: true,
    },
    {
      title: "AfA p.a.",
      value: formatCurrency(result.annualDepreciationBase),
      detail: `${formatPercent(result.input.depreciationRate * 100)} auf ${formatCurrency(result.depreciableBuildingBase)}${result.deferredPurchase && result.purchaseYear !== null ? ` (ab Jahr ${result.purchaseYear})` : ""}`,
      realEstateOnly: true,
    },
    {
      ...(result.deferredPurchase
        ? {
            title: result.purchaseYear !== null
              ? `Stiftung: Immobilienkauf in Jahr ${result.purchaseYear}`
              : "Stiftung: Immobilienkauf – nicht im Betrachtungszeitraum",
            value: result.purchaseYear !== null
              ? formatCurrency(result.propertyValue + result.realEstateTax)
              : "–",
            detail: result.purchaseYear !== null
              ? `ETF-Phase bis Jahr ${result.purchaseYear - 1}; Kaufpreis ${formatCurrency(result.propertyValue)} + GrESt ${formatCurrency(result.realEstateTax)}`
              : `ETF wächst auf ${formatCurrency(result.rows[result.rows.length - 1]?.foundationEtfLiquidationValue ?? 0)} (Liquidationswert Jahr ${result.input.projectionYears})`,
          }
        : {
            title: "Stiftung: Startliquidität nach Ankauf",
            value: formatCurrency(result.initialCash),
            detail: "Jahr 0 vor laufender Bewirtschaftung",
          }),
      realEstateOnly: true,
    },
    {
      title: "Stiftung: Nettovermögen Jahr 1",
      value: formatCurrency(firstYear.foundationWealth),
      detail: result.deferredPurchase && !(firstYear.propertyOwned)
        ? `ETF-Phase: Verwaltungskosten ${formatCurrency(result.input.annualAdminCost)} p.a.`
        : `Liquiditätsüberschuss ${formatCurrency(firstYear.foundationCashFlow)}`,
    },
    {
      title: `Stiftung: Nettovermögen Jahr ${result.input.projectionYears}`,
      value: formatCurrency(lastYear.foundationWealth),
      detail: `Restdarlehen ${formatCurrency(lastYear.remainingLoan)}`,
    },
    {
      title: `Person: Vermögensposition Jahr ${result.input.projectionYears}`,
      value: formatCurrency(lastYear.personAssetPosition),
      detail: `Persönlicher Steuersatz ${formatPercent(lastYear.personalTaxRate * 100)}, Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)}, ETF-Rendite ${formatPercent(result.input.etfReturnRate * 100)}, ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}, Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)}`,
      loanOnly: true,
    },
    {
      title: `Vergleichsvermögen Jahr ${result.input.projectionYears} (${compareScenarioLabel})`,
      value: formatCurrency(lastYear.compareWealth),
      detail: includeRealEstate
        ? `Ohne Stiftung, ohne Darlehen, ohne Verwaltungskosten, Mieteinnahmen zu ${formatPercent(lastYear.personalTaxRate * 100)} versteuert${compareTaxCardDetail}, Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)}, positive Liquidität in ETF (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)})`
        : `Ohne Stiftung, Kapital direkt in ETF investiert (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)}; Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)})`,
    },
    ...(includeRealEstate ? [{
      title: `ETF-Vergleichsvermögen Jahr ${result.input.projectionYears} (gleiches Kapital, nur ETF)`,
      value: formatCurrency(lastYear.etfOnlyWealth),
      detail: `Gleiches Startkapital (${formatCurrency(result.input.initialCapital)}) ohne Immobilie, vollständig in ETF investiert (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)}; Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)})`,
    }] : []),
  ].filter((card) => (!card.realEstateOnly || includeRealEstate) && (!card.loanOnly || result.input.loanAmount > 0));

  const wealthChart = useMemo(() => {
    if (result.rows.length === 0) {
      return {
        chartWidth: 900,
        chartHeight: 340,
        margin: {
          top: 20,
          right: 20,
          bottom: 48,
          left: 72,
        },
        xAxisLabelOffset: CHART_X_AXIS_LABEL_OFFSET,
        lines: [],
        yTicks: [],
        xTicks: [],
      };
    }

    const chartWidth = 900;
    const chartHeight = 340;
    const margin = {
      top: 20,
      right: 20,
      bottom: 48,
      left: 72,
    };
    const xAxisLabelOffset = CHART_X_AXIS_LABEL_OFFSET;
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;
    const maxIndex = Math.max(1, result.rows.length - 1);

    const compareSeriesLabel = `Vergleich: ${compareScenarioLabel} (ohne Stiftung)`;

    const allSeries = [
      {
        id: "foundation",
        label: "Stiftung",
        color: "#2563eb",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.foundationWealth,
        })),
      },
      {
        id: "person",
        label: "Privatperson (Darlehensgeber)",
        color: "#0f766e",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.personAssetPosition,
        })),
        loanOnly: true,
      },
      {
        id: "total",
        label: "Gesamtvermögen",
        color: "#7c3aed",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.foundationWealth + row.personAssetPosition,
        })),
        loanOnly: true,
      },
      {
        id: "compare",
        label: compareSeriesLabel,
        color: "#ea580c",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.compareWealth,
        })),
      },
      {
        id: "etfOnly",
        label: "Gleiches Kapital, nur ETF (ohne Immobilie)",
        color: "#16a34a",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.etfOnlyWealth,
        })),
        realEstateOnly: true,
      },
    ];
    const series = allSeries.filter((s) => (!s.realEstateOnly || includeRealEstate) && (!s.loanOnly || result.input.loanAmount > 0));

    const allValues = series.flatMap((line) => line.values.map((entry) => entry.value));
    const minValue = Math.min(CHART_MIN_VALUE_FLOOR, ...allValues);
    const maxValue = Math.max(...allValues);
    const valueRange = maxValue - minValue || 1;

    const yFromValue = (value) =>
      margin.top + ((maxValue - value) / valueRange) * innerHeight;
    const xFromIndex = (index) =>
      margin.left + (index / maxIndex) * innerWidth;

    const lines = series.map((line) => ({
      ...line,
      points: line.values.map((entry, index) => ({
        x: xFromIndex(index),
        y: yFromValue(entry.value),
        year: entry.year,
        value: entry.value,
      })),
    }));

    const yTicks = Array.from({ length: CHART_Y_TICK_COUNT }, (_, index) => {
      const ratio = CHART_Y_TICK_COUNT === 1 ? 0 : index / (CHART_Y_TICK_COUNT - 1);
      const value = maxValue - valueRange * ratio;
      return {
        value,
        y: yFromValue(value),
      };
    });

    const xTickStep = Math.max(1, Math.ceil(result.rows.length / CHART_MAX_X_TICKS));
    const xTicks = result.rows
      .map((row, index) => ({
        index,
        year: row.year,
        x: xFromIndex(index),
      }))
      .filter(
        (tick, index, allTicks) =>
          index === 0 || index === allTicks.length - 1 || tick.index % xTickStep === 0,
      );

    const breakEvenIndex = result.rows.findIndex(
      (row, index) => index >= 1 && row.foundationWealth + row.personAssetPosition >= row.compareWealth,
    );
    const breakEven =
      breakEvenIndex >= 0
        ? {
            year: result.rows[breakEvenIndex].year,
            x: xFromIndex(breakEvenIndex),
          }
        : null;

    return {
      chartWidth,
      chartHeight,
      margin,
      xAxisLabelOffset,
      lines,
      yTicks,
      xTicks,
      breakEven,
    };
  }, [result.rows, result.input.loanAmount, includeRealEstate, compareScenarioLabel]);

  function handleFieldChange(fieldId, value) {
    setState((currentState) => {
      const nextFormValues = {
        ...currentState.formValues,
        [fieldId]: value,
      };
      const nextValidation = validateFormValues(getEffectiveFormValues(nextFormValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);

      return {
        ...currentState,
        formValues: nextFormValues,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRelationshipChange(nextRelationshipId) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      const nextRelationship = getRelationshipOption(nextRelationshipId);
      return {
        ...currentState,
        relationshipId: nextRelationship.id,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                nextRelationship,
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleSurplusToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        surplusToRepayment: checked,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                checked,
                nextTaxValidation.parsedSteps,
                currentState.comparePaysRealEstateTax,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleCompareRealEstateTaxToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        comparePaysRealEstateTax: checked,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                checked,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleIncludeRealEstateToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, checked), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        includeRealEstate: checked,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                checked ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleBundeslandChange(name) {
    const bl = BUNDESLAENDER.find((b) => b.name === name) ?? null;
    setState((currentState) => {
      const nextFormValues = bl
        ? { ...currentState.formValues, realEstateTaxRate: String(bl.rate) }
        : currentState.formValues;
      const nextValidation = validateFormValues(getEffectiveFormValues(nextFormValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        bundesland: name || null,
        formValues: nextFormValues,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleTaxStepChange(index, field, value) {
    setState((currentState) => {
      const nextSteps = currentState.personalTaxSteps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step,
      );
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(nextSteps);
      return {
        ...currentState,
        personalTaxSteps: nextSteps,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleAddTaxStep() {
    setState((currentState) => {
      const lastStep = currentState.personalTaxSteps[currentState.personalTaxSteps.length - 1];
      const lastFromYear = parseNumber(String(lastStep?.fromYear ?? "0")) ?? 0;
      const newStep = { fromYear: String(lastFromYear + 1), rate: lastStep?.rate ?? "42" };
      const nextSteps = [...currentState.personalTaxSteps, newStep];
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(nextSteps);
      return {
        ...currentState,
        personalTaxSteps: nextSteps,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRemoveTaxStep(index) {
    setState((currentState) => {
      if (currentState.personalTaxSteps.length <= 1) return currentState;
      const nextSteps = currentState.personalTaxSteps.filter((_, i) => i !== index);
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(nextSteps);
      return {
        ...currentState,
        personalTaxSteps: nextSteps,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleBulletLoanToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), checked);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        bulletLoan: checked,
        // When switching off bullet loan, also reset show-return
        bulletLoanShowReturn: checked ? currentState.bulletLoanShowReturn : false,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                checked,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleBulletLoanShowReturnToggle(checked) {
    setState((currentState) => ({
      ...currentState,
      bulletLoanShowReturn: checked,
    }));
  }

  function handleLenderTenantToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      const nextTenantRentFromExternalFunds = checked
        ? currentState.tenantRentFromExternalFunds
        : false;
      return {
        ...currentState,
        lenderIsTenant: checked,
        tenantRentFromExternalFunds: nextTenantRentFromExternalFunds,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                checked,
                nextTenantRentFromExternalFunds,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleTenantRentFromExternalFundsToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        tenantRentFromExternalFunds: checked,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                checked,
                validateMaintenanceEvents(currentState.maintenanceEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleAddMaintenanceEvent() {
    setState((currentState) => {
      const nextEvents = [
        ...currentState.maintenanceEvents,
        { year: "1", amount: "5000", type: "full" },
      ];
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        maintenanceEvents: nextEvents,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(nextEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRemoveMaintenanceEvent(index) {
    setState((currentState) => {
      const nextEvents = currentState.maintenanceEvents.filter((_, i) => i !== index);
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        maintenanceEvents: nextEvents,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(nextEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleMaintenanceEventChange(index, field, value) {
    setState((currentState) => {
      const nextEvents = currentState.maintenanceEvents.map((evt, i) =>
        i === index ? { ...evt, [field]: value } : evt,
      );
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        maintenanceEvents: nextEvents,
        result: nextValidation.input && nextTaxValidation.parsedSteps
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                nextTaxValidation.parsedSteps,
                currentState.includeRealEstate ? currentState.comparePaysRealEstateTax : false,
                currentState.bulletLoan,
                currentState.lenderIsTenant,
                currentState.tenantRentFromExternalFunds,
                validateMaintenanceEvents(nextEvents).parsedEvents,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleOverviewYearChange(value) {
    setState((currentState) => ({
      ...currentState,
      selectedOverviewYear: value,
    }));
  }

  const wealthDiff =
    lastYear.foundationWealth +
    (result.input.loanAmount > 0 ? lastYear.personAssetPosition : 0) -
    lastYear.compareWealth;

  return (
    <>
      <ServiceWorkerRegistration />
      <main className={styles.page}>
        <section className={styles.intro}>
          <div className={styles.introHeader}>
            <Image
              src="/logo.svg"
              alt="Logo Familienstiftung-Rechner"
              className={styles.logo}
              width={72}
              height={72}
              priority
            />
            <div>
              <h1 className={styles.introTitle}>Familienstiftung-Rechner</h1>
              <p className={styles.introText}>
                Dieser Next.js-Rechner bildet die Vermögens- und Ergebniswirkung für
                eine Familienstiftung und die darlehensgebende Person ab. Nach dem
                ersten Laden bleibt die PWA auch offline nutzbar.
              </p>
            </div>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusBadge}>Offline-fähige PWA</span>
            <span className={styles.statusBadge}>Installierbar auf Mobil & Desktop</span>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Eingaben</h2>
          <fieldset className={styles.radioFieldset}>
            <legend className={styles.fieldLabel}>Verwandtschaftsgruppe der Begünstigten</legend>
            <div className={styles.radioGroup}>
              {RELATIONSHIP_OPTIONS.map((option) => (
                <label key={option.id} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="relationship"
                    value={option.id}
                    checked={relationshipId === option.id}
                    onChange={() => handleRelationshipChange(option.id)}
                    className={styles.radio}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className={styles.hint}>
              Für die Erstausstattung gilt die günstigste Steuerklasse aus dem Kreis der Begünstigten; Schenkungssteuersatz und pauschaler Freibetrag werden daraus abgeleitet.
            </p>
          </fieldset>
          <div className={styles.checkboxRow}>
            <input
              id="includeRealEstate"
              type="checkbox"
              checked={includeRealEstate}
              onChange={(event) => handleIncludeRealEstateToggle(event.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="includeRealEstate" className={styles.checkboxLabel}>
              Immobilie in die Rechnung einbeziehen
            </label>
          </div>
          {(() => {
            const renderField = (field) => {
              const isInvalid = validation.invalidIds.includes(field.id);
              return (
                <div key={field.id}>
                  <label htmlFor={field.id} className={styles.fieldLabel}>
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={formValues[field.id]}
                    onChange={(event) => handleFieldChange(field.id, event.target.value)}
                    className={`${styles.fieldInput} ${isInvalid ? styles.fieldInputInvalid : ""}`.trim()}
                    aria-invalid={isInvalid}
                    required
                  />
                </div>
              );
            };

            const nonRealEstateFields = FIELD_DEFINITIONS.filter(
              (f) =>
                !f.realEstate &&
                !(f.id === "loanRepaymentRate" && bulletLoan) &&
                !(f.conditionalField === "bulletLoan" && !bulletLoan),
            );

            const realEstateFields = FIELD_DEFINITIONS.filter((f) => f.realEstate);

            return (
              <>
                <div className={styles.grid}>
                  {nonRealEstateFields.map(renderField)}
                </div>
                {includeRealEstate && (
                  <div className={styles.realEstateFields}>
                    <div className={styles.bundeslandRow}>
                      <label htmlFor="bundesland" className={styles.fieldLabel}>
                        Bundesland (setzt Grunderwerbsteuer-Satz)
                      </label>
                      <select
                        id="bundesland"
                        value={bundesland ?? ""}
                        onChange={(event) => handleBundeslandChange(event.target.value)}
                        className={styles.fieldInput}
                      >
                        <option value="">— Manuell eingeben —</option>
                        {BUNDESLAENDER.map((bl) => (
                          <option key={bl.name} value={bl.name}>
                            {bl.name} ({bl.rate} %)
                          </option>
                        ))}
                      </select>
                    </div>
                    {realEstateFields.map(renderField)}
                  </div>
                )}
              </>
            );
          })()}
          <div className={styles.taxStepsSection}>
            <span className={styles.fieldLabel}>Persönlicher Steuersatz der Person (%)</span>
            <p className={styles.hint}>
              Für jede Periode den Startzeitraum (ab welchem Jahr) und den zugehörigen Steuersatz eingeben.
              Die zuletzt passende Periode gilt für alle nachfolgenden Jahre.
            </p>
            {personalTaxSteps.map((step, index) => {
              const isInvalidStep = taxStepsValidation.invalidIndices.includes(index);
              return (
                <div key={index} className={styles.taxStepRow}>
                  <div className={styles.taxStepField}>
                    <label htmlFor={`taxStepFrom_${index}`} className={styles.taxStepLabel}>Ab Jahr</label>
                    <input
                      id={`taxStepFrom_${index}`}
                      type="number"
                      min="1"
                      step="1"
                      value={step.fromYear}
                      onChange={(event) => handleTaxStepChange(index, "fromYear", event.target.value)}
                      className={`${styles.fieldInput} ${isInvalidStep ? styles.fieldInputInvalid : ""}`.trim()}
                      aria-invalid={isInvalidStep}
                      required
                    />
                  </div>
                  <div className={styles.taxStepField}>
                    <label htmlFor={`taxStepRate_${index}`} className={styles.taxStepLabel}>Steuersatz (%)</label>
                    <input
                      id={`taxStepRate_${index}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={step.rate}
                      onChange={(event) => handleTaxStepChange(index, "rate", event.target.value)}
                      className={`${styles.fieldInput} ${isInvalidStep ? styles.fieldInputInvalid : ""}`.trim()}
                      aria-invalid={isInvalidStep}
                      required
                    />
                  </div>
                  {personalTaxSteps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTaxStep(index)}
                      className={styles.taxStepRemoveButton}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddTaxStep}
              className={styles.taxStepAddButton}
            >
              + Periode hinzufügen
            </button>
          </div>
          <p className={styles.hint}>Leere oder ungültige Eingaben werden rot markiert.</p>
          {hasInvalidFields || hasInvalidTaxSteps ? (
            <p className={styles.validationMessage}>
              Bitte korrigieren Sie die rot markierten Eingaben. Bis dahin bleiben
              die zuletzt gültigen Ergebnisse sichtbar.
            </p>
          ) : null}
          <div className={styles.checkboxRow}>
            <input
              id="bulletLoan"
              type="checkbox"
              checked={bulletLoan}
              onChange={(event) => handleBulletLoanToggle(event.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="bulletLoan" className={styles.checkboxLabel}>
              Endfälliges Darlehen (keine laufende Tilgung, volle Rückzahlung am Laufzeitende)
            </label>
          </div>
          {bulletLoan && (
            <div className={styles.checkboxRow}>
              <input
                id="bulletLoanShowReturn"
                type="checkbox"
                checked={bulletLoanShowReturn}
                onChange={(event) => handleBulletLoanShowReturnToggle(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="bulletLoanShowReturn" className={styles.checkboxLabel}>
                Netto-Gesamtrückfluss anzeigen (Kapital + Zinsen − Steuer auf Zinsen)
              </label>
            </div>
          )}
          {!bulletLoan && (
            <div className={styles.checkboxRow}>
              <input
                id="surplusToRepayment"
                type="checkbox"
                checked={surplusToRepayment}
                onChange={(event) => handleSurplusToggle(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="surplusToRepayment" className={styles.checkboxLabel}>
                Jährlichen Liquiditätsüberschuss als Sondertilgung verwenden
              </label>
            </div>
          )}
          {includeRealEstate && (
            <div className={styles.checkboxRow}>
              <input
                id="lenderIsTenant"
                type="checkbox"
                checked={lenderIsTenant}
                onChange={(event) => handleLenderTenantToggle(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="lenderIsTenant" className={styles.checkboxLabel}>
                Darlehensgeber als Mieter annehmen
              </label>
            </div>
          )}
          {includeRealEstate && lenderIsTenant && (
            <div className={styles.checkboxRow}>
              <input
                id="tenantRentFromExternalFunds"
                type="checkbox"
                checked={tenantRentFromExternalFunds}
                onChange={(event) => handleTenantRentFromExternalFundsToggle(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="tenantRentFromExternalFunds" className={styles.checkboxLabel}>
                Miete aus externen Mitteln zahlen (nicht aus Vermögen der Person)
              </label>
            </div>
          )}
          {includeRealEstate && (
            <div className={styles.checkboxRow}>
              <input
                id="comparePaysRealEstateTax"
                type="checkbox"
                checked={comparePaysRealEstateTax}
                onChange={(event) => handleCompareRealEstateTaxToggle(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="comparePaysRealEstateTax" className={styles.checkboxLabel}>
                Vergleichsvermögen zahlt Grunderwerbsteuer
              </label>
            </div>
          )}
          {includeRealEstate && (
            <div className={styles.taxStepsSection}>
              <span className={styles.fieldLabel}>Ereignisse: Instandhaltung</span>
              <p className={styles.hint}>
                Einmalige Instandhaltungskosten eintragen, die in einem bestimmten Jahr anfallen.
                Wählen Sie, ob die Kosten steuerlich voll abzugsfähig sind oder über 2 % AfA abgeschrieben werden.
                Eine Umlage auf den Mieter ist nicht vorgesehen.
              </p>
              {maintenanceEvents.map((evt, index) => {
                const isInvalid = maintenanceValidation.invalidIndices.includes(index);
                return (
                  <div key={index} className={styles.taxStepRow}>
                    <div className={styles.taxStepField}>
                      <label htmlFor={`maintYear_${index}`} className={styles.taxStepLabel}>Jahr</label>
                      <input
                        id={`maintYear_${index}`}
                        type="number"
                        min="1"
                        step="1"
                        value={evt.year}
                        onChange={(event) => handleMaintenanceEventChange(index, "year", event.target.value)}
                        className={`${styles.fieldInput} ${isInvalid ? styles.fieldInputInvalid : ""}`.trim()}
                        aria-invalid={isInvalid}
                        required
                      />
                    </div>
                    <div className={styles.taxStepField}>
                      <label htmlFor={`maintAmount_${index}`} className={styles.taxStepLabel}>Betrag (€)</label>
                      <input
                        id={`maintAmount_${index}`}
                        type="number"
                        min="0.01"
                        step="100"
                        value={evt.amount}
                        onChange={(event) => handleMaintenanceEventChange(index, "amount", event.target.value)}
                        className={`${styles.fieldInput} ${isInvalid ? styles.fieldInputInvalid : ""}`.trim()}
                        aria-invalid={isInvalid}
                        required
                      />
                    </div>
                    <div className={styles.taxStepField}>
                      <label htmlFor={`maintType_${index}`} className={styles.taxStepLabel}>Steuerliche Behandlung</label>
                      <select
                        id={`maintType_${index}`}
                        value={evt.type}
                        onChange={(event) => handleMaintenanceEventChange(index, "type", event.target.value)}
                        className={styles.fieldInput}
                      >
                        <option value="full">Voll abzugsfähig (Sofortabzug)</option>
                        <option value="afa">2 % AfA (Abschreibung)</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaintenanceEvent(index)}
                      className={styles.taxStepRemoveButton}
                    >
                      Entfernen
                    </button>
                  </div>
                );
              })}
              {hasInvalidMaintenanceEvents && (
                <p className={styles.validationMessage}>
                  Bitte korrigieren Sie die rot markierten Instandhaltungseinträge (Jahr ≥ 1, Betrag &gt; 0).
                </p>
              )}
              <button
                type="button"
                onClick={handleAddMaintenanceEvent}
                className={styles.taxStepAddButton}
              >
                + Instandhaltung hinzufügen
              </button>
            </div>
          )}
          <p className={styles.hint}>
            {bulletLoan
              ? `Endfälliges Darlehen: Während der Laufzeit (${result.input.loanTermYears} Jahre) werden nur Zinsen auf die volle Darlehenssumme gezahlt; die Tilgung erfolgt als Einmalzahlung am Laufzeitende.`
              : "Annahme: Die Tilgung erfolgt jährlich als konstanter Prozentsatz vom ursprünglichen Darlehensbetrag; die Zinsen fallen auf die jeweilige Restschuld an."}{" "}
            Die Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG) wird alle
            30 Jahre auf Basis des Nettovermögens berechnet: 2 fiktive Kinder
            (Freibetrag je {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)}, vereinfachter
            Pauschalsatz {formatPercent(ERBERSATZ_TAX_RATE * 100)}). Die Zahlung
            erfolgt in 30 gleichen Jahresraten an das Finanzamt (§ 24 ErbStG).
          </p>
        </section>

        <section>
          <div className={styles.cards}>
            {cards.map((card) => (
              <article key={card.title} className={styles.card}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <div className={styles.value}>{card.value}</div>
                <div>{card.detail}</div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Vermögensverlauf</h2>
          <p className={styles.hint}>
            Das Diagramm aktualisiert sich direkt bei jeder Parameteränderung.
          </p>
          <div className={styles.chartWrap}>
            <svg
              viewBox={`0 0 ${wealthChart.chartWidth} ${wealthChart.chartHeight}`}
              className={styles.chart}
              role="img"
              aria-label="Zeitlicher Verlauf von Stiftungs-, Privat- und Gesamtvermögen"
            >
              {wealthChart.yTicks.map((tick) => (
                <g key={`y-${tick.y}`}>
                  <line
                    x1={wealthChart.margin.left}
                    y1={tick.y}
                    x2={wealthChart.chartWidth - wealthChart.margin.right}
                    y2={tick.y}
                    className={styles.chartGridLine}
                  />
                  <text x={wealthChart.margin.left - 6} y={tick.y + 4} className={styles.chartAxisLabel}>
                    {formatCurrency(tick.value)}
                  </text>
                </g>
              ))}

              {wealthChart.xTicks.map((tick) => (
                <g key={`x-${tick.year}`}>
                  <line
                    x1={tick.x}
                    y1={wealthChart.margin.top}
                    x2={tick.x}
                    y2={wealthChart.chartHeight - wealthChart.margin.bottom}
                    className={styles.chartGridLineVertical}
                  />
                  <text
                    x={tick.x}
                    y={wealthChart.chartHeight - wealthChart.xAxisLabelOffset}
                    className={styles.chartAxisLabelX}
                  >
                    {tick.year}
                  </text>
                </g>
              ))}

              {wealthChart.lines.map((line) => (
                <g key={line.id}>
                  <path
                    d={createSvgLinePath(line.points)}
                    fill="none"
                    stroke={line.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}

              {wealthChart.breakEven && (
                <g>
                  <line
                    x1={wealthChart.breakEven.x}
                    y1={wealthChart.margin.top}
                    x2={wealthChart.breakEven.x}
                    y2={wealthChart.chartHeight - wealthChart.margin.bottom}
                    className={styles.chartBreakEvenLine}
                  />
                  <text
                    x={wealthChart.breakEven.x + 5}
                    y={wealthChart.margin.top + 14}
                    className={styles.chartBreakEvenLabel}
                  >
                    Break-Even: Jahr {wealthChart.breakEven.year}
                  </text>
                </g>
              )}
            </svg>
          </div>
          <div className={styles.chartLegend}>
            {wealthChart.lines.map((line) => (
              <div key={`legend-${line.id}`} className={styles.chartLegendItem}>
                <span
                  className={styles.chartLegendSwatch}
                  style={{ backgroundColor: line.color }}
                  aria-hidden="true"
                />
                <span>{line.label}</span>
              </div>
            ))}
          </div>
          {wealthChart.breakEven ? (
            <p className={styles.breakEvenBadge}>
              ✓ Break-Even erreicht in Jahr {wealthChart.breakEven.year} – ab diesem Jahr erreicht oder übersteigt das Gesamtvermögen (Stiftung) das Vergleichsvermögen (Privatvermietung).
            </p>
          ) : (
            <p className={styles.breakEvenMissing}>
              Kein Break-Even im Projektionszeitraum erreicht.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Jahresübersicht</h2>
          <div className={styles.yearFilterRow}>
            <label htmlFor="overviewYear" className={styles.fieldLabel}>
              Jahr filtern
            </label>
            <select
              id="overviewYear"
              value={normalizedOverviewYear}
              onChange={(event) => handleOverviewYearChange(event.target.value)}
              className={styles.fieldInput}
            >
              <option value="all">Alle Jahre</option>
              {overviewYearOptions.map((year) => (
                <option key={year} value={year}>
                  Jahr {year}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.yearList}>
            {visibleOverviewRows.map((row) => (
              <div key={row.year} className={styles.yearCard}>
                <h3 className={styles.yearCardTitle}>Jahr {row.year}</h3>

                {row.propertyBoughtThisYear && (
                  <p className={styles.hint}>
                    🏠 Immobilie in diesem Jahr erworben (ETF-Teilverkauf {formatCurrency(row.etfSaleForPurchase)}, davon Steuer {formatCurrency(row.etfSaleTaxForPurchase)}, Nettomittel {formatCurrency(row.etfSaleNetForPurchase)}; Darlehen {formatCurrency(result.input.loanAmount)} aufgenommen).
                  </p>
                )}
                {row.guvMaintenanceEtfSaleGross > 0 && (
                  <p className={styles.hint}>
                    🔧 Instandhaltungsfinanzierung: ETF-Teilverkauf {formatCurrency(row.guvMaintenanceEtfSaleGross)} (Steuer {formatCurrency(row.guvMaintenanceEtfSaleTax)}, Nettomittel {formatCurrency(row.guvMaintenanceEtfSaleNet)}) zur Deckung der Instandhaltungskosten {formatCurrency(row.guvMaintenanceCashOut)}.
                  </p>
                )}
                {result.deferredPurchase && !row.propertyOwned && row.year > 0 && (
                  <p className={styles.hint}>
                    📈 ETF-Phase: Noch kein Immobilienkauf – Kapital in ETF investiert, laufende Kosten werden aus Erträgen gedeckt.
                  </p>
                )}

                <div className={styles.yearSection}>
                  <h4 className={styles.yearSectionTitle}>Übersicht</h4>
                  <div className={styles.guvColumns}>
                    <div className={styles.guvColumn}>
                      <h5 className={styles.guvColumnTitle}>Stiftung</h5>
                      <dl className={styles.dataGrid}>
                        <div className={styles.dataItem}>
                          {row.year > 0 ? (
                            <>
                              <dt>{row.propertyOwned ? "Jährl. Liquiditätsüberschuss" : "Jährl. Liquiditätsveränderung (ETF-Phase)"}</dt>
                              <dd className={row.foundationCashFlow < 0 ? styles.negative : styles.positive}>
                                {formatCurrency(row.foundationCashFlow)}
                              </dd>
                              {row.propertyOwned ? (
                                <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen){row.guvMaintenanceCashOut > 0 ? ` − ${formatCurrency(row.guvMaintenanceCashOut)} (Instandhaltung)` : ""}</small>
                              ) : (
                                <small className={styles.formula}>− {formatCurrency(row.guvAdminCost)} (Verwaltungskosten, keine Mieteinnahmen)</small>
                              )}
                            </>
                          ) : (
                            <>
                              <dt>Startliquidität</dt>
                              <dd>{formatCurrency(row.foundationCash)}</dd>
                              {result.deferredPurchase ? (
                                <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer) — Immobilienkauf zurückgestellt</small>
                              ) : (
                                <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer) + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue)} (Kaufpreis) − {formatCurrency(result.realEstateTax)} (GrESt)</small>
                              )}
                            </>
                          )}
                        </div>
                        <div className={styles.dataItem}>
                          <dt>Steuerliches Ergebnis</dt>
                          <dd>{formatCurrency(row.taxableResult)}</dd>
                          {row.year > 0 && row.propertyOwned && (
                            <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.guvDepreciation)} (AfA)</small>
                          )}
                          {row.year > 0 && !row.propertyOwned && (
                            <small className={styles.formula}>− {formatCurrency(row.guvAdminCost)} (Verwaltungskosten, keine Immobilienerträge)</small>
                          )}
                        </div>
                        {row.year === 0 && !result.deferredPurchase && (
                          <div className={styles.dataItem}>
                            <dt>Grunderwerbsteuer (Anschaffungskosten)</dt>
                            <dd className={styles.negative}>{formatCurrency(result.realEstateTax)}</dd>
                            <small className={styles.formula}>{formatPercent(result.input.realEstateTaxRate * 100)} × {formatCurrency(result.propertyValue)} (Kaufpreis) — Gebäudeanteil {formatCurrency(result.realEstateTaxBuildingPortion)} wird abgeschrieben</small>
                          </div>
                        )}
                        {row.propertyBoughtThisYear && (
                          <div className={styles.dataItem}>
                            <dt>Grunderwerbsteuer (Anschaffungskosten)</dt>
                            <dd className={styles.negative}>{formatCurrency(result.realEstateTax)}</dd>
                            <small className={styles.formula}>{formatPercent(result.input.realEstateTaxRate * 100)} × {formatCurrency(result.propertyValue)} (Kaufpreis) — Gebäudeanteil {formatCurrency(result.realEstateTaxBuildingPortion)} wird abgeschrieben</small>
                          </div>
                        )}
                        <div className={styles.dataItem}>
                          <dt>Nettovermögen</dt>
                          <dd>{formatCurrency(row.foundationWealth)}</dd>
                          {row.propertyOwned ? (
                            <small className={styles.formula}>{formatCurrency(row.foundationCash)} (Kassenbestand) + {formatCurrency(row.foundationEtfLiquidationValue)} (ETF nach Verkaufsteuer) + {formatCurrency(result.propertyValue)} (Immobilienwert) − {formatCurrency(row.remainingLoan)} (Restdarlehen){row.erbsRemainingLiability > 0 ? ` − ${formatCurrency(row.erbsRemainingLiability)} (Erbersatzsteuer-Verbindlichkeit)` : ""}</small>
                          ) : (
                            <small className={styles.formula}>{formatCurrency(row.foundationCash)} (Kassenbestand) + {formatCurrency(row.foundationEtfLiquidationValue)} (ETF nach Verkaufsteuer) — keine Immobilie</small>
                          )}
                        </div>
                        {row.year > 0 && row.year % ERBERSATZ_CYCLE_YEARS === 0 && (
                          <div className={styles.dataItem}>
                            <dt>Erbersatzsteuer (fällig, § 1 Abs. 1 Nr. 4 ErbStG)</dt>
                            <dd className={row.erbsTriggeredAmount > 0 ? styles.negative : undefined}>
                              {formatCurrency(row.erbsTriggeredAmount)}
                            </dd>
                            <small className={styles.formula}>
                              {ERBERSATZ_CHILDREN} × max(0, {formatCurrency((row.foundationCash + row.foundationEtfLiquidationValue + (row.propertyOwned ? result.propertyValue : 0) - row.remainingLoan) / ERBERSATZ_CHILDREN)} − {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)} Freibetrag) × {formatPercent(ERBERSATZ_TAX_RATE * 100)}
                              {row.erbsTriggeredAmount > 0
                                ? ` — wird auf ${ERBERSATZ_CYCLE_YEARS} Jahresraten à ${formatCurrency(row.erbsTriggeredAmount / ERBERSATZ_CYCLE_YEARS)} verteilt`
                                : " — kein steuerpflichtiger Betrag im aktuellen 30-Jahres-Zyklus"}
                            </small>
                          </div>
                        )}
                        {row.year > 0 && (
                          <div className={styles.dataItem}>
                            <dt>Erbersatzsteuer: zahlbarer Jahresanteil</dt>
                            <dd className={row.erbsInstallmentShare > 0 ? styles.negative : undefined}>
                              {formatPercent(row.erbsInstallmentShare * 100)}
                            </dd>
                            <small className={styles.formula}>
                              {row.erbsCurrentCycleAmount > 0
                                ? `${formatCurrency(row.erbsInstallmentPaid)} von ${formatCurrency(row.erbsCurrentCycleAmount)} (aktueller Steuerfall)`
                                : "Keine laufende Erbersatzsteuer-Rate"}
                            </small>
                          </div>
                        )}
                      </dl>
                    </div>
                    <div className={styles.guvColumn}>
                      <h5 className={styles.guvColumnTitle}>Privat (Darlehensgeber)</h5>
                      <dl className={styles.dataGrid}>
                        <div className={styles.dataItem}>
                          <dt>Restdarlehen</dt>
                          <dd>{formatCurrency(row.remainingLoan)}</dd>
                          {row.year > 0 && row.propertyOwned && (
                            <small className={styles.formula}>
                              {formatCurrency(row.loanAtStartOfYear)} (Anfangsschuld) − {formatCurrency(row.scheduledRepayment)} (planm. Tilgung){row.extraRepayment > 0 ? ` − ${formatCurrency(row.extraRepayment)} (Sondertilgung)` : ""}
                            </small>
                          )}
                          {row.year > 0 && !row.propertyOwned && (
                            <small className={styles.formula}>Kein Darlehen – Immobilienkauf noch ausstehend</small>
                          )}
                        </div>
                        <div className={styles.dataItem}>
                          <dt>Netto-Zufluss</dt>
                          <dd>{formatCurrency(row.personNetCashFlow)}</dd>
                          {row.year > 0 && row.propertyOwned && (
                            <small className={styles.formula}>
                              {formatCurrency(row.scheduledRepayment)} (planm. Tilgung){row.extraRepayment > 0 ? ` + ${formatCurrency(row.extraRepayment)} (Sondertilgung)` : ""} + {formatCurrency(row.personGuvResult)} (Netto-Zinsergebnis){row.personRentPaidFromAssets > 0 ? ` − ${formatCurrency(row.personRentPaidFromAssets)} (Mietzahlung aus Vermögen)` : ""}
                            </small>
                          )}
                        </div>
                        <div className={styles.dataItem}>
                          <dt>Vermögensposition</dt>
                          <dd>{formatCurrency(row.personAssetPosition)}</dd>
                          {row.year > 0 && <small className={styles.formula}>{formatCurrency(row.remainingLoan)} (Restdarlehen) + {formatCurrency(row.personCash)} (Kasse) + {formatCurrency(row.personEtfLiquidationValue)} (ETF nach Verkaufsteuer)</small>}
                        </div>
                        {result.input.bulletLoan && bulletLoanShowReturn && row.year > 0 && (
                          <div className={styles.dataItem}>
                            <dt>Kumulierter Netto-Rückfluss (endfälliges Darlehen)</dt>
                            <dd className={styles.positive}>
                              {formatCurrency(
                                (row.remainingLoan === 0 ? result.input.loanAmount : 0) +
                                row.personCumulativeGrossInterest - row.personCumulativeInterestTax
                              )}
                            </dd>
                            <small className={styles.formula}>
                              {row.remainingLoan === 0
                                ? `${formatCurrency(result.input.loanAmount)} (Kapitalrückzahlung) + `
                                : `Kapital (${formatCurrency(result.input.loanAmount)}) noch ausstehend + `}
                              {formatCurrency(row.personCumulativeGrossInterest)} (kum. Zinsen) − {formatCurrency(row.personCumulativeInterestTax)} (kum. Steuer auf Zinsen)
                            </small>
                          </div>
                        )}
                      </dl>
                    </div>
                    <div className={styles.guvColumn}>
                      <h5 className={styles.guvColumnTitle}>Privat ohne Stiftung (Vergleich)</h5>
                      <dl className={styles.dataGrid}>
                        <div className={styles.dataItem}>
                          <dt>Vergleichsvermögen</dt>
                          <dd>{formatCurrency(row.compareWealth)}</dd>
                          <small className={styles.formula}>Kasse + ETF (nach Verkaufsteuer) + {formatCurrency(result.propertyValue)} (Immobilienwert) — ohne Stiftung, ohne Darlehen, ohne Verwaltungskosten, Miete zu {formatPercent(row.personalTaxRate * 100)} versteuert{compareTaxFormulaDetail}</small>
                        </div>
                        {row.compareMaintenanceCashOut > 0 && (
                          <div className={styles.dataItem}>
                            <dt>Instandhaltung (Privat)</dt>
                            <dd className={styles.negative}>{formatCurrency(row.compareMaintenanceCashOut)}</dd>
                            <small className={styles.formula}>
                              {row.compareMaintenanceFullDeduction > 0 && `${formatCurrency(row.compareMaintenanceFullDeduction)} voll abzugsfähig`}
                              {row.compareMaintenanceFullDeduction > 0 && row.compareMaintenanceAfaAddition > 0 && "; "}
                              {row.compareMaintenanceAfaAddition > 0 && `${formatCurrency(row.compareMaintenanceAfaAddition)} AfA-aktiviert`}
                              {row.compareMaintenanceEtfSaleGross > 0 && `; ETF-Verkauf ${formatCurrency(row.compareMaintenanceEtfSaleGross)} (Steuer ${formatCurrency(row.compareMaintenanceEtfSaleTax)}, Netto ${formatCurrency(row.compareMaintenanceEtfSaleNet)})`}
                            </small>
                          </div>
                        )}
                      </dl>
                    </div>
                    {includeRealEstate && (
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Gleiches Kapital, nur ETF (Vergleich)</h5>
                        <dl className={styles.dataGrid}>
                          <div className={styles.dataItem}>
                            <dt>Vergleichsvermögen (ETF-only)</dt>
                            <dd>{formatCurrency(row.etfOnlyWealth)}</dd>
                            <small className={styles.formula}>ETF (nach Verkaufsteuer) — gleiches Startkapital ({formatCurrency(result.input.initialCapital)}), keine Immobilie, kein Darlehen, kein Verwaltungsaufwand</small>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </div>

                {row.year > 0 && (
                  <div className={styles.yearSection}>
                    <h4 className={styles.yearSectionTitle}>GuV-Rechnung</h4>
                    <div className={styles.guvColumns}>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Stiftung</h5>
                        <dl className={styles.dataGrid}>
                          <div className={styles.dataItem}>
                            <dt>Mieteinnahmen</dt>
                            <dd>{formatCurrency(row.guvRent)}</dd>
                            {row.propertyOwned ? (
                              <small className={styles.formula}>12 Monate × {formatCurrency(result.input.monthlyRent)} (Monatsmiete)</small>
                            ) : (
                              <small className={styles.formula}>Keine Mieteinnahmen – Immobilie noch nicht erworben</small>
                            )}
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Verwaltungskosten</dt>
                            <dd>{formatCurrency(row.guvAdminCost)}</dd>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Darlehenszinsen</dt>
                            <dd>{formatCurrency(row.guvInterest)}</dd>
                            {row.propertyOwned ? (
                              <small className={styles.formula}>{formatCurrency(row.loanAtStartOfYear)} (Restschuld) × {formatPercent(result.input.loanInterestRate * 100)} (Zinssatz)</small>
                            ) : (
                              <small className={styles.formula}>Kein Darlehen – Immobilienkauf noch ausstehend</small>
                            )}
                          </div>
                          <div className={styles.dataItem}>
                            <dt>AfA</dt>
                            <dd>{formatCurrency(row.guvDepreciation)}</dd>
                            {row.propertyOwned && (
                              <small className={styles.formula}>{formatCurrency(result.depreciableBuildingBase)} (Gebäude inkl. GrESt-Anteil) × {formatPercent(result.input.depreciationRate * 100)} (AfA-Satz){row.guvMaintenanceAfaAddition > 0 ? ` + ${formatCurrency(row.guvMaintenanceAfaAddition)} (neue AfA-Basis Instandhaltung)` : ""}</small>
                            )}
                          </div>
                          {row.guvMaintenanceCashOut > 0 && (
                            <div className={styles.dataItem}>
                              <dt>Instandhaltung</dt>
                              <dd className={styles.negative}>{formatCurrency(row.guvMaintenanceCashOut)}</dd>
                              <small className={styles.formula}>
                                {row.guvMaintenanceFullDeduction > 0 && `${formatCurrency(row.guvMaintenanceFullDeduction)} voll abzugsfähig`}
                                {row.guvMaintenanceFullDeduction > 0 && row.guvMaintenanceAfaAddition > 0 && "; "}
                                {row.guvMaintenanceAfaAddition > 0 && `${formatCurrency(row.guvMaintenanceAfaAddition)} AfA-aktiviert (Abschreibung über Folgejahre)`}
                              </small>
                            </div>
                          )}
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Jahresüberschuss/-fehlbetrag</dt>
                            <dd className={row.guvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.guvResult)}
                            </dd>
                            <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.guvDepreciation)} (AfA){row.guvMaintenanceFullDeduction > 0 ? ` − ${formatCurrency(row.guvMaintenanceFullDeduction)} (Instandhaltung Sofortabzug)` : ""}</small>
                          </div>
                          {row.year > 0 && row.guvKstUsedCarryforward > 0 && (
                            <div className={styles.dataItem}>
                              <dt>Verlustvortrag (verrechnet)</dt>
                              <dd className={styles.negative}>− {formatCurrency(row.guvKstUsedCarryforward)}</dd>
                              <small className={styles.formula}>Kumulierter Verlustvortrag aus Vorjahren reduziert das zu versteuernde Einkommen</small>
                            </div>
                          )}
                          {row.year > 0 && row.guvKstAmount > 0 && (
                            <div className={styles.dataItem}>
                              <dt>Körperschaftsteuer + SolZ</dt>
                              <dd className={styles.negative}>− {formatCurrency(row.guvKstAmount)}</dd>
                              <small className={styles.formula}>{formatCurrency(row.guvKstBase)} (zu versteuerndes Einkommen) × {formatPercent(KST_COMBINED_RATE * 100)} (KSt {formatPercent(KST_RATE * 100)} + SolZ {formatPercent(SOLZ_ON_KST * 100)})</small>
                            </div>
                          )}
                          {row.year > 0 && row.guvLossCarryforward > 0 && (
                            <div className={styles.dataItem}>
                              <dt>Verlustvortrag (kumuliert)</dt>
                              <dd>{formatCurrency(row.guvLossCarryforward)}</dd>
                              <small className={styles.formula}>Noch nicht verrechnete steuerliche Verluste aus Vorjahren</small>
                            </div>
                          )}
                        </dl>
                      </div>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Darlehens-Person</h5>
                        <dl className={styles.dataGrid}>
                          <div className={styles.dataItem}>
                            <dt>Zinserträge</dt>
                            <dd>{formatCurrency(row.personGuvInterest)}</dd>
                            {row.propertyOwned ? (
                              <small className={styles.formula}>{formatCurrency(row.loanAtStartOfYear)} (Restschuld) × {formatPercent(result.input.loanInterestRate * 100)} (Zinssatz)</small>
                            ) : (
                              <small className={styles.formula}>Kein Darlehen ausstehend</small>
                            )}
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Einkommensteuer auf Zinsen</dt>
                            <dd>{formatCurrency(row.personGuvTax)}</dd>
                            <small className={styles.formula}>max(0, {formatCurrency(row.personGuvInterest)} (Zinserträge) − {formatCurrency(result.input.saverAllowance)} (Sparerpauschbetrag)) × {formatPercent(row.personalTaxRate * 100)} (Steuersatz)</small>
                          </div>
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Netto-Zinsergebnis</dt>
                            <dd className={row.personGuvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.personGuvResult)}
                            </dd>
                            <small className={styles.formula}>{formatCurrency(row.personGuvInterest)} (Zinserträge) − {formatCurrency(row.personGuvTax)} (Einkommensteuer)</small>
                          </div>
                          {result.input.bulletLoan && row.scheduledRepayment > 0 && (
                            <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                              <dt>Rückzahlung Darlehen (Laufzeitende)</dt>
                              <dd className={styles.positive}>
                                {formatCurrency(row.scheduledRepayment)}
                              </dd>
                              <small className={styles.formula}>Volle Tilgung des endfälligen Darlehens in Jahr {result.input.loanTermYears}</small>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.yearSection}>
                  <h4 className={styles.yearSectionTitle}>Bilanz</h4>
                  <dl className={styles.dataGrid}>
                    <div className={styles.dataItem}>
                      <dt>Immobilie (Buchwert)</dt>
                      <dd>{formatCurrency(row.buildingBookValue)}</dd>
                      {row.year > 0 && row.propertyOwned && (
                        <small className={styles.formula}>{formatCurrency(row.buildingDepreciableValue)} (Gebäude Restwert) + {formatCurrency(result.realEstateTaxLandPortion + result.input.landValue)} (Grundstück inkl. GrESt-Anteil)</small>
                      )}
                      {!row.propertyOwned && row.year > 0 && (
                        <small className={styles.formula}>Immobilie noch nicht erworben</small>
                      )}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Kassenbestand</dt>
                      <dd>{formatCurrency(row.foundationCash)}</dd>
                      {row.year === 0 ? (
                        result.deferredPurchase ? (
                          <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer) — kein Ankauf, ETF-Investition ab Jahr 1</small>
                        ) : (
                          <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer) + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue)} (Kaufpreis) − {formatCurrency(result.realEstateTax)} (GrESt)</small>
                        )
                      ) : row.propertyBoughtThisYear ? (
                        <small className={styles.formula}>{formatCurrency(row.prevFoundationCash)} (vor Kauf){row.guvMaintenanceEtfSaleNet > 0 ? ` + ${formatCurrency(row.guvMaintenanceEtfSaleNet)} (ETF-Verkauf Instandhaltungsfinanzierung)` : ""}{row.guvMaintenanceCashOut > 0 ? ` − ${formatCurrency(row.guvMaintenanceCashOut)} (Instandhaltung)` : ""} + {formatCurrency(row.etfSaleNetForPurchase)} (ETF-Erlös) + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue + result.realEstateTax)} (Kaufpreis + GrESt) + {formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.scheduledRepayment + row.extraRepayment)} (Tilgung){row.foundationEtfDeficitSaleNet > 0 ? ` + ${formatCurrency(row.foundationEtfDeficitSaleNet)} (ETF-Teilverkauf bei Liquiditätsbedarf)` : ""} − {formatCurrency(row.foundationEtfInvestment)} (ETF-Investition){row.erbsInstallmentPaid > 0 ? ` − ${formatCurrency(row.erbsInstallmentPaid)} (Erbersatzsteuer-Rate)` : ""}</small>
                      ) : (
                        <small className={styles.formula}>{formatCurrency(row.prevFoundationCash)} (Vorjahr){row.guvMaintenanceEtfSaleNet > 0 ? ` + ${formatCurrency(row.guvMaintenanceEtfSaleNet)} (ETF-Verkauf Instandhaltungsfinanzierung)` : ""} + {formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen){row.guvMaintenanceCashOut > 0 ? ` − ${formatCurrency(row.guvMaintenanceCashOut)} (Instandhaltung)` : ""} [= {formatCurrency(row.foundationCashFlow)} Überschuss] − {formatCurrency(row.scheduledRepayment + row.extraRepayment)} (Tilgung{row.extraRepayment > 0 ? ` inkl. ${formatCurrency(row.extraRepayment)} Sondertilgung` : ""}){row.foundationEtfDeficitSaleNet > 0 ? ` + ${formatCurrency(row.foundationEtfDeficitSaleNet)} (ETF-Teilverkauf bei Liquiditätsbedarf)` : ""} − {formatCurrency(row.foundationEtfInvestment)} (ETF-Investition){row.erbsInstallmentPaid > 0 ? ` − ${formatCurrency(row.erbsInstallmentPaid)} (Erbersatzsteuer-Rate)` : ""}</small>
                      )}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>ETF-Bestand</dt>
                      <dd>{formatCurrency(row.foundationEtfBalance)}</dd>
                      {row.year > 0 && (
                        <small className={styles.formula}>
                          {row.propertyBoughtThisYear
                            ? `Nach Teilverkauf für Immobilienkauf (${formatCurrency(row.etfSaleForPurchase)} verkauft): `
                            : ""}
                          Vorjahresbestand{row.guvMaintenanceEtfSaleGross > 0
                            ? ` − ${formatCurrency(row.guvMaintenanceEtfSaleGross)} (ETF-Verkauf Instandhaltungsfinanzierung, Steuer ${formatCurrency(row.guvMaintenanceEtfSaleTax)})`
                            : ""}{row.foundationEtfDeficitSaleGross > 0
                            ? ` − ${formatCurrency(row.foundationEtfDeficitSaleGross)} (Teilverkauf bei Liquiditätsbedarf, Steuer ${formatCurrency(row.foundationEtfDeficitSaleTax)})`
                            : ""} + {formatCurrency(row.foundationEtfInvestment)} (neue ETF-Investition) + {formatCurrency(row.foundationGrossEtfReturn)} (Brutto-Rendite) − {formatCurrency(row.foundationVorabTax)} (Vorabpauschale)
                        </small>
                      )}
                    </div>
                    {row.year > 0 && (
                      <div className={styles.dataItem}>
                        <dt>ETF-Verkaufsteuer (wenn Verkauf in Jahr {row.year})</dt>
                        <dd className={styles.negative}>{formatCurrency(row.foundationEtfSaleTax)}</dd>
                        <small className={styles.formula}>max(0, ({formatCurrency(row.foundationEtfBalance)} − Einzahlungen) × (1 − {formatPercent(result.input.foundationEtfPartialExemptionRate * 100)}) − bereits vorab besteuerte Gewinne) × {formatPercent(result.input.foundationEtfTaxRate * 100)} = Steuer auf {formatCurrency(row.foundationEtfTaxableSaleGain)}</small>
                      </div>
                    )}
                    <div className={styles.dataItem}>
                      <dt>Bilanzsumme</dt>
                      <dd>{formatCurrency(row.totalAssets)}</dd>
                      <small className={styles.formula}>{formatCurrency(row.foundationCash)} (Kassenbestand) + {formatCurrency(row.foundationEtfLiquidationValue)} (ETF nach Verkaufsteuer) + {formatCurrency(row.buildingBookValue)} (Immobilie)</small>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Darlehen</dt>
                      <dd>{formatCurrency(row.remainingLoan)}</dd>
                    </div>
                    {row.erbsRemainingLiability > 0 && (
                      <div className={styles.dataItem}>
                        <dt>Erbersatzsteuer-Verbindlichkeit</dt>
                        <dd className={styles.negative}>{formatCurrency(row.erbsRemainingLiability)}</dd>
                        <small className={styles.formula}>Verbleibende Steuerschuld gegenüber dem Finanzamt (§ 24 ErbStG)</small>
                      </div>
                    )}
                    <div className={styles.dataItem}>
                      <dt>Eigenkapital</dt>
                      <dd className={row.equity < 0 ? styles.negative : styles.positive}>
                        {formatCurrency(row.equity)}
                      </dd>
                      <small className={styles.formula}>{formatCurrency(row.totalAssets)} (Bilanzsumme) − {formatCurrency(row.remainingLoan)} (Darlehen){row.erbsRemainingLiability > 0 ? ` − ${formatCurrency(row.erbsRemainingLiability)} (Erbersatzsteuer)` : ""}</small>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.note}>
            Das Nettovermögen der Stiftung nutzt den Immobilienwert aus Gebäude +
            Grundstück. Die AfA wirkt nur auf das steuerliche Ergebnis. Die
            Vermögensposition der Person setzt sich aus Restforderung und bereits
            zugeflossenen, nach Steuern verbleibenden Zahlungen zusammen. Positive
            Liquidität wird jährlich in ETF-Anteile umgeschichtet (Rendite:
            {" "}
            {formatPercent(result.input.etfReturnRate * 100)}). Die Vorabpauschale
            wird für ETF-Erträge jährlich mit getrennten Sätzen angesetzt
            (Stiftung: {formatPercent(result.input.foundationEtfTaxRate * 100)},
            Privat/Vergleich: {formatPercent(result.input.privateEtfTaxRate * 100)}).
            Für die ETF-Steuerbasis gilt eine Teilfreistellung (Stiftung:
            {" "}
            {formatPercent(result.input.foundationEtfPartialExemptionRate * 100)},
            Privat/Vergleich:
            {" "}
            {formatPercent(result.input.privateEtfPartialExemptionRate * 100)});
            zusätzlich wird eine hypothetische Verkaufsteuer auf noch nicht über
            Vorabpauschale besteuerte ETF-Gewinne berücksichtigt. Der
            Sparerpauschbetrag ({formatCurrency(result.input.saverAllowance)}/Jahr)
            reduziert die steuerpflichtigen Zinserträge des Darlehensgebers; ein
            verbleibender Restbetrag mindert die jährliche Vorabpauschale des
            Privat-ETF. Für das Vergleichsszenario wird der Sparerpauschbetrag
            vollständig auf die ETF-Vorabpauschale angerechnet. Die
            Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG) wird alle 30 Jahre auf
            Grundlage des Nettovermögens (2 fiktive Kinder, Freibetrag je{" "}
            {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)}, Pauschalsatz{" "}
            {formatPercent(ERBERSATZ_TAX_RATE * 100)}) berechnet und in 30 gleichen
            Jahresraten (§ 24 ErbStG) beglichen; die Verbindlichkeit wird bis zur
            vollständigen Tilgung als Fremdkapital ausgewiesen.
          </p>
        </section>
      </main>
      <footer className={styles.stickyFooter}>
        <div className={styles.stickyFooterItem}>
          <span className={styles.stickyFooterLabel}>Break-Even:</span>
          {wealthChart.breakEven ? (
            <span className={`${styles.stickyFooterValue} ${styles.stickyFooterPositive}`}>Jahr {wealthChart.breakEven.year}</span>
          ) : (
            <span className={styles.stickyFooterValue}>nicht erreicht</span>
          )}
        </div>
        <div className={styles.stickyFooterItem}>
          <span className={styles.stickyFooterLabel}>
            Vermögensunterschied Jahr {result.input.projectionYears}:
          </span>
          <span className={`${styles.stickyFooterValue} ${wealthDiff >= 0 ? styles.stickyFooterPositive : styles.stickyFooterNegative}`}>
            {wealthDiff >= 0 ? "+" : ""}{formatCurrency(wealthDiff)}
          </span>
        </div>
      </footer>
    </>
  );
}
