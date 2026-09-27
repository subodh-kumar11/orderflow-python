# OrderFlow — Order Processing Assignment

A runnable FastAPI backend and React dashboard for creating, tracking and cancelling orders. This is a separate Python implementation; the earlier .NET project is unchanged.

## Start with Docker (recommended)

Install Docker with Compose, then from this repository:

```sh
docker compose up --build --wait
```

Open **http://localhost:8080** for the dashboard and **http://localhost:8080/docs** for interactive API documentation. PostgreSQL 16, the API and nginx start together. Only the dashboard port is exposed, on the local machine. Data survives `docker compose down` in the named PostgreSQL volume.

Stop with `docker compose down`. The sample database password is for this local demonstration. AI is disabled by default; no API key or cloud service is required.

## Run locally without Docker or PostgreSQL

Requirements: Python **3.11, 3.12 or 3.13**, Node.js **24**, and pnpm **11.19.0** (`npm install --global pnpm@11.19.0`). SQLite is included with Python. Use a standard Python installation with pip and venv.

### Windows PowerShell

Run these from the repository root:

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -c backend/constraints.txt -e './backend[dev]'
Push-Location frontend
pnpm install --frozen-lockfile
pnpm build
Pop-Location
.venv/Scripts/python.exe scripts/run.py
```

Use `py -3.11` or `py -3.13` if that is your installed version. No PowerShell activation-policy change is needed.

### macOS / Linux

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -c backend/constraints.txt -e './backend[dev]'
cd frontend
pnpm install --frozen-lockfile
pnpm build
cd ..
.venv/bin/python scripts/run.py
```

Open **http://127.0.0.1:5173**. API docs are also at **http://127.0.0.1:8000/docs**. Press Ctrl+C to stop both servers. Local data is stored in `backend/orders.db` and retained between restarts.

For frontend hot reload, run the API from `backend` with `../.venv/Scripts/python.exe -m uvicorn app.main:app --reload` (on Unix use `../.venv/bin/python`), and run `pnpm dev` in a second terminal inside `frontend`. Use one API worker because it owns the scheduler.

## What is implemented

| Area | Implementation |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn, Pydantic v2, pydantic-settings |
| Persistence | SQLAlchemy 2.1; PostgreSQL 16 in Compose/CI; SQLite locally |
| Background processing | APScheduler 3.x, every 300 seconds by default |
| Dashboard | React 19, TypeScript, Vite, responsive layout |
| Search | Deterministic parser; optional Claude or OpenAI-compatible provider through httpx2 |
| Quality | pytest/coverage, strict mypy, ruff, Vitest, oxlint, TypeScript, Playwright |
| Delivery | Dockerfiles, Compose, nginx and GitHub Actions |
| Contract | REST, OpenAPI, RFC 9457 problem responses |

Test counts are measured, not targets: **114 backend tests**, **13 frontend tests** and **6 end-to-end browser tests**. See [verification](VERIFICATION.md) for execution evidence and limitations.

## Order lifecycle and API

```text
PENDING -> PROCESSING -> SHIPPED -> DELIVERED
   |
   +-----> CANCELLED
```

