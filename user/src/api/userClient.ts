import type {
  BoundAddress,
  CreateAddressInput,
  CreatedAddress,
  LoginInput,
  OpenSettings,
  PaginatedResult,
  ParsedMail,
  PublicSettings,
  RawMail,
  RegisterInput,
  UserSession,
  UserSettings,
  VerifyCodeInput,
  VerifyCodeResult,
} from "./types";

export interface UserClientOptions {
  baseUrl: string;
  getUserToken?: () => string | null | undefined;
  fetcher?: typeof fetch;
}

export interface UserClient {
  getOpenSettings(): Promise<OpenSettings>;
  getPublicSettings(): Promise<PublicSettings>;
  verifyCode(input: VerifyCodeInput): Promise<VerifyCodeResult>;
  register(input: RegisterInput): Promise<void>;
  login(input: LoginInput): Promise<UserSession>;
  getSettings(): Promise<UserSettings>;
  listAddresses(): Promise<BoundAddress[]>;
  getAddressToken(addressId: string): Promise<string>;
  createAndBindAddress(input: CreateAddressInput): Promise<CreatedAddress>;
  listMails(options?: { address?: string; limit?: number; offset?: number }): Promise<PaginatedResult<RawMail>>;
  getParsedMessage(mailId: string, addressToken: string): Promise<ParsedMail>;
}

export class UserApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "UserApiError";
    this.status = status;
  }
}

