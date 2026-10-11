<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:09090b,50:18181b,100:27272a&height=190&section=header&text=ALZA%20DEVKIT&fontSize=49&fontColor=ffffff&fontAlignY=38&desc=Build%20%2F%20Test%20%2F%20Ship&descAlignY=61&descSize=16" width="100%" alt="ALZA DevKit banner" />

### A private developer operations workspace.

**Generate test data. Validate workflows. Build with confidence.**

[![Next.js](https://img.shields.io/badge/Next.js-16-111111?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-111111?style=flat-square&logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-111111?style=flat-square&logo=fastapi&logoColor=009688)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-111111?style=flat-square&logo=tailwindcss&logoColor=06B6D4)](https://tailwindcss.com/)

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Roadmap](#roadmap)

</div>

---

## Overview

**ALZA DevKit** is an internal developer toolkit for building, testing, and maintaining software projects from a single workspace. It brings repeatable development utilities into a clean web interface backed by a modular Python API.

> **V0.3.0 — Database Schema Importer:** release verification complete on 2026-10-11; ready for release, not published by this verification. Includes the Household Generator and Custom Dataset Builder. API Testing Lab and operational modules remain planned.

## Features

<table>
<tr><td width="50%" valign="top">

### 01 / Mock Data Factory
**Available**

- Synthetic household records with Filipino-style Faker names
- Configurable row count (1–1,000)
- Reproducible results with a random seed
- Paginated dataset preview
- CSV, JSON, and Excel exports
- Input validation and spreadsheet-formula protection

</td><td width="50%" valign="top">

### 02 / Custom Dataset Builder
**Available**

- Configurable fields, typed constraints and computed fields
- Seeded generation and CSV / JSON / Excel downloads
- SQLite-backed saved templates and JSON import/export
- Built-in Student Enrollment preset

</td></tr>
<tr><td width="50%" valign="top">

### 03 / Database Schema Importer
**Available in V0.3.0**

- Paste or upload PostgreSQL DDL and inspect tables, keys and relationships
- Review field mappings, select tables and configure row counts
- Generate parent-first records with composite foreign-key integrity
- Download JSON, CSV ZIP with manifest, or multi-sheet Excel
- Save, rename, import and export durable schema configurations

</td><td width="50%" valign="top">

### 04 / Developer Operations
**Planned**

- Database inspection
- Code quality auditing
- Deployment health monitoring
- Engineering reports

</td></tr>
</table>

## Architecture

```mermaid
flowchart LR
    U["Developer"] --> W["Next.js Dashboard"]
    W --> A["FastAPI /api/v1"]
    A --> P["Bounded PostgreSQL DDL Parser"]
    P --> G["Synthetic Data Engine"]
    A --> G
    G --> F["Faker + Seeded RNG"]
    A --> S["SQLite Configurations / Templates"]
    A --> E["Export Services"]
    E --> O["CSV / CSV ZIP / JSON / XLSX"]
    classDef surface fill:#18181b,stroke:#52525b,color:#fafafa
    class U,W,A,P,G,F,S,E,O surface
```

```text
alza-devkit/
├── apps/
│   ├── web/          # Next.js, TypeScript, Tailwind, shadcn/ui
│   └── api/          # FastAPI, Faker, OpenPyXL, Pytest
├── docs/             # Engineering and setup guides
├── scripts/          # Verification utilities
├── infra/            # Infrastructure workspace
└── storage/          # Local workspace data
```

## Quick Start

**Requirements:** Node.js and npm, Python 3.12+, and [uv](https://docs.astral.sh/uv/).

```powershell
git clone https://github.com/SPATIBAIII/alza-devkit.git
cd alza-devkit
```

**Terminal 1 — API**

```powershell
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Web**

```powershell
cd apps/web
npm ci
npm run dev
```

| Service | Local address |
| :-- | :-- |
| Dashboard | http://localhost:3000 |
| API | http://127.0.0.1:8000 |
| Swagger UI | http://127.0.0.1:8000/docs |
| Health check | http://127.0.0.1:8000/api/v1/health |

If needed, copy `apps/web/.env.example` to `apps/web/.env.local` and configure `NEXT_PUBLIC_API_BASE_URL`. Restart the web server after changing it.

## Using Mock Data Factory

1. Open **Mock Data Factory** in the dashboard sidebar.
2. Select **Household Dataset**.
3. Enter the number of records and an optional seed.
4. Click **Generate Dataset**.
5. Preview records and download **CSV**, **JSON**, or **Excel**.

The generator creates **synthetic records only**. Income categories are illustrative, not official classifications. No real citizen data is required.

### API example

```http
GET /api/v1/data-factory/households?count=5&seed=42
```

Export the same configuration:

```http
GET /api/v1/data-factory/households/export?count=5&seed=42&format=xlsx
```

Supported export formats: `csv`, `json`, `xlsx`.

## Using the Database Schema Importer

1. Open **Database Schema Importer** in the sidebar.
2. Paste PostgreSQL DDL, upload a `.sql` file, or choose **Example Schema**, then **Parse Schema**.
3. Inspect types, keys, defaults, enum domains and parent relationships.
4. Configure field mappings, table selection, row counts and seed; **Validate Schema**.
5. **Save Configuration**, then generate and download **JSON**, **CSV ZIP**, or **Excel**.
6. Use **Saved schemas** to reopen, rename, export, import or delete configurations.

SQL is parsed as text and never executed; no PostgreSQL server or credentials are needed.
Supported imports are limited to documented `CREATE TABLE`, `CREATE TYPE AS ENUM`, and
`ALTER TABLE ADD` constraints. Generation supports up to 20 tables, 50 columns per table,
1,000 rows per table and 5,000 rows total. Cycles, self-references and overlapping foreign
keys are rejected. Defaults are retained for inspection, not evaluated.

Saved configurations and custom templates use SQLite at
`apps/api/app/data/templates.sqlite3` by default. Set `DATA_FACTORY_DB` to an absolute,
durable path before starting the API to override it; keep that path across restarts.
See the [Database Schema Importer guide](docs/database-schema-importer.md) for the
supported SQL subset, architecture, API, constraints, security protections and limitations.

## Quality Checks

```powershell
# Backend
cd apps/api
uv run python -m pytest

# Frontend (in another terminal)
cd apps/web
npx tsc --noEmit
npm run lint
npm run build
```

For real browser acceptance, start the production web server (`npm run start` after
building), leave API port 8000 free, then run from `apps/api`:

```powershell
uv run --with playwright python ../../scripts/check-schema-importer.py
```

The script requires Microsoft Edge, starts its own isolated API/SQLite store, verifies
actual downloads, stops and restarts the backend to check persistence, and runs the
Household Generator and Custom Dataset Builder browser regression suites. It prints
the location of traces, screenshots, downloads and process-restart evidence.

Verified on **2026-10-11**: **217 backend tests passed** (one Starlette/httpx
deprecation warning), TypeScript/ESLint/production build passed, and **14 real
Edge browser acceptance groups passed**, including both existing generator suites.
An actual API restart preserved a saved schema and reproduced all 90 generated
records. Desktop and 320px/390px mobile viewports were tested; native mobile and
other browser engines were not. These are recorded local results, not live CI.

## Roadmap

- [x] Next.js dashboard and navigation
- [x] FastAPI backend and health endpoint
- [x] Mock Data Factory — household preset
- [x] Dataset preview and CSV / JSON / XLSX exports
- [x] Custom Dataset Builder and saved templates
- [x] Database Schema Importer
- [ ] API Testing Lab
- [ ] Code Auditor
- [ ] Deployment Monitor

## Documentation

- [Mock Data Factory — implementation and verification](docs/mock-data-factory.md)
- [Custom Dataset Builder](docs/custom-dataset-builder.md)
- [Database Schema Importer — V0.3.0 guide and verification](docs/database-schema-importer.md)
- [FastAPI application guide](apps/api/README.md)

## Security

ALZA DevKit is designed as a **private internal development tool**, not a publicly exposed service. Do not commit secrets, environment files, real personal data, or generated datasets containing sensitive information. Add authentication, authorization, and deployment hardening before exposing it beyond a trusted local environment.

## License

No license has been specified for this repository. All rights are reserved unless a license is added.

---

<div align="center">

<sub>ENGINEERED FOR BETTER DEVELOPMENT WORKFLOWS</sub>

**ALZA DEVKIT** · Internal developer tooling

</div>
