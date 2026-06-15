import type {
  AccountDetail,
  ActivityItem,
  AdminAccount,
  DashboardData,
  MailMessage,
  MailflowPoint,
  SearchResult,
  SystemStatus,
} from "./types";

export const mockAccounts: AdminAccount[] = [
  {
    id: "team-a",
    displayName: "Team A",
    ownerEmail: "team-a@example.com",
    status: "active",
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
  },
  {
    id: "ops-bot",
    displayName: "Ops Bot",
    ownerEmail: "ops@example.com",
    status: "active",
    addresses: [
      {
        id: "addr-ops-bot",
        email: "ops-bot@mail.example.com",
        label: "Operational alerts",
        isPrimary: true,
        createdAt: "2026-05-03T10:30:00.000Z",
      },
    ],
    createdAt: "2026-05-03T10:30:00.000Z",
    lastActiveAt: "2026-06-03T08:30:00.000Z",
    messageCount: 76,
  },
  {
    id: "personal",
    displayName: "Personal",
    ownerEmail: "personal@example.com",
    status: "paused",
    addresses: [
      {
        id: "addr-personal",
        email: "personal@mail.example.com",
        label: "Personal mailbox",
        isPrimary: true,
        createdAt: "2026-05-08T13:15:00.000Z",
      },
    ],
    createdAt: "2026-05-08T13:15:00.000Z",
    lastActiveAt: "2026-06-02T15:10:00.000Z",
    messageCount: 41,
  },
];

export const mockMessages: MailMessage[] = [
  {
    id: "msg-openai-release",
    accountId: "team-a",
    addressId: "addr-team-a",
    from: { name: "OpenAI", email: "noreply@openai.com" },
    to: [{ name: "Team A", email: "team-a@mail.example.com" }],
    subject: "Usage summary is ready",
    preview: "Your latest workspace usage summary is available for review.",
    direction: "incoming",
    status: "delivered",
    receivedAt: "2026-06-03T08:42:00.000Z",
  },
  {
    id: "msg-github-security",
    accountId: "ops-bot",
    addressId: "addr-ops-bot",
    from: { name: "GitHub", email: "noreply@github.com" },
    to: [{ name: "Ops Bot", email: "ops-bot@mail.example.com" }],
    subject: "Dependabot alert digest",
    preview: "Three repositories have updated security advisories.",
    direction: "incoming",
    status: "delivered",
    receivedAt: "2026-06-03T08:18:00.000Z",
  },
  {
    id: "msg-cloudflare-zone",
    accountId: "personal",
    addressId: "addr-personal",
    from: { name: "Cloudflare", email: "no-reply@cloudflare.com" },
    to: [{ name: "Personal", email: "personal@mail.example.com" }],
    subject: "DNS change confirmed",
    preview: "A DNS record for mail.example.com was updated successfully.",
    direction: "incoming",
    status: "delivered",
    receivedAt: "2026-06-02T14:55:00.000Z",
  },
];

export const mockActivity: ActivityItem[] = [
  {
    id: "act-openai-message",
    accountId: "team-a",
    type: "message.received",
    title: "OpenAI message received",
    description: "Usage summary delivered to team-a@mail.example.com.",
    createdAt: "2026-06-03T08:42:00.000Z",
  },
  {
    id: "act-github-message",
    accountId: "ops-bot",
    type: "message.received",
    title: "GitHub digest received",
    description: "Dependabot digest delivered to ops-bot@mail.example.com.",
    createdAt: "2026-06-03T08:18:00.000Z",
  },
  {
    id: "act-cloudflare-message",
    accountId: "personal",
    type: "message.received",
    title: "Cloudflare notice received",
    description: "DNS confirmation delivered to personal@mail.example.com.",
    createdAt: "2026-06-02T14:55:00.000Z",
  },
];

export const mockMailflow: MailflowPoint[] = [
  { timestamp: "2026-06-03T06:00:00.000Z", delivered: 12, failed: 0 },
  { timestamp: "2026-06-03T07:00:00.000Z", delivered: 18, failed: 1 },
  { timestamp: "2026-06-03T08:00:00.000Z", delivered: 24, failed: 0 },
];

export const mockSystemStatus: SystemStatus = {
  status: "healthy",
  checkedAt: "2026-06-03T08:50:00.000Z",
  latencyMs: 18,
  message: "All admin services are responding.",
};

export const mockDashboard: DashboardData = {
  totals: {
    accounts: mockAccounts.length,
    addresses: mockAccounts.reduce((count, account) => count + account.addresses.length, 0),
    messages: mockMessages.length,
    deliveredToday: 2,
    failedToday: 0,
  },
  mailflow: mockMailflow,
  activity: mockActivity,
  recentMessages: mockMessages,
  system: mockSystemStatus,
};

export function getMockAccountDetail(accountId: string): AccountDetail {
  const account = mockAccounts.find((item) => item.id === accountId);

  if (!account) {
    throw new Error(`Mock account not found: ${accountId}`);
  }

  const messages = mockMessages.filter((message) => message.accountId === accountId);

  return {
    account,
    messages,
    messagesTotal: messages.length,
    messagesLimit: 20,
    messagesOffset: 0,
    activity: mockActivity.filter((item) => item.accountId === accountId),
  };
}

export function searchMockData(query: string): SearchResult {
  const term = query.trim().toLowerCase();

  if (!term) {
    return { accounts: [], messages: [] };
  }

  return {
    accounts: mockAccounts.filter((account) =>
      [account.id, account.displayName, account.ownerEmail, ...account.addresses.map((item) => item.email)]
        .join(" ")
        .toLowerCase()
        .includes(term),
    ),
    messages: mockMessages.filter((message) =>
      [message.from.name, message.from.email, message.subject, message.preview]
        .join(" ")
        .toLowerCase()
        .includes(term),
    ),
  };
}
