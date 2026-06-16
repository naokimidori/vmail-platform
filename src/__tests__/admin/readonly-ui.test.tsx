import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountsPage } from "../../admin/components/AccountsPage";
import { AdminAuthProvider } from "../../admin/auth/AdminAuthContext";
import { Toaster } from "../../admin/components/ui/toaster";

const account = {
  id: "team-a",
  displayName: "Team A",
  ownerEmail: "team-a@example.com",
  status: "active" as const,
  addresses: [
    {
      id: "addr-team-a",
      email: "team-a@mail.example.com",
      label: "Shared team inbox",
      isPrimary: true,
      createdAt: "2026-05-01T09:00:00.000Z",
    },
  ],
  createdAt: "2026-05-01T09:00:00.000Z",
  lastActiveAt: "2026-06-03T08:45:00.000Z",
  messageCount: 128,
};

const opsAccount = {
  id: "ops-bot",
  displayName: "Ops Bot",
  ownerEmail: "ops@example.com",
  status: "active" as const,
  addresses: [
    {
      id: "addr-ops-bot",
      email: "ops-bot@mail.example.com",
      label: "Ops inbox",
      isPrimary: true,
      createdAt: "2026-05-02T09:00:00.000Z",
    },
  ],
  createdAt: "2026-05-02T09:00:00.000Z",
  lastActiveAt: "2026-06-03T08:50:00.000Z",
  messageCount: 4,
};

const laterAccount = {
  id: "later",
  displayName: "later@example.com",
  ownerEmail: "later@example.com",
  status: "active" as const,
  addresses: [
    {
      id: "addr-later",
      email: "later@example.com",
      label: "Later inbox",
      isPrimary: true,
      createdAt: "2026-05-03T09:00:00.000Z",
    },
  ],
  createdAt: "2026-05-03T09:00:00.000Z",
  lastActiveAt: "2026-06-03T08:55:00.000Z",
  messageCount: 2,
};

const opsMessage = {
  id: "msg-ops-login",
  accountId: "ops-bot",
  addressId: "addr-ops-bot",
  from: { name: "PayPal", email: "service@paypal.com" },
  to: [{ name: "Ops Bot", email: "ops-bot@mail.example.com" }],
  subject: "Login from a new device",
  preview: "Your security code is 863223.",
  rawContent:
    "From: PayPal <service@paypal.com>\nTo: ops-bot@mail.example.com\nSubject: Login from a new device\n\nYour security code is 863223.",
  direction: "incoming" as const,
  status: "delivered" as const,
  receivedAt: "2026-06-03 08:50:00",
};

const createdAccounts: typeof account[] = [];

function createAccountDetail(accountId: string, options = {}) {
  const selected =
    createdAccounts.find((item) => item.id === accountId) ??
    (accountId === "ops-bot" ? opsAccount : accountId === "later" ? laterAccount : account);
  return {
    account: selected,
    messages: accountId === "ops-bot" ? [opsMessage] : [],
    messagesTotal: accountId === "ops-bot" ? 1 : 0,
    messagesLimit: 20,
    messagesOffset: Number((options as { offset?: number }).offset ?? 0),
    activity: [],
  };
}

