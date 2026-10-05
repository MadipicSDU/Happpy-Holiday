# Frontend stress testing — paused handoff

Paused at the user's request on 2026-10-11. This is a progress record, not a claim that exhaustive stress testing is complete. All edits are in the working tree; nothing was committed, pushed, or deployed.

## Environment and data safety

Testing used the isolated `hh_frontend_preview` PostgreSQL database, backend `http://localhost:5295`, and normal frontend `http://127.0.0.1:3001`. The user's existing application database was not used.

A separate frontend on port 3002 and loopback fault proxy on port 5296 injected failures and synthetic large data sets. Synthetic records were generated in responses rather than inserted into PostgreSQL; volume mode blocks catalogue/history mutations. The harness is `tests/frontend-preview-proxy.cjs`, with its mode file `.test-postgres/frontend-stress-mode.json` (ignored). The temporary stress processes are stopped as part of this handoff; the normal preview remains available.

Browser saves temporarily changed the seeded client's name and the seeded venue's capacity/rate/name/address/description, catering rate, and manager quota. These were restored to Sarah Preview, Grand Ballroom Atrium / 123 Main St / 250 guests / KZT 2,450 per hour / original description, Premium Catering Package KZT 150 per unit, and manager quota 12. No stress booking was submitted; maximum booking values were quoted only. Earlier Sprint 2 preview bookings remain.

## Changes made during testing

1. **Long text:** A valid 100-character unbroken name made a 579-pixel page approximately 2,812 pixels wide. Added safe wrapping and flexible-child constraints; verified the same name no longer overflows, including at a 320-pixel viewport.
2. **Login feedback:** Wrong passwords incorrectly showed “session expired.” Unauthenticated 401 responses now explain that the email or password is incorrect; authenticated 401 responses retain session expiry behavior.
3. **Unreadable success responses:** Empty, malformed, null, and primitive JSON success responses now throw actionable API errors rather than reaching the UI as saved/loaded records. Interrupted response-body reads also produce a recovery message.
4. **Stalled requests:** Added a 20-second timeout covering fetch and response-body reading, caller cancellation forwarding, and timer/listener cleanup. Mutation failures advise refreshing before retrying; no automatic mutation retries are added.
5. **Large lists:** Introduced shared pagination: 12 venue/booking cards or 25 table/list rows per page. Applied to catalogue, bookings, order queue, clients, administration, occupancy, and venue analytics. Filters/sorts reset the page, and shrinking results clamp it safely. Searching still covers all loaded records.
6. **Mobile table overflow:** Absolutely positioned accessibility labels escaped scrolling tables and widened a 305-pixel document to 557 pixels. Positioned table containers keep the labels within the scrolling region. Verified document width equals scroll width afterward.
7. **Extreme-price readability:** Maximum monetary amounts squeezed item names into tiny columns on mobile. Mobile breakdowns now stack names and amounts, with responsive total text.
8. **Service selection count:** Added frontend rejection of more than 100 selected services, matching the API contract.
9. **Formatting and aggregation:** Reused Intl formatters and replaced analytics' repeated per-venue filtering with one aggregation pass.

Relevant files: `src/services/api.js`, `src/utils.js`, `src/usePagination.js`, `src/components/UI.jsx`, `src/styles/index.css`, and the seven paginated pages under `src/pages/`. Regression tests are in `tests/frontend.test.js`.

## Verified so far

