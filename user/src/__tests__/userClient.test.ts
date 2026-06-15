import { describe, expect, it, vi } from "vitest";

import { UserApiError, createUserClient } from "../api/userClient";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createUserClient", () => {
  it("loads open registration settings", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ enable: true, enableMailVerify: true, oauth2ClientIDs: [{ clientID: "github", name: "GitHub" }] }),
    );
    const client = createUserClient({ baseUrl: "https://email.example.test", fetcher });

    await expect(client.getOpenSettings()).resolves.toEqual({
      registrationEnabled: true,
      mailVerificationEnabled: true,
      oauthProviders: [{ clientID: "github", name: "GitHub" }],
    });
    expect(fetcher).toHaveBeenCalledWith("https://email.example.test/user_api/open_settings", expect.objectContaining({ method: "GET" }));
  });

  it("logs in and normalizes the returned user token", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ jwt: "user-jwt" }));
    const client = createUserClient({ baseUrl: "https://email.example.test", fetcher });

    await expect(client.login({ email: "me@example.com", password: "secret123" })).resolves.toEqual({ token: "user-jwt" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://email.example.test/user_api/login",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
        body: JSON.stringify({ email: "me@example.com", password: "secret123", cf_token: undefined }),
      }),
    );
  });

  it("attaches x-user-token to authenticated user endpoints", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ results: [{ id: 7, name: "demo@example.com", mail_count: 3, send_count: 0 }] }));
    const client = createUserClient({
      baseUrl: "https://email.example.test",
      fetcher,
      getUserToken: () => "user-jwt",
    });

    await expect(client.listAddresses()).resolves.toEqual([
      expect.objectContaining({ id: "7", email: "demo@example.com", mailCount: 3, sendCount: 0 }),
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://email.example.test/user_api/bind_address",
      expect.objectContaining({ headers: expect.objectContaining({ "x-user-token": "user-jwt" }) }),
    );
  });

  it("creates a mailbox and binds it with the address token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ address_id: 9, address: "new@example.com", jwt: "address-jwt" }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    const client = createUserClient({
      baseUrl: "https://email.example.test",
      fetcher,
      getUserToken: () => "user-jwt",
    });

    await expect(client.createAndBindAddress({ name: "new", domain: "example.com" })).resolves.toEqual({
      id: "9",
      email: "new@example.com",
      addressToken: "address-jwt",
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://email.example.test/api/new_address",
      expect.objectContaining({ headers: expect.objectContaining({ "x-user-token": "user-jwt" }) }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://email.example.test/user_api/bind_address",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-user-token": "user-jwt",
          authorization: "Bearer address-jwt",
        }),
      }),
    );
  });

  it("uses address bearer auth for parsed message detail", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: 12, subject: "Code", text: "123456", html: "<strong>123456</strong>" }));
    const client = createUserClient({ baseUrl: "https://email.example.test", fetcher });

    await expect(client.getParsedMessage("12", "address-jwt")).resolves.toEqual(
      expect.objectContaining({ id: "12", subject: "Code", text: "123456", html: "<strong>123456</strong>" }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://email.example.test/api/parsed_mail/12",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer address-jwt" }) }),
    );
  });

  it("throws UserApiError with response text", async () => {
    const fetcher = vi.fn(async () => new Response("Invalid email or password", { status: 400 }));
    const client = createUserClient({ baseUrl: "https://email.example.test", fetcher });

    await expect(client.login({ email: "me@example.com", password: "bad" })).rejects.toMatchObject({
      name: "UserApiError",
      status: 400,
      message: "Invalid email or password",
    });
  });

  it("supports mock mode for local development", async () => {
    const client = createUserClient({ baseUrl: "mock" });

    await expect(client.login({ email: "demo@example.com", password: "demo" })).resolves.toEqual({ token: "mock-user-token" });
    await expect(client.listAddresses()).resolves.toEqual([
      expect.objectContaining({ id: "addr-demo", email: "demo@example.com", mailCount: 1 }),
    ]);
    await expect(client.listMails({ address: "demo@example.com" })).resolves.toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ id: "mail-demo" })], total: 1 }),
    );
  });
});
