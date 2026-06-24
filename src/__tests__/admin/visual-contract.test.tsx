import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAuthProvider } from "../../admin/auth/AdminAuthContext";
import { AdminShell } from "../../admin/components/AdminShell";
import { Dashboard } from "../../admin/components/Dashboard";
import { LoginScreen } from "../../admin/components/LoginScreen";

const fakeClient = {
  getDashboard: vi.fn(),
  getStatus: vi.fn(),
  listAccountsPage: vi.fn(),
  listAccounts: vi.fn(),
  getAccount: vi.fn(),
  search: vi.fn(),
  deleteAddress: vi.fn(),
};

vi.mock("../../admin/api/adminClient", () => ({
  createAdminClient: () => fakeClient,
}));

describe("AI roadmap visual refresh contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the authenticated app inside the glass site frame while preserving navigation labels", () => {
    render(
      <MemoryRouter>
        <AdminAuthProvider>
          <Routes>
            <Route element={<AdminShell />}>
              <Route index element={<div>Shell content</div>} />
            </Route>
          </Routes>
        </AdminAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("admin-site-frame")).toHaveClass("site-frame");
    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toHaveClass("space-y-1");
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Accounts/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mail Setting/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /User Settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Service Check/i })).toBeInTheDocument();
    expect(screen.getByText("Shell content")).toBeInTheDocument();
  });

  it("renders login in the same glass frame without changing auth copy", () => {
    render(
      <MemoryRouter>
        <AdminAuthProvider>
          <LoginScreen />
        </AdminAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("login-site-frame")).toHaveClass("site-frame");
    expect(screen.getByText("V-Mail Admin")).toBeInTheDocument();
    expect(screen.getByText("Super admin access")).toBeInTheDocument();
    expect(screen.getByLabelText("Admin password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter dashboard" })).toBeInTheDocument();
    expect(screen.queryAllByText(/read-only/i)).toHaveLength(0);
  });

  it("keeps dashboard data labels while exposing the refreshed hero and metric layout", async () => {
    fakeClient.getDashboard.mockResolvedValueOnce({
      totals: {
        accounts: 515,
        addresses: 515,
        messages: 969,
        deliveredToday: 12,
        failedToday: null,
      },
      mailflow: [
        { timestamp: "2026-06-03T00:00:00.000Z", delivered: 8, failed: 1 },
        { timestamp: "2026-06-03T01:00:00.000Z", delivered: 12, failed: 0 },
      ],
      activity: [
        { id: "activity-1", title: "Mailbox updated", description: "team-a@mail.example.com received a message." },
      ],
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

    expect(await screen.findByText("V-Mail Mailbox")).toBeInTheDocument();
    expect(screen.getAllByText("Mailbox accounts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Messages").length).toBeGreaterThan(0);
    expect(screen.getByText("Mailflow")).toBeInTheDocument();
    expect(screen.queryByText("Recent activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent messages")).not.toBeInTheDocument();
    expect(screen.queryByText("Unread messages")).not.toBeInTheDocument();
    expect(screen.queryAllByText(/^Read-only$/i)).toHaveLength(0);
  });
});
