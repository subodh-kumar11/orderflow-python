# Verification

Local checks on Windows, Python 3.12.14 and Node.js 24.19.0:

| Check | Result |
| --- | --- |
| Backend pytest | 114 passed |
| Backend coverage | 98.10%; required minimum 85% |
| ruff lint and formatting | Passed |
| strict mypy | Passed, 10 application modules |
| Vitest | 13 passed |
| oxlint and TypeScript | Passed |
| Vite production build | Passed |
| Playwright / installed Chrome | All 6 browser cases passed; Windows child-server teardown hung afterward |

The browser cases exercise multi-item creation and the full lifecycle, cancellation, status filtering, rule-based search without a key, server validation preserving form input, and mobile layout/API docs.

Backend tests cover the independent transition matrix, money boundaries, validation, retrieval, filtering, pagination, persistence across app restarts, actual scheduled processing, concurrent mutations/creation and mocked provider success/failure paths.

Local Docker execution was unavailable because the desktop environment could not access the Docker daemon. GitHub Actions is configured to independently test Python 3.11/3.12/3.13 on SQLite/PostgreSQL 16, frontend checks and Chromium, and the complete Docker Compose stack. Consult the actual Actions result for remote validation; configuration alone is not a passing result.

No real provider API calls, load tests, security audit or production deployment were performed. The README and architecture document identify the intended local demonstration scope.
