using System.Security.Claims;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Services;

public static class OrderAccess
{
    public static Guid UserId(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue("sub")!);
    public static IQueryable<Order> Visible(AppDbContext db, ClaimsPrincipal user) => db.Orders.Include(o => o.Client).Include(o => o.OrderServices)
        .Where(o => user.IsInRole("admin") || (user.IsInRole("client") && o.ClientId == UserId(user)) || (user.IsInRole("manager") && o.ManagerId == UserId(user)));
    public static void RequirePaid(Order order)
    {
        if (order.Status != "confirmed" || order.PaymentConfirmedAt is null || order.PaidAmount < order.TotalAmount)
            throw new BookingException(409, "A recorded payment covering the current booking is required before execution can be planned.");
    }
}
