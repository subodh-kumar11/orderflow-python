# AI assistance and corrections

This project was developed with ChatGPT/Codex assistance, as encouraged by the assignment. Assistance covered stack selection, API and database design, backend/frontend implementation, tests, Docker/CI configuration, debugging, documentation and GitHub publication. Cursor was not used in this session. The candidate should review and understand the code before submitting or presenting it.

## Observed issues and how they were corrected

| Issue observed during development | Correction and verification |
| --- | --- |
| SQLAlchemy model forward references failed during initial import | Enabled postponed annotations; backend then imported and its test suite ran |
| A status-matrix test initially depended on the implementation's transition constant | Replaced its oracle with an independent literal set of allowed transitions, so a regression in the service cannot silently change test expectations |
| The status-filter browser test did not allow the space before the displayed count | Updated the accessible-name matcher; the filtering assertion and all six browser cases passed |
| UI conflict/error handling could clear the reported error while refreshing details | Separated the refresh from the error-clearing open action; frontend type checks and build passed |
| Vite's default config bundler hit Windows sandbox ancestor-directory permissions | Used native config loading with Node 24; production build and tests passed, and browser tests use the built preview |
| Browser download attempts timed out in the local environment | Executed browser cases with the installed Chrome executable; CI installs its own Chromium |
| The local Windows browser runner hung while cleaning up child servers | All six case results were recorded; Linux CI is used for a complete independent run and teardown |
| Initial assumption that httpx2 was a typo was incorrect | Checked current Starlette documentation; used the actual httpx2 package for FastAPI TestClient compatibility and the optional AI adapters |
| A deprecated frontend test-library patch appeared during dependency installation | Pinned the supported jest-dom 6.9.1 release and refreshed the lockfile |

## Design risks addressed while implementing

These are design decisions, not claims that a failure happened in production:

- Use integer cents for exact money instead of floating-point arithmetic.
- Enforce lifecycle transitions on the server and use conditional SQL updates to prevent cancellation/processing races.
- Preserve data across restarts in a transactional database.
- Reject unknown search text and invalid AI output instead of silently widening queries.
- Keep optional provider calls separate from core order operations; use mock transports for repeatable tests.
- Reject extra request fields and bound item counts, quantities, prices and pagination.
- Keep secrets and local data out of Git; include repeatable setup and CI commands.

## Honest validation boundary

No paid Claude/OpenAI request was made. Provider tests validate adapter behavior with mocked responses; real model availability, quality, latency and cost depend on the configured account/model. Local execution used Python 3.12; the CI matrix is responsible for 3.11/3.13 and PostgreSQL checks. See VERIFICATION.md and the actual GitHub Actions run for results, rather than treating the presence of a workflow file as proof that it passed.

## References consulted

- SQLAlchemy release information: https://www.sqlalchemy.org/download.html
- FastAPI lifespan: https://fastapi.tiangolo.com/advanced/events/
- APScheduler 3.x: https://apscheduler.readthedocs.io/en/3.x/userguide.html
- Starlette TestClient: https://starlette.dev/testclient/
- OpenAI structured output / JSON mode: https://developers.openai.com/api/docs/guides/structured-outputs

The implementation uses a compatible JSON-object response mode plus local schema validation; it does not claim provider-enforced strict structured output for every model.
