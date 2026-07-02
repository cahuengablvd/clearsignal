# Golden report fixtures

Place the latest approved AZ Moving report JSON here as:

```text
tests/fixtures/golden-report-az-moving.json
```

Export only the `report` / `generated_report` JSON from Supabase, not the PDF
text. The golden-report test will skip fixture-dependent assertions until this
file exists.
