using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Models;
using HappyHoliday.Repositories;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HappyHoliday.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IUserRepository users,
    IPasswordHasher<AppUser> passwordHasher,
    ITokenService tokens) : ControllerBase
{
    [HttpPost("register")]
    [EnableRateLimiting("authentication")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> RegisterClient(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length < 2)
            return BadRequest(new ProblemDetails { Detail = "Display name must contain at least two characters." });
        var result = await RegisterUserAsync(request, UserRoles.Client, cancellationToken);
        if (result is null)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Email already registered",
                Detail = "An account with this email address already exists.",
                Status = StatusCodes.Status409Conflict
            });
        }

        var response = tokens.CreateToken(result);
        return CreatedAtAction(nameof(UsersController.GetCurrentUser), "Users", null, response);
    }

    [HttpPost("managers")]
    [Authorize(Roles = UserRoles.Admin)]
    [ProducesResponseType<UserResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> RegisterManager(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await RegisterUserAsync(request, UserRoles.Manager, cancellationToken);
        if (result is null)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Email already registered",
                Detail = "An account with this email address already exists.",
                Status = StatusCodes.Status409Conflict
            });
        }

        return StatusCode(StatusCodes.Status201Created, result.ToResponse());
    }

    [HttpPost("staff")]
    [Authorize(Roles = UserRoles.Admin)]
    [ProducesResponseType<UserResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> RegisterStaff(
        CreateStaffRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Role is not (UserRoles.Manager or UserRoles.Admin))
            return BadRequest(new ProblemDetails { Detail = "Staff role must be manager or admin." });
        var result = await RegisterUserAsync(
            new RegisterRequest { DisplayName = request.DisplayName, Email = request.Email, Password = request.Password, Phone = request.Phone },
            request.Role,
            cancellationToken, request.ClientLimit);

        if (result is null)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Email already registered",
                Detail = "An account with this email address already exists.",
                Status = StatusCodes.Status409Conflict
            });
        }

        return StatusCode(StatusCodes.Status201Created, result.ToResponse());
    }

    [HttpPost("login")]
    [EnableRateLimiting("authentication")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(request.Email, cancellationToken);
        if (user is null)
        {
            return InvalidCredentials();
        }

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return InvalidCredentials();
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
            await users.SaveChangesAsync(cancellationToken);
        }

        return Ok(tokens.CreateToken(user));
    }

    private async Task<AppUser?> RegisterUserAsync(
        RegisterRequest request,
        string role,
        CancellationToken cancellationToken,
        int clientLimit = 10)
    {
        var email = request.Email.Trim();
        var user = new AppUser
        {
            DisplayName = request.DisplayName.Trim(),
            Email = email,
            NormalizedEmail = PostgresUserRepository.NormalizeEmail(email),
            PasswordHash = string.Empty,
            Role = role,
            ClientLimit = clientLimit,
            Phone = request.Phone?.Trim()
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        return await users.TryAddAsync(user, cancellationToken) ? user : null;
    }

    private UnauthorizedObjectResult InvalidCredentials() => Unauthorized(new ProblemDetails
    {
        Title = "Invalid credentials",
        Detail = "The email address or password is incorrect.",
        Status = StatusCodes.Status401Unauthorized
    });
}
