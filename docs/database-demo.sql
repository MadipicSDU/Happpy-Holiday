-- Read-only demonstration queries for hh_frontend_preview.
-- Open in pgAdmin Query Tool and select/run one query at a time (F5).
BEGIN TRANSACTION READ ONLY;
SET LOCAL TIME ZONE 'Asia/Qyzylorda';

-- 1. Overview: persisted catalogue and booking counts.
SELECT 'Venues' AS dataset, count(*) AS records FROM premises
UNION ALL SELECT 'Services', count(*) FROM event_services
UNION ALL SELECT 'Bookings', count(*) FROM orders
UNION ALL SELECT 'Booked service lines', count(*) FROM order_services;

-- 2. Venue catalogue: capacity and hourly rate.
SELECT "Name", "Address", "Capacity", "PricePerHour"
FROM premises ORDER BY "Name";

-- 3. Service types and prices.
SELECT "Category", "Name", "Description", "Price"
FROM event_services ORDER BY "Category", "Name";

-- 4. Bookings linked to clients and managers. Stored venue details are snapshots.
SELECT o."Id" AS booking_reference, c."DisplayName" AS client,
       m."DisplayName" AS manager, o."PremiseName" AS booked_venue,
       o."EventDate" AT TIME ZONE 'UTC' AS starts_at_utc,
       o."EndDate" AT TIME ZONE 'UTC' AS ends_at_utc,
       o."EventDate" AT TIME ZONE 'Asia/Qyzylorda' AS local_start,
       o."ExpectedGuests" AS guests, o."Status", o."TotalAmount"
FROM orders o
JOIN users c ON c."Id" = o."ClientId"
LEFT JOIN users m ON m."Id" = o."ManagerId"
ORDER BY o."EventDate" DESC;

-- 5. Service quantities, stored rates, and stored line totals per booking.
SELECT o."Id" AS booking_reference, o."PremiseName", s."Name" AS booked_service,
       s."Category", s."Quantity", s."UnitPrice", s."Amount"
FROM orders o JOIN order_services s ON s."OrderId" = o."Id"
ORDER BY o."EventDate" DESC, s."Name";

-- 6. Reconcile stored rental and service totals; differences should be zero.
SELECT o."Id", o."RentalAmount", COALESCE(SUM(s."Amount"), 0) AS services_amount,
       o."RentalDiscount", o."TotalAmount", o."TotalAmount" - o."RentalAmount" + o."RentalDiscount" - COALESCE(SUM(s."Amount"), 0) AS difference,
       o."LegacyEstimate" AS historical_details_estimated
FROM orders o LEFT JOIN order_services s ON s."OrderId" = o."Id"
GROUP BY o."Id", o."RentalAmount", o."TotalAmount", o."LegacyEstimate"
ORDER BY o."Id";

-- 7. Account roles and manager client limits; excludes passwords and contact details.
SELECT "DisplayName", "Role", CASE WHEN "Role" = 'manager' THEN "ClientLimit" END AS active_client_limit
FROM users ORDER BY "Role", "DisplayName";
ROLLBACK;
