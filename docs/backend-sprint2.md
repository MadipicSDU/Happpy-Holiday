# Backend Sprint 2 implementation and review

Source: [revised Sprint Plan in Google Drive](https://docs.google.com/document/d/1IoAJ1WBlfbxq47H66oPKdnwQpbUmW7Eh/edit), read on 2026-10-11. The summary says seven Sprint 2 stories, but its detailed Sprint 2 table contains nine stories totaling 24 points. This implementation follows the detailed table and the plan's manager-quota requirement.

## Implemented backend scope

| Story | API / behavior |
| --- | --- |
| 3.1 Profile management | `GET /api/users/me`, `PUT /api/users/me`; validated name/email/phone, normalized unique email, phone in responses |
| 4.1 Premise and rental dates | Exact start/end timestamps, address from the selected premise, capacity and future-period validation |
| 4.2 Three-premise limit | At most three concurrent active reservations per client across separate orders; partial overlaps count, adjacent periods do not |
| 7.2 Service selection | Food/equipment catalogue selection, explicit quantities, missing/duplicate/invalid service rejection |
| 4.3 Submission and assignment | Creates a `pending` order and assigns an eligible manager atomically; collision-resistant order IDs |
| 5.1 Occupancy | `GET /api/premises/occupancy?from=...&to=...` for managers/admins; occupied intervals and availability for every premise |
| 5.2 Conflict prevention | Half-open periods `[start,end)`; a shared PostgreSQL transaction advisory lock serializes booking/status/quota mutations across API instances |
| 8.1 Pricing | Premise-specific hourly rate multiplied by exact duration, plus service unit price multiplied by requested quantity |
| 8.2 Itemized breakdown | `POST /api/orders/quote`; rental line, service lines, rates, quantities, line totals, total, KZT currency; persisted snapshots in order responses |

Manager limits default to **10 distinct clients with active orders**, configurable per manager through admin staff creation (`clientLimit`) or `PUT /api/users/{id}`. Additional bookings for an existing active client reuse their manager without consuming another client slot. Otherwise the least-loaded eligible manager is chosen, with deterministic tie-breaking. Cancellation/completion releases the client's slot when no active orders remain. No eligible manager returns `409`, without persisting a booking. Limits cannot be reduced below the current load.

One submission reserves one premise, matching the existing client. Multiple premises are separate orders; the concurrency limit applies across them. Service prices are per selected unit, charged once per order. The API does not assume catering quantities equal guest count: callers specify servings/equipment units using `services[].quantity`. Monetary values use decimal arithmetic and round each rental line to two places, midpoint away from zero. Venue location is represented by its catalogue address and venue-specific rate.

## Request examples

Authenticate with `POST /api/auth/login` and send `Authorization: Bearer <accessToken>` for protected calls.

Quote and create use the same body:

```json
{
  "premiseId": "<premise-guid>",
  "startsAt": "2026-12-01T14:00:00+05:00",
  "endsAt": "2026-12-01T18:30:00+05:00",
  "guests": 80,
  "services": [{ "serviceId": "<service-guid>", "quantity": 80 }]
}
```

JSON timestamps require ISO 8601 with seconds and an explicit UTC offset or `Z`; stored timestamps are UTC. Durations must be positive and no more than 365 days. Creation returns `201` with a Location header. A quote checks current availability but does not reserve it; creation repeats validation under the booking lock. Validation returns `400`, unknown premises return `404`, and booking/quota conflicts return `409`.

Compatibility: `eventDate` plus integer `durationHours` (default four) and `serviceIds` (quantity one) remain accepted. Use either explicit timestamps or the legacy pair, and either `services` or `serviceIds`. Existing display fields (`venue`, `eventDate`, `amount`, `guests`, `statusLabel`) remain alongside machine-readable `startsAt`, `endsAt`, `totalAmount`, `managerId`, and `pricing`.

`PUT /api/users/me` accepts `displayName`, `email`, and optional `phone`. This is a full contact update: omitting phone clears it. Only clients can use this update. Staff account changes are admin operations.

Clients see their own orders. Managers see orders and clients assigned to them. Admins see all orders. Order detail responses contain explicit DTOs rather than tracked entities; password hashes and account normalization fields are excluded. Occupancy includes booking IDs/periods/status, without client contact details.

## Bugs corrected during review

| Finding | Correction |
| --- | --- |
| Any authenticated user could retrieve another client's order, including the client's password hash; raw graphs could also cause serialization cycles | Scoped reads and explicit response DTOs |
| Malformed client subject could fall through to an unrestricted order list | Subject/account/role validation on every JWT request plus explicit role authorization |
| Concurrent overlapping reservations and manager assignment races | Transaction-level PostgreSQL advisory lock; validation and commit inside one transaction |
| Duration was discarded; invalid/negative durations and excessive guest counts accepted | Stored end timestamp, UTC normalization, bounded period and capacity checks |
| Missing service IDs silently ignored, no quantities, and unknown pricing history | Strict selection validation, quantities, quotes, persisted rate/name/address/amount snapshots |
| Four-digit random order IDs collided | GUID-based IDs |
| Orders were immediately awaiting payment without manager assignment | Pending status and quota-aware manager assignment |
| Arbitrary statuses and terminal-order resurrection | Whitelisted status transitions and scoped mutations; future orders cannot be completed |
| Catalogue/client deletion cascaded into booking history; managers could delete staff | Restricted foreign keys, conflict responses, admin-only destructive account/catalogue operations |
| Arbitrary staff roles, duplicate-email update failures, role changes on historical users, deleting/demoting the last admin | Role validation, normalization/unique conflicts, history and last-admin guards; changed roles invalidate existing JWTs |
| Profile contacts could not be updated; phone was hardcoded in manager worklist | Profile endpoint and real phone fields |
| `EnsureCreated` skipped schema upgrades; Phone and ImageUrl were absent from migrations | `MigrateAsync`, a new migration, checked legacy baseline procedure |
| Production always received known demo accounts and sample orders | Demo seeder is Development-only and can be disabled with `SeedDemoData=false` |
| Login and registration had no attempt limit | Per-IP fixed-window limit of 30 requests/minute, returning `429` |
| Private EF design dependencies hid a runtime/test EF version mismatch | Explicit EF Core Relational runtime reference, aligned to 10.0.11 |
| Booking UI discarded chosen start time, rounded fractional hours upward, and treated error responses as successful bookings/status changes | Sends exact local start/end as UTC, preserves fractional duration, checks HTTP errors, and awaits status updates |
| Tracked database credentials, malformed Docker ignore file, database startup race | Environment-supplied credentials, valid ignore patterns, database healthcheck dependency |

The review covered backend controllers, contracts, models, EF configuration/migrations, authentication, repositories, seeders, configuration and Docker startup, plus the client code that submits bookings. It is a bounded review, not a guarantee that no defects remain.

## Database rollout

No existing application database was modified during development or testing.

For a fresh database or one already managed by EF migrations, configure `ConnectionStrings__DefaultConnection` and start the API; it applies migrations before seeders run. `Jwt__Key` must have at least 32 characters outside Development. Production seed settings are empty by default. Catalogue/sample account seeding occurs only in Development.

For an existing database previously created by `EnsureCreated`:

1. Back up the intended database and stop old API instances. Old versions do not participate in the booking lock.
2. Inspect its schema. Startup deliberately stops if existing tables have no migration history.
3. Run `docs/baseline-legacy-database.sql` explicitly against that database using `psql -v ON_ERROR_STOP=1 -f ...`. It checks the expected legacy table/column types and constraint names, rejects mismatched schemas or already-applied migrations, and records the first three migrations in a transaction. It does not drop or recreate business tables. Inspect the script against your database before running it.
4. Start the new API to apply `Sprint2Ordering`.
5. Reconcile all orders with `pricing.legacyEstimate = true`. The old schema never stored duration or service price snapshots. The migration retains each original total, assumes the old four-hour duration, snapshots current catalogue names/service prices, and derives the rental remainder. These estimates cannot recover lost historical facts. Existing unassigned orders stay unassigned and are visible to admins; they need operator reconciliation before managers can process them.

Review estimated legacy periods for overlaps and incorrect rates before relying on occupancy. No destructive cleanup or automatic historical manager reassignment is performed. Booking integrity is enforced for writes through the new API; direct SQL writes and older API versions bypass its advisory-lock protocol. At this project's workload a shared lock is simple and adequate; larger workloads may require more granular database locking.

Docker Compose is a local development setup. Set `POSTGRES_PASSWORD`, `JWT_KEY`, and `PGADMIN_PASSWORD` before `docker compose up --build`. An existing volume keeps its original PostgreSQL password: supplying a different variable does not rotate that database password. Local `dotnet run --project HappyHoliday` requires a configured connection string, for example through environment variables or user secrets. The local Docker database is mapped to port 5433.

Invoices, real payment processing, alternatives, finalized schedules, paid cancellation penalties, deadline changes, and automated completion belong to later sprints. The existing manager status endpoint retains guarded unpaid-to-confirmed transitions for manual workflows; it does not prove payment. Clients can cancel pending/unpaid orders; paid cancellation and change requests are not implemented by Sprint 2.

## Verification

`HappyHoliday.Tests` contains real HTTP integration tests against Kestrel and PostgreSQL, migration tests, and booking-boundary tests. The suite creates only random `hh_test_<guid>` databases and cleans them up. The connection must point to an isolated PostgreSQL server with database creation privileges:

```powershell
$env:HAPPYHOLIDAY_TEST_POSTGRES = 'Host=127.0.0.1;Port=15439;Database=postgres;Username=postgres'
dotnet test HappyHoliday.slnx
npm run build
```

Without the test connection, database tests are reported inconclusive. Tests cover simultaneous hall booking, adjacent periods, the three-premise cap, manager-quota races/reuse/reduction, cancellation release, invalid requests, price snapshots and rounding, privacy/access controls, stale JWT roles, contact changes, timezone conversion, legacy payloads, Swagger, deletion guards, legacy baselining, and preservation of migrated totals. Development verification used an isolated PostgreSQL 18 cluster; Docker's PostgreSQL 15 engine was not running and was not tested.

Verified on 2026-10-11: all **13 tests passed**, backend/test projects built without warnings or errors, and the Vite production build passed.
