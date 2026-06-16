import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MailMessage } from "../../admin/api/types";
import { MessageDetailDialog } from "../../admin/components/MessageDetailDialog";

const baseMessage: MailMessage = {
  id: "msg-openai-code",
  accountId: "stephen@example.com",
  addressId: "stephen@example.com",
  from: { name: "ChatGPT", email: "noreply@tm.openai.com" },
  to: [{ name: "Stephen", email: "stephen@example.com" }],
  subject: "Your ChatGPT code",
  preview: "Your code is 863223.",
  direction: "incoming",
  status: "delivered",
  receivedAt: "2026-06-03 08:50:00",
};

describe("MessageDetailDialog", () => {
  it("renders html email previews in a sandboxed iframe", () => {
    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          htmlContent:
            '<html><body><h1>OpenAI</h1><a href="https://example.com/reset">Reset password</a><div>863223</div></body></html>',
        }}
        onClose={vi.fn()}
      />,
    );

    const iframe = screen.getByTitle("Email preview");
    const srcdoc = iframe.getAttribute("srcdoc") ?? "";

    expect(iframe).toHaveAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
    expect(iframe).toHaveAttribute("srcdoc", expect.stringContaining("<h1>OpenAI</h1>"));
    expect(srcdoc).toContain('<base target="_blank">');
    expect(srcdoc).toContain('href="https://example.com/reset"');
    expect(srcdoc).toContain('target="_blank"');
    expect(srcdoc).toContain('rel="noopener noreferrer"');
  });

  it("removes unsafe html email link protocols before rendering previews", () => {
    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          htmlContent:
            '<html><body><a href="javascript:alert(1)">Unsafe</a><a href="mailto:hello@example.com">Email us</a></body></html>',
        }}
        onClose={vi.fn()}
      />,
    );

    const srcdoc = screen.getByTitle("Email preview").getAttribute("srcdoc") ?? "";

    expect(srcdoc).not.toContain("javascript:alert");
    expect(srcdoc).toContain('href="mailto:hello@example.com"');
  });

  it("keeps metadata in the header and lets only the message body scroll", () => {
    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          htmlContent: "<html><body><h1>OpenAI</h1><div>863223</div></body></html>",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Your ChatGPT code" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Your ChatGPT code" })).toHaveClass("h-[700px]");
    expect(screen.getByText(/Received:/)).toHaveClass("mt-2", "text-sm", "text-muted-foreground");
    expect(screen.getByText("Received: 2026/6/3 16:50:00")).toBeInTheDocument();
    expect(screen.getByText(/Received:/)).not.toHaveClass("font-bold");
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("message-detail-body")).toHaveClass("overflow-y-auto", "p-5");
    expect(screen.getByTestId("message-detail-body")).not.toHaveClass("pb-10");
    expect(screen.getByTestId("message-detail-footer-spacer")).toHaveClass("flex-none", "p-5", "pt-0");
    expect(screen.getByTitle("Email preview")).toHaveClass("min-h-[620px]");
  });

  it("portals the viewport overlay to the document body", () => {
    const { container } = render(
      <div data-testid="filtered-page-frame">
        <MessageDetailDialog message={baseMessage} onClose={vi.fn()} />
      </div>,
    );

    const overlay = screen.getByTestId("message-detail-overlay");

    expect(container).not.toContainElement(overlay);
    expect(overlay.parentElement).toBe(document.body);
  });

  it("copies a detected verification code from the header", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          rawContent:
            "From: ChatGPT <noreply@tm.openai.com>\nTo: stephen@example.com\nSubject: Your ChatGPT code\n\nYour code is 863223.",
        }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy code 863223" }));

    expect(writeText).toHaveBeenCalledWith("863223");
  });

  it("detects verification codes from decoded html email content", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          subject: "你的临时 OpenAI 登录代码",
          preview: "输入此临时验证码以继续：",
          rawContent:
            "Subject: =?UTF-8?B?5L2g55qE5Li05pe2IE9wZW5BSSDnmbvlvZXku6PnoIE=?=\nContent-Transfer-Encoding: quoted-printable\n\n=E8=BE=93=E5=85=A5=E6=AD=A4=E4=B8=B4=E6=97=B6=E9=AA=8C=E8=AF=81=E7=A0=81=E4=BB=A5=E7=BB=A7=E7=BB=AD=EF=BC=9A\n<p>387171</p>",
          htmlContent:
            "<html><body><p>输入此临时验证码以继续：</p><p>387171</p><p>未请求验证码？你可以忽略此邮件。</p></body></html>",
        }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy code 387171" }));

    expect(writeText).toHaveBeenCalledWith("387171");
  });

  it("hides the verification code action when no code is detected", () => {
    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          subject: "Monthly newsletter",
          preview: "Your account summary is ready. Order 123456 was delivered on 2026-06-03.",
          rawContent:
            "From: Example <hello@example.com>\nTo: stephen@example.com\nSubject: Monthly newsletter\n\nYour account summary is ready. Order 123456 was delivered on 2026-06-03.",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Copy code/i })).not.toBeInTheDocument();
  });

  it("shows a raw message tooltip and opens raw message in a dialog", async () => {
    const user = userEvent.setup();

    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          rawContent:
            "From: ChatGPT <noreply@tm.openai.com>\nTo: stephen@example.com\nSubject: Your ChatGPT code\n\nYour code is 863223.",
        }}
        onClose={vi.fn()}
      />,
    );

    const rawButton = screen.getByRole("button", { name: "Show raw message" });

    expect(screen.queryByRole("tooltip", { name: "Show raw message" })).not.toBeInTheDocument();
    expect(screen.queryByText(/From: ChatGPT/)).not.toBeInTheDocument();

    await user.hover(rawButton);

    expect(screen.getByRole("tooltip", { name: "Show raw message" })).toBeVisible();

    await user.click(rawButton);

    expect(screen.getByRole("dialog", { name: "Raw message" })).toBeInTheDocument();
    expect(screen.getByText(/From: ChatGPT/)).toBeVisible();
  });

  it("copies raw message from the raw message dialog", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    const rawContent =
      "From: ChatGPT <noreply@tm.openai.com>\nTo: stephen@example.com\nSubject: Your ChatGPT code\n\nYour code is 863223.";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MessageDetailDialog
        message={{
          ...baseMessage,
          rawContent,
        }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show raw message" }));
    await user.click(screen.getByRole("button", { name: "Copy raw message" }));

    expect(writeText).toHaveBeenCalledWith(rawContent);
    expect(screen.getByRole("button", { name: "Copied raw message" })).toBeInTheDocument();
  });

  it("restores the raw message copy button after copied feedback", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const rawContent =
      "From: ChatGPT <noreply@tm.openai.com>\nTo: stephen@example.com\nSubject: Your ChatGPT code\n\nYour code is 863223.";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(
        <MessageDetailDialog
          message={{
            ...baseMessage,
            rawContent,
          }}
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Show raw message" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy raw message" }));
      });

      expect(screen.getByRole("button", { name: "Copied raw message" })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByRole("button", { name: "Copy raw message" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
