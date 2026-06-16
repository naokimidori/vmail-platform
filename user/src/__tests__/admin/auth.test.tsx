import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from "../../admin/auth/adminAuth";
import { AdminAuthProvider, useAdminAuth } from "../../admin/auth/AdminAuthContext";

describe("admin auth storage", () => {
  it("reads, writes, and clears the admin credential with injectable storage", () => {
    const storage = createMemoryStorage();

    expect(readAdminCredential(storage)).toBeNull();

    writeAdminCredential("admin-secret", storage);
    expect(readAdminCredential(storage)).toBe("admin-secret");
    expect(storage.getItem("v-mail-admin-credential")).toBe("admin-secret");

    clearAdminCredential(storage);
    expect(readAdminCredential(storage)).toBeNull();
  });
});

describe("AdminAuthProvider", () => {
  it("hydrates from session storage and exposes authenticated state", () => {
    sessionStorage.setItem("v-mail-admin-credential", "stored-secret");

    render(
      <AdminAuthProvider>
        <AuthStatus />
      </AdminAuthProvider>,
    );

    expect(screen.getByTestId("credential").textContent).toBe("stored-secret");
    expect(screen.getByTestId("is-authenticated").textContent).toBe("yes");
  });

  it("trims login credentials and logs out by clearing state and storage", async () => {
    const user = userEvent.setup();

    render(
      <AdminAuthProvider>
        <AuthStatus />
      </AdminAuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("credential").textContent).toBe("admin-secret");
    expect(screen.getByTestId("is-authenticated").textContent).toBe("yes");
    expect(sessionStorage.getItem("v-mail-admin-credential")).toBe("admin-secret");

    await user.click(screen.getByRole("button", { name: "logout" }));

    expect(screen.getByTestId("credential").textContent).toBe("none");
    expect(screen.getByTestId("is-authenticated").textContent).toBe("no");
    expect(sessionStorage.getItem("v-mail-admin-credential")).toBeNull();
  });

  it("clears credentials when login receives only whitespace", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("v-mail-admin-credential", "stored-secret");

    render(
      <AdminAuthProvider>
        <AuthStatus />
      </AdminAuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: "empty login" }));

    expect(screen.getByTestId("credential").textContent).toBe("none");
    expect(screen.getByTestId("is-authenticated").textContent).toBe("no");
    expect(sessionStorage.getItem("v-mail-admin-credential")).toBeNull();
  });
});

function AuthStatus() {
  const { credential, isAuthenticated, login, logout } = useAdminAuth();

  return (
    <div>
      <p data-testid="credential">{credential ?? "none"}</p>
      <p data-testid="is-authenticated">{isAuthenticated ? "yes" : "no"}</p>
      <button type="button" onClick={() => login("  admin-secret  ")}>
        login
      </button>
      <button type="button" onClick={() => login("   ")}>
        empty login
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
}

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
  };
}
