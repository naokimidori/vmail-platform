import {
  getMockAccountDetail,
  mockAccounts,
  mockDashboard,
  mockSystemStatus,
  searchMockData,
} from "./mockData";
import { mailboxDomain } from "../../config/env";
import type {
  AccountDetail,
  AdminAccount,
  AdminUserSettings,
  DashboardData,
  DashboardTotals,
  MailMessage,
  PaginatedResult,
  SearchResult,
  SystemStatus,
} from "./types";

export interface AdminClientOptions {
  baseUrl: string;
  getCredential?: () => string | null | undefined;
  fetcher?: typeof fetch;
}

export interface AdminClient {
  getStatus(): Promise<SystemStatus>;
  getDashboard(): Promise<DashboardData>;
  listAccountsPage(options?: PaginationOptions): Promise<PaginatedResult<AdminAccount>>;
  listAccounts(): Promise<AdminAccount[]>;
  getAccount(email: string, options?: PaginationOptions): Promise<AccountDetail>;
  createAddress(input: CreateAddressInput): Promise<AdminAccount>;
  deleteAddress(addressId: string): Promise<void>;
  getAddressAccessJwt(addressId: string): Promise<string>;
  search(query: string): Promise<SearchResult>;
  getUserSettings(): Promise<AdminUserSettings>;
  updateUserSettings(settings: AdminUserSettings): Promise<void>;
}

