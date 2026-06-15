import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const login = vi.fn();
const register = vi.fn();
const verifyCode = vi.fn();
const getOpenSettings = vi.fn();
const getPublicSettings = vi.fn();
const listAddresses = vi.fn();

vi.mock("../api/userClient", () => ({
  createUserClient: () => ({
    getOpenSettings,
    getPublicSettings,
    login,
    register,
    verifyCode,
    listAddresses,
  }),
}));

describe("login and registration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    login.mockReset();
    register.mockReset();
    verifyCode.mockReset();
    listAddresses.mockReset();
    listAddresses.mockResolvedValue([]);
    getOpenSettings.mockReset();
    getOpenSettings.mockResolvedValue({
      registrationEnabled: true,
      mailVerificationEnabled: true,
      oauthProviders: [],
    });
    getPublicSettings.mockReset();
    getPublicSettings.mockResolvedValue({
      cfTurnstileSiteKey: null,
      globalTurnstileEnabled: false,
    });
  });

  it("logs in and opens the protected portal", async () => {
    login.mockResolvedValue({ token: "user-jwt" });
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: "me@example.com", password: "secret123" }));
    expect(await screen.findByText("Mailbox accounts")).toBeInTheDocument();
  });

  it("sends a verification code and registers a user", async () => {
    verifyCode.mockResolvedValue({ success: true, expirationTtl: 300 });
    register.mockResolvedValue(undefined);
    login.mockResolvedValue({ token: "registered-jwt" });
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("link", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith({ email: "new@example.com" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Verification code sent. Check your email.");

    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({ email: "new@example.com", password: "secret123", code: "123456" }),
    );
    expect(login).toHaveBeenCalledWith({ email: "new@example.com", password: "secret123" });
  });

  it("does not submit registration when requesting a verification code", async () => {
    verifyCode.mockResolvedValue({ success: true, expirationTtl: 300 });
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("link", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith({ email: "new@example.com" }));
    expect(register).not.toHaveBeenCalled();
    const alert = screen.queryByRole("alert");
    if (alert) {
      expect(alert).not.toHaveTextContent("Enter the verification code.");
    }
    expect(await screen.findByRole("status")).toHaveTextContent("Verification code sent. Check your email.");
  });
});
