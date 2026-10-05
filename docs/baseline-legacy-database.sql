-- Only for a backed-up Sprint2Schema database created with EnsureCreated,
-- which has no applied EF migrations. Run against the intended database explicitly.
BEGIN;
DO $baseline$
DECLARE applied integer;
BEGIN
    IF to_regclass('public."__EFMigrationsHistory"') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public."__EFMigrationsHistory"' INTO applied;
        IF applied <> 0 THEN RAISE EXCEPTION 'Database already has migration history; do not baseline it'; END IF;
    END IF;
    IF EXISTS (
        WITH expected(table_name, column_name, udt_name) AS (VALUES
            ('users','Id','uuid'), ('users','DisplayName','varchar'), ('users','Email','varchar'),
            ('users','NormalizedEmail','varchar'), ('users','PasswordHash','text'), ('users','Role','varchar'),
            ('users','CreatedAt','timestamptz'),
            ('premises','Id','uuid'), ('premises','Name','varchar'), ('premises','Description','varchar'),
            ('premises','Address','varchar'), ('premises','Capacity','int4'), ('premises','PricePerHour','numeric'),
            ('premises','CreatedAt','timestamptz'),
            ('event_services','Id','uuid'), ('event_services','Name','varchar'), ('event_services','Description','varchar'),
            ('event_services','Category','varchar'), ('event_services','Price','numeric'), ('event_services','CreatedAt','timestamptz'),
            ('orders','Id','text'), ('orders','ClientId','uuid'), ('orders','PremiseId','uuid'), ('orders','ManagerId','uuid'),
            ('orders','EventDate','timestamptz'), ('orders','ExpectedGuests','int4'), ('orders','Status','varchar'), ('orders','TotalAmount','numeric'),
            ('order_services','Id','text'), ('order_services','OrderId','text'), ('order_services','EventServiceId','uuid'),
            ('order_services','Quantity','int4')
        ), actual AS (
            SELECT table_name, column_name, udt_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name IN ('users','premises','event_services','orders','order_services')
              AND NOT (table_name = 'users' AND column_name = 'Phone' AND udt_name = 'varchar' AND character_maximum_length = 20)
              AND NOT (table_name = 'premises' AND column_name = 'ImageUrl' AND udt_name = 'varchar' AND character_maximum_length = 2000)
        )
        SELECT 1 FROM expected e FULL JOIN actual a USING(table_name,column_name)
        WHERE e.udt_name IS DISTINCT FROM a.udt_name
    ) THEN RAISE EXCEPTION 'Legacy schema does not match Sprint2Schema. Stop and inspect it; no changes applied'; END IF;
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('PK_users'), ('PK_premises'), ('PK_event_services'), ('PK_orders'), ('PK_order_services'),
            ('FK_orders_users_ClientId'), ('FK_orders_users_ManagerId'), ('FK_orders_premises_PremiseId'),
            ('FK_order_services_orders_OrderId'), ('FK_order_services_event_services_EventServiceId')
        ) AS expected(name)
        WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
                          WHERE n.nspname = 'public' AND c.conname = expected.name)
    ) THEN RAISE EXCEPTION 'Expected legacy constraints are missing. Stop and inspect the schema'; END IF;
END
$baseline$;
CREATE TABLE IF NOT EXISTS public."__EFMigrationsHistory" (
    "MigrationId" varchar(150) NOT NULL PRIMARY KEY,
    "ProductVersion" varchar(32) NOT NULL
);
INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES
    ('20260922085809_InitialAuthSchema', '10.0.11'),
    ('20260927160818_Sprint1Schema', '10.0.11'),
    ('20260929074012_Sprint2Schema', '10.0.11');
COMMIT;
