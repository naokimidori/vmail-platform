import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { ADMIN_CREDENTIAL_STORAGE_KEY } from "../admin/auth/adminAuth";
import { USER_EMAIL_STORAGE_KEY, USER_TOKEN_STORAGE_KEY } from "../auth/userAuth";

vi.mock("../config/env", () => ({
  apiBaseUrl: "mock",
  mailboxDomain: "example.com",
  mailboxDomains: ["example.com", "vino.cc.cd", "vinoss.us.ci"],
  publicMailboxUrl: "https://mail.example.com",
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("combined user and admin routing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("serves the user login at the root path when no user session exists", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "V-Mail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /admin access/i, hidden: true })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /go to admin access/i })).toHaveAttribute("href", "/admin");
  });

  it("serves the admin login at /admin without requiring a user session", () => {
    renderAt("/admin");

    expect(screen.getByRole("heading", { name: "Mail console." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Super admin access" })).toBeInTheDocument();
    expect(screen.getByLabelText("Admin password")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Log in to V-Mail" })).not.toBeInTheDocument();
  });

  it("keeps /admin behind admin auth even when a normal user session exists", () => {
    window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, "person@example.com");
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, "user-jwt");

    renderAt("/admin/accounts");

    expect(screen.getByRole("heading", { name: "Super admin access" })).toBeInTheDocument();
    expect(screen.getByLabelText("Admin password")).toBeInTheDocument();
    expect(screen.queryByText("User Account")).not.toBeInTheDocument();
  });

  it("renders the admin shell under /admin when an admin credential exists", async () => {
    window.sessionStorage.setItem(ADMIN_CREDENTIAL_STORAGE_KEY, "admin-secret");

    renderAt("/admin");

    expect(await screen.findByText("V-Mail Mailbox")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/i })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /Accounts/i })).toHaveAttribute("href", "/admin/accounts");
  });

  it("does not treat an admin credential as a user login for user routes", () => {
    window.sessionStorage.setItem(ADMIN_CREDENTIAL_STORAGE_KEY, "admin-secret");

    renderAt("/");

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText("User Account")).not.toBeInTheDocument();
  });
});
