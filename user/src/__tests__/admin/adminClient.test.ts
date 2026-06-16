import { describe, expect, it, vi } from "vitest";

import { AdminApiError, createAdminClient } from "../../admin/api/adminClient";

describe("createAdminClient", () => {
  it("returns deterministic mock data without calling fetch", async () => {
    const fetcher = vi.fn();
    const client = createAdminClient({ baseUrl: "mock", fetcher });

    const [accounts, dashboard, account] = await Promise.all([
      client.listAccounts(),
      client.getDashboard(),
      client.getAccount("team-a"),
    ]);

    expect(fetcher).not.toHaveBeenCalled();
    expect(accounts.map((item) => item.id)).toEqual(["team-a", "ops-bot", "personal"]);
    expect(accounts.flatMap((item) => item.addresses.map((address) => address.email))).toEqual(
      expect.arrayContaining([
        "team-a@mail.example.com",
        "ops-bot@mail.example.com",
        "personal@mail.example.com",
      ]),
    );
    expect(dashboard.recentMessages.map((message) => message.from.name)).toEqual([
      "OpenAI",
      "GitHub",
      "Cloudflare",
    ]);
    expect(account.account.id).toBe("team-a");
  });

  it("attaches x-admin-auth when a credential exists", async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: "team-a", addresses: [] }]));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test/api",
      getCredential: () => "secret-token",
      fetcher,
    });

    await client.listAccounts();

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/api/admin/users?limit=100&offset=0",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-admin-auth": "secret-token" }),
      }),
    );
  });

  it("throws AdminApiError with status when the server returns 401", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: "Unauthorized" }, 401));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    await expect(client.getStatus()).rejects.toMatchObject({
      name: "AdminApiError",
      status: 401,
    });
    await expect(client.getStatus()).rejects.toBeInstanceOf(AdminApiError);
  });

  it("uses the real upstream statistics endpoint for admin validation", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ total: 3 }));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    await client.getStatus();

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/admin/statistics",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-admin-auth": "secret-token" }),
      }),
    );
  });

  it("deletes an address through the admin delete endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    await client.deleteAddress("516");

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/admin/delete_address/516",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "x-admin-auth": "secret-token" }),
      }),
    );
  });

  it("requests an address access jwt through the admin show password endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ jwt: "signed-token" }));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    const jwt = await client.getAddressAccessJwt("addr 516");

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/admin/show_password/addr%20516",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-admin-auth": "secret-token" }),
      }),
    );
    expect(jwt).toBe("signed-token");
  });

  it("creates an address through the admin new address endpoint", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        address_id: 517,
        address: "support@example.com",
        jwt: "signed-token",
      }),
    );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    const account = await client.createAddress({ prefix: "support" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/admin/new_address",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-admin-auth": "secret-token",
        }),
        body: JSON.stringify({
          name: "support",
          domain: "example.com",
          enablePrefix: false,
          enableRandomSubdomain: false,
        }),
      }),
    );
    expect(account).toEqual(
      expect.objectContaining({
        id: "517",
        ownerEmail: "support@example.com",
        messageCount: 0,
      }),
    );
  });

  it("loads user registration settings from the admin endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      enable: true,
      enableMailVerify: false,
      verifyMailSender: "verify@example.com",
      maxAddressCount: 5,
    }));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    const settings = await client.getUserSettings();

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/admin/user_settings",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-admin-auth": "secret-token" }),
      }),
    );
    expect(settings).toEqual({
      registrationEnabled: true,
      mailVerificationEnabled: false,
      apiSettings: expect.objectContaining({
        verifyMailSender: "verify@example.com",
        maxAddressCount: 5,
      }),
    });
  });

  it("saves user registration settings without dropping hidden upstream fields", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    await client.updateUserSettings({
      registrationEnabled: true,
      mailVerificationEnabled: true,
      apiSettings: {
        verifyMailSender: "verify@example.com",
        maxAddressCount: 5,
      },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.example.test/admin/user_settings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-admin-auth": "secret-token",
        }),
        body: JSON.stringify({
          verifyMailSender: "verify@example.com",
          maxAddressCount: 5,
          enable: true,
          enableMailVerify: true,
        }),
      }),
    );
  });

  it("surfaces plain text admin API errors", async () => {
    const fetcher = vi.fn(async () => textResponse("Enable KV to use mail verification.", 403));
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      getCredential: () => "secret-token",
      fetcher,
    });

    await expect(client.updateUserSettings({
      registrationEnabled: true,
      mailVerificationEnabled: true,
      apiSettings: {},
    })).rejects.toMatchObject({
      message: "Enable KV to use mail verification.",
      status: 403,
    });
  });

  it("normalizes missing dashboard totals to null", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        totals: {
          accounts: 3,
        },
        mailflow: [],
        activity: [],
        recentMessages: [],
        system: {
          status: "healthy",
          checkedAt: "2026-06-03T00:00:00.000Z",
          latencyMs: 12,
          message: "OK",
        },
      }),
    );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const dashboard = await client.getDashboard();

    expect(dashboard.totals).toEqual({
      accounts: 3,
      addresses: null,
      messages: null,
      deliveredToday: null,
      failedToday: null,
    });
  });

  it("normalizes the Cloudflare Temp Email statistics shape", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        mailCount: 969,
        addressCount: 515,
        activeAddressCount7days: 8,
        activeAddressCount30days: 94,
        userCount: 0,
        sendMailCount: 0,
      }),
    );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const dashboard = await client.getDashboard();

    expect(dashboard.totals).toEqual({
      accounts: 515,
      addresses: 515,
      messages: 969,
      deliveredToday: null,
      failedToday: null,
    });
    expect(dashboard.mailflow).toHaveLength(1);
  });

  it("falls back to admin address records when the upstream has no users", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 516,
              name: "stephen@example.com",
              source_meta: "45.134.217.55",
              created_at: "2026-05-29 06:11:53",
              updated_at: "2026-05-29 06:33:52",
              mail_count: 7,
              send_count: 0,
            },
          ],
          count: 515,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const accounts = await client.listAccounts();

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://admin.example.test/admin/address?limit=100&offset=0",
      expect.objectContaining({ method: "GET" }),
    );
    expect(accounts).toEqual([
      expect.objectContaining({
        id: "516",
        displayName: "stephen@example.com",
        ownerEmail: "stephen@example.com",
        messageCount: 7,
        addresses: [
          expect.objectContaining({
            email: "stephen@example.com",
            label: "45.134.217.55",
          }),
        ],
      }),
    ]);
  });

  it("requests address pages with caller-provided pagination", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 514,
              name: "jiangmu@example.com",
              source_meta: "1.160.33.165",
              created_at: "2026-05-29 02:22:48",
              updated_at: "2026-06-03 07:02:16",
              mail_count: 5,
            },
          ],
          count: 515,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const page = await client.listAccountsPage({ limit: 25, offset: 50 });

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://admin.example.test/admin/address?limit=25&offset=50",
      expect.objectContaining({ method: "GET" }),
    );
    expect(page.total).toBe(515);
    expect(page.items[0]).toEqual(expect.objectContaining({ id: "514" }));
  });

  it("searches address accounts across address pages when the upstream ignores query params", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `first-${index + 1}@example.com`,
      mail_count: 1,
    }));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          results: firstPage,
          count: 101,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 2,
              name: "target@example.com",
              mail_count: 3,
            },
          ],
          count: 2,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const page = await client.listAccountsPage({ limit: 20, offset: 0, query: "target" });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://admin.example.test/admin/address?limit=100&offset=0",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://admin.example.test/admin/address?limit=100&offset=100",
      expect.objectContaining({ method: "GET" }),
    );
    expect(page.items).toEqual([expect.objectContaining({ ownerEmail: "target@example.com" })]);
    expect(page.total).toBe(1);
  });

  it("loads account detail messages from the admin mails endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 516,
              name: "stephen@example.com",
              source_meta: "45.134.217.55",
              created_at: "2026-05-29 06:11:53",
              updated_at: "2026-05-29 06:33:52",
              mail_count: 7,
            },
          ],
          count: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 971,
              source: "news@nvidia.com",
              address: "stephen@example.com",
              raw: "From: NVIDIA GTC <news@nvidia.com>\r\nTo: stephen@example.com\r\nSubject: GTC Taipei keynote recap\r\n\r\nUseful AI has arrived.",
              created_at: "2026-06-03 20:14:36",
            },
          ],
          count: 7,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const detail = await client.getAccount("516");

    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://admin.example.test/admin/mails?limit=20&offset=0&address=stephen%40example.com",
      expect.objectContaining({ method: "GET" }),
    );
    expect(detail.messages).toEqual([
      expect.objectContaining({
        id: "971",
        subject: "GTC Taipei keynote recap",
        preview: "Useful AI has arrived.",
        from: { name: "NVIDIA GTC", email: "news@nvidia.com" },
      }),
    ]);
  });

  it("decodes utf-8 quoted-printable previews and MIME Q encoded subjects", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 516,
              name: "stephen@example.com",
              mail_count: 1,
            },
          ],
          count: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 901,
              source: "service@paypal.com",
              address: "stephen@example.com",
              raw:
                "From: PayPal <service@paypal.com>\r\nTo: stephen@example.com\r\nSubject: =?UTF-8?Q?You=E2=80=99ve_added_another_way_to_log_in_to_PayPal?=\r\n\r\nYou=E2=80=99ve added another way to log in to PayPal.\r\n=E4=BD=A0=E5=A5=BD",
              created_at: "2026-06-03 20:14:36",
            },
          ],
          count: 1,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const detail = await client.getAccount("516");

    expect(detail.messages[0]).toEqual(
      expect.objectContaining({
        subject: "You’ve added another way to log in to PayPal",
        preview: "You’ve added another way to log in to PayPal. 你好",
      }),
    );
  });

  it("extracts decoded html content from multipart email bodies", async () => {
    const raw =
      'From: ChatGPT <noreply@tm.openai.com>\r\nTo: stephen@example.com\r\nSubject: Your ChatGPT code\r\nContent-Type: multipart/alternative; boundary="mail-boundary"\r\n\r\n--mail-boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nYour code is 863223.\r\n--mail-boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n<html><body><h1>OpenAI</h1><div style=3D"font-size:48px">863223</div><script>alert("x")</script></body></html>\r\n--mail-boundary--';
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 516, name: "stephen@example.com", mail_count: 1 }], count: 1 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 902,
              source: "noreply@tm.openai.com",
              address: "stephen@example.com",
              raw,
              created_at: "2026-06-03 20:14:36",
            },
          ],
          count: 1,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const detail = await client.getAccount("516");

    expect(detail.messages[0]).toEqual(
      expect.objectContaining({
        htmlContent: expect.stringContaining("<h1>OpenAI</h1>"),
      }),
    );
    expect(detail.messages[0].htmlContent).toContain('style="font-size:48px"');
    expect(detail.messages[0].htmlContent).not.toContain("<script>");
  });

  it("searches live accounts and messages through admin endpoints", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 516,
              name: "stephen@example.com",
              mail_count: 7,
            },
          ],
          count: 515,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 971,
              source: "news@nvidia.com",
              address: "stephen@example.com",
              raw: "From: NVIDIA GTC <news@nvidia.com>\r\nTo: stephen@example.com\r\nSubject: GTC Taipei keynote recap\r\n\r\nUseful AI has arrived.",
              created_at: "2026-06-03 20:14:36",
            },
          ],
          count: 1,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const result = await client.search("nvidia");

    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://admin.example.test/admin/mails?limit=20&offset=0&q=nvidia",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.accounts).toHaveLength(0);
    expect(result.messages[0]).toEqual(expect.objectContaining({ subject: "GTC Taipei keynote recap" }));
  });

  it("searches address-specific messages when the query matches an account address", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 516,
              name: "stephen@example.com",
              mail_count: 7,
            },
          ],
          count: 515,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ results: [], count: 971 }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: 900,
              source: "service@paypal.com",
              address: "stephen@example.com",
              raw: "From: PayPal <service@paypal.com>\r\nTo: stephen@example.com\r\nSubject: Login from a new device\r\n\r\nA new device logged into your PayPal account.",
              created_at: "2026-05-29 06:33:52",
            },
          ],
          count: 7,
        }),
      );
    const client = createAdminClient({
      baseUrl: "https://admin.example.test",
      fetcher,
    });

    const result = await client.search("stephen@example.com");

    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "https://admin.example.test/admin/mails?limit=20&offset=0&address=stephen%40example.com",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.messages).toEqual([
      expect.objectContaining({
        subject: "Login from a new device",
        to: [expect.objectContaining({ email: "stephen@example.com" })],
      }),
    ]);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}
