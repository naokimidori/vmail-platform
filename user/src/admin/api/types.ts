export type AccountStatus = "active" | "paused" | "locked";

export type MessageDirection = "incoming" | "outgoing";

export type MessageStatus = "delivered" | "queued" | "failed";

export type SystemHealth = "healthy" | "degraded" | "offline";

export interface MailboxAddress {
  id: string;
  email: string;
  label: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface AdminAccount {
  id: string;
  displayName: string;
  ownerEmail: string;
  status: AccountStatus;
  addresses: MailboxAddress[];
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
}

export interface MailMessageContact {
  name: string;
  email: string;
}

export interface MailMessage {
  id: string;
  accountId: string;
  addressId: string;
  from: MailMessageContact;
  to: MailMessageContact[];
  subject: string;
  preview: string;
  direction: MessageDirection;
  status: MessageStatus;
  receivedAt: string;
  rawContent?: string;
  htmlContent?: string;
}

export interface ActivityItem {
  id: string;
  accountId: string;
  type: "message.received" | "message.failed" | "account.created" | "address.created";
  title: string;
  description: string;
  createdAt: string;
}

export interface DashboardTotals {
  accounts: number | null;
  addresses: number | null;
  messages: number | null;
  deliveredToday: number | null;
  failedToday: number | null;
}

export interface MailflowPoint {
  timestamp: string;
  delivered: number;
  failed: number;
}

export interface SystemStatus {
  status: SystemHealth;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
}

export interface DashboardData {
  totals: DashboardTotals;
  mailflow: MailflowPoint[];
  activity: ActivityItem[];
  recentMessages: MailMessage[];
  system: SystemStatus;
}

export interface AccountDetail {
  account: AdminAccount;
  messages: MailMessage[];
  messagesTotal: number;
  messagesLimit: number;
  messagesOffset: number;
  activity: ActivityItem[];
}

export interface SearchResult {
  accounts: AdminAccount[];
  messages: MailMessage[];
}

export interface AdminUserSettings {
  registrationEnabled: boolean;
  mailVerificationEnabled: boolean;
  apiSettings: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
