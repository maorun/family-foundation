"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

import {
  BUNDESLAENDER,
  CHART_MAX_X_TICKS,
  CHART_MIN_VALUE_FLOOR,
  CHART_X_AXIS_LABEL_OFFSET,
  CHART_Y_TICK_COUNT,
  DEFAULT_FORM_VALUES,
  DEFAULT_PERSONAL_TAX_STEPS,
  DEFAULT_RELATIONSHIP_ID,
  DEFAULT_RESULT,
  DISTRIBUTION_FIELD_IDS,
  ERBERSATZ_CHILD_ALLOWANCE,
  ERBERSATZ_CHILDREN,
  ERBERSATZ_CYCLE_YEARS,
  ERBERSATZ_TAX_CLASS,
  FIELD_DEFINITIONS,
  KST_COMBINED_RATE,
  KST_RATE,
  RELATIONSHIP_OPTIONS,
  SOLZ_ON_KST,
  calculateProjection,
  createProjectionInput,
  createSvgLinePath,
  formatCurrency,
  formatDecimalAsPercent,
  formatPercent,
  getEffectiveFormValues,
  getRelationshipOption,
  parseNumber,
  validateFormValues,
  validateMaintenanceEvents,
  validatePersonalTaxSteps,
} from "./lib/projection";

// Keep v1 key for backward compatibility with previously persisted browser state.
// v1 stored the raw form state object without version/scenario metadata.
const STORAGE_KEY_V1 = "familienstiftung-rechner-v1";
// v2 stores a versioned payload: { version, current, scenarios }.
const STORAGE_KEY_V2 = "familienstiftung-rechner-v2";
const STORAGE_VERSION = 2;
const FIELD_HELP_TEXT_BY_ID = {
  foundationSetupCost:
    "Einmalige Kosten für die Stiftungsgründung, z. B. Notar, Behörden und erforderliche Kapitalbindung.",
  foundationEtfTaxRate:
    "Steuersatz auf die steuerpflichtigen ETF-Erträge der Stiftung.",
  privateEtfTaxRate:
    "Steuersatz auf die steuerpflichtigen ETF-Erträge der Privatperson/Vergleichsrechnung.",
  depreciationRate:
    "Jährlicher AfA-Satz auf den abschreibungsfähigen Gebäudeanteil.",
  realEstateTaxRate: "Grunderwerbsteuer-Satz auf den Immobilienkaufpreis.",
  saverAllowance:
    "Jährlicher steuerfreier Freibetrag auf Kapitalerträge der Privatperson.",
  etfBasisInterestRate:
    "Gesetzlicher Basiszins zur Berechnung der ETF-Vorabpauschale (Basisertrag = ETF-Wert × 70 % × Basiszins).",
  inflationRate:
    "Jährliche Anpassungsrate für Mieteinnahmen und Verwaltungskosten (0 = keine Anpassung, 2 = 2 % p.a. Anstieg ab Jahr 2).",
};

function normalizeConfig(rawConfig = {}) {
  const personalTaxSteps = Array.isArray(rawConfig.personalTaxSteps)
    ? rawConfig.personalTaxSteps
    : DEFAULT_PERSONAL_TAX_STEPS;
  const maintenanceEvents = Array.isArray(rawConfig.maintenanceEvents)
    ? rawConfig.maintenanceEvents.map((evt) =>
        evt.type === "afa" ? { ...evt, type: "spread", spreadYears: "5" } : evt,
      )
    : [];

  return {
    formValues: { ...DEFAULT_FORM_VALUES, ...(rawConfig.formValues ?? {}) },
    relationshipId: rawConfig.relationshipId ?? DEFAULT_RELATIONSHIP_ID,
    surplusToRepayment: rawConfig.surplusToRepayment ?? false,
    comparePaysRealEstateTax: rawConfig.comparePaysRealEstateTax ?? false,
    bundesland: rawConfig.bundesland ?? null,
    personalTaxSteps,
    selectedOverviewYear: rawConfig.selectedOverviewYear ?? "all",
    includeRealEstate: rawConfig.includeRealEstate ?? false,
    includeDistributions: rawConfig.includeDistributions ?? false,
    compareType: rawConfig.compareType ?? "rental",
    bulletLoan: rawConfig.bulletLoan ?? false,
    bulletLoanShowReturn: rawConfig.bulletLoanShowReturn ?? false,
    bulletLoanReinvest: rawConfig.bulletLoanReinvest ?? false,
    lenderIsTenant: rawConfig.lenderIsTenant ?? false,
    tenantRentFromExternalFunds: rawConfig.tenantRentFromExternalFunds ?? false,
    founderPaysSetupCost: rawConfig.founderPaysSetupCost ?? false,
    maintenanceEvents,
  };
}

function calculateResultFromConfig(config) {
  const normalized = normalizeConfig(config);
  const validation = validateFormValues(
    getEffectiveFormValues(normalized.formValues, normalized.includeRealEstate, normalized.includeDistributions),
    normalized.bulletLoan,
  );
  const taxValidation = validatePersonalTaxSteps(normalized.personalTaxSteps);
  const maintenanceValidation = validateMaintenanceEvents(normalized.maintenanceEvents);
  const relationship = getRelationshipOption(normalized.relationshipId);
  if (!validation.input || !taxValidation.parsedSteps) return DEFAULT_RESULT;
  return calculateProjection(
    createProjectionInput(
      validation.input,
      relationship,
      normalized.surplusToRepayment,
      taxValidation.parsedSteps,
      normalized.includeRealEstate ? normalized.comparePaysRealEstateTax : false,
      normalized.bulletLoan,
      normalized.lenderIsTenant,
      normalized.tenantRentFromExternalFunds,
      maintenanceValidation.parsedEvents,
      normalized.bulletLoanReinvest,
      normalized.founderPaysSetupCost,
    ),
  );
}

function toScenarioConfig(state) {
  return {
    formValues: state.formValues,
    relationshipId: state.relationshipId,
    surplusToRepayment: state.surplusToRepayment,
    comparePaysRealEstateTax: state.comparePaysRealEstateTax,
    bundesland: state.bundesland,
    personalTaxSteps: state.personalTaxSteps,
    selectedOverviewYear: state.selectedOverviewYear,
    includeRealEstate: state.includeRealEstate,
    includeDistributions: state.includeDistributions,
    compareType: state.compareType,
    bulletLoan: state.bulletLoan,
    bulletLoanShowReturn: state.bulletLoanShowReturn,
    bulletLoanReinvest: state.bulletLoanReinvest,
    lenderIsTenant: state.lenderIsTenant,
    tenantRentFromExternalFunds: state.tenantRentFromExternalFunds,
    founderPaysSetupCost: state.founderPaysSetupCost,
    maintenanceEvents: state.maintenanceEvents,
  };
}

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

function getActiveCompareWealth(row, compareType, includeRealEstate) {
  if (!includeRealEstate) return row.compareWealth;
  if (compareType === "etfOnly") return row.etfOnlyWealth;
  if (compareType === "selfUse") return row.selfUseWealth;
  return row.compareWealth; // 'rental' (default)
}

