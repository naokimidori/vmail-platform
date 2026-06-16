import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, HelpCircle, Loader2, X } from "lucide-react";

import type { MailMessage } from "../api/types";
import { formatDatabaseDateTime } from "../utils/date";
import { extractMessageVerificationCode } from "../utils/verificationCode";
import { Button } from "./ui/button";

const messageDetailOpenDelayMs = 24;
const copyFeedbackDurationMs = 3000;
const emailPreviewSandbox = "allow-popups allow-popups-to-escape-sandbox";

export function useMessageDetailTransition(delayMs = messageDetailOpenDelayMs) {
  const [pendingMessage, setPendingMessage] = useState<MailMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null);
  const openTimerRef = useRef<number | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const openMessage = useCallback(
    (message: MailMessage) => {
      clearOpenTimer();
      setSelectedMessage(null);
      setPendingMessage(message);
      openTimerRef.current = window.setTimeout(() => {
        setSelectedMessage(message);
        setPendingMessage((currentMessage) => (currentMessage?.id === message.id ? null : currentMessage));
        openTimerRef.current = null;
      }, delayMs);
    },
    [clearOpenTimer, delayMs],
  );

  const closeMessage = useCallback(() => {
    clearOpenTimer();
    setPendingMessage(null);
    setSelectedMessage(null);
  }, [clearOpenTimer]);

  useEffect(() => clearOpenTimer, [clearOpenTimer]);

  return { closeMessage, openMessage, pendingMessage, selectedMessage };
}

export function MessageDetailLoading() {
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center px-4 py-6" role="presentation">
      <div
        aria-label="Loading message detail"
        className="inline-flex items-center gap-2 rounded-[16px] border border-white/80 bg-white/75 px-4 py-3 text-sm font-black text-foreground shadow-glass backdrop-blur-xl"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        <span>Loading message...</span>
      </div>
    </div>,
    document.body,
  );
}

