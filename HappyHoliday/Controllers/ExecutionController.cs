using System.Text.Json;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/orders/{orderId}/execution"), Authorize(Roles = "manager,admin")]
public sealed class ExecutionController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    private async Task<object> View(ExecutionPlan plan, CancellationToken ct) => new { plan.Id, plan.OrderId, plan.OrderRevision,
        plan.Version, plan.State, plan.Notes, plan.UpdatedAt, plan.FinalizedAt, plan.DispatchedAt,
        tasks = plan.Tasks.OrderBy(t => t.StartsAt).Select(t => new { t.Id, t.ServiceId, t.ServiceName, t.Activity, t.StaffId, t.StaffName, t.StartsAt, t.EndsAt, t.Instructions }),
        briefs = await db.ExecutionBriefs.Where(b => b.PlanId == plan.Id && b.PlanVersion == plan.Version)
            .Select(b => new { b.Id, b.TaskId, b.StaffId, b.Status, b.SentAt, b.UpdatedAt, b.SupersededAt }).ToListAsync(ct) };
    private async Task Validate(Order order, List<ExecutionTaskDto> tasks, Guid? planId, bool finalize, CancellationToken ct)
    {
        OrderAccess.RequirePaid(order);
        if (order.EndDate <= clock.GetUtcNow().UtcDateTime) throw new BookingException(409, "The rental has ended; its execution plan cannot be changed.");
        if (tasks.Count > 100 || (finalize && tasks.Count == 0)) throw new BookingException(400, "Add between one and 100 execution activities before finalizing.");
        foreach (var task in tasks)
        {
            if (string.IsNullOrWhiteSpace(task.Activity) || task.Activity.Trim().Length < 2 || task.Activity.Length > 200
                || task.StartsAt.UtcDateTime < order.EventDate || task.EndsAt.UtcDateTime > order.EndDate || task.EndsAt <= task.StartsAt)
                throw new BookingException(400, "Each activity needs a name and a valid period inside the venue rental.");
            if (task.ServiceId.HasValue && !order.OrderServices.Any(s => s.EventServiceId == task.ServiceId))
                throw new BookingException(400, "Execution activities can reference only services in this booking.");
            if (task.StaffId.HasValue && !await db.Users.AnyAsync(u => u.Id == task.StaffId && u.Role == "staff", ct))
                throw new BookingException(400, "Assign activities to an existing service staff / performer account.");
            if (finalize && !task.StaffId.HasValue) throw new BookingException(400, "Assign a staff member to every activity before finalizing.");
        }
        if (!finalize) return;
        if (order.OrderServices.Any(service => !tasks.Any(t => t.ServiceId == service.EventServiceId)))
            throw new BookingException(400, "Include every booked service in the execution schedule.");
        var staffIds = tasks.Where(t => t.StaffId.HasValue).Select(t => t.StaffId!.Value).Distinct().ToList();
        var reserved = await db.ExecutionTasks.Where(t => t.PlanId != planId && staffIds.Contains(t.StaffId!.Value)
            && (t.Plan.State == "finalized" || t.Plan.State == "dispatched") && t.Plan.Order.Status == "confirmed"
            && t.Plan.OrderRevision == t.Plan.Order.Revision && t.StartsAt < order.EndDate && t.EndsAt > order.EventDate).ToListAsync(ct);
        foreach (var task in tasks)
        {
            if (reserved.Any(r => r.StaffId == task.StaffId && BookingRules.Overlaps(task.StartsAt.UtcDateTime, task.EndsAt.UtcDateTime, r.StartsAt, r.EndsAt))
                || tasks.Any(other => !ReferenceEquals(task, other) && other.StaffId == task.StaffId
                    && BookingRules.Overlaps(task.StartsAt.UtcDateTime, task.EndsAt.UtcDateTime, other.StartsAt.UtcDateTime, other.EndsAt.UtcDateTime)))
                throw new BookingException(409, "A staff member has overlapping execution activities. Choose another person or time.");
        }
    }
    private static List<ExecutionTaskDto> Details(ExecutionPlan plan) => plan.Tasks.Select(t => new ExecutionTaskDto {
        ServiceId = t.ServiceId, StaffId = t.StaffId, Activity = t.Activity, Instructions = t.Instructions,
        StartsAt = new DateTimeOffset(t.StartsAt), EndsAt = new DateTimeOffset(t.EndsAt) }).ToList();
    [HttpGet]
    public async Task<IActionResult> Get(string orderId, CancellationToken ct)
    {
        var order = await OrderAccess.Visible(db, User).AsNoTracking().SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        var plan = await db.ExecutionPlans.AsNoTracking().Include(p => p.Tasks).SingleOrDefaultAsync(p => p.OrderId == orderId && p.OrderRevision == order.Revision, ct);
        return plan is null ? NotFound() : Ok(await View(plan, ct));
    }
    [HttpPut]
    public async Task<IActionResult> Save(string orderId, SaveExecutionDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        if (dto.Tasks is null) return BadRequest();
        var plan = await db.ExecutionPlans.Include(p => p.Tasks).SingleOrDefaultAsync(p => p.OrderId == orderId && p.OrderRevision == order.Revision, ct);
        if ((plan is not null && dto.ExpectedVersion != plan.Version) || (plan is null && dto.ExpectedVersion.HasValue))
            throw new BookingException(409, "This plan changed. Refresh before saving another draft.");
        if (plan is not null && await db.ExecutionBriefs.AnyAsync(b => b.PlanId == plan.Id && b.SupersededAt == null && (b.Status == "in-progress" || b.Status == "completed"), ct))
            throw new BookingException(409, "Execution has started. Its published plan cannot be rewritten.");
        await Validate(order, dto.Tasks, plan?.Id, false, ct);
        var now = BookingRules.UtcNow(clock);
        if (plan is null) { plan = new ExecutionPlan { OrderId = orderId, OrderRevision = order.Revision }; db.ExecutionPlans.Add(plan); }
        else
        {
            foreach (var brief in await db.ExecutionBriefs.Where(b => b.PlanId == plan.Id && b.SupersededAt == null).ToListAsync(ct)) brief.SupersededAt = now;
            db.ExecutionTasks.RemoveRange(plan.Tasks); plan.Tasks.Clear(); plan.Version++;
        }
        plan.State = "draft"; plan.Notes = dto.Notes?.Trim() ?? ""; plan.UpdatedAt = now; plan.FinalizedAt = null; plan.DispatchedAt = null;
        foreach (var task in dto.Tasks)
        {
            var entity = new ExecutionTask { PlanId = plan.Id, ServiceId = task.ServiceId,
            ServiceName = order.OrderServices.FirstOrDefault(s => s.EventServiceId == task.ServiceId)?.Name ?? "Venue preparation",
            Activity = task.Activity.Trim(), StaffId = task.StaffId,
            StaffName = task.StaffId.HasValue ? await db.Users.Where(u => u.Id == task.StaffId).Select(u => u.DisplayName).SingleAsync(ct) : null,
                StartsAt = task.StartsAt.UtcDateTime, EndsAt = task.EndsAt.UtcDateTime, Instructions = task.Instructions?.Trim() ?? "" };
            plan.Tasks.Add(entity); db.ExecutionTasks.Add(entity);
        }
        order.ExecutionState = "draft";
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(await View(plan, ct));
    }
    [HttpPost("finalize")]
    public async Task<IActionResult> FinalizePlan(string orderId, PlanVersionDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        var plan = await db.ExecutionPlans.Include(p => p.Tasks).SingleOrDefaultAsync(p => p.OrderId == orderId && p.OrderRevision == order.Revision, ct);
        if (plan is null) return NotFound();
        if (plan.State is "finalized" or "dispatched") return Ok(await View(plan, ct));
        if (plan.Version != dto.ExpectedVersion || plan.State != "draft") throw new BookingException(409, "Refresh the current draft before finalizing.");
        await Validate(order, Details(plan), plan.Id, true, ct);
        plan.State = "finalized"; plan.Version++; plan.FinalizedAt = BookingRules.UtcNow(clock); plan.UpdatedAt = plan.FinalizedAt.Value;
        order.ExecutionState = plan.State;
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(await View(plan, ct));
    }
    [HttpPost("dispatch")]
    public async Task<IActionResult> Dispatch(string orderId, PlanVersionDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        var plan = await db.ExecutionPlans.Include(p => p.Tasks).SingleOrDefaultAsync(p => p.OrderId == orderId && p.OrderRevision == order.Revision, ct);
        if (plan is null) return NotFound();
        if (plan.State == "dispatched") return Ok(await View(plan, ct));
        if (plan.Version != dto.ExpectedVersion || plan.State != "finalized") throw new BookingException(409, "Finalize the latest plan before dispatching briefs.");
        await Validate(order, Details(plan), plan.Id, true, ct);
        var now = BookingRules.UtcNow(clock);
        var manager = await db.Users.Where(u => u.Id == OrderAccess.UserId(User)).Select(u => u.DisplayName).SingleAsync(ct);
        plan.Version++; plan.State = "dispatched"; plan.DispatchedAt = now; plan.UpdatedAt = now; order.ExecutionState = plan.State;
        foreach (var task in plan.Tasks)
        {
            var details = new ExecutionBriefSnapshot(order.Id, order.Revision, order.PremiseName, order.PremiseAddress, order.ExpectedGuests,
                order.EventDate, order.EndDate, task.Activity, task.ServiceName,
                order.OrderServices.FirstOrDefault(s => s.EventServiceId == task.ServiceId)?.Quantity ?? 1, task.StaffName!, manager,
                task.StartsAt, task.EndsAt, task.Instructions, plan.Notes);
            db.ExecutionBriefs.Add(new ExecutionBrief { PlanId = plan.Id, PlanVersion = plan.Version, TaskId = task.Id,
                StaffId = task.StaffId!.Value, SentAt = now, UpdatedAt = now, SnapshotJson = JsonSerializer.Serialize(details, BillingService.Json) });
        }
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(await View(plan, ct));
    }
}