function createAccountsPage({ limit = 20, offset = 0, query = "" } = {}) {
  const allAccounts = [account, opsAccount, ...createdAccounts, laterAccount];
  const term = query.trim().toLowerCase();
  const availableAccounts = allAccounts.filter(
    (item) => !deletedAddressIds.has(item.addresses[0]?.id ?? item.id),
  );
  const items = term
    ? availableAccounts.filter((item) =>
        [item.id, item.displayName, item.ownerEmail, ...item.addresses.map((address) => address.email)]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : availableAccounts.filter((item) => item.id !== "later");
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

function createManyAccountsPage({ limit = 20, offset = 0 } = {}) {
  const items = Array.from({ length: 25 }, (_, index) => ({
    ...account,
    id: index === 0 ? "team-a" : `account-${index + 1}`,
    ownerEmail: index === 0 ? "team-a@example.com" : `account-${index + 1}@example.com`,
    displayName: index === 0 ? "Team A" : `account-${index + 1}@example.com`,
  }));

  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

const getAccount = vi.fn(async (accountId: string, options = {}) => createAccountDetail(accountId, options));
const listAccountsPage = vi.fn(async (options = {}) => createAccountsPage(options));
const deletedAddressIds = new Set<string>();
const deleteAddress = vi.fn(async (addressId: string) => {
  deletedAddressIds.add(addressId);
});
const getAddressAccessJwt = vi.fn(async (addressId: string) => `jwt-for-${addressId}`);
const createAddress = vi.fn(async ({ prefix }: { prefix: string }) => {
  const nextAccount = {
    ...account,
    id: `addr-${prefix}`,
    displayName: `${prefix}@example.com`,
    ownerEmail: `${prefix}@example.com`,
    addresses: [
      {
        ...account.addresses[0],
        id: `addr-${prefix}`,
        email: `${prefix}@example.com`,
        label: `${prefix}@example.com`,
        createdAt: "2026-06-11 09:17:02",
      },
    ],
    createdAt: "2026-06-11 09:17:02",
    lastActiveAt: "2026-06-11 09:17:02",
    messageCount: 0,
  };
  createdAccounts.unshift(nextAccount);
  return nextAccount;
});

vi.mock("../../admin/api/adminClient", () => ({
  createAdminClient: () => ({
    listAccountsPage,
    listAccounts: async () => [account, opsAccount],
    getAccount,
    deleteAddress,
    getAddressAccessJwt,
    createAddress,
  }),
}));

function renderAccountsPage() {
  return render(
    <AdminAuthProvider>
      <AccountsPage />
      <Toaster />
    </AdminAuthProvider>,
  );
}

const randomMailboxPrefixPattern = /^[a-z]+\d{2,6}$/;

describe("AccountsPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    listAccountsPage.mockClear();
    getAccount.mockClear();
    deleteAddress.mockClear();
    getAddressAccessJwt.mockClear();
    createAddress.mockClear();
    deletedAddressIds.clear();
    createdAccounts.length = 0;
  });

  it("renders account data with focused account actions", async () => {
    renderAccountsPage();

    expect(await screen.findByRole("button", { name: "Open team-a@example.com account" })).toBeInTheDocument();
    expect(screen.getByText("Account details")).toBeInTheDocument();
    expect(await screen.findByText("Created: 2026/5/1 17:00:00")).toBeInTheDocument();
    expect(screen.queryByText("Team A")).not.toBeInTheDocument();
    expect(screen.queryByText("Addr.")).not.toBeInTheDocument();
    expect(screen.queryByText("1 address")).not.toBeInTheDocument();
    expect(screen.getByText("128 messages")).toBeInTheDocument();
    expect(screen.queryByText("Mailbox addresses")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent messages")).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Page number")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Accounts pagination" })).not.toBeInTheDocument();
    expect(screen.queryByText("Read-only account view")).not.toBeInTheDocument();
    expect(screen.queryAllByText(/^Read-only$/i)).toHaveLength(0);
    expect(screen.queryByText("active")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New mailbox account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy team-a@example.com" })).toBeInTheDocument();
  });

  it("copies an account email from the account list", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Copy team-a@example.com" }));

    expect(writeText).toHaveBeenCalledWith("team-a@example.com");
    expect(await screen.findByText("Email copied")).toBeInTheDocument();
  });

  it("creates a mailbox account with a typed prefix", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "New mailbox account" }));

    expect(screen.getByRole("dialog", { name: "New mailbox account" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Mailbox prefix"), "support");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(createAddress).toHaveBeenCalledWith({ prefix: "support" });
    });
    expect(await screen.findByRole("button", { name: "Open support@example.com account" })).toBeInTheDocument();
    expect(await screen.findByText("Mailbox account created")).toBeInTheDocument();
  });

  it("generates a random mailbox prefix before creating an account", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "New mailbox account" }));
    await user.click(screen.getByRole("button", { name: "Random prefix" }));

    const prefixInput = screen.getByLabelText("Mailbox prefix");
    expect((prefixInput as HTMLInputElement).value).toMatch(randomMailboxPrefixPattern);
    expect((prefixInput as HTMLInputElement).value).not.toMatch(/^mail/i);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(createAddress).toHaveBeenCalledWith({ prefix: expect.stringMatching(randomMailboxPrefixPattern) });
    });
  });

  it("centers the create account dialog from a viewport portal", async () => {
    const user = userEvent.setup();
    const { container } = renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "New mailbox account" }));

    const dialog = screen.getByRole("dialog", { name: "New mailbox account" });
    const overlay = dialog.parentElement;

    expect(container).not.toContainElement(dialog);
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay).toHaveClass("fixed", "inset-0", "grid", "place-items-center");
  });

  it("filters accounts from the left list search", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.type(await screen.findByPlaceholderText("Search accounts"), "ops");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Open team-a@example.com account" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open ops@example.com account" })).toBeInTheDocument();
  });

  it("debounces mailbox search text and replaces account rows with loading feedback", async () => {
    listAccountsPage.mockImplementationOnce(async (options = {}) => createManyAccountsPage(options));

    renderAccountsPage();

    await screen.findByPlaceholderText("Search accounts");
    expect(screen.getByRole("navigation", { name: "Accounts pagination" })).toBeInTheDocument();
    listAccountsPage.mockClear();
    let resolveSearch: (() => void) | undefined;
    const searchPromise = new Promise<void>((resolve) => {
      resolveSearch = resolve;
    });
    listAccountsPage.mockImplementationOnce(async (options = {}) => {
      await searchPromise;
      return createAccountsPage(options);
    });

    fireEvent.change(await screen.findByPlaceholderText("Search accounts"), { target: { value: "later" } });

    expect(listAccountsPage).not.toHaveBeenCalledWith({ limit: 10, offset: 0, query: "later" });

    expect(await screen.findByText("Loading accounts...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open team-a@example.com account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open ops@example.com account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Accounts pagination" })).not.toBeInTheDocument();
    resolveSearch?.();
    expect(await screen.findByRole("button", { name: "Open later@example.com account" })).toBeInTheDocument();
    expect(listAccountsPage).toHaveBeenLastCalledWith({ limit: 10, offset: 0, query: "later" });
  });

  it("shows empty states when the accounts page has no accounts", async () => {
    listAccountsPage.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
    });

    renderAccountsPage();

    expect(await screen.findByText("No accounts found")).toBeInTheDocument();
    expect(screen.getByText("No mailbox accounts match the current view.")).toBeInTheDocument();
    expect(screen.getByText("No account selected")).toBeInTheDocument();
    expect(screen.getByText("Select or create a mailbox account to view messages.")).toBeInTheDocument();
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("switches accounts and opens message details from the message list", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Open ops@example.com account" }));

    expect(await screen.findAllByText("ops@example.com")).toHaveLength(2);
    expect(getAccount).toHaveBeenLastCalledWith("ops-bot", { limit: 10, offset: 0 });
    expect(screen.getByText("Login from a new device")).toBeInTheDocument();
    expect(screen.getByText("2026/6/3 16:50")).toBeInTheDocument();
    expect(screen.queryByText("Read")).not.toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Open message Login from a new device" }));

    expect(screen.getByRole("status", { name: "Loading message detail" })).toBeInTheDocument();
    expect(screen.queryByTestId("message-detail-overlay")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    expect(screen.getByRole("dialog", { name: "Login from a new device" })).toBeInTheDocument();
    expect(screen.getByText("Your security code is 863223.")).toBeInTheDocument();
  });

  it("shows detected message codes beside account detail subjects and copies without opening details", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Open ops@example.com account" }));

    const codeButton = await screen.findByRole("button", { name: "Copy code 863223" });
    expect(codeButton).toBeInTheDocument();

    await user.click(codeButton);

    expect(writeText).toHaveBeenCalledWith("863223");
    expect(screen.queryByRole("dialog", { name: "Login from a new device" })).not.toBeInTheDocument();
    expect(await screen.findByText("Verification code copied")).toBeInTheDocument();
  });

  it("keeps message timestamps on the first row while truncating long subjects", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Open ops@example.com account" }));

    const subjectButton = await screen.findByRole("button", { name: "Open message Login from a new device" });
    expect(subjectButton).toHaveClass("truncate", "max-w-full");
    expect(screen.getByText("2026/6/3 16:50")).toHaveClass("whitespace-nowrap");
  });

  it("opens account row actions from the overflow menu", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    const actionsButton = await screen.findByRole("button", { name: "Account actions for ops@example.com" });

    await user.hover(actionsButton);

    expect(screen.getByRole("menu", { name: "Actions for ops@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeEnabled();

    await user.click(actionsButton);
    await user.click(screen.getByRole("menuitem", { name: "Open" }));

    await waitFor(() => {
      expect(getAccount).toHaveBeenLastCalledWith("ops-bot", { limit: 10, offset: 0 });
    });
    expect(screen.getAllByText("ops@example.com")).toHaveLength(2);
  });

  it("fetches and copies an account access link from the overflow menu", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    let resolveAccessJwt: ((jwt: string) => void) | undefined;
    getAddressAccessJwt.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveAccessJwt = resolve;
        }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Account actions for ops@example.com" }));
    await user.click(screen.getByRole("menuitem", { name: "Link" }));

    expect(await screen.findByRole("status", { name: "Generating access link" })).toBeInTheDocument();
    await waitFor(() => {
      expect(getAddressAccessJwt).toHaveBeenCalledWith("addr-ops-bot");
    });
    await act(async () => {
      resolveAccessJwt?.("jwt-for-addr-ops-bot");
    });

    const expectedLink = "https://mail.example.com/?jwt=jwt-for-addr-ops-bot";
    expect(await screen.findByRole("dialog", { name: "Access link for ops@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close access link dialog" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByTestId("access-link-value")).toHaveTextContent(expectedLink);
    expect(screen.getByTestId("access-link-footer")).toContainElement(
      screen.getByRole("button", { name: "Copy access link" }),
    );

    await user.click(screen.getByRole("button", { name: "Copy access link" }));

    expect(writeText).toHaveBeenCalledWith(expectedLink);
    expect(await screen.findByText("Access link copied")).toBeInTheDocument();
  });

  it("deletes after one confirmation and shows pending and success feedback", async () => {
    const user = userEvent.setup();
    let resolveDelete: (() => void) | undefined;
    deleteAddress.mockImplementationOnce(
      (addressId: string) =>
        new Promise<void>((resolve) => {
          resolveDelete = () => {
            deletedAddressIds.add(addressId);
            resolve();
          };
        }),
    );

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Account actions for ops@example.com" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByRole("dialog", { name: "Delete ops@example.com?" })).toBeInTheDocument();
    expect(deleteAddress).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(screen.getByRole("status", { name: "Deleting mailbox account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(screen.queryByRole("dialog", { name: "Delete ops@example.com permanently?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm permanent delete" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(deleteAddress).toHaveBeenCalledWith("addr-ops-bot");
    });
    await act(async () => {
      resolveDelete?.();
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Open ops@example.com account" })).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Mailbox address deleted")).toBeInTheDocument();
    expect(screen.getByText("ops@example.com was deleted from the mailbox service.")).toBeInTheDocument();
  });

  it("keeps the delete dialog open and shows an error toast when deletion fails", async () => {
    const user = userEvent.setup();
    deleteAddress.mockRejectedValueOnce(new Error("delete failed"));

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Account actions for ops@example.com" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
    expect(deleteAddress).toHaveBeenCalledWith("addr-ops-bot");
    });
    expect(screen.getByRole("dialog", { name: "Delete ops@example.com?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm permanent delete" })).not.toBeInTheDocument();
    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    expect(screen.getByText("Could not delete ops@example.com. Try again later.")).toBeInTheDocument();
  });

  it("refreshes messages for the selected account from account details", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Open ops@example.com account" }));
    await screen.findByText("Login from a new device");
    getAccount.mockClear();
    let resolveRefresh: (() => void) | undefined;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    getAccount.mockImplementationOnce(async (accountId: string, options = {}) => {
      await refreshPromise;
      return createAccountDetail(accountId, options);
    });

    await user.click(screen.getByRole("button", { name: "Refresh account messages" }));

    expect(await screen.findByText("Refreshing messages...")).toBeInTheDocument();
    resolveRefresh?.();
    await waitFor(() => {
      expect(getAccount).toHaveBeenCalledWith("ops-bot", { limit: 10, offset: 0 });
    });
  });

  it("updates displayed mail counts from refreshed message totals", async () => {
    const user = userEvent.setup();

    renderAccountsPage();

    await user.click(await screen.findByRole("button", { name: "Open ops@example.com account" }));
    expect(await screen.findByText("4 messages")).toBeInTheDocument();
    const opsRow = screen.getByRole("button", { name: "Open ops@example.com account" }).closest("tr");
    expect(opsRow).not.toBeNull();
    expect(within(opsRow as HTMLElement).getByText("4")).toBeInTheDocument();

    getAccount.mockImplementationOnce(async (accountId: string, options = {}) => ({
      ...createAccountDetail(accountId, options),
      messages: [
        opsMessage,
        {
          ...opsMessage,
          id: "msg-ops-new",
          subject: "New verification code",
          receivedAt: "2026-06-15 11:37:00",
        },
      ],
      messagesTotal: 5,
    }));

    await user.click(screen.getByRole("button", { name: "Refresh account messages" }));

    expect(await screen.findByText("5 messages")).toBeInTheDocument();
    expect(within(opsRow as HTMLElement).getByText("5")).toBeInTheDocument();
  });
});
