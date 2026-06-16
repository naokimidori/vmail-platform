import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { writeUserSession } from "../auth/userAuth";

const listAddresses = vi.fn();
const listMails = vi.fn();
const getAddressToken = vi.fn();
const getParsedMessage = vi.fn();

vi.mock("../api/userClient", () => ({
  createUserClient: () => ({
    listAddresses,
    listMails,
    getAddressToken,
    getParsedMessage,
  }),
}));

describe("inbox", () => {
  beforeEach(() => {
    window.localStorage.clear();
    writeUserSession({ email: "me@example.com", token: "user-jwt" });
    listAddresses.mockReset();
    listMails.mockReset();
    getAddressToken.mockReset();
    getParsedMessage.mockReset();
    listAddresses.mockResolvedValue([{ id: "7", email: "demo@example.com", mailCount: 1, sendCount: 0, createdAt: null, updatedAt: null }]);
    listMails.mockResolvedValue({ items: [{ id: "99", address: "demo@example.com", raw: "Subject: Code\r\n\r\nYour code is 123456.", createdAt: null }], total: 1, limit: 20, offset: 0 });
    getAddressToken.mockResolvedValue("address-jwt");
    getParsedMessage.mockResolvedValue({ id: "99", subject: "Code", text: "Your code is 123456.", html: "", from: "", to: "", createdAt: null });
  });

  it("loads mailbox messages for the selected address", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("link", { name: "Inbox" }));
    expect(await screen.findByText("demo@example.com")).toBeInTheDocument();
    expect(await screen.findByText("Code")).toBeInTheDocument();
    expect(listMails).toHaveBeenCalledWith({ address: "demo@example.com", limit: 20, offset: 0 });
  });

  it("opens parsed message detail with an address token", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("link", { name: "Inbox" }));
    await user.click(await screen.findByRole("button", { name: "Open Code" }));

    await waitFor(() => expect(getAddressToken).toHaveBeenCalledWith("7"));
    expect(getParsedMessage).toHaveBeenCalledWith("99", "address-jwt");
    expect(await screen.findByRole("dialog", { name: "Code" })).toBeInTheDocument();
  });
});
