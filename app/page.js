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
    id: "buildingValue",
    label: "Gebäudewert (€)",
    min: 0,
    step: "1000",
    defaultValue: 200000,
  },
  {
    id: "landValue",
    label: "Grundstückswert (€)",
    min: 0,
    step: "1000",
    defaultValue: 200000,
  },
  {
    id: "realEstateTaxRate",
    label: "Grunderwerbsteuer (%)",
    min: 0,
    max: 10,
    step: "0.5",
    defaultValue: 5.0,
  },
  {
    id: "monthlyRent",
    label: "Monatliche Miete (€)",
    min: 0,
    step: "50",
    defaultValue: 1500,
  },
  {
    id: "depreciationRate",
    label: "AfA auf das Gebäude p.a. (%)",
    min: 0,
    step: "0.1",
    defaultValue: 2,
  },
  {
    id: "personalTaxRate",
    label: "Persönlicher Steuersatz der Person (%)",
    min: 0,
    max: 100,
    step: "0.1",
    defaultValue: 42,
  },
  {
    id: "projectionYears",
    label: "Betrachtungszeitraum (Jahre)",
    min: 1,
    max: 50,
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

// Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG): fiktive Erbschaft alle 30 Jahre
const ERBERSATZ_CYCLE_YEARS = 30;
const ERBERSATZ_CHILDREN = 2;
const ERBERSATZ_CHILD_ALLOWANCE = 400_000; // Freibetrag je Kind, Steuerklasse I
const ERBERSATZ_TAX_RATE = 0.15; // vereinfachter Pauschalsatz, Steuerklasse I (Kinder)

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

function validateFormValues(formValues) {
  const invalidIds = [];
  const parsedValues = {};

  for (const field of FIELD_DEFINITIONS) {
    const parsedValue = parseNumber(formValues[field.id] ?? "");

    if (parsedValue === null) {
      invalidIds.push(field.id);
      continue;
    }

    if (parsedValue < field.min || (field.max !== undefined && parsedValue > field.max)) {
      invalidIds.push(field.id);
      continue;
    }

    if (field.integer && !Number.isInteger(parsedValue)) {
      invalidIds.push(field.id);
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
      buildingValue: parsedValues.buildingValue,
      landValue: parsedValues.landValue,
      realEstateTaxRate: parsedValues.realEstateTaxRate / 100,
      monthlyRent: parsedValues.monthlyRent,
      depreciationRate: parsedValues.depreciationRate / 100,
      personalTaxRate: parsedValues.personalTaxRate / 100,
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

function createProjectionInput(validatedInput, relationship, surplusToRepayment, erbersatzsteuerSpread) {
  return {
    ...validatedInput,
    giftTaxRate: relationship.giftTaxRate,
    giftTaxAllowance: relationship.giftTaxAllowance,
    surplusToRepayment,
    erbersatzsteuerSpread,
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

  const initialCash =
    input.initialCapital - giftTax + input.loanAmount - propertyValue - realEstateTax;

  let foundationCash = initialCash;
  let remainingLoan = input.loanAmount;
  let remainingDepreciableBuildingValue = depreciableBuildingBase;
  let cumulativePersonNetCash = 0;

  // Erbersatzsteuer-Tracking (§ 1 Abs. 1 Nr. 4 ErbStG)
  let erbsRemainingLiability = 0;
  let erbsCurrentInstallment = 0;

  // Vergleichsszenario: Privatvermietung ohne Stiftung
  // Kein Schenkungssteuerabzug, Mieteinnahmen zum persönlichen Steuersatz besteuert,
  // kein Darlehen, keine Verwaltungskosten
  let privateCash = input.initialCapital + input.loanAmount - propertyValue - realEstateTax;
  let privateRemainingDepreciableBuilding = depreciableBuildingBase;

  const buildingBookValue0 = depreciableBuildingBase + landBookBase;

  const rows = [
    {
      year: 0,
      foundationCash,
      taxableResult: -giftTax,
      foundationWealth: foundationCash + propertyValue - remainingLoan,
      remainingLoan,
      personNetCashFlow: 0,
      personAssetPosition: remainingLoan,
      // Bilanz Jahr 0
      buildingBookValue: buildingBookValue0,
      totalAssets: foundationCash + buildingBookValue0,
      equity: foundationCash + buildingBookValue0 - remainingLoan,
      // Erbersatzsteuer
      erbsTriggeredAmount: 0,
      erbsInstallmentPaid: 0,
      erbsRemainingLiability: 0,
      // Vergleichsvermögen Privatvermietung Jahr 0
      compareWealth: privateCash + propertyValue,
    },
  ];

  for (let year = 1; year <= input.projectionYears; year += 1) {
    const annualInterest = remainingLoan * input.loanInterestRate;
    const scheduledRepaymentTarget = Math.min(
      remainingLoan,
      input.loanAmount * input.loanRepaymentRate,
    );
    const annualDepreciation = Math.min(
      remainingDepreciableBuildingValue,
      depreciableBuildingBase * input.depreciationRate,
    );
    const taxableResult =
      annualRent -
      input.annualAdminCost -
      annualInterest -
      annualDepreciation;
    // Operativer Liquiditätsüberschuss (ohne Tilgung, da Tilgung eine
    // reine Bilanzumschichtung ist und die operative Liquidität nicht mindert)
    const foundationCashFlow =
      annualRent -
      input.annualAdminCost -
      annualInterest;
    const availableCashBeforeRepayment = foundationCash + foundationCashFlow;
    // Business rule: normal repayment is always paid each year, even with negative cash.
    const scheduledRepayment = scheduledRepaymentTarget;

    // Jährlichen Überschuss als Sondertilgung verwenden
    const extraRepayment = input.surplusToRepayment
      ? Math.min(
          Math.max(0, availableCashBeforeRepayment - scheduledRepayment),
          remainingLoan - scheduledRepayment,
        )
      : 0;

    const loanAtStartOfYear = remainingLoan;
    const lenderTax = annualInterest * input.personalTaxRate;
    const lenderNetCashFlow =
      scheduledRepayment + extraRepayment + (annualInterest - lenderTax);

    const prevFoundationCash = foundationCash;
    foundationCash = availableCashBeforeRepayment - scheduledRepayment - extraRepayment;
    remainingLoan -= scheduledRepayment + extraRepayment;
    remainingDepreciableBuildingValue = Math.max(
      0,
      remainingDepreciableBuildingValue - annualDepreciation,
    );
    cumulativePersonNetCash += lenderNetCashFlow;

    // Vergleichsszenario: Privatvermietung – kein Darlehen, keine Verwaltungskosten, Steuern auf Miete
    const privateDepreciation = Math.min(
      privateRemainingDepreciableBuilding,
      depreciableBuildingBase * input.depreciationRate,
    );
    const privateTaxableRentalIncome = annualRent - privateDepreciation;
    const privateIncomeTax = privateTaxableRentalIncome * input.personalTaxRate;
    privateCash += annualRent - privateIncomeTax;
    privateRemainingDepreciableBuilding = Math.max(
      0,
      privateRemainingDepreciableBuilding - privateDepreciation,
    );

    const buildingDepreciableValue = remainingDepreciableBuildingValue;
    const buildingBookValue = buildingDepreciableValue + landBookBase;

    // Erbersatzsteuer: Jahresrate auszahlen (aus Vorjahres-Zyklus)
    let erbsTriggeredAmount = 0;
    let erbsInstallmentPaid = 0;
    if (input.erbersatzsteuerSpread && erbsRemainingLiability > 0) {
      erbsInstallmentPaid = Math.min(erbsCurrentInstallment, erbsRemainingLiability);
      foundationCash -= erbsInstallmentPaid;
      erbsRemainingLiability -= erbsInstallmentPaid;
    }

    // Erbersatzsteuer: Auslösung alle 30 Jahre (frühestens Jahr 30, nie Jahr 0)
    if (year > 0 && year % ERBERSATZ_CYCLE_YEARS === 0) {
      const netWealthForErbs = foundationCash + propertyValue - remainingLoan;
      const perChildTaxable = Math.max(
        0,
        netWealthForErbs / ERBERSATZ_CHILDREN - ERBERSATZ_CHILD_ALLOWANCE,
      );
      erbsTriggeredAmount = ERBERSATZ_CHILDREN * perChildTaxable * ERBERSATZ_TAX_RATE;
      if (!input.erbersatzsteuerSpread) {
        // Sofortzahlung
        foundationCash -= erbsTriggeredAmount;
      } else {
        // Ratenzahlung über 30 Jahre
        erbsRemainingLiability += erbsTriggeredAmount;
        erbsCurrentInstallment = erbsTriggeredAmount / ERBERSATZ_CYCLE_YEARS;
      }
    }

    rows.push({
      year,
      foundationCash,
      foundationCashFlow,
      taxableResult,
      foundationWealth: foundationCash + propertyValue - remainingLoan - erbsRemainingLiability,
      remainingLoan,
      personNetCashFlow: lenderNetCashFlow,
      personAssetPosition: remainingLoan + cumulativePersonNetCash,
      cumulativePersonNetCash,
      // GuV Stiftung
      guvRent: annualRent,
      guvAdminCost: input.annualAdminCost,
      guvInterest: annualInterest,
      guvDepreciation: annualDepreciation,
      guvResult: taxableResult,
      loanAtStartOfYear,
      scheduledRepayment,
      extraRepayment,
      prevFoundationCash,
      // GuV Person
      personGuvInterest: annualInterest,
      personGuvTax: lenderTax,
      personGuvResult: annualInterest - lenderTax,
      // Bilanz
      buildingDepreciableValue,
      buildingBookValue,
      totalAssets: foundationCash + buildingBookValue,
      equity: foundationCash + buildingBookValue - remainingLoan - erbsRemainingLiability,
      // Erbersatzsteuer
      erbsTriggeredAmount,
      erbsInstallmentPaid,
      erbsRemainingLiability,
      // Vergleichsvermögen Privatvermietung
      compareWealth: privateCash + propertyValue,
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
    propertyValue,
    initialCash,
    annualDepreciationBase: depreciableBuildingBase * input.depreciationRate,
    rows,
  };
}

const DEFAULT_RESULT = calculateProjection({
  ...createProjectionInput(
    validateFormValues(DEFAULT_FORM_VALUES).input,
    getRelationshipOption(DEFAULT_RELATIONSHIP_ID),
    false,
    true,
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
  const [{ formValues, relationshipId, surplusToRepayment, erbersatzsteuerSpread, bundesland, result }, setState] = useState({
    formValues: DEFAULT_FORM_VALUES,
    relationshipId: DEFAULT_RELATIONSHIP_ID,
    surplusToRepayment: false,
    erbersatzsteuerSpread: true,
    bundesland: null,
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
      const nextErbersatzsteuerSpread = parsed.erbersatzsteuerSpread ?? true;
      const nextBundesland = parsed.bundesland ?? null;
      const nextValidation = validateFormValues(nextFormValues);
      const nextRelationship = getRelationshipOption(nextRelationshipId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        formValues: nextFormValues,
        relationshipId: nextRelationship.id,
        surplusToRepayment: nextSurplusToRepayment,
        erbersatzsteuerSpread: nextErbersatzsteuerSpread,
        bundesland: nextBundesland,
        result: nextValidation.input
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                nextRelationship,
                nextSurplusToRepayment,
                nextErbersatzsteuerSpread,
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
          JSON.stringify({ formValues, relationshipId, surplusToRepayment, erbersatzsteuerSpread, bundesland }),
        );
      } catch {
        // ignore storage errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formValues, relationshipId, surplusToRepayment, erbersatzsteuerSpread, bundesland]);

  const validation = useMemo(() => validateFormValues(formValues), [formValues]);
  const hasInvalidFields = validation.invalidIds.length > 0;
  const selectedRelationship = useMemo(
    () => getRelationshipOption(relationshipId),
    [relationshipId],
  );

  const firstYear = result.rows[1] ?? result.rows[0];
  const lastYear = result.rows[result.rows.length - 1];

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
    },
    {
      title: "Kaufpreis Immobilie",
      value: formatCurrency(result.propertyValue),
      detail: `Gebäude ${formatCurrency(result.input.buildingValue)} + Grundstück ${formatCurrency(result.input.landValue)}`,
    },
    {
      title: "Annuitätsdarlehen (Jahr 1)",
      value: formatCurrency(result.input.loanAmount * (result.input.loanInterestRate + result.input.loanRepaymentRate)),
      detail: `Zinsrate ${formatPercent(result.input.loanInterestRate * 100)} + Tilgungsrate ${formatPercent(result.input.loanRepaymentRate * 100)} auf ${formatCurrency(result.input.loanAmount)}`,
    },
    {
      title: "Mieteinnahmen p.a.",
      value: formatCurrency(result.annualRent),
      detail: `${formatCurrency(result.input.monthlyRent)} pro Monat`,
    },
    {
      title: "AfA p.a.",
      value: formatCurrency(result.annualDepreciationBase),
      detail: `${formatPercent(result.input.depreciationRate * 100)} auf ${formatCurrency(result.depreciableBuildingBase)}`,
    },
    {
      title: "Stiftung: Startliquidität nach Ankauf",
      value: formatCurrency(result.initialCash),
      detail: "Jahr 0 vor laufender Bewirtschaftung",
    },
    {
      title: "Stiftung: Nettovermögen Jahr 1",
      value: formatCurrency(firstYear.foundationWealth),
      detail: `Liquiditätsüberschuss ${formatCurrency(firstYear.foundationCashFlow)}`,
    },
    {
      title: `Stiftung: Nettovermögen Jahr ${result.input.projectionYears}`,
      value: formatCurrency(lastYear.foundationWealth),
      detail: `Restdarlehen ${formatCurrency(lastYear.remainingLoan)}`,
    },
    {
      title: `Person: Vermögensposition Jahr ${result.input.projectionYears}`,
      value: formatCurrency(lastYear.personAssetPosition),
      detail: `Persönlicher Steuersatz ${formatPercent(result.input.personalTaxRate * 100)}`,
    },
    {
      title: `Vergleichsvermögen Jahr ${result.input.projectionYears} (Privatvermietung)`,
      value: formatCurrency(lastYear.compareWealth),
      detail: `Ohne Stiftung, ohne Darlehen, ohne Verwaltungskosten, Mieteinnahmen zu ${formatPercent(result.input.personalTaxRate * 100)} versteuert`,
    },
  ];

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

    const series = [
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
      },
      {
        id: "total",
        label: "Gesamtvermögen",
        color: "#7c3aed",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.foundationWealth + row.personAssetPosition,
        })),
      },
      {
        id: "compare",
        label: "Vergleich: Privatvermietung (ohne Stiftung)",
        color: "#ea580c",
        values: result.rows.map((row) => ({
          year: row.year,
          value: row.compareWealth,
        })),
      },
    ];

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

    return {
      chartWidth,
      chartHeight,
      margin,
      xAxisLabelOffset,
      lines,
      yTicks,
      xTicks,
    };
  }, [result.rows]);

  function handleFieldChange(fieldId, value) {
    setState((currentState) => {
      const nextFormValues = {
        ...currentState.formValues,
        [fieldId]: value,
      };
      const nextValidation = validateFormValues(nextFormValues);

      return {
        ...currentState,
        formValues: nextFormValues,
        result: nextValidation.input
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                currentState.erbersatzsteuerSpread,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRelationshipChange(nextRelationshipId) {
    setState((currentState) => {
      const nextValidation = validateFormValues(currentState.formValues);
      const nextRelationship = getRelationshipOption(nextRelationshipId);
      return {
        ...currentState,
        relationshipId: nextRelationship.id,
        result: nextValidation.input
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                nextRelationship,
                currentState.surplusToRepayment,
                currentState.erbersatzsteuerSpread,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleSurplusToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(currentState.formValues);
      return {
        ...currentState,
        surplusToRepayment: checked,
        result: nextValidation.input
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                checked,
                currentState.erbersatzsteuerSpread,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleErbersatzsteuerSpreadToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(currentState.formValues);
      return {
        ...currentState,
        erbersatzsteuerSpread: checked,
        result: nextValidation.input
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                checked,
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
      const nextValidation = validateFormValues(nextFormValues);
      return {
        ...currentState,
        bundesland: name || null,
        formValues: nextFormValues,
        result: nextValidation.input
          ? calculateProjection(
              createProjectionInput(
                nextValidation.input,
                getRelationshipOption(currentState.relationshipId),
                currentState.surplusToRepayment,
                currentState.erbersatzsteuerSpread,
              ),
            )
          : currentState.result,
      };
    });
  }

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
          <div className={styles.grid}>
            {FIELD_DEFINITIONS.map((field) => {
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
            })}
          </div>
          <p className={styles.hint}>Leere oder ungültige Eingaben werden rot markiert.</p>
          {hasInvalidFields ? (
            <p className={styles.validationMessage}>
              Bitte korrigieren Sie die rot markierten Eingaben. Bis dahin bleiben
              die zuletzt gültigen Ergebnisse sichtbar.
            </p>
          ) : null}
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
          <div className={styles.checkboxRow}>
            <input
              id="erbersatzsteuerSpread"
              type="checkbox"
              checked={erbersatzsteuerSpread}
              onChange={(event) => handleErbersatzsteuerSpreadToggle(event.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="erbersatzsteuerSpread" className={styles.checkboxLabel}>
              Erbersatzsteuer auf 30 Jahresraten verteilen (§ 24 ErbStG)
            </label>
          </div>
          <p className={styles.hint}>
            Annahme: Die Tilgung erfolgt jährlich als konstanter Prozentsatz vom
            ursprünglichen Darlehensbetrag; die Zinsen fallen auf die jeweilige
            Restschuld an. Die Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG) wird alle
            30 Jahre auf Basis des Nettovermögens berechnet: 2 fiktive Kinder
            (Freibetrag je {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)}, vereinfachter
            Pauschalsatz {formatPercent(ERBERSATZ_TAX_RATE * 100)}). Ratenzahlung:
            30 gleiche Jahresraten an das Finanzamt (§ 24 ErbStG).
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
        </section>

        <section className={styles.panel}>
          <h2>Jahresübersicht</h2>
          <div className={styles.yearList}>
            {result.rows.map((row) => (
              <div key={row.year} className={styles.yearCard}>
                <h3 className={styles.yearCardTitle}>Jahr {row.year}</h3>

                <div className={styles.yearSection}>
                  <h4 className={styles.yearSectionTitle}>Übersicht</h4>
                  <dl className={styles.dataGrid}>
                    <div className={styles.dataItem}>
                      {row.year > 0 ? (
                        <>
                          <dt>Stiftung: Jährl. Liquiditätsüberschuss</dt>
                          <dd className={row.foundationCashFlow < 0 ? styles.negative : styles.positive}>
                            {formatCurrency(row.foundationCashFlow)}
                          </dd>
                          <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen)</small>
                        </>
                      ) : (
                        <>
                          <dt>Stiftung: Startliquidität</dt>
                          <dd>{formatCurrency(row.foundationCash)}</dd>
                          <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer) + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue)} (Kaufpreis) − {formatCurrency(result.realEstateTax)} (GrESt)</small>
                        </>
                      )}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Stiftung: Steuerliches Ergebnis</dt>
                      <dd>{formatCurrency(row.taxableResult)}</dd>
                      {row.year > 0 && <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.guvDepreciation)} (AfA)</small>}
                    </div>
                    {row.year === 0 && (
                      <div className={styles.dataItem}>
                        <dt>Grunderwerbsteuer (Anschaffungskosten)</dt>
                        <dd className={styles.negative}>{formatCurrency(result.realEstateTax)}</dd>
                        <small className={styles.formula}>{formatPercent(result.input.realEstateTaxRate * 100)} × {formatCurrency(result.propertyValue)} (Kaufpreis) — Gebäudeanteil {formatCurrency(result.realEstateTaxBuildingPortion)} wird abgeschrieben</small>
                      </div>
                    )}
                    <div className={styles.dataItem}>
                      <dt>Stiftung: Nettovermögen</dt>
                      <dd>{formatCurrency(row.foundationWealth)}</dd>
                      <small className={styles.formula}>{formatCurrency(row.foundationCash)} (Kassenbestand) + {formatCurrency(result.propertyValue)} (Immobilienwert) − {formatCurrency(row.remainingLoan)} (Restdarlehen){row.erbsRemainingLiability > 0 ? ` − ${formatCurrency(row.erbsRemainingLiability)} (Erbersatzsteuer-Verbindlichkeit)` : ""}</small>
                    </div>
                    {row.erbsTriggeredAmount > 0 && (
                      <div className={styles.dataItem}>
                        <dt>Erbersatzsteuer (fällig, § 1 Abs. 1 Nr. 4 ErbStG)</dt>
                        <dd className={styles.negative}>{formatCurrency(row.erbsTriggeredAmount)}</dd>
                        <small className={styles.formula}>
                          {ERBERSATZ_CHILDREN} × max(0, {formatCurrency((row.foundationCash + result.propertyValue - row.remainingLoan) / ERBERSATZ_CHILDREN)} − {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)} Freibetrag) × {formatPercent(ERBERSATZ_TAX_RATE * 100)}
                          {result.input.erbersatzsteuerSpread
                            ? ` — wird auf ${ERBERSATZ_CYCLE_YEARS} Jahresraten à ${formatCurrency(row.erbsTriggeredAmount / ERBERSATZ_CYCLE_YEARS)} verteilt`
                            : " — Sofortzahlung"}
                        </small>
                      </div>
                    )}
                    {row.erbsInstallmentPaid > 0 && (
                      <div className={styles.dataItem}>
                        <dt>Erbersatzsteuer: Jahresrate (Zahlung an Finanzamt)</dt>
                        <dd className={styles.negative}>{formatCurrency(row.erbsInstallmentPaid)}</dd>
                      </div>
                    )}
                    <div className={styles.dataItem}>
                      <dt>Restdarlehen</dt>
                      <dd>{formatCurrency(row.remainingLoan)}</dd>
                      {row.year > 0 && (
                        <small className={styles.formula}>
                          {formatCurrency(row.loanAtStartOfYear)} (Anfangsschuld) − {formatCurrency(row.scheduledRepayment)} (planm. Tilgung){row.extraRepayment > 0 ? ` − ${formatCurrency(row.extraRepayment)} (Sondertilgung)` : ""}
                        </small>
                      )}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Person: Netto-Zufluss</dt>
                      <dd>{formatCurrency(row.personNetCashFlow)}</dd>
                      {row.year > 0 && (
                        <small className={styles.formula}>
                          {formatCurrency(row.scheduledRepayment)} (planm. Tilgung){row.extraRepayment > 0 ? ` + ${formatCurrency(row.extraRepayment)} (Sondertilgung)` : ""} + {formatCurrency(row.personGuvResult)} (Netto-Zinsergebnis)
                        </small>
                      )}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Person: Vermögensposition</dt>
                      <dd>{formatCurrency(row.personAssetPosition)}</dd>
                      {row.year > 0 && <small className={styles.formula}>{formatCurrency(row.remainingLoan)} (Restdarlehen) + {formatCurrency(row.cumulativePersonNetCash)} (kum. Netto-Zuflüsse)</small>}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Vergleichsvermögen (Privatvermietung)</dt>
                      <dd>{formatCurrency(row.compareWealth)}</dd>
                      <small className={styles.formula}>Kasse + {formatCurrency(result.propertyValue)} (Immobilienwert) — ohne Stiftung, ohne Darlehen, ohne Verwaltungskosten, Miete zu {formatPercent(result.input.personalTaxRate * 100)} versteuert</small>
                    </div>
                  </dl>
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
                            <small className={styles.formula}>12 Monate × {formatCurrency(result.input.monthlyRent)} (Monatsmiete)</small>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Verwaltungskosten</dt>
                            <dd>{formatCurrency(row.guvAdminCost)}</dd>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Darlehenszinsen</dt>
                            <dd>{formatCurrency(row.guvInterest)}</dd>
                            <small className={styles.formula}>{formatCurrency(row.loanAtStartOfYear)} (Restschuld) × {formatPercent(result.input.loanInterestRate * 100)} (Zinssatz)</small>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>AfA</dt>
                            <dd>{formatCurrency(row.guvDepreciation)}</dd>
                            <small className={styles.formula}>{formatCurrency(result.depreciableBuildingBase)} (Gebäude inkl. GrESt-Anteil) × {formatPercent(result.input.depreciationRate * 100)} (AfA-Satz)</small>
                          </div>
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Jahresüberschuss/-fehlbetrag</dt>
                            <dd className={row.guvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.guvResult)}
                            </dd>
                            <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.guvDepreciation)} (AfA)</small>
                          </div>
                        </dl>
                      </div>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Darlehens-Person</h5>
                        <dl className={styles.dataGrid}>
                          <div className={styles.dataItem}>
                            <dt>Zinserträge</dt>
                            <dd>{formatCurrency(row.personGuvInterest)}</dd>
                            <small className={styles.formula}>{formatCurrency(row.loanAtStartOfYear)} (Restschuld) × {formatPercent(result.input.loanInterestRate * 100)} (Zinssatz)</small>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Einkommensteuer auf Zinsen</dt>
                            <dd>{formatCurrency(row.personGuvTax)}</dd>
                            <small className={styles.formula}>{formatCurrency(row.personGuvInterest)} (Zinserträge) × {formatPercent(result.input.personalTaxRate * 100)} (Steuersatz)</small>
                          </div>
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Netto-Zinsergebnis</dt>
                            <dd className={row.personGuvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.personGuvResult)}
                            </dd>
                            <small className={styles.formula}>{formatCurrency(row.personGuvInterest)} (Zinserträge) − {formatCurrency(row.personGuvTax)} (Einkommensteuer)</small>
                          </div>
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
                      {row.year > 0 && <small className={styles.formula}>{formatCurrency(row.buildingDepreciableValue)} (Gebäude Restwert) + {formatCurrency(result.realEstateTaxLandPortion + result.input.landValue)} (Grundstück inkl. GrESt-Anteil)</small>}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Kassenbestand</dt>
                      <dd>{formatCurrency(row.foundationCash)}</dd>
                      {row.year === 0 ? (
                        <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer) + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue)} (Kaufpreis) − {formatCurrency(result.realEstateTax)} (GrESt)</small>
                      ) : (
                        <small className={styles.formula}>{formatCurrency(row.prevFoundationCash)} (Vorjahr) + {formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) [= {formatCurrency(row.foundationCashFlow)} Überschuss] − {formatCurrency(row.scheduledRepayment + row.extraRepayment)} (Tilgung{row.extraRepayment > 0 ? ` inkl. ${formatCurrency(row.extraRepayment)} Sondertilgung` : ""})</small>
                      )}
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Bilanzsumme</dt>
                      <dd>{formatCurrency(row.totalAssets)}</dd>
                      <small className={styles.formula}>{formatCurrency(row.foundationCash)} (Kassenbestand) + {formatCurrency(row.buildingBookValue)} (Immobilie)</small>
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
            zugeflossenen, nach Steuern verbleibenden Zahlungen zusammen. Die
            Erbersatzsteuer (§ 1 Abs. 1 Nr. 4 ErbStG) wird alle 30 Jahre auf
            Grundlage des Nettovermögens (2 fiktive Kinder, Freibetrag je{" "}
            {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)}, Pauschalsatz{" "}
            {formatPercent(ERBERSATZ_TAX_RATE * 100)}) berechnet und mindert das
            Eigenkapital. Bei Ratenzahlung (§ 24 ErbStG) wird die Verbindlichkeit
            als Fremdkapital ausgewiesen.
          </p>
        </section>
      </main>
    </>
  );
}
