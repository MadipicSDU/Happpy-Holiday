using HappyHoliday.Controllers;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace HappyHoliday.Tests;

[TestClass]
public sealed class PaymentPolicyTests
{
    private sealed class EnvironmentStub(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
    [TestMethod]
    public async Task DemoPaymentsCannotRunInProductionOrWhenDisabled()
    {
        foreach (var (environment, enabled) in new[] { ("Production", "true"), ("Development", "false") })
        {
            using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().Options);
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Payments:AllowDemo"] = enabled }).Build();
            var controller = new InvoicesController(db, TimeProvider.System, new EnvironmentStub(environment), config, new BillingService(db));
            try { await controller.Pay("example", new PayInvoiceDto(Guid.NewGuid()), CancellationToken.None); Assert.Fail("Payment must be disabled."); }
            catch (BookingException error) { Assert.AreEqual(503, error.Status); }
        }
    }
}
