using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Services;

public static class ExecutionWorkflow
{
    public static async Task Invalidate(AppDbContext db, Order order, DateTime now, string state, CancellationToken ct)
    {
        foreach (var plan in await db.ExecutionPlans.Where(p => p.OrderId == order.Id && p.State != "superseded").ToListAsync(ct)) plan.State = "superseded";
        foreach (var brief in await db.ExecutionBriefs.Where(b => b.Plan.OrderId == order.Id && b.SupersededAt == null).ToListAsync(ct)) brief.SupersededAt = now;
        order.ExecutionState = state;
    }
}
