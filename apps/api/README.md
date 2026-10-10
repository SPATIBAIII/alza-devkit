# ALZA DevKit API

From `apps/api` (Python 3.12+ and uv required):

```powershell
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run tests: `uv run python -m pytest`.
API documentation: http://localhost:8000/docs

Mock Data Factory endpoints:

- `GET /api/v1/data-factory/households?count=100&seed=42`
- `GET /api/v1/data-factory/households/export?count=100&seed=42&format=csv`
- Export formats: `csv`, `json`, `xlsx`; defaults: count 100, seed 42, format csv.
- Count is restricted to 1–1,000 and seed must be non-negative. Invalid queries return HTTP 422.
- JSON exports contain the same metadata envelope and records as the preview API.
- CSV uses UTF-8 with BOM for Excel compatibility. Spreadsheet exports prefix potentially dangerous text with an apostrophe; JSON preserves original text.
- Excel removes XML-incompatible control characters and normalizes line endings.

All records are synthetic and barangays are explicitly fictional. Monthly incomes
range from PHP 3,000 to 80,000. Low (<12,000), Middle (<40,000), and High are
illustrative testing categories, not official classifications. IDs are unique within
each dataset, not across separate generations. The same count and seed reproduce
results with the same installed Faker version; keep `uv.lock` for reproducibility.
Exports are generated in memory without temporary files.

CORS permits only local frontend origins on port 3000. This is a local development
service; no public authentication or hosting is configured.
