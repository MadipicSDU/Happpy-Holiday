using HappyHoliday.Authentication;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Services;

public sealed class DbSeeder(
    IServiceScopeFactory scopeFactory,
    IPasswordHasher<AppUser> passwordHasher) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // ── Premises ────────────────────────────────────────────────
        if (!await db.Premises.AnyAsync(cancellationToken))
        {
            var premises = DemoVenues.Create();
            db.Premises.AddRange(premises);
            await db.SaveChangesAsync(cancellationToken);
        }

        // ── Event Services ──────────────────────────────────────────
        if (!await db.EventServices.AnyAsync(cancellationToken))
        {
            db.EventServices.AddRange(
                new EventService { Name = "Premium Catering Package",   Category = "FoodPreparation",  Description = "3-course meal with champagne reception",     Price = 150 },
                new EventService { Name = "Standard Buffet",            Category = "FoodPreparation",  Description = "Buffet-style catering for up to 200 guests", Price = 80  },
                new EventService { Name = "Standard A/V Equipment",     Category = "EquipmentRental",  Description = "Projector, screen, and 2 wireless mics",     Price = 300 },
                new EventService { Name = "Stage & Lighting Rig",       Category = "EquipmentRental",  Description = "One stage lighting package per event.",      Price = 550 },
                new EventService { Name = "Floral Table Centrepiece", Category = "Decoration", Description = "One floral arrangement for one table.", Price = 120 },
                new EventService { Name = "DJ Performance", Category = "Entertainment", Description = "One hour of DJ performance. Enter the number of hours required.", Price = 400 },
                new EventService { Name = "Event Photography", Category = "Photography", Description = "One hour of photography coverage and edited digital images.", Price = 350 },
                new EventService { Name = "Event Coordinator", Category = "EventPlanning", Description = "One coordinator for one hour of on-site event support.", Price = 200 },
                new EventService { Name = "Guest Welcome Host", Category = "Staffing", Description = "One host for one hour of guest check-in and welcome support.", Price = 100 },
                new EventService { Name = "Guest Shuttle Transfer", Category = "Transport", Description = "One shuttle trip for up to 12 guests. Coordinate route and timing with your manager.", Price = 300 },
                new EventService { Name = "Event Security Officer", Category = "Security", Description = "One security officer for one hour of event coverage.", Price = 150 },
                new EventService { Name = "Post-event Cleanup", Category = "Cleaning", Description = "One standard venue cleanup package per event.", Price = 250 },
                new EventService { Name = "Children's Animator", Category = "Animators", Description = "One hour of supervised event games and entertainment.", Price = 250 },
                new EventService { Name = "Event Host", Category = "Hosts", Description = "One hour of event hosting and announcements.", Price = 300 },
                new EventService { Name = "Live Musician", Category = "Musicians", Description = "One hour of live musical performance.", Price = 450 },
                new EventService { Name = "Dance Performance", Category = "Dancers", Description = "One choreographed performance package.", Price = 500 },
                new EventService { Name = "Banquet Chair", Category = "Furniture", Description = "One chair for the full rental period.", Price = 30, ConcurrentCapacity = 250 }
            );
            await db.SaveChangesAsync(cancellationToken);
        }

        if (!await db.Users.AnyAsync(u => u.Role == UserRoles.Staff, cancellationToken))
        {
            foreach (var (name, email) in new[] { ("Demo Event Host", "staff.host@happyholiday.local"), ("Demo AV Technician", "staff.av@happyholiday.local"), ("Demo Performer", "staff.performer@happyholiday.local") })
            {
                var staff = new AppUser { DisplayName = name, Email = email, NormalizedEmail = PostgresUserRepository.NormalizeEmail(email), Role = UserRoles.Staff, PasswordHash = "" };
                staff.PasswordHash = passwordHasher.HashPassword(staff, "Staff123!"); db.Users.Add(staff);
            }
            await db.SaveChangesAsync(cancellationToken);
        }
        // ── Seed client accounts + sample orders ────────────────────
        if (!await db.Users.AnyAsync(u => u.Role == UserRoles.Client, cancellationToken))
        {
            var premises = await db.Premises.ToListAsync(cancellationToken);

            AppUser MakeClient(string displayName, string email, string password)
            {
                var u = new AppUser
                {
                    DisplayName = displayName,
                    Email = email,
                    NormalizedEmail = PostgresUserRepository.NormalizeEmail(email),
                    PasswordHash = string.Empty,
                    Role = UserRoles.Client
                };
                u.PasswordHash = passwordHasher.HashPassword(u, password);
                return u;
            }

            var clients = new[]
            {
                MakeClient("Sarah Jenkins",   "sarah.j@outlook.com",         "Password1!"),
                MakeClient("Michael Chang",   "m.chang@corporatecorp.com",   "Password1!"),
                MakeClient("Emily Rose",      "emily.rose@agency.co",        "Password1!"),
                MakeClient("David Miller",    "david@millerholding.com",     "Password1!"),
                MakeClient("Sophia Loren",    "sophia@classiccinema.it",     "Password1!"),
                MakeClient("James Thompson",  "j.thompson@builders.io",      "Password1!"),
            };
            db.Users.AddRange(clients);
            await db.SaveChangesAsync(cancellationToken);

            // Sample orders
            var statuses = new[] { "awaiting-payment", "confirmed", "change-requested", "completed" };
            var random   = new Random(42);
            var orders   = new List<Order>();
            for (int i = 0; i < clients.Length; i++)
            {
                var premise = premises[i % premises.Count];
                var start = DateTime.UtcNow.AddDays(random.Next(10, 90));
                var hours = random.Next(3, 8);
                orders.Add(new Order
                {
                    ClientId       = clients[i].Id,
                    PremiseId      = premise.Id,
                    EventDate      = start,
                    EndDate        = start.AddHours(hours),
                    PremiseName    = premise.Name,
                    PremiseAddress = premise.Address,
                    RentalRate     = premise.PricePerHour,
                    RentalAmount   = premise.PricePerHour * hours,
                    ExpectedGuests = random.Next(Math.Min(50, premise.Capacity), premise.Capacity + 1),
                    Status         = statuses[i % statuses.Length],
                    TotalAmount    = premise.PricePerHour * hours,
                    ManagerId      = await db.Users.Where(u => u.Role == UserRoles.Manager).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(cancellationToken)
                });
            }
            db.Orders.AddRange(orders);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
