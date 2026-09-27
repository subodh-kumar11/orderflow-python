# Suggested interview walkthrough

1. Start the application and open /docs. Create an order containing a book at 12.50 x 2 and pens at 0.10 x 3; explain why the total is exactly 25.30.
2. Fetch its ID and list PENDING orders. Show the dashboard's details panel and optional status filters.
3. Cancel one pending order; repeat the request and explain harmless retries. Create a second order and move it through PROCESSING, SHIPPED and DELIVERED. Show a rejected reversal/cancellation.
4. Explain the scheduler's 300-second default and restart behavior. For a short demo set ORDERFLOW_PROCESSING_INTERVAL_SECONDS=10 before starting the backend; this changes only the local demonstration interval.
5. Explain the conditional SQL update and version field. Show how a stale version returns 409, including when the scheduler wins a race.
6. Search for pending orders for a customer without an API key. Explain the limited grammar and inclusive amount bounds. Walk through the optional AI adapter and its mocked tests without requiring a paid key.
7. Show the tests and CI results. Explain the independent transition matrix, real scheduler test and SQLite/PostgreSQL coverage.
8. Be candid about AI assistance: read AI_USAGE.md, reproduce the commands, and explain each module in your own words. Do not describe AI-generated work as entirely handwritten or claim live-provider validation.
9. Discuss next steps: authentication and ownership, catalog pricing, migration tooling, a dedicated worker, creation idempotency, audit history and production monitoring.

The application factory, dependency injection, SQLAlchemy unit of work, explicit state machine and provider adapters are practical design patterns here. Explain the problem each solves; avoid adding layers simply to name more patterns.
