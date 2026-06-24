import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code, Copy, Loader2, X } from "lucide-react";

import type { MailMessage } from "../api/types";
import { formatDatabaseDateTime } from "../utils/date";
import { extractMessageVerificationCode } from "../utils/verificationCode";
import { Button } from "./ui/button";

const messageDetailOpenDelayMs = 24;
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
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-soft"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <span>Loading message...</span>
      </div>
    </div>,
    document.body,
  );
}

export function MessageDetailDialog({ message, onClose }: { message: MailMessage; onClose: () => void }) {
  const [showRawMessage, setShowRawMessage] = useState(false);
  const [codeCopyState, setCodeCopyState] = useState<"idle" | "copied" | "error">("idle");
  const rawMessage = message.rawContent ?? message.preview;
  const previewHtml = useMemo(
    () => (message.htmlContent ? prepareHtmlEmailPreview(message.htmlContent) : undefined),
    [message.htmlContent],
  );
  const verificationCode = useMemo(() => extractMessageVerificationCode(message), [message]);

  useEffect(() => {
    setCodeCopyState("idle");
  }, [verificationCode]);

  useEffect(() => {
    if (codeCopyState === "idle") return undefined;
    const timer = window.setTimeout(() => setCodeCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [codeCopyState]);

  const copyVerificationCode = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!verificationCode) return;

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(verificationCode);
      setCodeCopyState("copied");
    } catch {
      setCodeCopyState("error");
    }
  };

  const isCodeCopied = codeCopyState === "copied";
  const isCodeError = codeCopyState === "error";

  const overlay = (
    <div
      data-testid="message-detail-overlay"
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        aria-labelledby="message-detail-title"
        className="flex h-[700px] max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-frame"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="message-detail-title" className="text-base font-semibold text-foreground">
                {message.subject}
              </h2>
              {verificationCode ? (
                <Button
                  aria-label={isCodeCopied ? `Copied ${verificationCode}` : `Copy code ${verificationCode}`}
                  className={[
                    "h-7 flex-none gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors duration-150",
                    isCodeCopied
                      ? "bg-success/15 text-success hover:bg-success/15"
                      : isCodeError
                        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border border-accent/20 bg-accent/10 text-accent hover:bg-accent/15",
                  ].join(" ")}
                  onClick={copyVerificationCode}
                  size="sm"
                  title={isCodeCopied ? "Copied" : `Copy code ${verificationCode}`}
                  type="button"
                  variant="secondary"
                >
                  <span className="font-mono">{verificationCode}</span>
                  {isCodeCopied ? (
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="truncate">
                {message.from.name} &lt;{message.from.email}&gt;
              </span>
              <span className="flex-none text-muted-foreground/60">to</span>
              <span className="truncate">
                {message.to.map((item) => item.email).join(", ")}
              </span>
            </div>
            {message.receivedAt ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatDatabaseDateTime(message.receivedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-none items-center gap-1">
            <Button
              aria-label="Show raw message"
              className="h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setShowRawMessage(true)}
              size="icon"
              title="View raw message source"
              type="button"
              variant="ghost"
            >
              <Code className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              className="h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close message detail"
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 overflow-y-auto" data-testid="message-detail-body">
          <section>
            {previewHtml ? (
              <iframe
                className="min-h-[620px] w-full border-0 bg-white"
                sandbox={emailPreviewSandbox}
                srcDoc={previewHtml}
                title="Email preview"
              />
            ) : (
              <p className="p-5 text-sm leading-6 text-foreground">{message.preview}</p>
            )}
          </section>
        </div>
        {showRawMessage ? <RawMessageDialog rawMessage={rawMessage} onClose={() => setShowRawMessage(false)} /> : null}
      </article>
    </div>
  );

  return createPortal(overlay, document.body);
}

function RawMessageDialog({ rawMessage, onClose }: { rawMessage: string; onClose: () => void }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copyState === "idle") return undefined;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const copyRawMessage = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(rawMessage);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  const isCopied = copyState === "copied";
  const isError = copyState === "error";

  return (
    <div
      className="absolute inset-0 z-[55] grid place-items-center bg-foreground/30 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <article
        aria-labelledby="raw-message-title"
        aria-modal="true"
        className="flex max-h-[72vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-frame"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border/60 p-4">
          <h3 className="text-base font-semibold" id="raw-message-title">
            Raw message
          </h3>
          <div className="flex flex-none items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isCopied ? "Copied raw message" : "Copy raw message"}
              className={[
                "h-8 w-8 rounded-md transition-colors duration-150",
                isCopied
                  ? "bg-success/15 text-success hover:bg-success/15"
                  : isError
                    ? "text-red-600 hover:bg-red-50 hover:text-red-600"
                    : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600",
              ].join(" ")}
              onClick={copyRawMessage}
              title={isCopied ? "Copied" : "Copy raw message"}
            >
              {isCopied ? (
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              className="h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close raw message"
              onClick={onClose}
            >
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
