export const FIELD_DEFINITIONS = [
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
    id: "etfBasisInterestRate",
    label: "Gesetzlicher Basiszins (Vorabpauschale) p.a. (%)",
    min: 0,
    step: "0.1",
    defaultValue: 2.5,
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

// § 19 Abs. 1 ErbStG – Stufentarif für Schenkung- und Erbschaftsteuer
// Jede Stufe enthält die obere Wertgrenze (upTo) und den Steuersatz (rate).
// Der Satz gilt jeweils für den gesamten steuerpflichtigen Erwerb.
export const GIFT_TAX_BRACKETS = {
  I: [
    { upTo: 75_000, rate: 0.07 },
    { upTo: 300_000, rate: 0.11 },
    { upTo: 600_000, rate: 0.15 },
    { upTo: 6_000_000, rate: 0.19 },
    { upTo: 13_000_000, rate: 0.23 },
    { upTo: 26_000_000, rate: 0.27 },
    { upTo: Infinity, rate: 0.30 },
  ],
  II: [
    { upTo: 75_000, rate: 0.15 },
    { upTo: 300_000, rate: 0.20 },
    { upTo: 600_000, rate: 0.25 },
    { upTo: 6_000_000, rate: 0.30 },
    { upTo: 13_000_000, rate: 0.35 },
    { upTo: 26_000_000, rate: 0.40 },
    { upTo: Infinity, rate: 0.43 },
  ],
  III: [
    { upTo: 6_000_000, rate: 0.30 },
    { upTo: Infinity, rate: 0.50 },
  ],
};

/**
 * Berechnet die Schenkung-/Erbschaftsteuer nach dem Stufentarif des § 19 Abs. 1 ErbStG
 * unter Anwendung der Härtefallregelung des § 19 Abs. 3 ErbStG.
 *
 * Die Härtefallregelung begrenzt den Steuermehrbetrag beim Überschreiten einer
 * Wertgrenze auf 50 % des Mehrbetrags des steuerpflichtigen Erwerbs über diese Grenze.
 *
 * @param {number} taxableAmount - Steuerpflichtiger Erwerb nach Abzug des Freibetrags (≥ 0)
 * @param {"I"|"II"|"III"} taxClass - Steuerklasse gem. § 15 ErbStG
 * @returns {number} Festzusetzende Steuer
 */
export function calculateGiftTaxByBrackets(taxableAmount, taxClass) {
  if (taxableAmount <= 0) return 0;
  const brackets = GIFT_TAX_BRACKETS[taxClass];
  let bracketIdx = brackets.findIndex((b) => taxableAmount <= b.upTo);
  // Defensive fallback: the last bracket always has upTo: Infinity, so this is
  // normally unreachable, but guards against accidental table truncation.
  if (bracketIdx === -1) bracketIdx = brackets.length - 1;

  const tax = taxableAmount * brackets[bracketIdx].rate;

  // § 19 Abs. 3 ErbStG: Härteklausel – der Steuermehrbetrag gegenüber der
  // nächstniedrigen Wertstufe darf 50 % des diese Stufe übersteigenden Betrages
  // nicht überschreiten.
  if (bracketIdx > 0) {
    const prev = brackets[bracketIdx - 1];
    const taxAtPrevCeiling = prev.upTo * prev.rate;
    const excess = taxableAmount - prev.upTo;
    if (tax - taxAtPrevCeiling > 0.5 * excess) {
      return taxAtPrevCeiling + 0.5 * excess;
    }
  }

  return tax;
}

// Schenkungsteuer-Tarif je Begünstigtenkreis gemäß § 15 und § 19 ErbStG.
// Der progressive Stufentarif wird über calculateGiftTaxByBrackets() angewendet.
export const RELATIONSHIP_OPTIONS = [
  {
    id: "class1-children-only",
    label: "Reine Kinder-Stiftung: ausschließlich Ehe-/Lebenspartner oder eigene Kinder (Steuerklasse I, Freibetrag 400.000 €)",
    shortLabel: "Steuerklasse I (400.000 €)",
    taxClass: "I",
    giftTaxAllowance: 400_000,
  },
  {
    id: "class1-multigeneration",
    label: "Mehrgenerationen-Stiftung: auch Enkel/Urenkel als (spätere) Begünstigte (Steuerklasse I, Freibetrag 100.000 €)",
    shortLabel: "Steuerklasse I (100.000 €)",
    taxClass: "I",
    giftTaxAllowance: 100_000,
  },
  {
    id: "class2",
    label: "Erweiterte Familie: z. B. Geschwister, Nichten/Neffen, Schwiegerkinder (Steuerklasse II, Freibetrag 20.000 €)",
    shortLabel: "Steuerklasse II (20.000 €)",
    taxClass: "II",
    giftTaxAllowance: 20_000,
  },
  {
    id: "class3",
    label: "Nicht verwandt / Dritte (Steuerklasse III, Freibetrag 20.000 €)",
    shortLabel: "Steuerklasse III (20.000 €)",
    taxClass: "III",
    giftTaxAllowance: 20_000,
  },
];

export const DEFAULT_RELATIONSHIP_ID = RELATIONSHIP_OPTIONS[0].id;

export const DEFAULT_PERSONAL_TAX_STEPS = [{ fromYear: "1", rate: "42" }];

// Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG): fiktive Erbschaft alle 30 Jahre
export const ERBERSATZ_CYCLE_YEARS = 30;
export const ERBERSATZ_CHILDREN = 2;
export const ERBERSATZ_CHILD_ALLOWANCE = 400_000; // Freibetrag je Kind, Steuerklasse I
export const ERBERSATZ_TAX_CLASS = "I"; // Steuerklasse für fiktive Kinder (§ 15 Abs. 1 Nr. 2 ErbStG)
const FOUNDATION_ETF_PARTIAL_EXEMPTION_RATE = 0.8; // 80 % gem. § 20 InvStG für körperschaftsteuerpflichtige Anleger (Aktienfonds)
const PRIVATE_ETF_PARTIAL_EXEMPTION_RATE = 0.3; // 30 % gem. § 20 InvStG für private Anleger (Aktienfonds)
const ETF_VORABPAUSCHALE_BASIS_FACTOR = 0.7; // 70 % gem. § 18 Abs. 3 InvStG
// Körperschaftsteuer (§ 23 Abs. 1 KStG) für Familienstiftungen
export const KST_RATE = 0.15;
export const SOLZ_ON_KST = 0.055; // Solidaritätszuschlag auf KSt
export const KST_COMBINED_RATE = KST_RATE * (1 + SOLZ_ON_KST); // 15,825 %

export const BUNDESLAENDER = [
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
export const CHART_Y_TICK_COUNT = 5;
export const CHART_MAX_X_TICKS = 8;
export const CHART_X_AXIS_LABEL_OFFSET = 24;
export const CHART_MIN_VALUE_FLOOR = 0;

export const DEFAULT_FORM_VALUES = Object.fromEntries(
  FIELD_DEFINITIONS.map((field) => [field.id, String(field.defaultValue)]),
);

const REAL_ESTATE_FIELD_IDS = new Set(
  FIELD_DEFINITIONS.filter((f) => f.realEstate).map((f) => f.id),
);

export function getEffectiveFormValues(formValues, includeRealEstate) {
  if (includeRealEstate) return formValues;
  const zeros = Object.fromEntries([...REAL_ESTATE_FIELD_IDS].map((id) => [id, "0"]));
  return { ...formValues, ...zeros };
}

export function formatCurrency(value) {
  return currency.format(value);
}

export function formatPercent(value) {
  return `${percent.format(value)} %`;
}

export function formatDecimalAsPercent(rate) {
  return formatPercent(rate * 100);
}

export function createSvgLinePath(points) {
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

export function parseNumber(value) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateFormValues(formValues, bulletLoan = false) {
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
      etfBasisInterestRate: parsedValues.etfBasisInterestRate / 100,
      foundationEtfTaxRate: parsedValues.foundationEtfTaxRate / 100,
      foundationEtfPartialExemptionRate: FOUNDATION_ETF_PARTIAL_EXEMPTION_RATE,
      privateEtfTaxRate: parsedValues.privateEtfTaxRate / 100,
      privateEtfPartialExemptionRate: PRIVATE_ETF_PARTIAL_EXEMPTION_RATE,
      saverAllowance: parsedValues.saverAllowance,
      projectionYears: parsedValues.projectionYears,
    },
  };
}

export function getRelationshipOption(relationshipId) {
  return (
    RELATIONSHIP_OPTIONS.find((option) => option.id === relationshipId) ??
    RELATIONSHIP_OPTIONS[0]
  );
}

export function validatePersonalTaxSteps(steps) {
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

export function validateMaintenanceEvents(events) {
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

export function createProjectionInput(
  validatedInput,
  relationship,
  surplusToRepayment,
  personalTaxSteps,
  comparePaysRealEstateTax,
  bulletLoan = false,
  lenderIsTenant = false,
  tenantRentFromExternalFunds = false,
  maintenanceEvents = [],
  bulletLoanReinvest = false,
) {
  return {
    ...validatedInput,
    giftTaxClass: relationship.taxClass,
    giftTaxAllowance: relationship.giftTaxAllowance,
    surplusToRepayment,
    personalTaxSteps,
    comparePaysRealEstateTax,
    bulletLoan,
    lenderIsTenant,
    tenantRentFromExternalFunds,
    maintenanceEvents,
    bulletLoanReinvest,
  };
}

export function computeEtfSaleTaxData(
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

export function computePartialEtfSale(
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

export function applyEtfYear({
  cash,
  etfBalance,
  etfContributions,
  etfTaxedGains,
  returnRate,
  basisInterestRate = 0,
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
  const baseYieldForVorab =
    etfBalanceAfterInvestment * basisInterestRate * ETF_VORABPAUSCHALE_BASIS_FACTOR;
  const vorabGainBeforePartialExemption = Math.max(0, Math.min(grossEtfReturn, baseYieldForVorab));
  const taxableVorabGainBeforeAllowance = vorabGainBeforePartialExemption * taxableRatio;
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

export function calculateProjection(input) {
  const propertyValue = input.buildingValue + input.landValue;
  const annualRent = input.monthlyRent * 12;
  const giftTaxAllowance = Math.max(0, input.giftTaxAllowance ?? 0);
  const taxableGiftBase = Math.max(0, input.initialCapital - giftTaxAllowance);
  const giftTax = calculateGiftTaxByBrackets(taxableGiftBase, input.giftTaxClass);
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

  // Vergleichsszenario: Selbstnutzung – Person kauft Immobilie selbst und nutzt sie
  // Kein Darlehen an Stiftung, keine AfA (da Eigennutzung), keine Mieteinnahmen.
  // Jährlicher Vorteil: gesparte Miete (= annualRent) als impliziter steuerfreier Cashflow.
  let selfUseCash =
    input.initialCapital + input.loanAmount - propertyValue - privateRealEstateTax;
  let selfUseEtfBalance = 0;
  let selfUseEtfContributions = 0;
  let selfUseEtfTaxedGains = 0;

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
      // Vergleichsvermögen Selbstnutzung Jahr 0
      selfUseWealth: selfUseCash + propertyValue,
      selfUseEtfBalance,
      selfUseEtfLiquidationValue: 0,
      selfUseVorabTax: 0,
      selfUseEtfSaleTax: 0,
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
    const isBulletRepaymentYear = input.bulletLoan && (
      input.bulletLoanReinvest
        ? (year % input.loanTermYears === 0 && year > 0)
        : (year === input.loanTermYears)
    );

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
        // Bei Wiederanlage: Rückzahlung am Ende jeder Laufzeit (year % loanTermYears === 0)
        scheduledRepaymentTarget = isBulletRepaymentYear ? remainingLoan : 0;
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
      erbsTriggeredAmount = ERBERSATZ_CHILDREN * calculateGiftTaxByBrackets(perChildTaxable, ERBERSATZ_TAX_CLASS);
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
      basisInterestRate: input.etfBasisInterestRate,
      taxRate: input.foundationEtfTaxRate,
      partialExemptionRate: input.foundationEtfPartialExemptionRate,
    });
    foundationCash = foundationEtf.cashAfterInvestment;
    foundationEtfBalance = foundationEtf.etfBalanceAfterTax;
    foundationEtfContributions = foundationEtf.etfContributionsAfterInvestment;
    foundationEtfTaxedGains = foundationEtf.etfTaxedGainsAfterYear;

    // Wiederanlage des endfälligen Darlehens: Am Ende jeder Laufzeit wird nur das
    // zurückgegebene Darlehen plus die Netto-Zinsen (nach Steuer) wieder als neues
    // Darlehen in die Stiftung angelegt. Die ETFs des Darlehensgebers werden nicht
    // verkauft – der in personCash liegende Betrag (zurückgezahltes Kapital +
    // diesjähriger Netto-Zins) ist genau der Wiederanlagebetrag.
    if (input.bulletLoanReinvest && isBulletRepaymentYear) {
      const reinvestmentAmount = personCash;
      foundationCash += reinvestmentAmount;
      remainingLoan = reinvestmentAmount;
      personCash = 0;

      // Kumulative Zinstracker für den nächsten Zyklus zurücksetzen
      personCumulativeGrossInterest = 0;
      personCumulativeInterestTax = 0;
    }

    const interestAllowanceUsed = Math.min(annualInterest, input.saverAllowance);
    const personEtfSaverAllowance = input.saverAllowance - interestAllowanceUsed;
    const personEtf = applyEtfYear({
      cash: personCash,
      etfBalance: personEtfBalance,
      etfContributions: personEtfContributions,
      etfTaxedGains: personEtfTaxedGains,
      returnRate: input.etfReturnRate,
      basisInterestRate: input.etfBasisInterestRate,
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
      basisInterestRate: input.etfBasisInterestRate,
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
      basisInterestRate: input.etfBasisInterestRate,
      taxRate: input.privateEtfTaxRate,
      partialExemptionRate: input.privateEtfPartialExemptionRate,
      saverAllowance: input.saverAllowance,
    });
    etfOnlyCash = etfOnlyEtf.cashAfterInvestment;
    etfOnlyEtfBalance = etfOnlyEtf.etfBalanceAfterTax;
    etfOnlyEtfContributions = etfOnlyEtf.etfContributionsAfterInvestment;
    etfOnlyEtfTaxedGains = etfOnlyEtf.etfTaxedGainsAfterYear;

    // Selbstnutzung: gesparte Miete fließt als impliziter steuerfreier Cashflow zu
    selfUseCash += annualRent;
    const selfUseEtf = applyEtfYear({
      cash: selfUseCash,
      etfBalance: selfUseEtfBalance,
      etfContributions: selfUseEtfContributions,
      etfTaxedGains: selfUseEtfTaxedGains,
      returnRate: input.etfReturnRate,
      basisInterestRate: input.etfBasisInterestRate,
      taxRate: input.privateEtfTaxRate,
      partialExemptionRate: input.privateEtfPartialExemptionRate,
      saverAllowance: input.saverAllowance,
    });
    selfUseCash = selfUseEtf.cashAfterInvestment;
    selfUseEtfBalance = selfUseEtf.etfBalanceAfterTax;
    selfUseEtfContributions = selfUseEtf.etfContributionsAfterInvestment;
    selfUseEtfTaxedGains = selfUseEtf.etfTaxedGainsAfterYear;

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
      // Vergleichsvermögen Selbstnutzung (Eigennutzung ohne AfA, gesparte Miete)
      selfUseWealth: selfUseCash + selfUseEtf.etfLiquidationValue + propertyValue,
      selfUseEtfBalance,
      selfUseEtfLiquidationValue: selfUseEtf.etfLiquidationValue,
      selfUseVorabTax: selfUseEtf.vorabTax,
      selfUseEtfSaleTax: selfUseEtf.saleTax,
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
    effectiveGiftTaxRate: taxableGiftBase > 0 ? giftTax / taxableGiftBase : 0,
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

export const DEFAULT_RESULT = calculateProjection({
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
