using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Premise> Premises => Set<Premise>();
    public DbSet<EventService> EventServices => Set<EventService>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<AppUser>();

        user.ToTable("users");
        user.HasKey(item => item.Id);
        user.Property(item => item.DisplayName).HasMaxLength(100).IsRequired();
        user.Property(item => item.Email).HasMaxLength(254).IsRequired();
        user.Property(item => item.NormalizedEmail).HasMaxLength(254).IsRequired();
        user.Property(item => item.PasswordHash).IsRequired();
        user.Property(item => item.Role).HasMaxLength(20).IsRequired();
        user.Property(item => item.CreatedAt).IsRequired();
        user.HasIndex(item => item.NormalizedEmail).IsUnique();

        var premise = modelBuilder.Entity<Premise>();
        premise.ToTable("premises");
        premise.HasKey(item => item.Id);
        premise.Property(item => item.Name).HasMaxLength(200).IsRequired();
        premise.Property(item => item.Description).HasMaxLength(1000);
        premise.Property(item => item.Address).HasMaxLength(500).IsRequired();
        premise.Property(item => item.Capacity).IsRequired();
        premise.Property(item => item.PricePerHour).HasColumnType("decimal(18,2)").IsRequired();
        premise.Property(item => item.CreatedAt).IsRequired();

        var service = modelBuilder.Entity<EventService>();
        service.ToTable("event_services");
        service.HasKey(item => item.Id);
        service.Property(item => item.Name).HasMaxLength(200).IsRequired();
        service.Property(item => item.Description).HasMaxLength(1000);
        service.Property(item => item.Category).HasMaxLength(100).IsRequired();
        service.Property(item => item.Price).HasColumnType("decimal(18,2)").IsRequired();
        service.Property(item => item.CreatedAt).IsRequired();
    }
}
