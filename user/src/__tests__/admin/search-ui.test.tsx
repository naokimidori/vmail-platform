import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminAuthProvider } from "../../admin/auth/AdminAuthContext";
import { SearchPage } from "../../admin/components/SearchPage";

const message = {
  id: "msg-search-login",
  accountId: "stephen@example.com",
  addressId: "stephen@example.com",
  from: { name: "PayPal", email: "service@paypal.com" },
  to: [{ name: "Stephen", email: "stephen@example.com" }],
  subject: "Login from a new device",
  preview: "A new device logged into your PayPal account.",
  rawContent:
    "From: PayPal <service@paypal.com>\nTo: stephen@example.com\nSubject: Login from a new device\n\nA new device logged into your PayPal account.",
  direction: "incoming" as const,
  status: "delivered" as const,
  receivedAt: "2026-06-03T08:50:00.000Z",
};

vi.mock("../../admin/api/adminClient", () => ({
  createAdminClient: () => ({
    search: async () => ({
      accounts: [],
      messages: [message],
    }),
  }),
}));

describe("SearchPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens message details from search results", async () => {
    const user = userEvent.setup();

    render(
      <AdminAuthProvider>
        <SearchPage />
      </AdminAuthProvider>,
    );

    await user.type(screen.getByPlaceholderText("Search account / mailbox / subject"), "stephen@example.com");
    await user.click(screen.getByRole("button", { name: "Search" }));
    const openMessageButton = await screen.findByRole("button", { name: "Open message Login from a new device" });

    vi.useFakeTimers();
    fireEvent.click(openMessageButton);

    expect(screen.getByRole("status", { name: "Loading message detail" })).toBeInTheDocument();
    expect(screen.queryByTestId("message-detail-overlay")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    expect(screen.getByRole("dialog", { name: "Login from a new device" })).toBeInTheDocument();
    expect(screen.getByText("A new device logged into your PayPal account.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy code/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tooltip", { name: "Show raw message" })).not.toBeInTheDocument();
    expect(screen.queryByText(/From: PayPal/)).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Show raw message" }));
    expect(screen.getByRole("tooltip", { name: "Show raw message" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show raw message" }));

    expect(screen.getByRole("dialog", { name: "Raw message" })).toBeInTheDocument();
    expect(screen.getByText(/From: PayPal/)).toBeVisible();
  });
});
