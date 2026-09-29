using HappyHoliday.Contracts;
using HappyHoliday.Models;

namespace HappyHoliday.Services;

public interface ITokenService
{
    AuthResponse CreateToken(AppUser user);
}