export function createUserClient(options: UserClientOptions): UserClient {
  if (options.baseUrl === "mock") {
    return createMockUserClient();
  }

  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function request<T>(
    path: string,
    requestOptions: {
      method?: "GET" | "POST" | "DELETE";
      body?: unknown;
      userAuth?: boolean;
      addressToken?: string;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    const method = requestOptions.method ?? "GET";

    if (requestOptions.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    if (requestOptions.userAuth) {
      const token = options.getUserToken?.();
      if (token) headers["x-user-token"] = token;
    }

    if (requestOptions.addressToken) {
      headers.authorization = `Bearer ${requestOptions.addressToken}`;
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      method,
      headers,
      ...(requestOptions.body !== undefined ? { body: JSON.stringify(requestOptions.body) } : {}),
    });

    if (!response.ok) {
      throw new UserApiError(response.status, await getErrorMessage(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    getOpenSettings: async () => normalizeOpenSettings(await request<unknown>("/user_api/open_settings")),
    getPublicSettings: async () => normalizePublicSettings(await request<unknown>("/open_api/settings")),
    verifyCode: async (input) => {
      return normalizeVerifyCodeResult(await request<unknown>("/user_api/verify_code", {
        method: "POST",
        body: { email: input.email, cf_token: input.cfToken },
      }));
    },
    register: async (input) => {
      await request<unknown>("/user_api/register", {
        method: "POST",
        body: { email: input.email, password: input.password, code: input.code, cf_token: input.cfToken },
      });
    },
    login: async (input) => {
      const data = await request<unknown>("/user_api/login", {
        method: "POST",
        body: { email: input.email, password: input.password, cf_token: input.cfToken },
      });
      return normalizeSession(data);
    },
    getSettings: async () => normalizeUserSettings(await request<unknown>("/user_api/settings", { userAuth: true })),
    listAddresses: async () => normalizeBoundAddresses(await request<unknown>("/user_api/bind_address", { userAuth: true })),
    getAddressToken: async (addressId) => {
      const data = await request<unknown>(`/user_api/bind_address_jwt/${encodeURIComponent(addressId)}`, { userAuth: true });
      const token = isRecord(data) ? stringValue(data.jwt) : undefined;
      if (!token) throw new UserApiError(502, "Address token was missing from the response.");
      return token;
    },
    createAndBindAddress: async (input) => {
      const created = normalizeCreatedAddress(
        await request<unknown>("/api/new_address", {
          method: "POST",
          userAuth: true,
          body: {
            name: input.name,
            domain: input.domain,
            cf_token: input.cfToken,
            enableRandomSubdomain: input.enableRandomSubdomain,
          },
        }),
      );
      await request<unknown>("/user_api/bind_address", {
        method: "POST",
        userAuth: true,
        addressToken: created.addressToken,
      });
      return created;
    },
    listMails: async (options = {}) => {
      const limit = options.limit ?? 20;
      const offset = options.offset ?? 0;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (options.address) params.set("address", options.address);
      return normalizeRawMailPage(await request<unknown>(`/user_api/mails?${params.toString()}`, { userAuth: true }), limit, offset);
    },
    getParsedMessage: async (mailId, addressToken) =>
      normalizeParsedMail(
        await request<unknown>(`/api/parsed_mail/${encodeURIComponent(mailId)}`, {
          addressToken,
        }),
      ),
  };
}

async function getErrorMessage(response: Response) {
  const text = await response.text();
  if (text.trim()) return text.trim();
  return `Request failed with status ${response.status}`;
}

function normalizeOpenSettings(data: unknown): OpenSettings {
  const record = isRecord(data) ? data : {};
  return {
    registrationEnabled: Boolean(record.enable),
    mailVerificationEnabled: Boolean(record.enableMailVerify),
    oauthProviders: Array.isArray(record.oauth2ClientIDs)
      ? record.oauth2ClientIDs
          .map((item) => ({
            clientID: stringValue(isRecord(item) ? item.clientID : undefined) ?? "",
            name: stringValue(isRecord(item) ? item.name : undefined) ?? "",
            icon: stringValue(isRecord(item) ? item.icon : undefined),
          }))
          .filter((item) => item.clientID && item.name)
      : [],
  };
}

function normalizePublicSettings(data: unknown): PublicSettings {
  const record = isRecord(data) ? data : {};
  return {
    cfTurnstileSiteKey: stringValue(record.cfTurnstileSiteKey) ?? null,
    globalTurnstileEnabled: Boolean(record.enableGlobalTurnstileCheck),
  };
}

function normalizeVerifyCodeResult(data: unknown): VerifyCodeResult {
  const record = isRecord(data) ? data : {};
  return {
    success: record.success !== false,
    expirationTtl: numberValue(record.expirationTtl) ?? null,
  };
}

function normalizeSession(data: unknown): UserSession {
  const token = isRecord(data) ? stringValue(data.jwt) : undefined;
  if (!token) throw new UserApiError(502, "User token was missing from the response.");
  return { token };
}

function normalizeUserSettings(data: unknown): UserSettings {
  const record = isRecord(data) ? data : {};
  const role = isRecord(record.user_role) ? stringValue(record.user_role.role) : stringValue(record.user_role);
  return {
    userEmail: stringValue(record.user_email) ?? "",
    userId: String(record.user_id ?? ""),
    role: role ?? null,
    isAdmin: Boolean(record.is_admin),
    accessToken: stringValue(record.access_token) ?? null,
    refreshedUserToken: stringValue(record.new_user_token) ?? null,
  };
}

function normalizeBoundAddresses(data: unknown): BoundAddress[] {
  const rows = isRecord(data) && Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
  return rows
    .filter(isRecord)
    .map((record) => ({
      id: String(record.id ?? record.address_id ?? ""),
      email: stringValue(record.name) ?? stringValue(record.address) ?? stringValue(record.email) ?? "",
      mailCount: numberValue(record.mail_count) ?? 0,
      sendCount: numberValue(record.send_count) ?? 0,
      createdAt: stringValue(record.created_at) ?? null,
      updatedAt: stringValue(record.updated_at) ?? null,
    }))
    .filter((item) => item.id && item.email);
}

function normalizeCreatedAddress(data: unknown): CreatedAddress {
  const record = isRecord(data) ? data : {};
  const id = String(record.address_id ?? record.id ?? "");
  const email = stringValue(record.address) ?? stringValue(record.name) ?? stringValue(record.email);
  const addressToken = stringValue(record.jwt);
  if (!id || !email || !addressToken) {
    throw new UserApiError(502, "Created mailbox response was missing id, address, or token.");
  }
  return { id, email, addressToken };
}

function normalizeRawMailPage(data: unknown, limit: number, offset: number): PaginatedResult<RawMail> {
  const rows = isRecord(data) && Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
  const total = isRecord(data) ? numberValue(data.count) ?? rows.length : rows.length;
  return {
    items: rows
      .filter(isRecord)
      .map((record) => ({
        id: String(record.id ?? ""),
        address: stringValue(record.address) ?? "",
        raw: stringValue(record.raw) ?? stringValue(record.raw_mail) ?? stringValue(record.message) ?? "",
        createdAt: stringValue(record.created_at) ?? null,
      }))
      .filter((item) => item.id),
    total,
    limit,
    offset,
  };
}

function normalizeParsedMail(data: unknown): ParsedMail {
  const record = isRecord(data) ? data : {};
  return {
    id: String(record.id ?? record.mail_id ?? ""),
    subject: stringValue(record.subject) ?? "(no subject)",
    text: stringValue(record.text) ?? "",
    html: stringValue(record.html) ?? "",
    from: stringValue(record.from) ?? "",
    to: stringValue(record.to) ?? "",
    createdAt: stringValue(record.created_at) ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function createMockUserClient(): UserClient {
  const addresses: BoundAddress[] = [
    {
      id: "addr-demo",
      email: "demo@example.com",
      mailCount: 1,
      sendCount: 0,
      createdAt: "2026-06-12T08:00:00Z",
      updatedAt: "2026-06-12T08:30:00Z",
    },
  ];
  const mails: RawMail[] = [
    {
      id: "mail-demo",
      address: "demo@example.com",
      raw: "Subject: Welcome to V-Mail\r\n\r\nYour demo inbox is ready.",
      createdAt: "2026-06-12T08:30:00Z",
    },
  ];

  return {
    getOpenSettings: async () => ({ registrationEnabled: true, mailVerificationEnabled: true, oauthProviders: [] }),
    getPublicSettings: async () => ({ cfTurnstileSiteKey: null, globalTurnstileEnabled: false }),
    verifyCode: async () => ({ success: true, expirationTtl: 300 }),
    register: async () => undefined,
    login: async () => ({ token: "mock-user-token" }),
    getSettings: async () => ({
      userEmail: "demo@example.com",
      userId: "1",
      role: "demo",
      isAdmin: false,
      accessToken: null,
      refreshedUserToken: null,
    }),
    listAddresses: async () => addresses.map((address) => ({ ...address })),
    getAddressToken: async () => "mock-address-token",
    createAndBindAddress: async (input) => {
      const name = input.name?.trim() || "random";
      const address = {
        id: `addr-${name}`,
        email: `${name}@${input.domain}`,
        mailCount: 0,
        sendCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addresses.unshift(address);
      return { id: address.id, email: address.email, addressToken: "mock-address-token" };
    },
    listMails: async (options = {}) => {
      const limit = options.limit ?? 20;
      const offset = options.offset ?? 0;
      const filtered = options.address ? mails.filter((mail) => mail.address === options.address) : mails;
      return { items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
    },
    getParsedMessage: async (mailId) => ({
      id: mailId,
      subject: "Welcome to V-Mail",
      text: "Your demo inbox is ready.",
      html: "<p>Your demo inbox is ready.</p>",
      from: "V-Mail <noreply@example.com>",
      to: "demo@example.com",
      createdAt: "2026-06-12T08:30:00Z",
    }),
  };
}
