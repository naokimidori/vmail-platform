import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAuthProvider } from "../../admin/auth/AdminAuthContext";
import { AdminShell } from "../../admin/components/AdminShell";
import { Dashboard } from "../../admin/components/Dashboard";
import { SystemStatusPage } from "../../admin/components/SystemStatusPage";

const fakeClient = {
  getDashboard: vi.fn(),
  getStatus: vi.fn(),
  listAccountsPage: vi.fn(),
  listAccounts: vi.fn(),
  getAccount: vi.fn(),
  search: vi.fn(),
};

vi.mock("../../admin/api/adminClient", () => ({
  createAdminClient: () => fakeClient,
}));

describe("production readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an API error instead of mock dashboard data when live requests fail", async () => {
    fakeClient.getDashboard.mockRejectedValueOnce(new Error("live api unavailable"));

    render(
      <AdminAuthProvider>
        <Dashboard />
      </AdminAuthProvider>,
    );

    expect(await screen.findByText("Unable to load dashboard data.")).toBeInTheDocument();
    expect(screen.queryByText("Storage / Volume")).not.toBeInTheDocument();
  });

  it("renders a focused admin shell without inactive search or unused navigation", () => {
    render(
      <MemoryRouter>
        <AdminAuthProvider>
          <Routes>
            <Route element={<AdminShell />}>
              <Route index element={<div />} />
            </Route>
          </Routes>
        </AdminAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "V-Mail technology logo" })).toBeInTheDocument();
    expect(screen.queryByText("Search account / mailbox / subject")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mail Search/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Audit View/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Service Check/i })).toBeInTheDocument();
  });

  it("uses accounts and messages as the primary dashboard totals", async () => {
    fakeClient.getDashboard.mockResolvedValueOnce({
      totals: {
        accounts: 515,
        addresses: 515,
        messages: 969,
        deliveredToday: null,
        failedToday: null,
      },
      mailflow: [],
      activity: [],
      recentMessages: [],
      system: {
        status: "healthy",
        checkedAt: "2026-06-03T00:00:00.000Z",
        latencyMs: null,
        message: "OK",
      },
    });

    render(
      <AdminAuthProvider>
        <Dashboard />
      </AdminAuthProvider>,
    );

    expect((await screen.findAllByText("Accounts")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Messages").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mailboxes")).not.toBeInTheDocument();
  });

  it("shows service check as a statistics endpoint reachability check", async () => {
    fakeClient.getStatus.mockResolvedValueOnce({
      status: "healthy",
      checkedAt: "2026-06-03T00:00:00.000Z",
      latencyMs: null,
      message: "Admin statistics endpoint is reachable.",
    });

    render(
      <AdminAuthProvider>
        <SystemStatusPage />
      </AdminAuthProvider>,
    );

    expect(await screen.findByText("Service Check")).toBeInTheDocument();
    expect(screen.getByText("Statistics API")).toBeInTheDocument();
    expect(screen.queryByText("Worker")).not.toBeInTheDocument();
    expect(screen.queryByText("Database")).not.toBeInTheDocument();
  });
});