Only a PENDING order can first become CANCELLED. Repeating a successful status change or cancellation is harmless; delivered and cancelled orders cannot move to a different state. Skipping or reversing stages returns 409. These transition rules make the otherwise unspecified lifecycle explicit.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/orders` | Create an order with multiple items; returns 201 and Location |
| GET | `/api/orders/{id}` | Retrieve details |
| GET | `/api/orders?status=PENDING&offset=0&limit=20` | List/filter with pagination |
| PATCH | `/api/orders/{id}/status` | Advance status; optional expected_version |
| POST | `/api/orders/{id}/cancel` | Cancel if pending |
| GET | `/api/orders/summary` | Dashboard counts and non-cancelled order value |
| POST | `/api/orders/search` | Search using rules or explicitly enabled AI |
| GET | `/health` | Check API and database connection |
| GET | `/api/config` | Public capability flags, never credentials |

Example request in `/docs` or any HTTP client:

```json
{
  "customer_id": "alice",
  "items": [
    {"product_id": "book", "quantity": 2, "unit_price": "12.50"},
    {"product_id": "pen", "quantity": 3, "unit_price": "0.10"}
  ]
}
```

This creates a PENDING order totaling **25.30 USD**. Money is accepted as a decimal, stored as integer cents and returned as a decimal string. Duplicate product IDs, empty orders, nonpositive values, fractional quantities, excessive limits and extra fields are rejected.

Status request: `{"status":"PROCESSING","expected_version":1}`. A stale version returns 409 instead of overwriting another update. The scheduler processes all pending orders at each interval, not exactly five minutes after each order's creation. Its first run is one interval after startup; pending orders survive downtime and are picked up after restart.

## Search and optional GenAI

Without configuration, try:

- `pending orders for alice over 20`
- `shipped orders under 100`
- `orders since 2026-01-01 before 2026-10-01`
- `all orders`

Amounts are **inclusive bounds** (over 20 means at least 20; under 100 means at most 100). Dates use UTC, with `since` inclusive and `before` exclusive. Customer matching is exact. Unrecognized words are rejected rather than silently returning all orders.

For AI configuration, copy `backend/.env.example` to `backend/.env` for local runs. For Compose put the AI settings in a root `.env` instead. Both are git-ignored.

```dotenv
ORDERFLOW_AI_PROVIDER=openai_compatible
ORDERFLOW_AI_BASE_URL=https://api.openai.com/v1
ORDERFLOW_AI_MODEL=your-compatible-model-id
ORDERFLOW_AI_API_KEY=your-key
```

The OpenAI-compatible adapter requires a model supporting Chat Completions JSON-object mode and temperature=0. For native Claude, set provider `anthropic`, base URL `https://api.anthropic.com/v1`, and a model ID available to your account. Set these only on the backend, never in frontend build variables.

The dashboard displays an opt-in AI checkbox when configured. Rules are always tried first; a provider is called only for an unrecognized query with `use_ai=true`. Only that query and the filter schema are sent, never the order database. Provider output is validated against a strict schema and converted into bound ORM filters; it never executes model-generated SQL. Unknown/empty filters and provider failures return a clear error. Live paid provider calls are not required by the test suite.

## Run the checks

Backend (from `backend`; Windows executable shown):

```powershell
../.venv/Scripts/python.exe -m ruff check .
../.venv/Scripts/python.exe -m ruff format --check .
../.venv/Scripts/python.exe -m mypy app
../.venv/Scripts/python.exe -m pytest --cov=app --cov-report=term-missing
```

Use `../.venv/bin/python` on Unix. Coverage must remain at least 85%.

Frontend (from `frontend`):

```sh
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E starts its own API and built preview server, so ports 8000/5173 must be free. Activate the Python venv first, or set `PYTHON` to its absolute executable path. On Windows: `$env:PYTHON=(Resolve-Path ../.venv/Scripts/python.exe).Path`. A local installed Chrome can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if browser downloads are unavailable. E2E writes an isolated, ignored `frontend/e2e.db`.

CI runs backend checks on Python 3.11/3.12/3.13 against SQLite and PostgreSQL 16, frontend checks and browser tests, and a Compose smoke test. To run backend tests against PostgreSQL yourself, set `TEST_DATABASE_URL` to a **disposable test database**: those fixtures drop its application tables. Never use your development or production database for this variable.

## Design and submission notes

- [Architecture and tradeoffs](docs/ARCHITECTURE.md)
- [Job-description mapping](docs/JD_MAPPING.md)
- [AI assistance, observed issues and corrections](AI_USAGE.md)
- [Verification evidence](VERIFICATION.md)
- [Walkthrough guide](docs/WALKTHROUGH.md)
- [GitHub and future development](GITHUB.md)

This is a local take-home demonstration, not an authenticated commerce platform. It intentionally omits login/ownership authorization, catalog-controlled prices, inventory reservation, payments, shipping integration, audit history and schema migrations. Those are sensible next steps before a public deployment. The customer ID and item prices are supplied by the demo client.