export interface CreateAddressInput {
  prefix: string;
  domain?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  query?: string;
}

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export function createAdminClient(options: AdminClientOptions): AdminClient {
  if (options.baseUrl === "mock") {
    return createMockClient();
  }

  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const accountCache = new Map<string, AdminAccount>();
  let lastLatencyMs: number | null = null;

  async function request<T>(
    path: string,
    requestOptions: { method?: "GET" | "DELETE" | "POST"; body?: unknown } = {},
  ): Promise<T> {
    const credential = options.getCredential?.();
    const method = requestOptions.method ?? "GET";
    const headers: Record<string, string> = {};

    if (credential) {
      headers["x-admin-auth"] = credential;
    }

    if (requestOptions.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const start = nowMs();
    const response = await fetcher(`${baseUrl}${path}`, {
      method,
      headers,
      ...(requestOptions.body !== undefined ? { body: JSON.stringify(requestOptions.body) } : {}),
    });

    if (!response.ok) {
      throw new AdminApiError(response.status, await getErrorMessage(response));
    }

    const data = (await response.json()) as T;
    lastLatencyMs = Math.round(nowMs() - start);
    return data;
  }

  async function listLiveAccountsPage(pagination: PaginationOptions = {}): Promise<PaginatedResult<AdminAccount>> {
    const limit = pagination.limit ?? 100;
    const offset = pagination.offset ?? 0;
    const term = pagination.query?.trim().toLowerCase() ?? "";

    if (term) {
      const allAddresses = await listSearchableAddressAccounts();
      const filtered = allAddresses.filter((account) => accountMatchesQuery(account, term));
      const items = filtered.slice(offset, offset + limit);
      cacheAccounts(accountCache, items);
      return {
        items,
        total: filtered.length,
        limit,
        offset,
      };
    }

    const query = `limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
    const users = normalizeAccountsPage(await request<unknown>(`/admin/users?${query}`), limit, offset);
    if (users.items.length > 0) {
      cacheAccounts(accountCache, users.items);
      return users;
    }

    const addresses = normalizeAddressAccountsPage(await request<unknown>(`/admin/address?${query}`), limit, offset);
    cacheAccounts(accountCache, addresses.items);
    return addresses;
  }

  async function listSearchableAddressAccounts(): Promise<AdminAccount[]> {
    const searchLimit = 100;
    let searchOffset = 0;
    const accounts: AdminAccount[] = [];

    for (let guard = 0; guard < 100; guard += 1) {
      const query = `limit=${encodeURIComponent(searchLimit)}&offset=${encodeURIComponent(searchOffset)}`;
      const page = normalizeAddressAccountsPage(await request<unknown>(`/admin/address?${query}`), searchLimit, searchOffset);

      if (page.items.length === 0) break;

      accounts.push(...page.items);
      searchOffset += page.items.length;

      if (page.total > 0 && searchOffset >= page.total) break;
      if (page.items.length < searchLimit) break;
    }

    cacheAccounts(accountCache, accounts);
    return accounts;
  }

  async function listLiveAccounts(pagination?: PaginationOptions): Promise<AdminAccount[]> {
    return (await listLiveAccountsPage(pagination)).items;
  }

  async function listMessagesPage(options: { limit?: number; offset?: number; address?: string; query?: string } = {}) {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (options.address) params.set("address", options.address);
    if (options.query) params.set("q", options.query);

    return normalizeMessagesPage(await request<unknown>(`/admin/mails?${params.toString()}`), {
      ...options,
      limit,
      offset,
    });
  }

  async function listMessages(options: { limit?: number; offset?: number; address?: string; query?: string } = {}) {
    return (await listMessagesPage(options)).items;
  }

  return {
    getStatus: async () => normalizeStatus(await request<unknown>("/admin/statistics"), lastLatencyMs),
    getDashboard: async () => normalizeDashboard(await request<Partial<DashboardData>>("/admin/statistics"), lastLatencyMs),
    listAccountsPage: listLiveAccountsPage,
    listAccounts: listLiveAccounts,
    getAccount: async (email: string, pagination: PaginationOptions = {}) => {
      const accounts = accountCache.size > 0 ? Array.from(accountCache.values()) : await listLiveAccounts();
      const account = accounts.find((item) => item.ownerEmail === email) ?? accounts.find((item) => item.id === email);
      if (!account) {
        throw new AdminApiError(404, "Account not found");
      }
      const messages = await listMessagesPage({
        address: account.ownerEmail,
        limit: pagination.limit ?? 20,
        offset: pagination.offset ?? 0,
      });
      return {
        account,
        messages: messages.items,
        messagesTotal: messages.total,
        messagesLimit: messages.limit,
        messagesOffset: messages.offset,
        activity: [],
      };
    },
    createAddress: async (input: CreateAddressInput) => {
      const prefix = normalizeAddressPrefix(input.prefix);
      const domain = input.domain ?? mailboxDomain;
      const account = normalizeAddressAccount(await request<unknown>("/admin/new_address", {
        method: "POST",
        body: {
          name: prefix,
          domain,
          enablePrefix: false,
          enableRandomSubdomain: false,
        },
      }), 0);
      accountCache.set(account.id, account);
      return account;
    },
    deleteAddress: async (addressId: string) => {
      await request<unknown>(`/admin/delete_address/${encodeURIComponent(addressId)}`, { method: "DELETE" });
      accountCache.delete(addressId);
    },
    getAddressAccessJwt: async (addressId: string) => {
      return normalizeAccessJwt(await request<unknown>(`/admin/show_password/${encodeURIComponent(addressId)}`));
    },
    getUserSettings: async () => normalizeAdminUserSettings(await request<unknown>("/admin/user_settings")),
    updateUserSettings: async (settings) => {
      await request<unknown>("/admin/user_settings", {
        method: "POST",
        body: {
          ...settings.apiSettings,
          enable: settings.registrationEnabled,
          enableMailVerify: settings.mailVerificationEnabled,
        },
      });
    },
    search: async (query: string) => {
      const term = query.trim().toLowerCase();
      if (!term) return { accounts: [], messages: [] };
      const accounts = await listLiveAccounts({ limit: 100, offset: 0 });
      const filteredAccounts = accounts.filter((account) =>
        [account.id, account.displayName, account.ownerEmail, ...account.addresses.map((address) => address.email)]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
      const messageBatches = await Promise.all([
        listMessages({ query: term }),
        ...filteredAccounts.slice(0, 5).map((account) => listMessages({ address: account.ownerEmail })),
      ]);
      const messages = uniqueMessages(messageBatches.flat());
      return {
        accounts: filteredAccounts,
        messages: messages.filter((message) =>
          [message.from.name, message.from.email, message.subject, message.preview, ...message.to.map((item) => item.email)]
            .join(" ")
            .toLowerCase()
            .includes(term),
        ),
      };
    },
  };
}

function createMockClient(): AdminClient {
  let accounts = clone(mockAccounts);

  return {
    getStatus: async () => clone(mockSystemStatus),
    getDashboard: async () => clone(mockDashboard),
    listAccountsPage: async (options = {}) => {
      const limit = options.limit ?? accounts.length;
      const offset = options.offset ?? 0;
      const term = options.query?.trim().toLowerCase() ?? "";
      const visibleAccounts = term ? accounts.filter((account) => accountMatchesQuery(account, term)) : accounts;
      return {
        items: clone(visibleAccounts.slice(offset, offset + limit)),
        total: visibleAccounts.length,
        limit,
        offset,
      };
    },
    listAccounts: async () => clone(accounts),
    getAccount: async (email: string, pagination: PaginationOptions = {}) => {
      const account = accounts.find((item) => item.ownerEmail === email) ?? accounts.find((item) => item.id === email);
      const isBuiltInMockAccount = mockAccounts.some((item) => item.ownerEmail === email || item.id === email);
      const detail = account && !isBuiltInMockAccount
        ? {
            account: clone(account),
            messages: [],
            messagesTotal: 0,
            messagesLimit: 20,
            messagesOffset: 0,
            activity: [],
          }
        : clone(getMockAccountDetail(email));
      const limit = pagination.limit ?? 20;
      const offset = pagination.offset ?? 0;
      return {
        ...detail,
        messages: detail.messages.slice(offset, offset + limit),
        messagesLimit: limit,
        messagesOffset: offset,
      };
    },
    createAddress: async (input: CreateAddressInput) => {
      const prefix = normalizeAddressPrefix(input.prefix);
      const email = buildAddressEmail(prefix, input.domain);
      const createdAt = new Date().toISOString();
      const account: AdminAccount = {
        id: `mock-${prefix}`,
        displayName: email,
        ownerEmail: email,
        status: "active",
        addresses: [
          {
            id: `mock-${prefix}`,
            email,
            label: email,
            isPrimary: true,
            createdAt,
          },
        ],
        createdAt,
        lastActiveAt: createdAt,
        messageCount: 0,
      };
      accounts = [account, ...accounts];
      return clone(account);
    },
    deleteAddress: async () => undefined,
    getAddressAccessJwt: async (addressId: string) => `mock-access-token-${addressId}`,
    getUserSettings: async () => ({
      registrationEnabled: true,
      mailVerificationEnabled: true,
      apiSettings: {
        enable: true,
        enableMailVerify: true,
        verifyMailSender: `verify@${mailboxDomain}`,
        maxAddressCount: 5,
      },
    }),
    updateUserSettings: async () => undefined,
    search: async (query: string) => clone(searchMockData(query)),
  };
}

function normalizeAddressPrefix(prefix: string) {
  return prefix.trim().toLowerCase();
}

function buildAddressEmail(prefix: string, domain = mailboxDomain) {
  return `${prefix}@${domain}`;
}

function normalizeDashboard(
  data: Partial<DashboardData> | Record<string, unknown>,
  fallbackLatencyMs: number | null = null,
): DashboardData {
  const record = isRecord(data) ? data : {};
  const dashboard = data as Partial<DashboardData>;

  return {
    totals: normalizeTotals(isRecord(data.totals) ? data.totals : record),
    mailflow: Array.isArray(dashboard.mailflow) ? dashboard.mailflow : createMailflow(record),
    activity: Array.isArray(dashboard.activity) ? dashboard.activity : [],
    recentMessages: Array.isArray(dashboard.recentMessages) ? dashboard.recentMessages : [],
    system: (isSystemStatus(dashboard.system) ? dashboard.system : undefined) ?? normalizeStatus(data, fallbackLatencyMs),
  };
}

function normalizeStatus(data: unknown, fallbackLatencyMs: number | null = null): SystemStatus {
  const record = isRecord(data) ? data : {};
  return {
    status: "healthy",
    checkedAt: new Date().toISOString(),
    latencyMs: typeof record.latencyMs === "number" ? record.latencyMs : fallbackLatencyMs,
    message: "Admin statistics endpoint is reachable.",
  };
}

function normalizeAccounts(data: unknown): AdminAccount[] {
  return getList(data, "users").map((item, index) => normalizeAccount(item, index));
}

function normalizeAddressAccounts(data: unknown): AdminAccount[] {
  return getList(data).map((item, index) => normalizeAddressAccount(item, index));
}

function normalizeAccountsPage(data: unknown, limit: number, offset: number): PaginatedResult<AdminAccount> {
  const items = normalizeAccounts(data);
  return {
    items,
    total: getCount(data, items.length),
    limit,
    offset,
  };
}

function normalizeAddressAccountsPage(data: unknown, limit: number, offset: number): PaginatedResult<AdminAccount> {
  const items = normalizeAddressAccounts(data);
  return {
    items,
    total: getCount(data, items.length),
    limit,
    offset,
  };
}

function normalizeMessages(data: unknown, options: { address?: string }): MailMessage[] {
  return normalizeMessagesPage(data, { ...options, limit: getList(data).length, offset: 0 }).items;
}

function normalizeMessagesPage(data: unknown, options: { address?: string; limit: number; offset: number }): PaginatedResult<MailMessage> {
  const items = getList(data)
    .map((item, index) => normalizeMessage(item, index))
    .filter((message) => {
      if (!options.address) return true;
      return message.to.some((item) => item.email.toLowerCase() === options.address?.toLowerCase());
    });

  return {
    items,
    total: getCount(data, items.length),
    limit: options.limit,
    offset: options.offset,
  };
}

function normalizeAccount(item: unknown, index: number): AdminAccount {
  const record = isRecord(item) ? item : {};
  const id = idValue(record.id) ?? idValue(record.user_id) ?? idValue(record.userId) ?? `account-${index + 1}`;
  const ownerEmail =
    stringValue(record.ownerEmail) ??
    stringValue(record.email) ??
    stringValue(record.user_email) ??
    stringValue(record.userEmail) ??
    `${id}@${mailboxDomain}`;
  const displayName =
    stringValue(record.displayName) ??
    stringValue(record.name) ??
    stringValue(record.user_name) ??
    ownerEmail.split("@")[0] ??
    id;

  return {
    id,
    displayName,
    ownerEmail,
    status: record.status === "paused" || record.status === "locked" ? record.status : "active",
    addresses: Array.isArray(record.addresses) ? record.addresses.map((address, addressIndex) => normalizeAddress(address, id, addressIndex)) : [],
    createdAt: stringValue(record.createdAt) ?? stringValue(record.created_at) ?? "",
    lastActiveAt: stringValue(record.lastActiveAt) ?? stringValue(record.last_active_at) ?? "",
    messageCount: numberValue(record.messageCount) ?? numberValue(record.message_count) ?? 0,
  };
}

function normalizeAddressAccount(item: unknown, index: number): AdminAccount {
  const record = isRecord(item) ? item : {};
  const id = idValue(record.id) ?? idValue(record.address_id) ?? idValue(record.addressId) ?? `address-${index + 1}`;
  const email = stringValue(record.name) ?? stringValue(record.email) ?? stringValue(record.address) ?? `${id}@${mailboxDomain}`;
  const createdAt = stringValue(record.created_at) ?? stringValue(record.createdAt) ?? "";
  const updatedAt = stringValue(record.updated_at) ?? stringValue(record.updatedAt) ?? createdAt;

  return {
    id,
    displayName: email,
    ownerEmail: email,
    status: "active",
    addresses: [
      {
        id,
        email,
        label: stringValue(record.source_meta) ?? email,
        isPrimary: true,
        createdAt,
      },
    ],
    createdAt,
    lastActiveAt: updatedAt,
    messageCount: numberValue(record.mail_count) ?? numberValue(record.messageCount) ?? 0,
  };
}

function normalizeAccessJwt(data: unknown) {
  const jwt = isRecord(data) ? stringValue(data.jwt) : undefined;
  if (!jwt) {
    throw new AdminApiError(502, "Access token was missing from the admin response.");
  }

  return jwt;
}

function normalizeAdminUserSettings(data: unknown): AdminUserSettings {
  const record = isRecord(data) ? data : {};
  return {
    registrationEnabled: Boolean(record.enable),
    mailVerificationEnabled: Boolean(record.enableMailVerify),
    apiSettings: { ...record },
  };
}

function normalizeAddress(item: unknown, accountId: string, index: number) {
  const record = isRecord(item) ? item : {};
  const email = stringValue(record.email) ?? stringValue(record.address) ?? `${accountId}-${index + 1}@${mailboxDomain}`;
  return {
    id: idValue(record.id) ?? idValue(record.address_id) ?? `${accountId}-address-${index + 1}`,
    email,
    label: stringValue(record.label) ?? email,
    isPrimary: Boolean(record.isPrimary ?? record.is_primary ?? index === 0),
    createdAt: stringValue(record.createdAt) ?? stringValue(record.created_at) ?? "",
  };
}

function normalizeMessage(item: unknown, index: number): MailMessage {
  const record = isRecord(item) ? item : {};
  const raw = stringValue(record.raw) ?? "";
  const headers = parseRawHeaders(raw);
  const address = stringValue(record.address) ?? firstEmail(headers.to ?? "") ?? "";
  const from = parseContact(headers.from ?? stringValue(record.source) ?? "Unknown");
  const to = parseContacts(headers.to ?? address);
  const subject = decodeMimeHeader(headers.subject ?? stringValue(record.subject) ?? "(No subject)");
  const receivedAt = stringValue(record.created_at) ?? stringValue(record.createdAt) ?? stringValue(record.receivedAt) ?? "";

  return {
    id: idValue(record.id) ?? idValue(record.message_id) ?? `message-${index + 1}`,
    accountId: address,
    addressId: address,
    from,
    to,
    subject,
    preview: buildPreview(raw),
    direction: "incoming",
    status: "delivered",
    receivedAt,
    rawContent: raw,
    htmlContent: extractHtmlContent(raw),
  };
}

function uniqueMessages(messages: MailMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

function accountMatchesQuery(account: AdminAccount, term: string) {
  return [
    account.id,
    account.displayName,
    account.ownerEmail,
    account.status,
    ...account.addresses.flatMap((address) => [address.id, address.email, address.label]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

function normalizeTotals(totals: Record<string, unknown> | undefined): DashboardTotals {
  const record = totals && isRecord(totals) ? totals : {};
  const userCount = numberValue(record.userCount);
  const addressCount = numberValue(record.addressCount);

  return {
    accounts: numberValue(record.accounts) ?? (userCount && userCount > 0 ? userCount : addressCount) ?? userCount ?? null,
    addresses: numberValue(record.addresses) ?? addressCount ?? null,
    messages: numberValue(record.messages) ?? numberValue(record.mailCount) ?? null,
    deliveredToday: numberValue(record.deliveredToday) ?? null,
    failedToday: numberValue(record.failedToday) ?? null,
  };
}

function createMailflow(data: Record<string, unknown>) {
  const messages = numberValue(data.mailCount) ?? 0;
  const sent = numberValue(data.sendMailCount) ?? 0;

  return messages > 0 || sent > 0
    ? [
        {
          timestamp: new Date().toISOString(),
          delivered: messages,
          failed: 0,
        },
      ]
    : [];
}

async function getErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (text.trim()) {
    try {
      const body = JSON.parse(text) as { error?: unknown; message?: unknown };
      const message = body.error ?? body.message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      return text.trim();
    }
  }

  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = body.error ?? body.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Ignore malformed error bodies and fall back to the HTTP status text.
  }

  return response.statusText || `Request failed with status ${response.status}`;
}

function cacheAccounts(cache: Map<string, AdminAccount>, accounts: AdminAccount[]) {
  accounts.forEach((account) => cache.set(account.id, account));
}

function getList(data: unknown, alternateKey?: string): unknown[] {
  return Array.isArray(data)
    ? data
    : isRecord(data) && alternateKey && Array.isArray(data[alternateKey])
      ? data[alternateKey]
      : isRecord(data) && Array.isArray(data.results)
        ? data.results
        : [];
}

function getCount(data: unknown, fallback: number) {
  return isRecord(data) && typeof data.count === "number" ? data.count : fallback;
}

function parseRawHeaders(raw: string): Record<string, string> {
  const { headersText } = splitMessage(raw);
  return parseHeaderText(headersText);
}

function parseHeaderText(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let current = "";

  for (const line of headerText.split(/\r?\n/)) {
    if (/^\s/.test(line) && current) {
      headers[current] = `${headers[current]} ${line.trim()}`;
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) continue;
    current = line.slice(0, separator).trim().toLowerCase();
    headers[current] = line.slice(separator + 1).trim();
  }

  return headers;
}

function parseContacts(value: string) {
  return value
    .split(",")
    .map(parseContact)
    .filter((contact) => contact.email);
}

function parseContact(value: string) {
  const decoded = decodeMimeHeader(value.trim());
  const match = decoded.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "") || match[2].trim();
    return { name, email: match[2].trim() };
  }

  const email = firstEmail(decoded) ?? decoded;
  return { name: email, email };
}

function firstEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function decodeMimeHeader(value: string) {
  return value
    .replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, encoded: string) => decodeBase64Utf8(encoded))
    .replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, encoded: string) =>
      decodeQuotedPrintableUtf8(encoded.replace(/_/g, " ")),
    );
}

function buildPreview(raw: string) {
  const body = (extractTextContent(raw) ?? extractHtmlContent(raw) ?? splitMessage(raw).body) || raw;
  return decodeQuotedPrintableUtf8(body)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function extractHtmlContent(raw: string): string | undefined {
  return extractMimeContent(raw, "text/html");
}

function extractTextContent(raw: string): string | undefined {
  return extractMimeContent(raw, "text/plain");
}

function extractMimeContent(raw: string, mimeType: string): string | undefined {
  const { headersText, body } = splitMessage(raw);
  const headers = parseHeaderText(headersText);
  const contentType = headers["content-type"] ?? "";
  const normalizedType = contentType.toLowerCase();

  if (normalizedType.includes("multipart/")) {
    const boundary = getBoundary(contentType);
    if (!boundary) return undefined;

    for (const part of splitMimeParts(body, boundary)) {
      const found = extractMimeContent(part, mimeType);
      if (found) return found;
    }

    return undefined;
  }

  if (!normalizedType.includes(mimeType)) return undefined;

  const decoded = decodeTransferBody(body, headers["content-transfer-encoding"]);
  return mimeType === "text/html" ? sanitizeHtml(decoded) : decoded;
}

function splitMessage(raw: string) {
  const match = raw.match(/\r?\n\r?\n/);
  if (!match || match.index === undefined) {
    return { headersText: raw, body: "" };
  }

  const bodyStart = match.index + match[0].length;
  return {
    headersText: raw.slice(0, match.index),
    body: raw.slice(bodyStart),
  };
}

function getBoundary(contentType: string) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match?.[1] ?? match?.[2];
}

function splitMimeParts(body: string, boundary: string) {
  return body
    .split(`--${boundary}`)
    .map((part) => part.replace(/^\r?\n/, "").replace(/\r?\n$/, ""))
    .filter((part) => part.trim() && part.trim() !== "--" && !part.trim().startsWith("--"));
}

function decodeTransferBody(body: string, encoding: string | undefined) {
  const normalizedEncoding = encoding?.toLowerCase().trim();
  if (normalizedEncoding === "base64") {
    return decodeBase64Utf8(body.replace(/\s+/g, ""));
  }

  if (normalizedEncoding === "quoted-printable") {
    return decodeQuotedPrintableUtf8(body);
  }

  return body;
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "");
}

function decodeBase64Utf8(encoded: string) {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)));
  } catch {
    return encoded;
  }
}

function decodeQuotedPrintableUtf8(value: string) {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === "=" && /^[0-9A-F]{2}$/i.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }

    const char = normalized[index];
    const encoded = new TextEncoder().encode(char);
    bytes.push(...encoded);
  }

  return new TextDecoder().decode(Uint8Array.from(bytes));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function isSystemStatus(value: unknown): value is SystemStatus {
  return (
    isRecord(value) &&
    (value.status === "healthy" || value.status === "degraded" || value.status === "offline") &&
    typeof value.checkedAt === "string" &&
    (typeof value.latencyMs === "number" || value.latencyMs === null) &&
    typeof value.message === "string"
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function idValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return stringValue(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
