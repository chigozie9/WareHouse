# Warehouse Inventory Manager

[![Tests](https://github.com/chigozie9/WareHouse/actions/workflows/tests.yml/badge.svg)](https://github.com/chigozie9/WareHouse/actions/workflows/tests.yml)

A full-stack inventory app for managing warehouses, stock and transfers between
warehouses, with a dashboard showing how full each warehouse is, plus an automated **API + UI test suite** that runs in CI on every push.

| Part | Stack |
|---|---|
| `warehouse-manager/` | Java 17, Spring Boot 3, Spring Data JPA, PostgreSQL |
| `warehouse-frontend/` | React 19, React Router, Vite: Dashboard, Warehouses, Inventory and Transfers pages behind a nav bar |
| `warehouse-tests/` | Python, **pytest**, **requests**, **Playwright**, pytest-html |
| `.github/workflows/` | GitHub Actions with a PostgreSQL service container |

## Business rules under test

- A warehouse has a `maxCapacity`; `currentCapacity` is the total quantity of everything stored in it.
- Adding, updating, deleting or transferring items must keep `currentCapacity` accurate and never exceed `maxCapacity`.
- Adding an item with a SKU that already exists in the warehouse merges the quantities.
- Transfers move stock by SKU, merge into an existing item at the destination, and remove the source item when it reaches 0.
- A warehouse that still holds items can't be deleted.
- Errors come back as `{"error": "..."}` with a 4xx status, never a stack trace.

## Test strategy

**API tests (`tests/api`, ~40 cases)** cover the core logic, because that's where the rules live:

- **Happy paths** for every endpoint (create / read / update / delete / transfer)
- **Capacity accounting** after every kind of change, checked by reading the warehouse back from the API rather than trusting the response
- **Boundary values**: filling a warehouse to exactly `maxCapacity`, quantity `0` vs `-5`, shrinking capacity just below current stock
- **Negative paths**: unknown IDs, wrong warehouse for an item, transfer to the same warehouse, not enough stock or space
- **No partial updates**: after a rejected request, the data is checked to be unchanged
- **Error contract**: bad input should get a clear 4xx, and errors must not leak internals

**UI tests (`tests/ui`, ~18 Playwright cases)** cover what a user does in the browser: nav bar routing and active-tab state, dashboard capacity bars, creating/editing/deleting warehouses, adding and editing inventory, running a transfer end to end, required-field validation, and error banners. Backend failures are simulated with `page.route()` so error states can be tested without breaking real data.

**Design choices**

- Each test creates its own uniquely named data through fixtures and cleans it up, so tests are independent and can run in any order against a shared database.
- Bugs were written as tests of the *correct* behavior and marked `xfail` with `xfail_strict = true`, so the suite stayed green while documenting them, and the moment a bug was fixed the run failed as a reminder to remove the marker. Tests for fixed bugs keep the `bug` marker (`pytest -m bug`) as regression tests.
- CI runs the backend against a **real PostgreSQL** container. Locally, a `local` Spring profile swaps in an in-memory H2 database, so nothing has to be installed.

## Bugs found by the suite (all fixed)

The suite was first written against the original backend, where these tests
were marked `xfail`. After the fixes, `xfail_strict` flagged every one of them
as unexpectedly passing, and they now run as regular regression tests.

| ID | Bug | Before | Fix |
|---|---|---|---|
| BUG-1 | Bean-validation failures (missing name, negative capacity/quantity, transfer quantity 0, missing SKU) | **500** "Unexpected server error" | 400 listing each bad field, e.g. `maxCapacity: must be greater than or equal to 0` |
| BUG-2 | Creating or renaming a warehouse to a name that already exists | **500**, and the UI showed "Unexpected server error" | 409 `A warehouse named "X" already exists.`, plus a 409 safety net for DB constraint violations |
| BUG-3 | Malformed JSON or wrong types in the body | **500** | 400 `Request body is missing or is not valid JSON.` |
| BUG-4 | Updating an item's SKU to one already used in the same warehouse | **Allowed**, leaving duplicate SKUs; later transfers of that SKU crashed with 500 | 409, and nothing is changed |
| BUG-5 | `GET /warehouses/{id}/items` for a warehouse that doesn't exist | 200 `[]` | 404 |
| BUG-6 | Updating an item's `expirationDate` | **Silently ignored** | Saved |

Root cause for BUG-1 to BUG-3: `GlobalExceptionHandler` had no handlers for
`MethodArgumentNotValidException`, `HttpMessageNotReadableException` or
`DataIntegrityViolationException`, so they all fell through to the generic 500
handler. Each fix is commented with its bug ID in the code.

## Running it locally

Needs Java 17+, Maven, Node 18+ and Python 3.10+. No database install is needed.

```bash
# 1. Backend on :8080 with an in-memory database
cd warehouse-manager
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 2. Frontend on :5173 (new terminal)
cd warehouse-frontend
npm install
npm run dev

# 3. Tests (new terminal)
cd warehouse-tests
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium

pytest                       # everything
pytest -m api                # API tests only (frontend not needed)
pytest -m ui --headed        # watch the browser tests run
pytest --html=report/index.html --self-contained-html   # HTML report
```

To run against PostgreSQL instead, create a `warehouse_db` database (user `postgres` / password `password`) and start the backend without the `local` profile.
