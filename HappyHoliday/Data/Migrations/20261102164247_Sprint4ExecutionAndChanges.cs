using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HappyHoliday.Data.Migrations
{
    /// <inheritdoc />
    public partial class Sprint4ExecutionAndChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_invoices_OrderId",
                table: "invoices");

            migrationBuilder.AddColumn<int>(
                name: "ChangeCutoffHours",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 168);

            migrationBuilder.AddColumn<string>(
                name: "ExecutionState",
                table: "orders",
                type: "text",
                nullable: false,
                defaultValue: "not-planned");

            migrationBuilder.AddColumn<decimal>(
                name: "PaidAmount",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentConfirmedAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PendingChangeId",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Revision",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "DocumentType",
                table: "invoices",
                type: "text",
                nullable: false,
                defaultValue: "invoice");

            migrationBuilder.AddColumn<bool>(
                name: "IsDemo",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PreviousPaidAmount",
                table: "invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "Revision",
                table: "invoices",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "SettledAt",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConcurrentCapacity",
                table: "event_services",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "execution_plans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<string>(type: "text", nullable: false),
                    OrderRevision = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DispatchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_plans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_execution_plans_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_changes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<string>(type: "text", nullable: false),
                    OriginalRevision = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    Guests = table.Column<int>(type: "integer", nullable: false),
                    ProposalJson = table.Column<string>(type: "text", nullable: false),
                    PreviousPricingJson = table.Column<string>(type: "text", nullable: false),
                    PriceDelta = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedByName = table.Column<string>(type: "text", nullable: true),
                    ReviewNote = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_changes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_changes_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "execution_briefs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanVersion = table.Column<int>(type: "integer", nullable: false),
                    TaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    SnapshotJson = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SupersededAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_briefs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_execution_briefs_execution_plans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "execution_plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "execution_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    ServiceName = table.Column<string>(type: "text", nullable: false),
                    Activity = table.Column<string>(type: "text", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffName = table.Column<string>(type: "text", nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Instructions = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_execution_tasks_execution_plans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "execution_plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_invoices_OrderId_Revision",
                table: "invoices",
                columns: new[] { "OrderId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_execution_briefs_PlanId_PlanVersion_TaskId",
                table: "execution_briefs",
                columns: new[] { "PlanId", "PlanVersion", "TaskId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_execution_briefs_StaffId_SupersededAt",
                table: "execution_briefs",
                columns: new[] { "StaffId", "SupersededAt" });

            migrationBuilder.CreateIndex(
                name: "IX_execution_plans_OrderId_OrderRevision",
                table: "execution_plans",
                columns: new[] { "OrderId", "OrderRevision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_execution_tasks_PlanId",
                table: "execution_tasks",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_execution_tasks_StaffId_StartsAt_EndsAt",
                table: "execution_tasks",
                columns: new[] { "StaffId", "StartsAt", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_order_changes_OrderId",
                table: "order_changes",
                column: "OrderId",
                unique: true,
                filter: "\"Status\" = 'pending'");
            migrationBuilder.Sql("""
                UPDATE orders o SET "PaidAmount" = paid.amount, "PaymentConfirmedAt" = paid.at
                FROM (SELECT i."OrderId", SUM(p."Amount") AS amount, MAX(p."PaidAt") AS at
                      FROM payments p JOIN invoices i ON i."Id" = p."InvoiceId" GROUP BY i."OrderId") paid
                WHERE o."Id" = paid."OrderId";
                UPDATE invoices i SET "SettledAt" = p."PaidAt" FROM payments p WHERE p."InvoiceId" = i."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM invoices GROUP BY "OrderId" HAVING COUNT(*) > 1) THEN
                        RAISE EXCEPTION 'Cannot downgrade Sprint 4 after revision invoices exist. Restore a verified pre-upgrade backup instead.';
                    END IF;
                END $$;
                """);
            migrationBuilder.DropTable(
                name: "execution_briefs");

            migrationBuilder.DropTable(
                name: "execution_tasks");

            migrationBuilder.DropTable(
                name: "order_changes");

            migrationBuilder.DropTable(
                name: "execution_plans");

            migrationBuilder.DropIndex(
                name: "IX_invoices_OrderId_Revision",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "ChangeCutoffHours",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ExecutionState",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaidAmount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaymentConfirmedAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PendingChangeId",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "DocumentType",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "IsDemo",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "PreviousPaidAmount",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "SettledAt",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "ConcurrentCapacity",
                table: "event_services");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_OrderId",
                table: "invoices",
                column: "OrderId",
                unique: true);
        }
    }
}
