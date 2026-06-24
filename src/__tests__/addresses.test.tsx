import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { writeUserSession } from "../auth/userAuth";

const listAddresses = vi.fn();
const createAndBindAddress = vi.fn();
const getAddressToken = vi.fn();

vi.mock("../api/userClient", () => ({
  createUserClient: () => ({
    listAddresses,
    createAndBindAddress,
    getAddressToken,
  }),
}));

vi.mock("../config/env", () => ({
  apiBaseUrl: "mock",
  mailboxDomain: "example.com",
  mailboxDomains: ["example.com", "vino.cc.cd", "vinoss.us.ci"],
  publicMailboxUrl: "https://mail.example.com",
}));

describe("addresses", () => {
  beforeEach(() => {
    window.localStorage.clear();
    writeUserSession({ email: "me@example.com", token: "user-jwt" });
    listAddresses.mockReset();
    listAddresses.mockResolvedValue([{ id: "7", email: "demo@example.com", mailCount: 3, sendCount: 0, createdAt: null, updatedAt: null }]);
    createAndBindAddress.mockReset();
    getAddressToken.mockResolvedValue("address-jwt");
  });

  it("shows bound mailbox addresses", async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(await screen.findByText("demo@example.com")).toBeInTheDocument();
    expect(screen.getByText("3 mails")).toBeInTheDocument();
  });

  it("creates and binds a new mailbox address", async () => {
    createAndBindAddress.mockResolvedValue({ id: "8", email: "new@example.com", addressToken: "created-address-jwt" });
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "New mailbox" }));
    await user.type(screen.getByLabelText("Mailbox name"), "new");
    await user.selectOptions(screen.getByLabelText("Mailbox domain"), "vino.cc.cd");
    await user.click(screen.getByRole("button", { name: "Create mailbox" }));

    await waitFor(() =>
      expect(createAndBindAddress).toHaveBeenCalledWith({ name: "new", domain: "vino.cc.cd", enableRandomSubdomain: false }),
    );
    expect(listAddresses).toHaveBeenCalledTimes(2);
  });
});
