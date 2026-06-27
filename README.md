# family-foundation

Ein offline-fähiger Next.js-PWA-Rechner für eine Familienstiftung mit:

- Startkapital der Stiftung
- Schenkungssteuer auf Basis der gewählten Verwandtschaftsgruppe (inkl. pauschalem Freibetrag)
- jährlichen Verwaltungskosten
- privatem Darlehen mit Zins und Tilgung
- Immobilie mit Gebäude- und Grundstücksanteil
- Mieteinnahmen
- steuerlicher AfA auf den Gebäudeanteil
- Vermögenssicht für Stiftung und darlehensgebende Person

## Nutzung

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

3. `http://localhost:3000` im Browser öffnen
4. Optional als PWA installieren; nach dem ersten Laden bleibt die Anwendung auch offline nutzbar

## Qualitätssicherung

```bash
npm run lint
npm run build
```