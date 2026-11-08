using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Premise> Premises => Set<Premise>();
    public DbSet<EventService> EventServices => Set<EventService>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderService> OrderServices => Set<OrderService>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<OrderChange> OrderChanges => Set<OrderChange>();
    public DbSet<ExecutionPlan> ExecutionPlans => Set<ExecutionPlan>();
    public DbSet<ExecutionTask> ExecutionTasks => Set<ExecutionTask>();
    public DbSet<ExecutionBrief> ExecutionBriefs => Set<ExecutionBrief>();

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
        user.Property(item => item.Phone).HasMaxLength(20);
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

        var order = modelBuilder.Entity<Order>();
        order.ToTable("orders");
        order.HasKey(item => item.Id);
        order.Property(item => item.Status).HasMaxLength(50).IsRequired();
        order.Property(item => item.CancelledByName).HasMaxLength(100);
        order.Property(item => item.CancelledByRole).HasMaxLength(20);
        order.Property(item => item.TotalAmount).HasColumnType("decimal(18,2)").IsRequired();
        order.Property(item => item.RentalRate).HasPrecision(18, 2);
        order.Property(item => item.RentalAmount).HasPrecision(18, 2);
        order.Property(item => item.PaidAmount).HasPrecision(18, 2);
        order.Property(item => item.Revision).HasDefaultValue(1);
        order.Property(item => item.ChangeCutoffHours).HasDefaultValue(168);
        order.Property(item => item.ExecutionState).HasDefaultValue("not-planned");
        order.Property(item => item.RentalDiscount).HasPrecision(18, 2);
        order.Property(item => item.PromotionPercent).HasPrecision(5, 2);
        premise.Property(item => item.PromotionPercent).HasPrecision(5, 2);
        order.HasIndex(item => new { item.PremiseId, item.EventDate, item.EndDate });
        order.HasOne(item => item.Client).WithMany().HasForeignKey(item => item.ClientId).OnDelete(DeleteBehavior.Restrict);
        order.HasOne(item => item.Manager).WithMany().HasForeignKey(item => item.ManagerId).OnDelete(DeleteBehavior.Restrict);
        order.HasOne(item => item.Premise).WithMany().HasForeignKey(item => item.PremiseId).OnDelete(DeleteBehavior.Restrict);
        
        var orderService = modelBuilder.Entity<OrderService>();
        orderService.ToTable("order_services");
        orderService.HasKey(item => item.Id);
        orderService.Property(item => item.UnitPrice).HasPrecision(18, 2);
        orderService.Property(item => item.Amount).HasPrecision(18, 2);
        orderService.HasOne(item => item.EventService).WithMany().HasForeignKey(item => item.EventServiceId).OnDelete(DeleteBehavior.Restrict);
        orderService.HasIndex(item => new { item.OrderId, item.EventServiceId }).IsUnique();

        var invoice = modelBuilder.Entity<Invoice>();
        invoice.ToTable("invoices");
        invoice.HasIndex(i => new { i.OrderId, i.Revision }).IsUnique();
        invoice.HasIndex(i => i.Number).IsUnique();
        invoice.Property(i => i.TotalAmount).HasPrecision(18, 2);
        invoice.Property(i => i.PreviousPaidAmount).HasPrecision(18, 2);
        invoice.Property(i => i.Revision).HasDefaultValue(1);
        invoice.Property(i => i.DocumentType).HasDefaultValue("invoice");
        invoice.Property(i => i.ClientName).HasMaxLength(100);
        invoice.Property(i => i.ClientEmail).HasMaxLength(254);
        invoice.HasOne(i => i.Order).WithMany().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Restrict);
        var payment = modelBuilder.Entity<Payment>();
        payment.ToTable("payments");
        payment.Property(p => p.Amount).HasPrecision(18, 2);
        payment.HasIndex(p => p.InvoiceId).IsUnique();
        payment.HasIndex(p => p.IdempotencyKey).IsUnique();
        payment.HasIndex(p => p.Reference).IsUnique();
        payment.HasOne(p => p.Invoice).WithMany().HasForeignKey(p => p.InvoiceId).OnDelete(DeleteBehavior.Restrict);

        var change = modelBuilder.Entity<OrderChange>();
        change.ToTable("order_changes");
        change.Property(c => c.PriceDelta).HasPrecision(18, 2);
        change.HasOne(c => c.Order).WithMany().HasForeignKey(c => c.OrderId).OnDelete(DeleteBehavior.Restrict);
        change.HasIndex(c => c.OrderId).IsUnique().HasFilter("\"Status\" = 'pending'");
        var plan = modelBuilder.Entity<ExecutionPlan>();
        plan.ToTable("execution_plans");
        plan.HasOne(p => p.Order).WithMany().HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.Restrict);
        plan.HasIndex(p => new { p.OrderId, p.OrderRevision }).IsUnique();
        var task = modelBuilder.Entity<ExecutionTask>();
        task.ToTable("execution_tasks");
        task.HasOne(t => t.Plan).WithMany(p => p.Tasks).HasForeignKey(t => t.PlanId).OnDelete(DeleteBehavior.Cascade);
        task.HasIndex(t => new { t.StaffId, t.StartsAt, t.EndsAt });
        var brief = modelBuilder.Entity<ExecutionBrief>();
        brief.ToTable("execution_briefs");
        brief.HasOne(b => b.Plan).WithMany().HasForeignKey(b => b.PlanId).OnDelete(DeleteBehavior.Restrict);
        brief.HasIndex(b => new { b.PlanId, b.PlanVersion, b.TaskId }).IsUnique();
        brief.HasIndex(b => new { b.StaffId, b.SupersededAt });
    }
}
