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
            var premises = new List<Premise>
            {
                new() { Name = "Grand Ballroom Atrium",      Address = "123 Main St",       Description = "Opulent chandelier hall with double-height ceiling and bespoke banquet tables.",                    Capacity = 250, PricePerHour = 2400 },
                new() { Name = "The Crystal Greenhouse",     Address = "456 Garden Blvd",   Description = "Lush enclosed garden under vintage iron glass arches with warm string lighting.",                  Capacity = 160, PricePerHour = 1800 },
                new() { Name = "The Warehouse Atrium",       Address = "789 Industry Way",  Description = "Polished concrete floors, exposed brick accents and flexible modular stage architecture.",         Capacity = 220, PricePerHour = 1500 },
                new() { Name = "Whispering Pines Lodge",     Address = "101 Mountain Rd",   Description = "Warm timber interiors with grand stone fireplace and panoramic mountain views.",                   Capacity = 120, PricePerHour = 1950 },
                new() { Name = "Horizon Skyline Terrace",    Address = "202 Rooftop Ave",   Description = "High-altitude open sky lounge with illuminated city skyline backdrop and modern cocktail bar.",    Capacity = 150, PricePerHour = 2200 },
                new() { Name = "Metropolitan Symphony Hall", Address = "303 Arts St",       Description = "Historic auditorium crafted with pristine acoustics and concert-grade AV system.",                 Capacity = 350, PricePerHour = 3200 },
            };
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
                new EventService { Name = "Stage & Lighting Rig",       Category = "EquipmentRental",  Description = "Full LED stage lighting + follow spot",      Price = 550 },
                new EventService { Name = "Floral Arrangement Package",  Category = "Decoration",       Description = "Centrepieces and entrance floral arch",      Price = 400 }
            );
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
                orders.Add(new Order
                {
                    ClientId       = clients[i].Id,
                    PremiseId      = premise.Id,
                    EventDate      = DateTime.UtcNow.AddDays(random.Next(10, 90)),
                    ExpectedGuests = random.Next(50, premise.Capacity),
                    Status         = statuses[i % statuses.Length],
                    TotalAmount    = premise.PricePerHour * random.Next(3, 8)
                });
            }
            db.Orders.AddRange(orders);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
