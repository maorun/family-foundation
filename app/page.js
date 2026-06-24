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

const ROW_LABELS = {
  year: "Jahr",
  foundationCash: "Stiftung: Liquidität",
  taxableResult: "Stiftung: Steuerliches Ergebnis",
  foundationWealth: "Stiftung: Nettovermögen",
  remainingLoan: "Restdarlehen",
  personNetCashFlow: "Person: Netto-Zufluss",
  personAssetPosition: "Person: Vermögensposition",
};

const GUV_STIFTUNG_LABELS = {
  year: "Jahr",
  rent: "Mieteinnahmen",
  adminCost: "Verwaltungskosten",
  interest: "Darlehenszinsen",
  depreciation: "AfA",
  result: "Jahresüberschuss/-fehlbetrag",
};

const GUV_PERSON_LABELS = {
  year: "Jahr",
  interest: "Zinserträge",
  tax: "Einkommensteuer auf Zinsen",
  result: "Netto-Zinsergebnis",
};

const BILANZ_LABELS = {
  year: "Jahr",
  buildingBookValue: "Immobilie (Buchwert)",
  cash: "Liquidität",
  totalAssets: "Bilanzsumme",
  loan: "Darlehen",
  equity: "Eigenkapital",
};

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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>{ROW_LABELS.year}</th>
                  <th>{ROW_LABELS.foundationCash}</th>
                  <th>{ROW_LABELS.taxableResult}</th>
                  <th>{ROW_LABELS.foundationWealth}</th>
                  <th>{ROW_LABELS.remainingLoan}</th>
                  <th>{ROW_LABELS.personNetCashFlow}</th>
                  <th>{ROW_LABELS.personAssetPosition}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.year}>
                    <td data-label={ROW_LABELS.year}>{row.year}</td>
                    <td data-label={ROW_LABELS.foundationCash}>
                      {formatCurrency(row.foundationCash)}
                    </td>
                    <td data-label={ROW_LABELS.taxableResult}>
                      {formatCurrency(row.taxableResult)}
                    </td>
                    <td data-label={ROW_LABELS.foundationWealth}>
                      {formatCurrency(row.foundationWealth)}
                    </td>
                    <td data-label={ROW_LABELS.remainingLoan}>
                      {formatCurrency(row.remainingLoan)}
                    </td>
                    <td data-label={ROW_LABELS.personNetCashFlow}>
                      {formatCurrency(row.personNetCashFlow)}
                    </td>
                    <td data-label={ROW_LABELS.personAssetPosition}>
                      {formatCurrency(row.personAssetPosition)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Das Nettovermögen der Stiftung nutzt den Immobilienwert aus Gebäude +
            Grundstück. Die AfA wirkt nur auf das steuerliche Ergebnis. Die
            Vermögensposition der Person setzt sich aus Restforderung und bereits
            zugeflossenen, nach Steuern verbleibenden Zahlungen zusammen.
          </p>

          <h3 className={styles.tableSubtitle}>GuV-Rechnung</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th rowSpan={2}>{GUV_STIFTUNG_LABELS.year}</th>
                  <th colSpan={5} className={styles.tableGroupHeader}>Stiftung</th>
                  <th colSpan={3} className={styles.tableGroupHeader}>Darlehens-Person</th>
                </tr>
                <tr>
                  <th>{GUV_STIFTUNG_LABELS.rent}</th>
                  <th>{GUV_STIFTUNG_LABELS.adminCost}</th>
                  <th>{GUV_STIFTUNG_LABELS.interest}</th>
                  <th>{GUV_STIFTUNG_LABELS.depreciation}</th>
                  <th>{GUV_STIFTUNG_LABELS.result}</th>
                  <th>{GUV_PERSON_LABELS.interest}</th>
                  <th>{GUV_PERSON_LABELS.tax}</th>
                  <th>{GUV_PERSON_LABELS.result}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.filter((row) => row.year > 0).map((row) => (
                  <tr key={row.year}>
                    <td data-label={GUV_STIFTUNG_LABELS.year}>{row.year}</td>
                    <td data-label={GUV_STIFTUNG_LABELS.rent}>{formatCurrency(row.guvRent)}</td>
                    <td data-label={GUV_STIFTUNG_LABELS.adminCost}>{formatCurrency(row.guvAdminCost)}</td>
                    <td data-label={GUV_STIFTUNG_LABELS.interest}>{formatCurrency(row.guvInterest)}</td>
                    <td data-label={GUV_STIFTUNG_LABELS.depreciation}>{formatCurrency(row.guvDepreciation)}</td>
                    <td
                      data-label={GUV_STIFTUNG_LABELS.result}
                      className={row.guvResult < 0 ? styles.negative : styles.positive}
                    >
                      {formatCurrency(row.guvResult)}
                    </td>
                    <td data-label={GUV_PERSON_LABELS.interest}>{formatCurrency(row.personGuvInterest)}</td>
                    <td data-label={GUV_PERSON_LABELS.tax}>{formatCurrency(row.personGuvTax)}</td>
                    <td
                      data-label={GUV_PERSON_LABELS.result}
                      className={row.personGuvResult < 0 ? styles.negative : styles.positive}
                    >
                      {formatCurrency(row.personGuvResult)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.hint}>
            Die GuV zeigt das steuerliche Ergebnis der Stiftung (Mieteinnahmen abzüglich
            Verwaltungskosten, Darlehenszinsen und AfA) sowie die Zinserträge der
            Darlehens-Person nach Einkommensteuer. Tilgungszahlungen sind kein GuV-Posten.
          </p>

          <h3 className={styles.tableSubtitle}>Bilanz</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>{BILANZ_LABELS.year}</th>
                  <th>{BILANZ_LABELS.buildingBookValue}</th>
                  <th>{BILANZ_LABELS.cash}</th>
                  <th>{BILANZ_LABELS.totalAssets}</th>
                  <th>{BILANZ_LABELS.loan}</th>
                  <th>{BILANZ_LABELS.equity}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.year}>
                    <td data-label={BILANZ_LABELS.year}>{row.year}</td>
                    <td data-label={BILANZ_LABELS.buildingBookValue}>{formatCurrency(row.buildingBookValue)}</td>
                    <td data-label={BILANZ_LABELS.cash}>{formatCurrency(row.foundationCash)}</td>
                    <td data-label={BILANZ_LABELS.totalAssets}>{formatCurrency(row.totalAssets)}</td>
                    <td data-label={BILANZ_LABELS.loan}>{formatCurrency(row.remainingLoan)}</td>
                    <td
                      data-label={BILANZ_LABELS.equity}
                      className={row.equity < 0 ? styles.negative : styles.positive}
                    >
                      {formatCurrency(row.equity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.hint}>
            Aktiva: Immobilien-Buchwert (Gebäude nach AfA + Grundstück) + Liquidität.
            Passiva: Darlehen + Eigenkapital. Der Buchwert des Grundstücks bleibt konstant;
            das Gebäude wird jährlich um die AfA abgeschrieben.
          </p>
        </section>
      </main>
    </>
  );
}
