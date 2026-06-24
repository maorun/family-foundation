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
    id: "giftTaxRate",
    label: "Schenkungssteuer auf Gründungskapital (%)",
    min: 0,
    step: "0.1",
    defaultValue: 0,
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


const currency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const DEFAULT_FORM_VALUES = Object.fromEntries(
  FIELD_DEFINITIONS.map((field) => [field.id, String(field.defaultValue)]),
);

function formatCurrency(value) {
  return currency.format(value);
}

function formatPercent(value) {
  return `${percent.format(value)} %`;
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
      giftTaxRate: parsedValues.giftTaxRate / 100,
      annualAdminCost: parsedValues.annualAdminCost,
      loanAmount: parsedValues.loanAmount,
      loanInterestRate: parsedValues.loanInterestRate / 100,
      loanRepaymentRate: parsedValues.loanRepaymentRate / 100,
      buildingValue: parsedValues.buildingValue,
      landValue: parsedValues.landValue,
      monthlyRent: parsedValues.monthlyRent,
      depreciationRate: parsedValues.depreciationRate / 100,
      personalTaxRate: parsedValues.personalTaxRate / 100,
      projectionYears: parsedValues.projectionYears,
    },
  };
}

function calculateProjection(input) {
  const propertyValue = input.buildingValue + input.landValue;
  const annualRent = input.monthlyRent * 12;
  const giftTax = input.initialCapital * input.giftTaxRate;
  const initialCash =
    input.initialCapital - giftTax + input.loanAmount - propertyValue;

  let foundationCash = initialCash;
  let remainingLoan = input.loanAmount;
  let remainingDepreciableBuildingValue = input.buildingValue;
  let cumulativePersonNetCash = 0;

  const buildingBookValue0 = input.buildingValue + input.landValue;

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
    },
  ];

  for (let year = 1; year <= input.projectionYears; year += 1) {
    const annualInterest = remainingLoan * input.loanInterestRate;
    const scheduledRepayment = Math.min(
      remainingLoan,
      input.loanAmount * input.loanRepaymentRate,
    );
    const annualDepreciation = Math.min(
      remainingDepreciableBuildingValue,
      input.buildingValue * input.depreciationRate,
    );
    const taxableResult =
      annualRent -
      input.annualAdminCost -
      annualInterest -
      annualDepreciation;
    const foundationCashFlow =
      annualRent -
      input.annualAdminCost -
      annualInterest -
      scheduledRepayment;

    // Jährlichen Überschuss als Sondertilgung verwenden
    const extraRepayment = input.surplusToRepayment
      ? Math.min(Math.max(0, foundationCashFlow), remainingLoan - scheduledRepayment)
      : 0;

    const lenderTax = annualInterest * input.personalTaxRate;
    const lenderNetCashFlow =
      scheduledRepayment + extraRepayment + (annualInterest - lenderTax);

    foundationCash += foundationCashFlow - extraRepayment;
    remainingLoan -= scheduledRepayment + extraRepayment;
    remainingDepreciableBuildingValue = Math.max(
      0,
      remainingDepreciableBuildingValue - annualDepreciation,
    );
    cumulativePersonNetCash += lenderNetCashFlow;

    const buildingBookValue = remainingDepreciableBuildingValue + input.landValue;

    rows.push({
      year,
      foundationCash,
      taxableResult,
      foundationWealth: foundationCash + propertyValue - remainingLoan,
      remainingLoan,
      personNetCashFlow: lenderNetCashFlow,
      personAssetPosition: remainingLoan + cumulativePersonNetCash,
      // GuV Stiftung
      guvRent: annualRent,
      guvAdminCost: input.annualAdminCost,
      guvInterest: annualInterest,
      guvDepreciation: annualDepreciation,
      guvResult: taxableResult,
      // GuV Person
      personGuvInterest: annualInterest,
      personGuvTax: lenderTax,
      personGuvResult: annualInterest - lenderTax,
      // Bilanz
      buildingBookValue,
      totalAssets: foundationCash + buildingBookValue,
      equity: foundationCash + buildingBookValue - remainingLoan,
    });
  }

  return {
    input,
    annualRent,
    giftTax,
    propertyValue,
    initialCash,
    annualDepreciationBase: input.buildingValue * input.depreciationRate,
    rows,
  };
}