| Area | Completed evidence |
| --- | --- |
| Profile | Whitespace-only name rejected by API; 100-character Unicode and unbroken ASCII names saved; repeated submit did not duplicate save; HTML-like name rendered as text without executing; original preview name restored |
| Login | Invalid email blocked by native validity; incorrect 128-character password rejected; corrected error verified; successful subsequent sign-in |
| Booking | Capacity 251 rejected for a 250-capacity venue; quantity 0, -1, 1.5, 100001 and 1e20 rejected; 100000 accepted; >365-day period rejected; exact 365-day / 8760-hour quote with 100000 catering units totaled KZT 36,462,000 correctly |
| Failure recovery | Malformed orders response produced visible stale-data banner; cold startup showed retry/sign-in choices; retry recovered; stalled quote visibly timed out and unlocked form without losing details; retry recovered; simulated 503 submission returned to editable details and invalidated quote |
| Keyboard | Shift+Tab from dialog close wrapped to final control; Escape closed idle dialog and restored booking trigger |
| Large catalogue | 1000 venues with 200-character names, 500-character addresses, and 1000-character descriptions; rendering dropped from roughly 34000 nodes / 1000 cards to 537 nodes / 12 cards; next page and search for venue 999 verified |
| Large bookings | 2000 bookings; 12 cards rendered; empty Closed filter works; maximum 100-service / KZT 10,008,760,000,000 detail fixture inspected without page/dialog overflow at 320 pixels |
| Large admin tables | 1000 synthetic venues showed 25 rows; 2000 orders showed 25 rows / approximately 525 nodes; value sort and search for order 1999 verified |
| Admin boundaries | Guest capacity 0, -1, 1.5, 100001 rejected, 100000 accepted; hourly rate -0.01, 0.001, 1000000.01 rejected, 1000000 accepted; maximum name/address/description/capacity/rate saved and restored; service price 1000000 saved/restored; quota 0, 1.5, 1001 rejected, 1000 saved/restored |
| Occupancy | 367-day range rejected; exact 366-day range loaded successfully |
| Responsive layout | Long names and synthetic catalogue/bookings checked at normal preview width and 320 pixels; table page overflow reproduced and verified fixed; internal table scrolling remains intentional |

**Last automated verification:** all 14 frontend tests passed, including 100 selected services, period/number limits, malformed responses, interrupted bodies, timeout/no automatic retries, caller abort, 401/403/429/503 errors, pagination coverage/clamping, and 10000 generated valid plus 10000 invalid quantity checks. A production build passed after pagination/API changes (213.05 kB JS). Subsequent mobile table/price CSS adjustments were browser verified, but the production build was not rerun before the user requested stopping. No backend source changes were made during this stress-test session; the previous 13 backend tests passed in the earlier Sprint 2 work.

Screenshot: [extreme mobile pricing](screenshots/frontend-stress-mobile-pricing.png). It shows synthetic data only.

## Resume checklist

- Rerun `npm test` and `npm run build` after the final CSS adjustments; inspect the working diff.
- Complete large-data client-directory, occupancy, and analytics browser checks; verify pagination there and verify equivalent manager role behavior.
- Complete browser checks for 401 session expiry, 429 throttling, offline recovery, failed cancellation/profile/admin saves, and navigation while requests are pending. Unit tests cover several of these, but browser evidence is incomplete.
- Extend registration boundary coverage and verify maximum email/phone/URL fields, broken venue photos, and clipboard failure recovery.
- Review pagination keyboard usability/position after page changes, and inspect desktop/tablet breakpoints after the shared CSS changes.
- Consider collection/record response-shape validation beyond JSON parseability. The current guard rejects malformed/primitive responses but does not fully validate a structurally wrong JSON object.
- Cross-browser/device testing and sustained concurrent-user performance testing remain separate work. The current volume harness measures rendering behavior, not production server capacity or an exhaustive security/accessibility audit.

To restart the optional harness, start the normal isolated API first, write `{}` or `{"mode":"volume"}` to `.test-postgres/frontend-stress-mode.json`, run `node tests/frontend-preview-proxy.cjs .test-postgres/frontend-stress-mode.json`, and start a second Vite process with `VITE_API_URL=http://127.0.0.1:5296/api` on loopback port 3002. Supported fault modes are `malformed`, `stall`, `offline`, or a numeric `status`, optionally limited by `path`. Do not point the harness at production.