function calculateOutcomeDelta(projectionResult, compareType, includeRealEstate) {
  const lastRow = projectionResult.rows[projectionResult.rows.length - 1];
  if (!lastRow) return 0;
  return (
    lastRow.foundationWealth +
    lastRow.personAssetPosition -
    getActiveCompareWealth(lastRow, compareType, includeRealEstate)
  );
}

function formatSignedCurrency(value) {
  if (value > 0) return `+${formatCurrency(value)}`;
  return formatCurrency(value);
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
      includeDistributions,
      compareType,
      bulletLoan,
      bulletLoanShowReturn,
      bulletLoanReinvest,
      lenderIsTenant,
      tenantRentFromExternalFunds,
      founderPaysSetupCost,
      maintenanceEvents,
      scenarios,
      scenarioNameInput,
      activeScenarioName,
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
    includeDistributions: false,
    compareType: "rental",
    bulletLoan: false,
    bulletLoanShowReturn: false,
    bulletLoanReinvest: false,
    lenderIsTenant: false,
    tenantRentFromExternalFunds: false,
    founderPaysSetupCost: false,
    maintenanceEvents: [],
    scenarios: [],
    scenarioNameInput: "",
    activeScenarioName: "",
    result: DEFAULT_RESULT,
  });

  // Local state for the property value slider UI
  const [propertyTotalStr, setPropertyTotalStr] = useState(() => {
    const bv = parseFloat(DEFAULT_FORM_VALUES.buildingValue) || 0;
    const lv = parseFloat(DEFAULT_FORM_VALUES.landValue) || 0;
    return String(bv + lv);
  });
  const [buildingRatio, setBuildingRatio] = useState(() => {
    const bv = parseFloat(DEFAULT_FORM_VALUES.buildingValue) || 0;
    const lv = parseFloat(DEFAULT_FORM_VALUES.landValue) || 0;
    const total = bv + lv;
    return total > 0 ? Math.round((bv / total) * 100) : 50;
  });

  // Sync slider UI state when formValues change externally (e.g. scenario loading)
  useEffect(() => {
    const bv = parseFloat(formValues.buildingValue) || 0;
    const lv = parseFloat(formValues.landValue) || 0;
    const total = bv + lv;
    const ratio = total > 0 ? Math.round((bv / total) * 100) : 50;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPropertyTotalStr((prev) => {
      const prevTotal = parseFloat(prev) || 0;
      return Math.abs(prevTotal - total) > 0.5 ? String(total) : prev;
    });
    setBuildingRatio((prev) => (prev !== ratio ? ratio : prev));
  }, [formValues.buildingValue, formValues.landValue]);

  // Load saved values from localStorage on first mount
  useEffect(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_KEY_V2);
      const savedLegacy = savedV2 ? null : localStorage.getItem(STORAGE_KEY_V1);
      const saved = savedV2 ?? savedLegacy;
      if (!saved) return;
      const parsed = JSON.parse(saved);
      let payload;
      if (parsed?.version === STORAGE_VERSION) {
        payload = parsed;
      } else if (parsed?.version === undefined) {
        payload = { version: STORAGE_VERSION, current: parsed, scenarios: [] };
      } else {
        return;
      }
      const currentConfig = normalizeConfig(payload.current);
      const nextResult = calculateResultFromConfig(currentConfig);
      const nextScenarios = Array.isArray(payload.scenarios)
        ? payload.scenarios
            .filter((scenario) => typeof scenario?.name === "string" && scenario.name.trim().length > 0)
            .map((scenario) => ({
              name: scenario.name.trim(),
              config: normalizeConfig(scenario.config),
            }))
        : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        ...currentConfig,
        scenarios: nextScenarios,
        scenarioNameInput: "",
        activeScenarioName: "",
        result: nextResult,
      });
      localStorage.setItem(
        STORAGE_KEY_V2,
        JSON.stringify({
          version: STORAGE_VERSION,
          current: currentConfig,
          scenarios: nextScenarios,
        }),
      );
      if (localStorage.getItem(STORAGE_KEY_V1)) {
        localStorage.removeItem(STORAGE_KEY_V1);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist values to localStorage whenever they change (debounced to 300 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY_V2,
          JSON.stringify({
            version: STORAGE_VERSION,
            current: {
              formValues,
              relationshipId,
              surplusToRepayment,
              comparePaysRealEstateTax,
              bundesland,
              personalTaxSteps,
              selectedOverviewYear,
              includeRealEstate,
              includeDistributions,
              compareType,
              bulletLoan,
              bulletLoanShowReturn,
              bulletLoanReinvest,
              lenderIsTenant,
              tenantRentFromExternalFunds,
              founderPaysSetupCost,
              maintenanceEvents,
            },
            scenarios,
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
    includeDistributions,
    compareType,
    bulletLoan,
    bulletLoanShowReturn,
    bulletLoanReinvest,
    lenderIsTenant,
    tenantRentFromExternalFunds,
    founderPaysSetupCost,
    maintenanceEvents,
    scenarios,
  ]);

  const validation = useMemo(
    () => validateFormValues(getEffectiveFormValues(formValues, includeRealEstate, includeDistributions), bulletLoan),
    [formValues, includeRealEstate, includeDistributions, bulletLoan],
  );
  const taxStepsValidation = useMemo(() => validatePersonalTaxSteps(personalTaxSteps), [personalTaxSteps]);
  const maintenanceValidation = useMemo(() => validateMaintenanceEvents(maintenanceEvents), [maintenanceEvents]);
  const hasInvalidFields = validation.invalidIds.length > 0;
  const hasInvalidTaxSteps = taxStepsValidation.parsedSteps === null;
  const hasInvalidMaintenanceEvents = maintenanceValidation.invalidIndices.length > 0;
  const invalidFieldLabels = useMemo(
    () =>
      FIELD_DEFINITIONS.filter((field) => validation.invalidIds.includes(field.id)).map(
        (field) => field.label,
      ),
    [validation.invalidIds],
  );
  const selectedRelationship = useMemo(
    () => getRelationshipOption(relationshipId),
    [relationshipId],
  );
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

  const compareScenarioLabel = !includeRealEstate
    ? "Privates ETF-Investment"
    : compareType === "etfOnly"
      ? "Gleiches Kapital, nur ETF"
      : compareType === "selfUse"
        ? "Selbstnutzung"
        : "Privatvermietung";

  const compareTaxCardDetail = result.input.comparePaysRealEstateTax
    ? ", inkl. Grunderwerbsteuer"
    : ", ohne Grunderwerbsteuer";
  const compareTaxFormulaDetail = result.input.comparePaysRealEstateTax
    ? `, mit ${formatCurrency(result.privateRealEstateTax)} GrESt`
    : ", ohne GrESt";
  const totalFoundingCost = result.giftTax + result.foundationSetupCost;
  // Reusable formula fragment for founding-cost display in year-0 detail rows
  const setupCostFormulaFragment = result.input.founderPaysSetupCost
    ? " — Gründungskosten vom Stifter getragen"
    : ` − ${formatCurrency(result.foundationSetupCost)} (Gründungskosten)`;
  const setupCostTaxFormulaFragment = result.input.founderPaysSetupCost
    ? " — Gründungskosten vom Stifter getragen, kein Abzug"
    : ` − ${formatCurrency(result.foundationSetupCost)} (Gründungskosten)`;

  const cards = [
    {
      title: "Gründungskosten gesamt (Jahr 0)",
      value: formatCurrency(totalFoundingCost),
      detail: `${formatCurrency(result.giftTax)} (Schenkungssteuer) + ${formatCurrency(result.foundationSetupCost)} (einmalige Gründungskosten)`,
    },
    {
      title: "Schenkungssteuer bei Gründung",
      value: formatCurrency(result.giftTax),
      detail: `${selectedRelationship.shortLabel}: effektiv ${formatDecimalAsPercent(result.effectiveGiftTaxRate)}, Freibetrag ${formatCurrency(result.giftTaxAllowance)}`,
    },
    {
      title: "Gründungskosten (einmalig)",
      value: formatCurrency(result.foundationSetupCost),
      detail: "Notar, Behörden und Kapitalbindung gemäß Gründungsanforderungen",
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
        : `${formatCurrency(result.input.monthlyRent)} pro Monat${result.deferredPurchase && result.purchaseYear !== null ? ` (ab Jahr ${result.purchaseYear})` : ""}${result.input.inflationRate > 0 ? `, jährliche Steigerung ${formatDecimalAsPercent(result.input.inflationRate)}` : ""}`,
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
      value: formatCurrency(getActiveCompareWealth(lastYear, compareType, includeRealEstate)),
      detail: !includeRealEstate
        ? `Ohne Stiftung, Kapital direkt in ETF investiert (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)}; Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)})`
        : compareType === "etfOnly"
          ? `Gleiches Startkapital (${formatCurrency(result.input.initialCapital)}) ohne Immobilie, vollständig in ETF investiert (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)}; Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)})`
          : compareType === "selfUse"
            ? `Eigennutzung ohne AfA, kein Mietvorteil (fairer Vergleich)${compareTaxCardDetail}, Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)}, positive Liquidität in ETF (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)})`
            : `Ohne Stiftung, ohne Darlehen, ohne Verwaltungskosten, Mieteinnahmen zu ${formatPercent(lastYear.personalTaxRate * 100)} versteuert${compareTaxCardDetail}, Sparerpauschbetrag ${formatCurrency(result.input.saverAllowance)}, positive Liquidität in ETF (${formatPercent(result.input.etfReturnRate * 100)}; ETF-Steuer ${formatPercent(result.input.privateEtfTaxRate * 100)}; Teilfreistellung ${formatPercent(result.input.privateEtfPartialExemptionRate * 100)})`,
    },
  ].filter((card) => (!card.realEstateOnly || includeRealEstate) && (!card.loanOnly || result.input.loanAmount > 0));

  const sensitivityScenarios = useMemo(() => {
    const { input, rows } = result;
    if (rows.length === 0) return [];

    const lastBaseRow = rows[rows.length - 1];
    const baseOutcomeDelta =
      lastBaseRow.foundationWealth +
      lastBaseRow.personAssetPosition -
      getActiveCompareWealth(lastBaseRow, compareType, includeRealEstate);
    const variants = [
      {
        id: "etf-return-minus",
        title: "ETF-Rendite −1 Prozentpunkt",
        updatedInput: {
          etfReturnRate: Math.max(0, input.etfReturnRate - 0.01),
        },
      },
      {
        id: "etf-return-plus",
        title: "ETF-Rendite +1 Prozentpunkt",
        updatedInput: {
          etfReturnRate: input.etfReturnRate + 0.01,
        },
      },
      {
        id: "rent-minus",
        title: "Mieteinnahmen −10 %",
        updatedInput: {
          monthlyRent: Math.max(0, input.monthlyRent * 0.9),
        },
        realEstateOnly: true,
      },
      {
        id: "rent-plus",
        title: "Mieteinnahmen +10 %",
        updatedInput: {
          monthlyRent: input.monthlyRent * 1.1,
        },
        realEstateOnly: true,
      },
    ];

    return variants
      .filter((variant) => !variant.realEstateOnly || includeRealEstate)
      .map((variant) => {
        const variantResult = calculateProjection({
          ...input,
          ...variant.updatedInput,
        });
        const variantOutcomeDelta = calculateOutcomeDelta(
          variantResult,
          compareType,
          includeRealEstate,
        );
        const impact = variantOutcomeDelta - baseOutcomeDelta;
        return {
          id: variant.id,
          title: variant.title,
          outcomeDelta: variantOutcomeDelta,
          impact,
        };
      });
  }, [result, compareType, includeRealEstate]);

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
          value: getActiveCompareWealth(row, compareType, includeRealEstate),
        })),
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
      (row, index) => index >= 1 && row.foundationWealth + row.personAssetPosition >= getActiveCompareWealth(row, compareType, includeRealEstate),
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
  }, [result.rows, result.input.loanAmount, includeRealEstate, compareType, compareScenarioLabel]);

  function handleFieldChange(fieldId, value) {
    setState((currentState) => {
      const nextFormValues = {
        ...currentState.formValues,
        [fieldId]: value,
      };
      const nextValidation = validateFormValues(getEffectiveFormValues(nextFormValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRealEstateValuesChange(buildingVal, landVal) {
    setState((currentState) => {
      const nextFormValues = {
        ...currentState.formValues,
        buildingValue: buildingVal,
        landValue: landVal,
      };
      const nextValidation = validateFormValues(getEffectiveFormValues(nextFormValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRelationshipChange(nextRelationshipId) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleSurplusToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleCompareRealEstateTaxToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleIncludeRealEstateToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, checked, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleCompareTypeChange(type) {
    setState((currentState) => ({
      ...currentState,
      compareType: type,
    }));
  }

  function handleIncludeDistributionsToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(
        getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, checked),
        currentState.bulletLoan,
      );
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        includeDistributions: checked,
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
                currentState.bulletLoanReinvest,
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
      const nextValidation = validateFormValues(getEffectiveFormValues(nextFormValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
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
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
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
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
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
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleBulletLoanToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), checked);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        bulletLoan: checked,
        // When switching off bullet loan, also reset show-return and reinvest
        bulletLoanShowReturn: checked ? currentState.bulletLoanShowReturn : false,
        bulletLoanReinvest: checked ? currentState.bulletLoanReinvest : false,
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
                checked ? currentState.bulletLoanReinvest : false,
                currentState.founderPaysSetupCost,
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

  function handleBulletLoanReinvestToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        bulletLoanReinvest: checked,
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
                checked,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleLenderTenantToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleTenantRentFromExternalFundsToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleFounderPaysSetupCostToggle(checked) {
    setState((currentState) => {
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate), currentState.bulletLoan);
      const nextTaxValidation = validatePersonalTaxSteps(currentState.personalTaxSteps);
      return {
        ...currentState,
        founderPaysSetupCost: checked,
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
                currentState.bulletLoanReinvest,
                checked,
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
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
              ),
            )
          : currentState.result,
      };
    });
  }

  function handleRemoveMaintenanceEvent(index) {
    setState((currentState) => {
      const nextEvents = currentState.maintenanceEvents.filter((_, i) => i !== index);
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
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
      const nextValidation = validateFormValues(getEffectiveFormValues(currentState.formValues, currentState.includeRealEstate, currentState.includeDistributions), currentState.bulletLoan);
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
                currentState.bulletLoanReinvest,
                currentState.founderPaysSetupCost,
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

  function handleScenarioNameInputChange(value) {
    setState((currentState) => ({
      ...currentState,
      scenarioNameInput: value,
    }));
  }

  function handleSaveScenario() {
    setState((currentState) => {
      const name = currentState.scenarioNameInput.trim();
      if (!name) return currentState;
      const config = normalizeConfig(toScenarioConfig(currentState));
      const nextScenario = { name, config };
      const nextScenarios = [
        ...currentState.scenarios.filter((scenario) => scenario.name !== name),
        nextScenario,
      ].sort((a, b) => a.name.localeCompare(b.name, "de"));
      return {
        ...currentState,
        scenarios: nextScenarios,
        activeScenarioName: name,
      };
    });
  }

  function handleLoadScenario(name) {
    setState((currentState) => {
      const scenario = currentState.scenarios.find((entry) => entry.name === name);
      if (!scenario) return currentState;
      const config = normalizeConfig(scenario.config);
      return {
        ...currentState,
        ...config,
        activeScenarioName: name,
        result: calculateResultFromConfig(config),
      };
    });
  }

  function handleDeleteScenario(name) {
    setState((currentState) => {
      const nextScenarios = currentState.scenarios.filter((scenario) => scenario.name !== name);
      return {
        ...currentState,
        scenarios: nextScenarios,
        activeScenarioName:
          currentState.activeScenarioName === name ? "" : currentState.activeScenarioName,
      };
    });
  }

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    const lines = [
      [
        "Jahr",
        "Stiftung Nettovermögen",
        "Privatperson Vermögensposition",
        "Gesamtvermögen",
        "Vergleichsvermögen",
      ].join(";"),
      ...result.rows.map((row) =>
        [
          row.year,
          row.foundationWealth.toFixed(2),
          row.personAssetPosition.toFixed(2),
          (row.foundationWealth + row.personAssetPosition).toFixed(2),
          row.compareWealth.toFixed(2),
        ].join(";"),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "familienstiftung-vermoegensverlauf.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const wealthDiff =
    lastYear.foundationWealth +
    (result.input.loanAmount > 0 ? lastYear.personAssetPosition : 0) -
    getActiveCompareWealth(lastYear, compareType, includeRealEstate);

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

        <section className={`${styles.panel} ${styles.noPrint}`}>
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
              Für die Erstausstattung gilt die günstigste Steuerklasse aus dem Kreis der Begünstigten; der progressive Stufentarif (§ 19 ErbStG) und der pauschale Freibetrag werden daraus abgeleitet.
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
          <div className={styles.checkboxRow}>
            <input
              id="includeDistributions"
              type="checkbox"
              checked={includeDistributions}
              onChange={(event) => handleIncludeDistributionsToggle(event.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="includeDistributions" className={styles.checkboxLabel}>
              Destinatärszahlungen einbeziehen (jährliche Ausschüttungen an Begünstigte, § 20 Abs. 1 Nr. 9 EStG)
            </label>
          </div>
          {(() => {
            const renderField = (field) => {
              const isInvalid = validation.invalidIds.includes(field.id);
              return (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    className={styles.fieldLabel}
                    title={FIELD_HELP_TEXT_BY_ID[field.id] ?? undefined}
                  >
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
                !f.distribution &&
                !f.selfUse &&
                !(f.id === "loanRepaymentRate" && bulletLoan) &&
                !(f.conditionalField === "bulletLoan" && !bulletLoan),
            );
            const foundingFieldIds = new Set(["initialCapital", "foundationSetupCost"]);
            const foundingFields = nonRealEstateFields.filter((f) => foundingFieldIds.has(f.id));
            const planningFields = nonRealEstateFields.filter((f) => !foundingFieldIds.has(f.id));

            const realEstateFields = FIELD_DEFINITIONS.filter((f) => f.realEstate);
            const distributionFields = FIELD_DEFINITIONS.filter((f) => f.distribution);

            return (
              <>
                <div className={styles.inputSection}>
                  <h3 className={styles.inputSectionTitle}>Gründung</h3>
                  <div className={styles.grid}>
                    {foundingFields.map(renderField)}
                  </div>
                  <div className={styles.checkboxRow}>
                    <input
                      id="founderPaysSetupCost"
                      type="checkbox"
                      checked={founderPaysSetupCost}
                      onChange={(event) => handleFounderPaysSetupCostToggle(event.target.checked)}
                      className={styles.checkbox}
                    />
                    <label htmlFor="founderPaysSetupCost" className={styles.checkboxLabel}>
                      Gründungskosten vom Stifter/Darlehensgeber getragen (nicht von der Stiftung)
                    </label>
                  </div>
                </div>
                <div className={styles.inputSection}>
                  <h3 className={styles.inputSectionTitle}>Laufende Parameter</h3>
                  <div className={styles.grid}>
                    {planningFields.map(renderField)}
                  </div>
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
                    {/* Gesamter Immobilienwert + Slider */}
                    <div className={styles.propertyValueSection}>
                      <h3 className={styles.inputSectionTitle}>Immobilienwert</h3>
                      <div>
                        <label htmlFor="propertyTotal" className={styles.fieldLabel}>
                          Gesamter Immobilienwert (€)
                        </label>
                        <input
                          id="propertyTotal"
                          type="number"
                          min="0"
                          step="1000"
                          value={propertyTotalStr}
                          onChange={(event) => {
                            const val = event.target.value;
                            setPropertyTotalStr(val);
                            const total = parseFloat(val) || 0;
                            const building = Math.round((total * buildingRatio) / 100);
                            const land = total - building;
                            handleRealEstateValuesChange(String(building), String(land));
                          }}
                          className={styles.fieldInput}
                        />
                      </div>
                      <div className={styles.propertySliderSection}>
                        <div className={styles.propertySliderValues}>
                          <span>
                            <strong>Gebäudewert:</strong>{" "}
                            {formatCurrency(Math.round(((parseFloat(propertyTotalStr) || 0) * buildingRatio) / 100))}
                          </span>
                          <span>
                            <strong>Grundstückswert:</strong>{" "}
                            {formatCurrency(Math.round(((parseFloat(propertyTotalStr) || 0) * (100 - buildingRatio)) / 100))}
                          </span>
                        </div>
                        <input
                          type="range"
                          id="buildingRatioSlider"
                          min="0"
                          max="100"
                          step="1"
                          value={buildingRatio}
                          onChange={(event) => {
                            const ratio = Number(event.target.value);
                            setBuildingRatio(ratio);
                            const total = parseFloat(propertyTotalStr) || 0;
                            const building = Math.round((total * ratio) / 100);
                            const land = total - building;
                            handleRealEstateValuesChange(String(building), String(land));
                          }}
                          className={styles.propertySlider}
                        />
                        <div className={styles.propertySliderEndLabels}>
                          <span>0 % Gebäude</span>
                          <span>100 % Gebäude</span>
                        </div>
                      </div>
                    </div>
                    {/* Remaining real estate fields (without buildingValue and landValue) */}
                    <div className={styles.grid}>
                      {realEstateFields
                        .filter((f) => f.id !== "buildingValue" && f.id !== "landValue")
                        .map(renderField)}
                    </div>
                  </div>
                )}
                {includeDistributions && (
                  <div className={styles.inputSection}>
                    <h3 className={styles.inputSectionTitle}>Destinatärszahlungen</h3>
                    <div className={styles.grid}>
                      {distributionFields.map(renderField)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <div className={styles.taxStepsSection}>
            <span className={styles.fieldLabel}>Persönlicher Steuersatz des Darlehensgebers (%)</span>
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
            <div className={styles.validationMessage}>
              <p>
                Bitte korrigieren Sie die rot markierten Eingaben. Bis dahin bleiben
                die zuletzt gültigen Ergebnisse sichtbar.
              </p>
              {invalidFieldLabels.length > 0 && (
                <ul className={styles.validationList}>
                  {invalidFieldLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className={styles.taxStepsSection}>
            <span className={styles.fieldLabel}>Szenarien speichern</span>
            <p className={styles.hint}>
              Aktuelle Konfiguration unter einem Namen speichern und später wieder laden.
            </p>
            <div className={styles.scenarioActions}>
              <input
                id="scenarioNameInput"
                type="text"
                value={scenarioNameInput}
                onChange={(event) => handleScenarioNameInputChange(event.target.value)}
                className={styles.fieldInput}
                placeholder="z. B. Konservativ"
              />
              <button type="button" onClick={handleSaveScenario} className={styles.taxStepAddButton}>
                Szenario speichern
              </button>
            </div>
            {scenarios.length > 0 && (
              <div className={styles.scenarioList}>
                {scenarios.map((scenario) => (
                  <div key={scenario.name} className={styles.scenarioItem}>
                    <button
                      type="button"
                      onClick={() => handleLoadScenario(scenario.name)}
                      className={styles.scenarioLoadButton}
                    >
                      {scenario.name}
                      {activeScenarioName === scenario.name ? " (aktiv)" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteScenario(scenario.name)}
                      className={styles.taxStepRemoveButton}
                    >
                      Löschen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          {bulletLoan && (
            <div className={styles.checkboxRow}>
              <input
                id="bulletLoanReinvest"
                type="checkbox"
                checked={bulletLoanReinvest}
                onChange={(event) => handleBulletLoanReinvestToggle(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="bulletLoanReinvest" className={styles.checkboxLabel}>
                Wiederanlage: Nur zurückgezahltes Darlehen + Netto-Zinsen (nach Steuer) neu in die Stiftung anlegen – ETFs bleiben investiert
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
            <fieldset className={styles.radioFieldset}>
              <legend className={styles.fieldLabel}>Vergleichsparameter</legend>
              <p className={styles.hint}>
                Wählen Sie, womit die Stiftung verglichen werden soll.
              </p>
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="compareType"
                    value="rental"
                    checked={compareType === "rental"}
                    onChange={() => handleCompareTypeChange("rental")}
                    className={styles.radio}
                  />
                  <span>Privatvermietung (mit AfA, Mieteinnahmen versteuert)</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="compareType"
                    value="etfOnly"
                    checked={compareType === "etfOnly"}
                    onChange={() => handleCompareTypeChange("etfOnly")}
                    className={styles.radio}
                  />
                  <span>Gleiches Kapital, nur ETF (keine Immobilie)</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="compareType"
                    value="selfUse"
                    checked={compareType === "selfUse"}
                    onChange={() => handleCompareTypeChange("selfUse")}
                    className={styles.radio}
                  />
                  <span>Selbstnutzung (keine AfA, keine Mieteinnahmen; kein Mietvorteil — fairer Vergleich)</span>
                </label>
              </div>
              {compareType !== "etfOnly" && (
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
            </fieldset>
          )}
          {includeRealEstate && compareType === "selfUse" && (
            <div className={styles.inputSection}>
              <h3 className={styles.inputSectionTitle}>KfW-Förderkredit (Selbstnutzung)</h3>
              <p className={styles.hint}>
                Bei Selbstnutzung kann ein KfW-Förderkredit zu sehr günstigen Konditionen aufgenommen werden.
                Der Kreditbetrag verbleibt als Investitionskapital in ETFs; jährliche Tilgung und Zinsen
                werden als Abfluss berücksichtigt. Bei Betrag 0 hat der KfW-Kredit keinen Einfluss.
              </p>
              <div className={styles.grid}>
                {FIELD_DEFINITIONS.filter((f) => f.selfUse).map((field) => {
                  const isInvalid = validation.invalidIds.includes(field.id);
                  return (
                    <div key={field.id}>
                      <label
                        htmlFor={field.id}
                        className={styles.fieldLabel}
                      >
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
            </div>
          )}
          {includeRealEstate && (
            <div className={styles.taxStepsSection}>
              <span className={styles.fieldLabel}>Ereignisse: Instandhaltung</span>
              <p className={styles.hint}>
                Einmalige Instandhaltungskosten eintragen, die in einem bestimmten Jahr anfallen.
                Wählen Sie, ob die Kosten steuerlich sofort voll abzugsfähig sind oder gemäß § 82b EStDV gleichmäßig auf bis zu 5 Jahre verteilt werden.
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
                        <option value="spread">Verteilung auf bis zu 5 Jahre (§ 82b EStDV)</option>
                      </select>
                    </div>
                    {evt.type === "spread" && (
                      <div className={styles.taxStepField}>
                        <label htmlFor={`maintSpreadYears_${index}`} className={styles.taxStepLabel}>Verteilungsjahre (1–5)</label>
                        <input
                          id={`maintSpreadYears_${index}`}
                          type="number"
                          min="1"
                          max="5"
                          step="1"
                          value={evt.spreadYears ?? "5"}
                          onChange={(event) => handleMaintenanceEventChange(index, "spreadYears", event.target.value)}
                          className={`${styles.fieldInput} ${isInvalid ? styles.fieldInputInvalid : ""}`.trim()}
                          aria-invalid={isInvalid}
                          required
                        />
                      </div>
                    )}
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
                  Bitte korrigieren Sie die rot markierten Instandhaltungseinträge (Jahr ≥ 1, Betrag &gt; 0, Verteilungsjahre 1–5).
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
            (Freibetrag je {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)}, progressiver
            Stufentarif Steuerklasse {ERBERSATZ_TAX_CLASS} gem. § 19 ErbStG). Die Zahlung
            erfolgt in 30 gleichen Jahresraten an das Finanzamt (§ 24 ErbStG).
          </p>
        </section>

        <section className={`${styles.panel} ${styles.noPrint}`}>
          <h2>Export</h2>
          <div className={styles.scenarioActions}>
            <button type="button" onClick={handleExportCsv} className={styles.taxStepAddButton}>
              CSV exportieren
            </button>
            <button type="button" onClick={handlePrint} className={styles.taxStepAddButton}>
              Druckansicht / PDF
            </button>
          </div>
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
          <h2>Sensitivitätsanalyse</h2>
          <p className={styles.hint}>
            Ergebnis = Vermögensvorteil (Stiftung + Person) gegenüber dem Vergleich im Jahr {result.input.projectionYears}.
          </p>
          <div className={styles.cards}>
            {sensitivityScenarios.map((scenario) => (
              <article key={scenario.id} className={styles.card}>
                <h3 className={styles.cardTitle}>{scenario.title}</h3>
                <div className={styles.value}>{formatCurrency(scenario.outcomeDelta)}</div>
                <div>
                  Veränderung gegenüber Basis:{" "}
                  <strong
                    className={
                      scenario.impact === 0
                        ? styles.neutral
                        : scenario.impact < 0
                          ? styles.negative
                          : styles.positive
                    }
                  >
                    {formatSignedCurrency(scenario.impact)}
                  </strong>
                </div>
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
            {visibleOverviewRows.map((row) => {
              const foundationVorabTaxableBase = Math.max(
                0,
                Math.min(
                  row.foundationGrossEtfReturn,
                  row.foundationEtfVorabBase * result.input.etfBasisInterestRate * 0.7,
                ) * (1 - result.input.foundationEtfPartialExemptionRate),
              );
              // Privat: ETF-Bestand zu Jahresbeginn (vor Neuanlage) aus Zieldaten ableiten
              const personEtfVorabBase =
                row.personEtfBalance -
                row.personEtfInvestment -
                row.personGrossEtfReturn +
                row.personVorabTax;
              const personInterestAllowanceUsed = Math.min(
                row.personGuvInterest || 0,
                result.input.saverAllowance,
              );
              const personEtfSaverAllowance = result.input.saverAllowance - personInterestAllowanceUsed;
              const compareVorabTaxByType =
                compareType === "etfOnly"
                  ? row.etfOnlyVorabTax
                  : compareType === "selfUse"
                    ? row.selfUseVorabTax
                    : row.compareVorabTax;
              const compareVorabTaxLabel =
                compareType === "etfOnly"
                  ? "Privat-Vergleich (ETF-only): Vorabpauschale"
                  : compareType === "selfUse"
                    ? "Privat-Vergleich (Eigennutzung): Vorabpauschale"
                    : "Privat-Vergleich (Vermietung): Vorabpauschale";

              return (
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
                                <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer){setupCostFormulaFragment} — Immobilienkauf zurückgestellt</small>
                              ) : (
                                <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer){setupCostFormulaFragment} + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue)} (Kaufpreis) − {formatCurrency(result.realEstateTax)} (GrESt)</small>
                              )}
                            </>
                          )}
                        </div>
                        <div className={styles.dataItem}>
                          <dt>Steuerliches Ergebnis</dt>
                          <dd>{formatCurrency(row.taxableResult)}</dd>
                          {row.year === 0 && (
                            <small className={styles.formula}>− {formatCurrency(result.giftTax)} (Schenkungssteuer){setupCostTaxFormulaFragment}</small>
                          )}
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
                              {ERBERSATZ_CHILDREN} × Stufentarif § 19 ErbStG StKl. {ERBERSATZ_TAX_CLASS} auf max(0, {formatCurrency((row.foundationCash + row.foundationEtfLiquidationValue + (row.propertyOwned ? result.propertyValue : 0) - row.remainingLoan) / ERBERSATZ_CHILDREN)} − {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)} Freibetrag)
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
                        {row.year > 0 && row.distributionGross > 0 && (
                          <div className={styles.dataItem}>
                            <dt>Destinatärszahlungen (Ausschüttung)</dt>
                            <dd className={styles.negative}>− {formatCurrency(row.distributionGross)}</dd>
                            <small className={styles.formula}>
                              Brutto {formatCurrency(row.distributionGross)} — Steuer Destinatäre {formatCurrency(row.distributionTax)} — Netto {formatCurrency(row.distributionNet)}
                              {row.distributionEtfSaleGross > 0 ? `; ETF-Verkauf ${formatCurrency(row.distributionEtfSaleGross)} (Steuer ${formatCurrency(row.distributionEtfSaleTax)}, Netto ${formatCurrency(row.distributionEtfSaleNet)})` : ""}
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
                      <h5 className={styles.guvColumnTitle}>Privat ohne Stiftung ({compareScenarioLabel})</h5>
                      <dl className={styles.dataGrid}>
                        <div className={styles.dataItem}>
                          <dt>Vergleichsvermögen</dt>
                          <dd>{formatCurrency(getActiveCompareWealth(row, compareType, includeRealEstate))}</dd>
                          {compareType === "etfOnly" && (
                            <small className={styles.formula}>ETF (nach Verkaufsteuer) — gleiches Startkapital ({formatCurrency(result.input.initialCapital)}), keine Immobilie, kein Darlehen, kein Verwaltungsaufwand</small>
                          )}
                          {compareType === "selfUse" && (
                            <small className={styles.formula}>Kasse + ETF (nach Verkaufsteuer) + {formatCurrency(result.propertyValue)} (Immobilienwert){result.input.selfUseKfwLoanAmount > 0 ? ` − KfW-Restschuld` : ""} — Eigennutzung, keine AfA, kein Mietvorteil{compareTaxFormulaDetail}</small>
                          )}
                          {(compareType === "rental" || !includeRealEstate) && (
                            <small className={styles.formula}>Kasse + ETF (nach Verkaufsteuer) + {formatCurrency(result.propertyValue)} (Immobilienwert) — ohne Stiftung, ohne Darlehen, ohne Verwaltungskosten, Miete zu {formatPercent(row.personalTaxRate * 100)} versteuert{compareTaxFormulaDetail}</small>
                          )}
                        </div>
                        {compareType === "rental" && row.compareMaintenanceCashOut > 0 && (
                          <div className={styles.dataItem}>
                            <dt>Instandhaltung (Privat)</dt>
                            <dd className={styles.negative}>{formatCurrency(row.compareMaintenanceCashOut)}</dd>
                            <small className={styles.formula}>
                              {row.compareMaintenanceFullDeduction > 0 && `${formatCurrency(row.compareMaintenanceFullDeduction)} voll abzugsfähig`}
                              {row.compareMaintenanceFullDeduction > 0 && row.compareMaintenanceSpreadDeduction > 0 && "; "}
                              {row.compareMaintenanceSpreadDeduction > 0 && `${formatCurrency(row.compareMaintenanceSpreadDeduction)} verteilt abgezogen (§ 82b EStDV)`}
                              {row.compareMaintenanceEtfSaleGross > 0 && `; ETF-Verkauf ${formatCurrency(row.compareMaintenanceEtfSaleGross)} (Steuer ${formatCurrency(row.compareMaintenanceEtfSaleTax)}, Netto ${formatCurrency(row.compareMaintenanceEtfSaleNet)})`}
                            </small>
                          </div>
                        )}
                        {compareType === "selfUse" && row.selfUseMaintCashOut > 0 && (
                          <div className={styles.dataItem}>
                            <dt>Instandhaltung (Eigennutzung)</dt>
                            <dd className={styles.negative}>{formatCurrency(row.selfUseMaintCashOut)}</dd>
                            <small className={styles.formula}>
                              Kein Steuerabzug (Eigennutzung)
                              {row.selfUseMaintEtfSaleGross > 0 && `; ETF-Verkauf ${formatCurrency(row.selfUseMaintEtfSaleGross)} (Steuer ${formatCurrency(row.selfUseMaintEtfSaleTax)}, Netto ${formatCurrency(row.selfUseMaintEtfSaleNet)})`}
                            </small>
                          </div>
                        )}
                        {compareType === "selfUse" && row.year > 0 && (row.selfUseKfwRepayment > 0 || row.selfUseKfwInterest > 0) && (
                          <div className={styles.dataItem}>
                            <dt>KfW-Kredit (Tilgung + Zinsen)</dt>
                            <dd className={styles.negative}>{formatCurrency(row.selfUseKfwRepayment + row.selfUseKfwInterest)}</dd>
                            <small className={styles.formula}>
                              Tilgung: {formatCurrency(row.selfUseKfwRepayment)}, Zinsen: {formatCurrency(row.selfUseKfwInterest)} ({formatPercent(result.input.selfUseKfwLoanInterestRate * 100)} auf {formatCurrency(row.selfUseRemainingKfwLoan + row.selfUseKfwRepayment)} Restschuld)
                            </small>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                </div>

                <div className={styles.yearSection}>
                    <h4 className={styles.yearSectionTitle}>Steuern im Jahr</h4>
                    <div className={styles.guvColumns}>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Stiftung</h5>
                        <dl className={styles.dataGrid}>
                          {row.year === 0 ? (
                            <>
                              <div className={styles.dataItem}>
                                <dt>Schenkungssteuer bei Gründung</dt>
                                <dd className={styles.negative}>− {formatCurrency(result.giftTax)}</dd>
                                <small className={styles.formula}>
                                  Stufentarif § 19 ErbStG auf max(0, {formatCurrency(result.input.initialCapital)} − {formatCurrency(result.input.giftTaxAllowance)} Freibetrag)
                                </small>
                              </div>
                              {!result.deferredPurchase && (
                                <div className={styles.dataItem}>
                                  <dt>Grunderwerbsteuer (Gründung)</dt>
                                  <dd className={styles.negative}>− {formatCurrency(result.realEstateTax)}</dd>
                                  <small className={styles.formula}>
                                    {formatPercent(result.input.realEstateTaxRate * 100)} × {formatCurrency(result.propertyValue)} (Kaufpreis)
                                  </small>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className={styles.dataItem}>
                                <dt>ETF-Vorabpauschale</dt>
                                <dd className={styles.negative}>− {formatCurrency(row.foundationVorabTax)}</dd>
                                <small className={styles.formula}>
                                  max(0, min({formatCurrency(row.foundationGrossEtfReturn)} Brutto-Rendite, {formatCurrency(row.foundationEtfVorabBase)} ETF-Bestand × 70 % × {formatPercent(result.input.etfBasisInterestRate * 100)} Basiszins) × (1 − {formatPercent(result.input.foundationEtfPartialExemptionRate * 100)} Teilfreistellung)) = {formatCurrency(foundationVorabTaxableBase)} steuerpflichtig; × {formatPercent(result.input.foundationEtfTaxRate * 100)} Steuersatz{row.foundationVorabTaxCredit > 0 ? `; − ${formatCurrency(row.foundationVorabTaxCredit)} Verlustvortrag` : ""}
                                </small>
                              </div>
                              <div className={styles.dataItem}>
                                <dt>Körperschaftsteuer + SolZ</dt>
                                <dd className={styles.negative}>− {formatCurrency(row.guvKstAmount)}</dd>
                                <small className={styles.formula}>
                                  {formatCurrency(row.guvKstBase)} (zu versteuerndes Einkommen) × {formatPercent(KST_COMBINED_RATE * 100)}
                                </small>
                              </div>
                              {row.erbsInstallmentPaid > 0 && (
                                <div className={styles.dataItem}>
                                  <dt>Erbersatzsteuer-Rate</dt>
                                  <dd className={styles.negative}>− {formatCurrency(row.erbsInstallmentPaid)}</dd>
                                  <small className={styles.formula}>
                                    {formatCurrency(row.erbsCurrentCycleAmount)} / {ERBERSATZ_CYCLE_YEARS} Jahre
                                  </small>
                                </div>
                              )}
                              {row.distributionTax > 0 && (
                                <div className={styles.dataItem}>
                                  <dt>Steuer Destinatäre (Ausschüttung)</dt>
                                  <dd className={styles.negative}>− {formatCurrency(row.distributionTax)}</dd>
                                  <small className={styles.formula}>
                                    max(0, {formatCurrency(row.distributionGross)} / {result.input.destinatarCount} − {formatCurrency(result.input.destinatarSaverAllowance)} Sparerpauschbetrag je Person) × {formatPercent(result.input.destinatarTaxRate * 100)} × {result.input.destinatarCount}
                                  </small>
                                </div>
                              )}
                            </>
                          )}
                        </dl>
                      </div>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Privatperson</h5>
                        <dl className={styles.dataGrid}>
                          {row.year === 0 ? (
                            <div className={styles.dataItem}>
                              <dt>Steuern</dt>
                              <dd>{formatCurrency(0)}</dd>
                              <small className={styles.formula}>Im Startjahr keine laufenden Privatsteuern</small>
                            </div>
                          ) : (
                            <>
                              <div className={styles.dataItem}>
                                <dt>Einkommensteuer auf Zinsen</dt>
                                <dd className={styles.negative}>− {formatCurrency(row.personGuvTax)}</dd>
                                <small className={styles.formula}>
                                  max(0, {formatCurrency(row.personGuvInterest)} − {formatCurrency(result.input.saverAllowance)}) × {formatPercent(row.personalTaxRate * 100)}
                                </small>
                              </div>
                              <div className={styles.dataItem}>
                                <dt>ETF-Vorabpauschale</dt>
                                <dd className={styles.negative}>− {formatCurrency(row.personVorabTax)}</dd>
                                <small className={styles.formula}>
                                  max(0, min({formatCurrency(row.personGrossEtfReturn)} Brutto-Rendite, {formatCurrency(personEtfVorabBase)} ETF-Bestand × 70 % × {formatPercent(result.input.etfBasisInterestRate * 100)} Basiszins) × (1 − {formatPercent(result.input.privateEtfPartialExemptionRate * 100)} Teilfreistellung){personEtfSaverAllowance > 0 ? ` − ${formatCurrency(personEtfSaverAllowance)} Sparerpauschbetrag` : ""}) × {formatPercent(result.input.privateEtfTaxRate * 100)} Steuersatz
                                </small>
                              </div>
                            </>
                          )}
                        </dl>
                      </div>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Privat-Vergleich</h5>
                        <dl className={styles.dataGrid}>
                          {row.year === 0 ? (
                            <div className={styles.dataItem}>
                              <dt>Steuern</dt>
                              <dd>{formatCurrency(0)}</dd>
                              <small className={styles.formula}>Im Startjahr keine laufenden Vergleichssteuern</small>
                            </div>
                          ) : (
                            <div className={styles.dataItem}>
                              <dt>{compareVorabTaxLabel}</dt>
                              <dd className={styles.negative}>− {formatCurrency(compareVorabTaxByType)}</dd>
                              <small className={styles.formula}>
                                Vorabpauschale mit {formatPercent(result.input.privateEtfPartialExemptionRate * 100)} Teilfreistellung und {formatPercent(result.input.privateEtfTaxRate * 100)} Steuersatz
                              </small>
                            </div>
                          )}
                        </dl>
                    </div>
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
                              <small className={styles.formula}>{formatCurrency(result.depreciableBuildingBase)} (Gebäude inkl. GrESt-Anteil) × {formatPercent(result.input.depreciationRate * 100)} (AfA-Satz)</small>
                            )}
                          </div>
                          {(row.guvMaintenanceCashOut > 0 || row.guvMaintenanceSpreadDeduction > 0) && (
                            <div className={styles.dataItem}>
                              <dt>Instandhaltung</dt>
                              <dd className={styles.negative}>{formatCurrency(row.guvMaintenanceCashOut)}</dd>
                              <small className={styles.formula}>
                                {row.guvMaintenanceFullDeduction > 0 && `${formatCurrency(row.guvMaintenanceFullDeduction)} voll abzugsfähig`}
                                {row.guvMaintenanceFullDeduction > 0 && row.guvMaintenanceSpreadDeduction > 0 && "; "}
                                {row.guvMaintenanceSpreadDeduction > 0 && `${formatCurrency(row.guvMaintenanceSpreadDeduction)} verteilt abgezogen (§ 82b EStDV)`}
                              </small>
                            </div>
                          )}
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Jahresüberschuss/-fehlbetrag</dt>
                            <dd className={row.guvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.guvResult)}
                            </dd>
                            <small className={styles.formula}>{formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.guvDepreciation)} (AfA){row.guvMaintenanceFullDeduction > 0 ? ` − ${formatCurrency(row.guvMaintenanceFullDeduction)} (Instandhaltung Sofortabzug)` : ""}{row.guvMaintenanceSpreadDeduction > 0 ? ` − ${formatCurrency(row.guvMaintenanceSpreadDeduction)} (Instandhaltung verteilt)` : ""}</small>
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
                          <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer){setupCostFormulaFragment} — kein Ankauf, ETF-Investition ab Jahr 1</small>
                        ) : (
                          <small className={styles.formula}>{formatCurrency(result.input.initialCapital)} (Stiftungskapital) − {formatCurrency(result.giftTax)} (Schenkungssteuer){setupCostFormulaFragment} + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue)} (Kaufpreis) − {formatCurrency(result.realEstateTax)} (GrESt)</small>
                        )
                      ) : row.propertyBoughtThisYear ? (
                        <small className={styles.formula}>{formatCurrency(row.prevFoundationCash)} (vor Kauf){row.guvMaintenanceEtfSaleNet > 0 ? ` + ${formatCurrency(row.guvMaintenanceEtfSaleNet)} (ETF-Verkauf Instandhaltungsfinanzierung)` : ""}{row.guvMaintenanceCashOut > 0 ? ` − ${formatCurrency(row.guvMaintenanceCashOut)} (Instandhaltung)` : ""} + {formatCurrency(row.etfSaleNetForPurchase)} (ETF-Erlös) + {formatCurrency(result.input.loanAmount)} (Darlehen) − {formatCurrency(result.propertyValue + result.realEstateTax)} (Kaufpreis + GrESt) + {formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen) − {formatCurrency(row.scheduledRepayment + row.extraRepayment)} (Tilgung){row.foundationEtfDeficitSaleNet > 0 ? ` + ${formatCurrency(row.foundationEtfDeficitSaleNet)} (ETF-Teilverkauf bei Liquiditätsbedarf)` : ""} − {formatCurrency(row.foundationEtfInvestment)} (ETF-Investition){row.erbsInstallmentPaid > 0 ? ` − ${formatCurrency(row.erbsInstallmentPaid)} (Erbersatzsteuer-Rate)` : ""}{row.distributionGross > 0 ? ` − ${formatCurrency(row.distributionGross)} (Destinatärszahlung)` : ""}</small>
                      ) : (
                        <small className={styles.formula}>{formatCurrency(row.prevFoundationCash)} (Vorjahr){row.guvMaintenanceEtfSaleNet > 0 ? ` + ${formatCurrency(row.guvMaintenanceEtfSaleNet)} (ETF-Verkauf Instandhaltungsfinanzierung)` : ""} + {formatCurrency(row.guvRent)} (Mieteinnahmen) − {formatCurrency(row.guvAdminCost)} (Verwaltungskosten) − {formatCurrency(row.guvInterest)} (Zinsen){row.guvMaintenanceCashOut > 0 ? ` − ${formatCurrency(row.guvMaintenanceCashOut)} (Instandhaltung)` : ""} [= {formatCurrency(row.foundationCashFlow)} Überschuss] − {formatCurrency(row.scheduledRepayment + row.extraRepayment)} (Tilgung{row.extraRepayment > 0 ? ` inkl. ${formatCurrency(row.extraRepayment)} Sondertilgung` : ""}){row.foundationEtfDeficitSaleNet > 0 ? ` + ${formatCurrency(row.foundationEtfDeficitSaleNet)} (ETF-Teilverkauf bei Liquiditätsbedarf)` : ""} − {formatCurrency(row.foundationEtfInvestment)} (ETF-Investition){row.erbsInstallmentPaid > 0 ? ` − ${formatCurrency(row.erbsInstallmentPaid)} (Erbersatzsteuer-Rate)` : ""}{row.distributionGross > 0 ? ` − ${formatCurrency(row.distributionGross)} (Destinatärszahlung)` : ""}</small>
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
            )})}
          </div>
          <p className={styles.note}>
            Das Nettovermögen der Stiftung nutzt den Immobilienwert aus Gebäude +
            Grundstück. Die AfA wirkt nur auf das steuerliche Ergebnis. Die
            Vermögensposition der Person setzt sich aus Restforderung und bereits
            zugeflossenen, nach Steuern verbleibenden Zahlungen zusammen. Positive
            Liquidität wird jährlich in ETF-Anteile umgeschichtet (Rendite:
            {" "}
            {formatPercent(result.input.etfReturnRate * 100)}). Die Vorabpauschale
            wird jährlich auf den niedrigeren Wert aus Brutto-ETF-Rendite und
            Basisertrag (ETF-Wert × 70 % × Basiszins{" "}
            {formatPercent(result.input.etfBasisInterestRate * 100)}) angesetzt
            und mit getrennten Sätzen besteuert
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
            {formatCurrency(ERBERSATZ_CHILD_ALLOWANCE)}, progressiver Stufentarif
            Steuerklasse {ERBERSATZ_TAX_CLASS} gem. § 19 ErbStG) berechnet und in 30 gleichen
            Jahresraten (§ 24 ErbStG) beglichen; die Verbindlichkeit wird bis zur
            vollständigen Tilgung als Fremdkapital ausgewiesen.
            {result.input.annualDistribution > 0 && (
              <>
                {" "}Destinatärszahlungen (§ 20 Abs. 1 Nr. 9 EStG): jährlich{" "}
                {formatCurrency(result.input.annualDistribution)} Brutto-Ausschüttung an{" "}
                {result.input.destinatarCount} Begünstigte; Steuersatz{" "}
                {formatPercent(result.input.destinatarTaxRate * 100)}, Sparerpauschbetrag je{" "}
                {formatCurrency(result.input.destinatarSaverAllowance)}. Die Ausschüttung
                mindert die Stiftungsliquidität nach KSt; bei Bedarf erfolgt ein anteiliger
                ETF-Verkauf zur Finanzierung.
              </>
            )}
          </p>
        </section>
      </main>
      <footer className={`${styles.stickyFooter} ${styles.noPrint}`}>
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
