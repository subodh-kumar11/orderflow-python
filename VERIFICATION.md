# Verification

## Final GitHub Actions result

**All eight jobs passed** in [CI run #3](https://github.com/subodh-kumar11/orderflow-python/actions/runs/36293800758) on September 27, 2026, for application commit `8c150507725b77ec21d729252f215258d2f02a6e`.

| CI job | Result |
| --- | --- |
| Python 3.11 / SQLite | Passed |
| Python 3.11 / PostgreSQL 16 | Passed |
| Python 3.12 / SQLite | Passed |
| Python 3.12 / PostgreSQL 16 | Passed |
| Python 3.13 / SQLite | Passed |
| Python 3.13 / PostgreSQL 16 | Passed |
| Frontend: lint, types, 13 unit tests, build and 6 Chromium E2E tests | Passed |
| Docker Compose: build, healthy services and HTTP smoke test | Passed |

Each backend job runs ruff lint/format, strict mypy and the 114-test suite with a coverage gate of 85%. The Compose smoke test exercises the actual nginx/API/PostgreSQL stack, including the UI, health endpoint, multi-item creation, listing, status lifecycle, rejected cancellation and successful pending cancellation.

The first runs exposed an empty TEST_DATABASE_URL fallback issue in the test fixture and an nginx health probe using localhost instead of its IPv4 listener. Both were corrected before the passing run. The fixes and AI assistance are documented in AI_USAGE.md. Later verification-document updates do not alter application code.

## Local evidence

Windows, Python 3.12.14 and Node.js 24.19.0:

| Check | Result |
| --- | --- |
| Backend pytest | 114 passed, including a rerun with explicitly empty TEST_DATABASE_URL |
| Backend coverage | 98.10% |
| ruff lint and formatting | Passed |
| strict mypy | Passed, 10 application modules |
| Vitest | 13 passed |
| oxlint and TypeScript | Passed |
| Vite production build | Passed |
| Playwright / installed Chrome | All 6 cases passed; Windows child-server teardown hung afterward |
| scripts/run.py launcher and HTTP smoke through local preview | Passed |
| Dashboard visual inspection | Passed; desktop layout inspected and mobile overflow checked by E2E |

The local Windows teardown limitation was independently resolved as a verification concern by the complete successful Chromium CI job, including normal runner exit. Local Docker access was unavailable; the full Compose stack was built and exercised successfully in GitHub Actions instead.

Backend tests cover the independent transition matrix, money boundaries, validation, retrieval, filtering, pagination, persistence across app restarts, actual scheduled processing, concurrent mutations/creation and mocked provider success/failure paths.

No real Claude/OpenAI provider calls, load tests, security audit or production deployment were performed. Optional provider integration is verified using mock transports. The README and architecture document identify the intended local demonstration scope.