const DEFAULT_RESULT = calculateProjection({
  ...validateFormValues(DEFAULT_FORM_VALUES).input,
  surplusToRepayment: false,
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
  const [{ formValues, surplusToRepayment, result }, setState] = useState({
    formValues: DEFAULT_FORM_VALUES,
    surplusToRepayment: false,
    result: DEFAULT_RESULT,
  });

  // Load saved values from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const nextFormValues = { ...DEFAULT_FORM_VALUES, ...parsed.formValues };
      const nextSurplusToRepayment = parsed.surplusToRepayment ?? false;
      const nextValidation = validateFormValues(nextFormValues);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        formValues: nextFormValues,
        surplusToRepayment: nextSurplusToRepayment,
        result: nextValidation.input
          ? calculateProjection({ ...nextValidation.input, surplusToRepayment: nextSurplusToRepayment })
          : DEFAULT_RESULT,
      });
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist values to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ formValues, surplusToRepayment }));
    } catch {
      // ignore storage errors
    }
  }, [formValues, surplusToRepayment]);

  const validation = useMemo(() => validateFormValues(formValues), [formValues]);
  const hasInvalidFields = validation.invalidIds.length > 0;

  const firstYear = result.rows[1] ?? result.rows[0];
  const lastYear = result.rows[result.rows.length - 1];

  const cards = [
    {
      title: "Schenkungssteuer bei Gründung",
      value: formatCurrency(result.giftTax),
      detail: formatPercent(result.input.giftTaxRate * 100),
    },
    {
      title: "Kaufpreis Immobilie",
      value: formatCurrency(result.propertyValue),
      detail: `Gebäude ${formatCurrency(result.input.buildingValue)} + Grundstück ${formatCurrency(result.input.landValue)}`,
    },
    {
      title: "Mieteinnahmen p.a.",
      value: formatCurrency(result.annualRent),
      detail: `${formatCurrency(result.input.monthlyRent)} pro Monat`,
    },
    {
      title: "AfA p.a.",
      value: formatCurrency(result.annualDepreciationBase),
      detail: formatPercent(result.input.depreciationRate * 100),
    },
    {
      title: "Stiftung: Startliquidität nach Ankauf",
      value: formatCurrency(result.initialCash),
      detail: "Jahr 0 vor laufender Bewirtschaftung",
    },
    {
      title: "Stiftung: Nettovermögen Jahr 1",
      value: formatCurrency(firstYear.foundationWealth),
      detail: `Liquidität ${formatCurrency(firstYear.foundationCash)}`,
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
  ];

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
          ? calculateProjection({
              ...nextValidation.input,
              surplusToRepayment: currentState.surplusToRepayment,
            })
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
          ? calculateProjection({ ...nextValidation.input, surplusToRepayment: checked })
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
          <p className={styles.hint}>
            Annahme: Die Tilgung erfolgt jährlich als konstanter Prozentsatz vom
            ursprünglichen Darlehensbetrag; die Zinsen fallen auf die jeweilige
            Restschuld an.
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
          <h2>Jahresübersicht</h2>
          <div className={styles.yearList}>
            {result.rows.map((row) => (
              <div key={row.year} className={styles.yearCard}>
                <h3 className={styles.yearCardTitle}>Jahr {row.year}</h3>

                <div className={styles.yearSection}>
                  <h4 className={styles.yearSectionTitle}>Übersicht</h4>
                  <dl className={styles.dataGrid}>
                    <div className={styles.dataItem}>
                      <dt>Stiftung: Liquidität</dt>
                      <dd>{formatCurrency(row.foundationCash)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Stiftung: Steuerliches Ergebnis</dt>
                      <dd>{formatCurrency(row.taxableResult)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Stiftung: Nettovermögen</dt>
                      <dd>{formatCurrency(row.foundationWealth)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Restdarlehen</dt>
                      <dd>{formatCurrency(row.remainingLoan)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Person: Netto-Zufluss</dt>
                      <dd>{formatCurrency(row.personNetCashFlow)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Person: Vermögensposition</dt>
                      <dd>{formatCurrency(row.personAssetPosition)}</dd>
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
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Verwaltungskosten</dt>
                            <dd>{formatCurrency(row.guvAdminCost)}</dd>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Darlehenszinsen</dt>
                            <dd>{formatCurrency(row.guvInterest)}</dd>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>AfA</dt>
                            <dd>{formatCurrency(row.guvDepreciation)}</dd>
                          </div>
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Jahresüberschuss/-fehlbetrag</dt>
                            <dd className={row.guvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.guvResult)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className={styles.guvColumn}>
                        <h5 className={styles.guvColumnTitle}>Darlehens-Person</h5>
                        <dl className={styles.dataGrid}>
                          <div className={styles.dataItem}>
                            <dt>Zinserträge</dt>
                            <dd>{formatCurrency(row.personGuvInterest)}</dd>
                          </div>
                          <div className={styles.dataItem}>
                            <dt>Einkommensteuer auf Zinsen</dt>
                            <dd>{formatCurrency(row.personGuvTax)}</dd>
                          </div>
                          <div className={`${styles.dataItem} ${styles.dataItemResult}`}>
                            <dt>Netto-Zinsergebnis</dt>
                            <dd className={row.personGuvResult < 0 ? styles.negative : styles.positive}>
                              {formatCurrency(row.personGuvResult)}
                            </dd>
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
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Liquidität</dt>
                      <dd>{formatCurrency(row.foundationCash)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Bilanzsumme</dt>
                      <dd>{formatCurrency(row.totalAssets)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Darlehen</dt>
                      <dd>{formatCurrency(row.remainingLoan)}</dd>
                    </div>
                    <div className={styles.dataItem}>
                      <dt>Eigenkapital</dt>
                      <dd className={row.equity < 0 ? styles.negative : styles.positive}>
                        {formatCurrency(row.equity)}
                      </dd>
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
            zugeflossenen, nach Steuern verbleibenden Zahlungen zusammen.
          </p>
        </section>
      </main>
    </>
  );
}
