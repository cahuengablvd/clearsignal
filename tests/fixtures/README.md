# Golden report fixtures

Place the latest approved report JSON files here as:

```text
tests/fixtures/golden-report-az-moving.json
tests/fixtures/golden-report-blvdprod.json
tests/fixtures/golden-report-latvianart.json
tests/fixtures/golden-report-monokelriga.json
```

Export only the `report` / `generated_report` JSON from Supabase, not the PDF
text. The golden-report test automatically skips fixture-dependent assertions
for any optional fixture that is not present yet.

Keep `golden-report-az-moving.json` checked in as the required moving vertical
baseline. Add the other three fixtures after a clean approved run for each site.
