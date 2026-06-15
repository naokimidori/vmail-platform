import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { readUserSession, writeUserSession } from "../auth/userAuth";

const getSettings = vi.fn();
const listAddresses = vi.fn();

vi.mock("../api/userClient", () => ({
  createUserClient: () => ({ getSettings, listAddresses }),
}));

describe("settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    writeUserSession({ email: "me@example.com", token: "old-user-jwt" });
    listAddresses.mockReset();
    listAddresses.mockResolvedValue([]);
    getSettings.mockReset();
    getSettings.mockResolvedValue({
      userEmail: "me@example.com",
      userId: "42",
      role: "free",
      isAdmin: false,
      accessToken: null,
      refreshedUserToken: "new-user-jwt",
    });
  });

  it("shows user settings and refreshes the stored token", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("link", { name: "Settings" }));
    expect(await screen.findByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
    await waitFor(() => expect(readUserSession()?.token).toBe("new-user-jwt"));
  });
});
