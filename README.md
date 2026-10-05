# Familienstiftung-Rechner

Ein deutschsprachiger Rechner zur modellhaften Vermögens- und Ergebnisplanung für eine Familienstiftung und die darlehensgebende Person. Die Anwendung ist eine Next.js-PWA; Berechnungen und gespeicherte Eingaben bleiben im Browser.

## Funktionen

- Schenkungsteuer zur Gründung anhand des Begünstigtenkreises, mit Freibeträgen sowie Stufentarif und Härtefallregelung nach §§ 15 und 19 ErbStG
- Stiftungskapital, einmalige Gründungskosten, laufende Verwaltungskosten und Inflationsannahme
- Privates Darlehen mit Zins, Tilgung oder optional endfälliger Rückzahlung
- ETF-Anlage und modellierte Besteuerung von Stiftung und privater Vergleichsperson
- Optional: Immobilie mit getrennten Gebäude- und Grundstückswerten, Grunderwerbsteuer nach Bundesland, Mieteinnahmen, AfA und Instandhaltung
- Optional: Ausschüttungen an Destinatäre und ein KfW-Darlehen im Vergleichsszenario zur Selbstnutzung
- Vergleich von Stiftung und privaten Szenarien (ETF-Anlage, Vermietung oder Selbstnutzung), Vermögensverlauf, Jahresübersicht und Sensitivitätsanalyse
- Szenarien speichern und Vermögensverlauf als CSV exportieren

Die Eingaben umfassen unter anderem Renditen, Steuersätze, Betrachtungszeitraum, persönliche Besteuerung von Darlehenszinsen und den Umgang mit Überschüssen. Optionale Bereiche lassen sich in der Eingabemaske aktivieren.

## Voraussetzungen

- Node.js (LTS empfohlen)
- npm

## Lokal starten

```bash
npm ci
npm run dev
```

Anschließend [http://localhost:3000](http://localhost:3000) öffnen. Im Entwicklungsmodus ist die Offline-Funktion der PWA deaktiviert.

Für einen Produktivbuild und den PWA-Betrieb:

```bash
npm run build
npm run start
```

Die Anwendung zunächst online aufrufen, damit der Service Worker und die benötigten Ressourcen geladen werden. Danach kann sie – abhängig von Browser und Installationsumgebung – als PWA installiert und offline verwendet werden.

## Daten und Datenschutz

Eingaben und gespeicherte Szenarien werden automatisch im lokalen Speicher des Browsers abgelegt. Es gibt keine Konten- oder Synchronisierungsfunktion; Daten werden nicht zwischen Geräten übertragen. Das Löschen der Browserdaten kann gespeicherte Eingaben und Szenarien entfernen.

## Qualitätssicherung

```bash
npm run lint
npm run test
npm run build
```

## Hinweis zu den Berechnungen

Die Ergebnisse sind unverbindliche Modellrechnungen und keine Steuer-, Rechts- oder Anlageberatung. Sie hängen von den gewählten Eingaben und den im Rechner abgebildeten Annahmen ab; individuelle Sachverhalte und Änderungen der Rechtslage können zu anderen Ergebnissen führen. Vor Entscheidungen sollten die Annahmen und Ergebnisse mit qualifizierten Fachleuten geprüft werden.
