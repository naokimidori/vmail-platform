import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AccountDetailPage } from "../../admin/components/AccountDetailPage";
import { AccountListPage } from "../../admin/components/AccountListPage";
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

function createAccountDetail(identifier: string, options = {}) {
  const findByEmail = (email: string) =>
    createdAccounts.find((item) => item.ownerEmail === email) ??
    (email === opsAccount.ownerEmail
      ? opsAccount
      : email === laterAccount.ownerEmail
        ? laterAccount
        : email === account.ownerEmail
          ? account
          : null);
  const findById = (id: string) =>
    createdAccounts.find((item) => item.id === id) ??
    (id === "ops-bot" ? opsAccount : id === "later" ? laterAccount : account);
  const selected = findByEmail(identifier) ?? findById(identifier);
  const isOps = selected?.ownerEmail === opsAccount.ownerEmail;
  return {
    account: selected ?? account,
    messages: isOps ? [opsMessage] : [],
    messagesTotal: isOps ? 1 : 0,
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

const getAccount = vi.fn(async (identifier: string, options = {}) => createAccountDetail(identifier, options));
const listAccountsPage = vi.fn(async (options = {}) => createAccountsPage(options));
const deletedAddressIds = new Set<string>();
const deleteAddress = vi.fn(async (addressId: string) => {
  deletedAddressIds.add(addressId);
});
const getAddressAccessJwt = vi.fn(async (addressId: string) => `jwt-for-${addressId}`);
const createAddress = vi.fn(async ({ prefix, domain = "example.com" }: { prefix: string; domain?: string }) => {
  const email = `${prefix}@${domain}`;
  const nextAccount = {
    ...account,
    id: `addr-${prefix}`,
    displayName: email,
    ownerEmail: email,
    addresses: [
      {
        ...account.addresses[0],
        id: `addr-${prefix}`,
        email,
        label: email,
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

vi.mock("../../config/env", () => ({
  apiBaseUrl: "mock",
  mailboxDomain: "example.com",
  mailboxDomains: ["example.com", "vino.cc.cd", "vinoss.us.ci"],
  publicMailboxUrl: "https://mail.example.com",
}));

function renderListPage(initialPath = "/admin/accounts") {
  return render(
    <AdminAuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/accounts" element={<AccountListPage />} />
          <Route path="/admin/accounts/:email" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </AdminAuthProvider>,
  );
}

function renderDetailPage(email: string) {
  return render(
    <AdminAuthProvider>
      <MemoryRouter initialEntries={[`/admin/accounts/${encodeURIComponent(email)}`]}>
        <Routes>
          <Route path="/admin/accounts" element={<AccountListPage />} />
          <Route path="/admin/accounts/:email" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </AdminAuthProvider>,
  );
}

const randomMailboxPrefixPattern = /^[a-z]+\d{2,6}$/;

describe("AccountListPage", () => {
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

  it("renders account rows with the new account button and no detail panel", async () => {
    renderListPage();

    expect(await screen.findByRole("button", { name: "Open team-a@example.com account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New mailbox account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy team-a@example.com" })).toBeInTheDocument();
    expect(screen.queryByText("Account details")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected account")).not.toBeInTheDocument();
    expect(screen.queryByText("128 messages")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent messages")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent activity")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Account messages pagination" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh account messages" })).not.toBeInTheDocument();
  });

  it("copies an account email from the inline copy button and shows a 2s confirmation", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderListPage();

    const copyButton = await screen.findByRole("button", { name: "Copy team-a@example.com" });
    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("team-a@example.com");
    expect(screen.queryByText("Email copied")).not.toBeInTheDocument();
    const copiedButton = screen.getByRole("button", { name: "Copied team-a@example.com" });
    expect(copiedButton).toBeInTheDocument();
    expect(copiedButton).toHaveAttribute("data-state", "copied");

    await waitFor(
      () =>
        expect(
          screen.queryByRole("button", { name: "Copied team-a@example.com" }),
        ).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("button", { name: "Copy team-a@example.com" })).toHaveAttribute(
      "data-state",
      "idle",
    );
  });

  it("creates a mailbox account with a typed prefix and routes to its detail page", async () => {
    const user = userEvent.setup();

    renderListPage();

    await user.click(await screen.findByRole("button", { name: "New mailbox account" }));

    expect(screen.getByRole("dialog", { name: "New mailbox account" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Mailbox prefix"), "support");
    await user.selectOptions(screen.getByLabelText("Mailbox domain"), "vinoss.us.ci");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(createAddress).toHaveBeenCalledWith({ prefix: "support", domain: "vinoss.us.ci" });
    });
    expect(await screen.findByText("Mailbox account created")).toBeInTheDocument();
  });

  it("generates a random mailbox prefix before creating an account", async () => {
    const user = userEvent.setup();

    renderListPage();

    await user.click(await screen.findByRole("button", { name: "New mailbox account" }));
    await user.click(screen.getByRole("button", { name: "Random prefix" }));

    const prefixInput = screen.getByLabelText("Mailbox prefix");
    expect((prefixInput as HTMLInputElement).value).toMatch(randomMailboxPrefixPattern);
    expect((prefixInput as HTMLInputElement).value).not.toMatch(/^mail/i);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(createAddress).toHaveBeenCalledWith({
        prefix: expect.stringMatching(randomMailboxPrefixPattern),
        domain: "example.com",
      });
    });
  });

  it("centers the create account dialog from a viewport portal", async () => {
    const user = userEvent.setup();
    const { container } = renderListPage();

    await user.click(await screen.findByRole("button", { name: "New mailbox account" }));

    const dialog = screen.getByRole("dialog", { name: "New mailbox account" });
    const overlay = dialog.parentElement;

    expect(container).not.toContainElement(dialog);
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay).toHaveClass("fixed", "inset-0", "grid", "place-items-center");
  });

  it("filters accounts by search term", async () => {
    const user = userEvent.setup();

    renderListPage();

    await user.type(await screen.findByPlaceholderText("Search accounts"), "ops");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Open team-a@example.com account" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open ops@example.com account" })).toBeInTheDocument();
  });

  it("debounces search text and replaces account rows with loading feedback", async () => {
    listAccountsPage.mockImplementationOnce(async (options = {}) => createManyAccountsPage(options));

    renderListPage();

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

  it("shows empty states when the accounts list has no accounts", async () => {
    listAccountsPage.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
    });

    renderListPage();

    expect(await screen.findByText("No mailbox accounts yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Mailbox accounts receive messages for the configured domains/),
    ).toBeInTheDocument();
    expect(screen.queryByText("No account selected")).not.toBeInTheDocument();
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("exposes copy, link, and delete actions directly on each row", async () => {
    renderListPage();

    expect(
      await screen.findByRole("button", { name: "Copy ops@example.com" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Get access link for ops@example.com" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete ops@example.com" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Account actions for ops@example.com" }),
    ).not.toBeInTheDocument();
  });

  it("fetches and copies an account access link from the row action", async () => {
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

    renderListPage();

    await user.click(
      await screen.findByRole("button", { name: "Get access link for ops@example.com" }),
    );

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

    renderListPage();

    await user.click(await screen.findByRole("button", { name: "Delete ops@example.com" }));

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

    renderListPage();

    await user.click(await screen.findByRole("button", { name: "Delete ops@example.com" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(deleteAddress).toHaveBeenCalledWith("addr-ops-bot");
    });
    expect(screen.getByRole("dialog", { name: "Delete ops@example.com?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm permanent delete" })).not.toBeInTheDocument();
    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    expect(screen.getByText("Could not delete ops@example.com. Try again later.")).toBeInTheDocument();
  });
});

describe("AccountDetailPage", () => {
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

  it("renders the breadcrumb and account header for the selected account", async () => {
    renderDetailPage("ops@example.com");

    const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "href",
      "/admin/accounts",
    );
    expect(within(breadcrumb).getByText("ops@example.com")).toBeInTheDocument();
    expect(within(breadcrumb).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "ops@example.com" })).toBeInTheDocument();
    expect(screen.getByText("Created: 2026/5/2 17:00:00")).toBeInTheDocument();
    expect(screen.getByText("4 messages")).toBeInTheDocument();
  });

  it("renders messages for the selected account and opens message details", async () => {
    const user = userEvent.setup();

    renderDetailPage("ops@example.com");

    expect(await screen.findByText("Login from a new device")).toBeInTheDocument();
    expect(screen.getByText("PayPal <service@paypal.com>")).toBeInTheDocument();
    expect(screen.getByText("2026/6/3 16:50")).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Open message Login from a new device" }));

    expect(screen.getByRole("status", { name: "Loading message detail" })).toBeInTheDocument();
    expect(screen.queryByTestId("message-detail-overlay")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    vi.useRealTimers();

    expect(screen.getByRole("dialog", { name: "Login from a new device" })).toBeInTheDocument();
    expect(screen.getByText("Your security code is 863223.")).toBeInTheDocument();
  });

  it("shows detected message codes and copies without opening details", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderDetailPage("ops@example.com");

    const codeButton = await screen.findByRole("button", { name: "Copy code 863223" });
    expect(codeButton).toBeInTheDocument();

    await user.click(codeButton);

    expect(writeText).toHaveBeenCalledWith("863223");
    expect(screen.queryByRole("dialog", { name: "Login from a new device" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Copied 863223" })).toBeInTheDocument();
  });

  it("keeps message timestamps on the first row while truncating long subjects", async () => {
    renderDetailPage("ops@example.com");

    const subjectButton = await screen.findByRole("button", { name: "Open message Login from a new device" });
    expect(subjectButton).toHaveClass("truncate", "max-w-full");
    expect(screen.getByText("2026/6/3 16:50")).toHaveClass("whitespace-nowrap");
  });

  it("refreshes messages for the selected account", async () => {
    const user = userEvent.setup();

    renderDetailPage("ops@example.com");

    await screen.findByText("Login from a new device");
    getAccount.mockClear();
    let resolveRefresh: (() => void) | undefined;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    getAccount.mockImplementationOnce(async (identifier: string, options = {}) => {
      await refreshPromise;
      return createAccountDetail(identifier, options);
    });

    await user.click(screen.getByRole("button", { name: "Refresh account messages" }));

    expect(await screen.findByText("Refreshing messages...")).toBeInTheDocument();
    resolveRefresh?.();
    await waitFor(() => {
      expect(getAccount).toHaveBeenCalledWith("ops@example.com", { limit: 10, offset: 0 });
    });
  });

  it("updates displayed mail counts from refreshed message totals", async () => {
    const user = userEvent.setup();

    renderDetailPage("ops@example.com");
    expect(await screen.findByText("4 messages")).toBeInTheDocument();

    getAccount.mockImplementationOnce(async (identifier: string, options = {}) => ({
      ...createAccountDetail(identifier, options),
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
  });
});