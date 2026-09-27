# Job-description mapping

The supplied JD lists Python, Java, Node.js, Go/Golang, R, C++, C#, Ruby, Generative AI and AI Tools as mandatory skills; React and Angular are desirable. The assignment permits any backend language and asks for five order operations plus automatic processing every five minutes. It encourages AI assistance and an explanation of issues and corrections. It does not require every listed language in one application.

| Relevant skill | Evidence in this project |
| --- | --- |
| Python | Typed FastAPI backend, validation, ORM services, scheduled job and tests |
| Node.js | Frontend build/test runtime |
| React | TypeScript dashboard for the complete order workflow |
| Generative AI | Optional structured search translation with Claude/OpenAI-compatible adapters; deterministic fallback |
| AI tools | AI-assisted design, implementation, debugging and documentation, recorded in AI_USAGE.md |
| Maintainability and review | Small backend modules, explicit state machine, strict checks, CI, behavioral tests and tradeoff documentation |
| Polyglot engineering | Python service and TypeScript client integrated through an OpenAPI contract |

Java, C#, Go, Ruby and C++ remain alternative implementation languages. R is not needed for this transactional workload. Angular is an alternative to React. Using all of them would add complexity without improving the requested features.

SQLAlchemy, FastAPI, PostgreSQL, Docker, GitHub Actions and the named test tools are implementation choices supporting the task; this document does not claim the JD specifically mandates them.

| Assignment requirement | Implementation | Evidence |
| --- | --- | --- |
| Multi-item creation | POST /api/orders | Validation, exact totals, atomic persistence and concurrent creates |
| Details by ID | GET /api/orders/{id} | Retrieval and missing-ID tests |
| Status updates | PATCH /api/orders/{id}/status | Full transition matrix and stale-version tests |
| Pending to processing every 5 minutes | APScheduler interval job | Real scheduler lifecycle test at a shortened interval |
| Listing and optional status filter | GET /api/orders | Pagination, filters, ordering and invalid-query tests |
| Pending-only cancellation | POST /api/orders/{id}/cancel | Terminal-state, retry and concurrent-change tests |
| AI use explanation | AI_USAGE.md | Actual assistance, observed failures and fixes |
| Git repository submission | Separate orderflow-python repository | Source, run instructions and CI |
