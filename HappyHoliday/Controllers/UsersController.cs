using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Repositories;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HappyHoliday.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController(IUserRepository users, AppDbContext db) : ControllerBase
{
    // GET /api/users/me
    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> GetCurrentUser(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(userIdStr, out var id))
            return Unauthorized();
        var user = await users.FindByIdAsync(id, ct);
        return user is null ? Unauthorized() : Ok(user.ToResponse());
    }

    [HttpPut("me")]
    [Authorize(Roles = UserRoles.Client)]
    public async Task<IActionResult> UpdateProfile(UpdateProfileDto dto, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var id)) return Unauthorized();
        var user = await users.FindByIdAsync(id, ct);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(dto.DisplayName) || dto.DisplayName.Trim().Length < 2)
            return BadRequest(new ProblemDetails { Detail = "Display name must contain at least two characters." });
        var normalized = PostgresUserRepository.NormalizeEmail(dto.Email);
        if (await db.Users.AnyAsync(u => u.Id != id && u.NormalizedEmail == normalized, ct))
            return Conflict(new ProblemDetails { Detail = "Email already registered." });
        user.DisplayName = dto.DisplayName.Trim();
        user.Email = dto.Email.Trim();
        user.NormalizedEmail = normalized;
        user.Phone = dto.Phone?.Trim();
        await db.SaveChangesAsync(ct);
        return Ok(user.ToResponse());
    }

    // GET /api/users/clients  — managers only: clients with real booking stats
    [HttpGet("clients")]
    [Authorize(Roles = $"{UserRoles.Manager},{UserRoles.Admin}")]
    public async Task<IActionResult> GetClients(CancellationToken ct)
    {
        var clientQuery = db.Users.Where(u => u.Role == UserRoles.Client);
        if (User.IsInRole(UserRoles.Manager))
        {
            var managerId = Guid.Parse(User.FindFirstValue("sub")!);
            clientQuery = clientQuery.Where(u => db.Orders.Any(o => o.ClientId == u.Id && o.ManagerId == managerId));
        }
        var clientUsers = await clientQuery.AsNoTracking().OrderBy(u => u.DisplayName).ToListAsync(ct);
        var clientIds   = clientUsers.Select(u => u.Id).ToList();
        var orderQuery = db.Orders.Where(o => clientIds.Contains(o.ClientId));
        if (User.IsInRole(UserRoles.Manager))
        {
            var managerId = Guid.Parse(User.FindFirstValue("sub")!);
            orderQuery = orderQuery.Where(o => o.ManagerId == managerId);
        }

        // Fetch orders for all clients in one query
        var orderStats = await orderQuery
            .GroupBy(o => o.ClientId)
            .Select(g => new
            {
                ClientId      = g.Key,
                TotalBookings = g.Count(),
                LastBooking   = g.Max(o => o.EventDate)
            })
            .ToListAsync(ct);

        var statsMap = orderStats.ToDictionary(s => s.ClientId);

        return Ok(clientUsers.Select(u =>
        {
            statsMap.TryGetValue(u.Id, out var stats);
            return new
            {
                u.Id,
                name          = u.DisplayName,
                email         = u.Email,
                phone         = u.Phone ?? "—",
                totalBookings = stats?.TotalBookings ?? 0,
                lastBooking   = stats?.LastBooking.ToString("MMM dd, yyyy") ?? "No bookings",
                company       = "",
                notes         = ""
            };
        }));
    }

    // DELETE /api/users/{id}  — managers only
    // GET /api/users/staff
    [HttpGet("staff")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetStaff(CancellationToken ct)
    {
        var managers = await users.GetByRoleAsync(UserRoles.Manager, ct);
        var admins = await users.GetByRoleAsync(UserRoles.Admin, ct);
        var staff = managers.Concat(admins).ToList();

        return Ok(staff.Select(u => new
        {
            u.Id,
            name  = u.DisplayName,
            email = u.Email,
            role  = u.Role,
            clientLimit = u.ClientLimit,
            createdAt = u.CreatedAt
        }));
    }

    // PUT /api/users/{id}
    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserDto dto, CancellationToken ct)
    {
        if (dto.Role is not (UserRoles.Client or UserRoles.Manager or UserRoles.Admin)
            || string.IsNullOrWhiteSpace(dto.Name) || dto.Name.Trim().Length < 2)
            return BadRequest(new ProblemDetails { Detail = "Supply a valid name and role." });
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var user = await users.FindByIdAsync(id, ct);
        if (user is null) return NotFound();
        var normalized = PostgresUserRepository.NormalizeEmail(dto.Email);
        if (await db.Users.AnyAsync(u => u.Id != id && u.NormalizedEmail == normalized, ct))
            return Conflict(new ProblemDetails { Detail = "Email already registered." });
        if (user.Role != dto.Role && await db.Orders.AnyAsync(o => o.ClientId == id || o.ManagerId == id, ct))
            return Conflict(new ProblemDetails { Detail = "Users with order history cannot change roles." });
        if (user.Role == UserRoles.Admin && dto.Role != UserRoles.Admin
            && await db.Users.CountAsync(u => u.Role == UserRoles.Admin, ct) == 1)
            return Conflict(new ProblemDetails { Detail = "The last administrator cannot be demoted." });
        var clientCount = await db.Orders.Where(o => o.ManagerId == id && o.Status != "cancelled" && o.Status != "completed")
            .Select(o => o.ClientId).Distinct().CountAsync(ct);
        if (dto.ClientLimit.HasValue && dto.ClientLimit.Value < clientCount)
            return Conflict(new ProblemDetails { Detail = "Client limit cannot be lower than the current active client count." });
        user.DisplayName = dto.Name.Trim();
        user.Email = dto.Email.Trim();
        user.NormalizedEmail = normalized;
        user.Role = dto.Role;
        if (dto.ClientLimit.HasValue) user.ClientLimit = dto.ClientLimit.Value;
        
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(user.ToResponse());
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var user = await users.FindByIdAsync(id, ct);
        if (user is null) return NotFound();
        if (await db.Orders.AnyAsync(o => o.ClientId == id || o.ManagerId == id, ct))
            return Conflict(new ProblemDetails { Detail = "Users with booking history cannot be deleted." });
        if (user.Role == UserRoles.Admin && await db.Users.CountAsync(u => u.Role == UserRoles.Admin, ct) == 1)
            return Conflict(new ProblemDetails { Detail = "The last administrator cannot be deleted." });
        await users.DeleteAsync(user, ct);
        await transaction.CommitAsync(ct);
        return NoContent();
    }
}
