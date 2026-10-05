using HappyHoliday.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Npgsql;

namespace HappyHoliday.Tests;

[TestClass]
public sealed class MigrationTests
{
    [TestMethod]
    public async Task UpgradePreservesLegacyTotalsAndSupportsEnsureCreatedBaseline()
    {
        var connection = Environment.GetEnvironmentVariable("HAPPYHOLIDAY_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connection)) Assert.Inconclusive("Set HAPPYHOLIDAY_TEST_POSTGRES for migration tests.");
        var name = "hh_test_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(connection);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", admin)) await create.ExecuteNonQueryAsync();
        try
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(new NpgsqlConnectionStringBuilder(connection) { Database = name }.ConnectionString).Options;
            await using var db = new AppDbContext(options);
            await db.GetService<IMigrator>().MigrateAsync("20260929074012_Sprint2Schema");
            // Reproduce the old EnsureCreated schema, including its two unmigrated fields.
            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE users ADD COLUMN "Phone" varchar(20);
                ALTER TABLE premises ADD COLUMN "ImageUrl" varchar(2000);
                DROP TABLE "__EFMigrationsHistory";
                INSERT INTO users ("Id","DisplayName","Email","NormalizedEmail","PasswordHash","Role","CreatedAt","Phone")
                    VALUES ('00000000-0000-0000-0000-000000000001','Legacy','legacy@test.local','LEGACY@TEST.LOCAL','hash','client',now(),'+77001234567');
                INSERT INTO premises ("Id","Name","Address","Capacity","PricePerHour","CreatedAt")
                    VALUES ('00000000-0000-0000-0000-000000000002','Legacy hall','Legacy street',100,100,now());
                INSERT INTO orders ("Id","ClientId","PremiseId","EventDate","ExpectedGuests","Status","TotalAmount")
                    VALUES ('ORD-1234','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',now()+interval '1 month',50,'confirmed',456.78);
                """);
            var root = new DirectoryInfo(AppContext.BaseDirectory);
            while (root is not null && !File.Exists(Path.Combine(root.FullName, "HappyHoliday.slnx"))) root = root.Parent;
            Assert.IsNotNull(root);
            var baseline = await File.ReadAllTextAsync(Path.Combine(root.FullName, "docs", "baseline-legacy-database.sql"));
            await db.Database.ExecuteSqlRawAsync(baseline);
            await db.Database.MigrateAsync();
            var order = await db.Orders.SingleAsync();
            Assert.AreEqual(456.78m, order.TotalAmount);
            Assert.AreEqual(456.78m, order.RentalAmount);
            Assert.AreEqual(TimeSpan.FromHours(4), order.EndDate - order.EventDate);
            Assert.IsTrue(order.LegacyEstimate);
            Assert.AreEqual("Legacy hall", order.PremiseName);
            Assert.AreEqual("+77001234567", (await db.Users.SingleAsync()).Phone);
            Assert.AreEqual(10, (await db.Users.SingleAsync()).ClientLimit);
            Assert.AreEqual(4, (await db.Database.GetAppliedMigrationsAsync()).Count());
            Assert.IsFalse(db.Database.HasPendingModelChanges());
            // Baseline is intentionally not idempotent after migrations have been recorded.
            await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(baseline));
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
