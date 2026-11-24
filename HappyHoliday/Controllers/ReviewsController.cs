using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Authorize(Roles = "client,manager,admin")]
public sealed class ReviewsController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    private static object View(EventReview review) => new { review.Id, review.OrderId, review.Rating, review.Comment,
        review.SubmittedAt, services = review.Services.Select(s => new { s.ServiceId, s.ServiceName, s.Rating }) };

    [HttpGet("api/orders/{orderId}/review")]
    public async Task<IActionResult> Get(string orderId, CancellationToken ct)
    {
        if (!await OrderAccess.Visible(db, User).AnyAsync(o => o.Id == orderId, ct)) return NotFound();
        var review = await db.Reviews.AsNoTracking().Include(r => r.Services).SingleOrDefaultAsync(r => r.OrderId == orderId, ct);
        return review is null ? NotFound() : Ok(View(review));
    }
    [HttpPost("api/orders/{orderId}/review"), Authorize(Roles = "client")]
    public async Task<IActionResult> Submit(string orderId, ReviewDto dto, CancellationToken ct)
    {
        if (dto.Services is null || dto.Services.Any(s => s is null) || dto.Services.Select(s => s.ServiceId).Distinct().Count() != dto.Services.Count)
            return BadRequest(new ProblemDetails { Detail = "Supply each service rating at most once." });
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        if (order.Status != "completed" || order.EndDate > clock.GetUtcNow().UtcDateTime
            || !order.PaymentConfirmedAt.HasValue || order.PaidAmount < order.TotalAmount)
            throw new BookingException(409, "Reviews are available after your paid event has completed.");
        if (dto.Services.Any(s => !order.OrderServices.Any(line => line.EventServiceId == s.ServiceId)))
            return BadRequest(new ProblemDetails { Detail = "Only services in this completed booking can be rated." });
        var existing = await db.Reviews.Include(r => r.Services).SingleOrDefaultAsync(r => r.OrderId == orderId, ct);
        var comment = dto.Comment?.Trim() ?? "";
        if (existing is not null)
        {
            if (existing.Rating == dto.Rating && existing.Comment == comment && existing.Services.Count == dto.Services.Count
                && existing.Services.All(s => dto.Services.Any(x => x.ServiceId == s.ServiceId && x.Rating == s.Rating))) return Ok(View(existing));
            throw new BookingException(409, "This event already has a submitted review.");
        }
        var review = new EventReview { OrderId = orderId, Rating = dto.Rating, Comment = comment, SubmittedAt = BookingRules.UtcNow(clock),
            Services = dto.Services.Select(s => new ServiceReview { ServiceId = s.ServiceId,
                ServiceName = order.OrderServices.Single(line => line.EventServiceId == s.ServiceId).Name, Rating = s.Rating }).ToList() };
        db.Reviews.Add(review);
        db.AuditEntries.Add(new AuditEntry { Action = "review-submitted", TargetId = orderId,
            ActorId = OrderAccess.UserId(User), At = review.SubmittedAt, Details = "Completed-event venue and optional service ratings." });
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(View(review));
    }

    [HttpGet("api/reviews/summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        // Catalogue aggregates contain no client identifiers or private contact details.
        var venues = await db.Reviews.AsNoTracking().GroupBy(r => r.Order.PremiseId)
            .Select(g => new { premiseId = g.Key, count = g.Count(), average = g.Average(r => (decimal)r.Rating) }).ToListAsync(ct);
        var services = await db.ServiceReviews.AsNoTracking().GroupBy(r => r.ServiceId)
            .Select(g => new { serviceId = g.Key, count = g.Count(), average = g.Average(r => (decimal)r.Rating) }).ToListAsync(ct);
        return Ok(new { venues, services });
    }
    [HttpGet("api/reviews/feedback"), Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> Feedback([FromQuery] int page = 1, CancellationToken ct = default)
    {
        if (page < 1 || page > 100000) return BadRequest();
        var visibleIds = OrderAccess.Visible(db, User).Select(o => o.Id);
        var query = db.Reviews.AsNoTracking().Include(r => r.Services).Where(r => visibleIds.Contains(r.OrderId));
        return Ok(new { total = await query.CountAsync(ct), page, pageSize = 30,
            items = (await query.OrderByDescending(r => r.SubmittedAt).ThenBy(r => r.Id).Skip((page - 1) * 30).Take(30).ToListAsync(ct)).Select(View) });
    }
}