export function MessageDetailDialog({ message, onClose }: { message: MailMessage; onClose: () => void }) {
  const [showRawMessage, setShowRawMessage] = useState(false);
  const [showRawTooltip, setShowRawTooltip] = useState(false);
  const {
    isCopied: isVerificationCodeCopied,
    resetCopied: resetVerificationCodeCopied,
    showCopied: showVerificationCodeCopied,
  } = useCopyFeedback();
  const rawMessage = message.rawContent ?? message.preview;
  const previewHtml = useMemo(
    () => (message.htmlContent ? prepareHtmlEmailPreview(message.htmlContent) : undefined),
    [message.htmlContent],
  );
  const verificationCode = useMemo(() => extractMessageVerificationCode(message), [message]);

  useEffect(() => {
    resetVerificationCodeCopied();
  }, [resetVerificationCodeCopied, verificationCode]);

  const copyVerificationCode = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!verificationCode) return;

    if (await copyToClipboard(verificationCode)) {
      showVerificationCodeCopied();
    }
  };

  const overlay = (
    <div
      data-testid="message-detail-overlay"
      className="fixed inset-0 z-50 grid place-items-center bg-[#151a27]/35 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        aria-labelledby="message-detail-title"
        className="flex h-[700px] max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-frame backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2 id="message-detail-title" className="text-xl font-black">
              {message.subject}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {message.from.name} &lt;{message.from.email}&gt; to {message.to.map((item) => item.email).join(", ")}
            </p>
            {message.receivedAt ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Received: {formatDatabaseDateTime(message.receivedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-none items-center gap-1">
            {verificationCode ? (
              <Button
                aria-label={
                  isVerificationCodeCopied ? `Copied code ${verificationCode}` : `Copy code ${verificationCode}`
                }
                className={isVerificationCodeCopied ? "text-primary" : "text-muted-foreground"}
                onClick={copyVerificationCode}
                size="icon"
                title={isVerificationCodeCopied ? `Copied code ${verificationCode}` : `Copy code ${verificationCode}`}
                type="button"
                variant="ghost"
              >
                {isVerificationCodeCopied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            ) : null}
            <div
              className="relative"
              onBlur={() => setShowRawTooltip(false)}
              onFocus={() => setShowRawTooltip(true)}
              onMouseEnter={() => setShowRawTooltip(true)}
              onMouseLeave={() => setShowRawTooltip(false)}
            >
              <Button
                aria-describedby={showRawTooltip ? "raw-message-tooltip" : undefined}
                aria-label="Show raw message"
                className="text-muted-foreground"
                onClick={() => {
                  setShowRawTooltip(false);
                  setShowRawMessage(true);
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
              </Button>
              {showRawTooltip ? (
                <div
                  className="pointer-events-none absolute right-0 top-12 z-[60] whitespace-nowrap rounded-[12px] bg-[#151a27] px-3 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(21,26,39,0.18)]"
                  id="raw-message-tooltip"
                  role="tooltip"
                >
                  Show raw message
                </div>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close message detail" onClick={onClose}>
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5" data-testid="message-detail-body">
          <section>
            {previewHtml ? (
              <iframe
                className="min-h-[620px] w-full rounded-[22px] border border-white/70 bg-white"
                sandbox={emailPreviewSandbox}
                srcDoc={previewHtml}
                title="Email preview"
              />
            ) : (
              <p className="rounded-[22px] bg-white/55 p-4 text-sm leading-6">{message.preview}</p>
            )}
          </section>
        </div>
        <div className="flex-none p-5 pt-0" data-testid="message-detail-footer-spacer" aria-hidden="true" />
        {showRawMessage ? <RawMessageDialog rawMessage={rawMessage} onClose={() => setShowRawMessage(false)} /> : null}
      </article>
    </div>
  );

  return createPortal(overlay, document.body);
}

function RawMessageDialog({ rawMessage, onClose }: { rawMessage: string; onClose: () => void }) {
  const { isCopied: isRawMessageCopied, showCopied: showRawMessageCopied } = useCopyFeedback();

  const copyRawMessage = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (await copyToClipboard(rawMessage)) {
      showRawMessageCopied();
    }
  };

  return (
    <div
      className="absolute inset-0 z-[55] grid place-items-center bg-[#151a27]/28 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <article
        aria-labelledby="raw-message-title"
        aria-modal="true"
        className="flex max-h-[72vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] border border-white/70 bg-card shadow-frame backdrop-blur-xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border p-4">
          <h3 className="text-base font-black" id="raw-message-title">
            Raw message
          </h3>
          <div className="flex flex-none items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isRawMessageCopied ? "Copied raw message" : "Copy raw message"}
              className={isRawMessageCopied ? "text-primary" : "text-muted-foreground"}
              onClick={copyRawMessage}
              title={isRawMessageCopied ? "Copied raw message" : "Copy raw message"}
            >
              {isRawMessageCopied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Close raw message" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <pre className="min-h-0 overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-muted-foreground">
          {rawMessage}
        </pre>
      </article>
    </div>
  );
}

function useCopyFeedback(durationMs = copyFeedbackDurationMs) {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetCopied = useCallback(() => {
    clearTimer();
    setIsCopied(false);
  }, [clearTimer]);

  const showCopied = useCallback(() => {
    clearTimer();
    setIsCopied(true);
    timerRef.current = window.setTimeout(() => {
      setIsCopied(false);
      timerRef.current = null;
    }, durationMs);
  }, [clearTimer, durationMs]);

  useEffect(() => clearTimer, [clearTimer]);

  return { isCopied, resetCopied, showCopied };
}

async function copyToClipboard(value: string) {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function prepareHtmlEmailPreview(html: string) {
  if (typeof DOMParser === "undefined") return html;

  const document = new DOMParser().parseFromString(html, "text/html");
  const head = document.head ?? document.documentElement.insertBefore(document.createElement("head"), document.body);

  head.querySelectorAll("base").forEach((base) => base.remove());
  const base = document.createElement("base");
  base.setAttribute("target", "_blank");
  head.prepend(base);

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (!isSafeEmailLinkHref(href)) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }

    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });

  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

function isSafeEmailLinkHref(href: string) {
  if (!href) return false;

  try {
    const url = new URL(href, "https://email-preview.local");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}
