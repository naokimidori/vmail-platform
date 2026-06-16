import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { UserAuthProvider, useUserAuth } from "../auth/UserAuthContext";
import { clearUserSession, readUserSession, writeUserSession } from "../auth/userAuth";

function Probe() {
  const auth = useUserAuth();
  return (
    <div>
      <span data-testid="status">{auth.isAuthenticated ? "in" : "out"}</span>
      <span data-testid="email">{auth.email ?? "none"}</span>
      <button onClick={() => auth.login({ email: "me@example.com", token: "jwt" })}>login</button>
      <button onClick={auth.logout}>logout</button>
    </div>
  );
}

describe("user auth", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores and clears a user session", () => {
    writeUserSession({ email: "me@example.com", token: "jwt" });
    expect(readUserSession()).toEqual({ email: "me@example.com", token: "jwt" });

    clearUserSession();
    expect(readUserSession()).toBeNull();
  });

  it("updates auth context when logging in and out", async () => {
    const user = userEvent.setup();
    render(
      <UserAuthProvider>
        <Probe />
      </UserAuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("out");
    await user.click(screen.getByRole("button", { name: "login" }));
    expect(screen.getByTestId("status")).toHaveTextContent("in");
    expect(screen.getByTestId("email")).toHaveTextContent("me@example.com");

    await user.click(screen.getByRole("button", { name: "logout" }));
    expect(screen.getByTestId("status")).toHaveTextContent("out");
  });
});
