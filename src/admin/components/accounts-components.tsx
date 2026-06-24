import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  Link,
  Loader2,
  Mail,
  Minus,
  MoreHorizontal,
  Shuffle,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, MouseEvent, RefObject, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { AccountDetail, AccountStatus, AdminAccount, MailMessage } from "../api/types";
import { mailboxDomain, mailboxDomains, publicMailboxUrl } from "../../config/env";
import { formatDatabaseDateTime } from "../utils/date";
import { extractMessageVerificationCode } from "../utils/verificationCode";
import {
  buildMailboxAccessLink,
  getAccountAddressId,
  normalizeMailboxPrefix,
  sanitizeMailboxPrefix,
} from "./accounts-utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { toast } from "./ui/use-toast";

export function createPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

export function PaginationNav({
  ariaLabel,
  canGoNext,
  canGoPrevious,
  currentPage,
  disabledPages = false,
  onNext,
  onPage,
  onPrevious,
  pageItems,
}: {
  ariaLabel: string;
  canGoNext: boolean;
  canGoPrevious: boolean;
  currentPage: number;
  disabledPages?: boolean;
  onNext: () => void;
  onPage: (page: number) => void;
  onPrevious: () => void;
  pageItems: Array<number | "ellipsis">;
}) {
  if (pageItems.length <= 1) {
    return null;
  }

  return (
    <nav aria-label={ariaLabel} className="mt-5 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button aria-label="Previous page" className="gap-1 px-3" disabled={!canGoPrevious} variant="ghost" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Button>
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center text-muted-foreground" key={`ellipsis-${index}`}>
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              aria-current={item === currentPage ? "page" : undefined}
              aria-label={`Page ${item}`}
              className={item === currentPage ? "h-10 w-10 bg-muted font-semibold text-foreground" : "h-10 w-10"}
              disabled={disabledPages}
              key={item}
              onClick={() => onPage(item)}
              size="icon"
              variant="ghost"
            >
              {item}
            </Button>
          ),
        )}
        <Button aria-label="Next page" className="gap-1 px-3" disabled={!canGoNext} variant="ghost" onClick={onNext}>
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

export function InlineLoading({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-border bg-muted px-4 py-3 text-sm text-muted-foreground ${className}`}
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}...</span>
    </div>
  );
}

export function AccountMessageRow({ message, onOpen }: { message: MailMessage; onOpen: () => void }) {
  const verificationCode = useMemo(() => extractMessageVerificationCode(message), [message]);
  const copyVerificationCode = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!verificationCode) return;

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(verificationCode);
      toast({
        title: "Verification code copied",
        description: verificationCode,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser could not write to the clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="grid w-full cursor-pointer gap-2 border-b border-border p-4 text-left transition last:border-b-0 hover:bg-muted/60"
      onClick={onOpen}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label={`Open message ${message.subject}`}
            className="min-w-0 max-w-full truncate rounded-[10px] text-left font-black text-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <span className="block min-w-0 truncate">{message.subject}</span>
          </button>
          {verificationCode ? (
            <Button
              aria-label={`Copy code ${verificationCode}`}
              className="h-7 flex-none rounded-full border-accent/20 bg-accent/10 px-2 text-xs font-black text-accent hover:bg-accent/15"
              onClick={copyVerificationCode}
              size="sm"
              title={`Copy code ${verificationCode}`}
              type="button"
              variant="secondary"
            >
              <span className="font-mono">{verificationCode}</span>
              <Copy className="h-3 w-3" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {message.receivedAt ? (
          <Badge className="whitespace-nowrap" variant="secondary">{formatDatabaseDateTime(message.receivedAt, { seconds: false })}</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {message.from.name} &lt;{message.from.email}&gt;
      </p>
    </div>
  );
}

export function AccountMessageTableRow({ message, onOpen }: { message: MailMessage; onOpen: () => void }) {
  const verificationCode = useMemo(() => extractMessageVerificationCode(message), [message]);
  const [codeCopyState, setCodeCopyState] = useState<"idle" | "copied" | "error">("idle");

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
      toast({
        title: "Copy failed",
        description: "Your browser could not write to the clipboard.",
        variant: "destructive",
      });
    }
  };

  const isCodeCopied = codeCopyState === "copied";
  const isCodeError = codeCopyState === "error";

  return (
    <TableRow
      className="group/row cursor-pointer transition-all duration-150 hover:bg-muted/50"
      onClick={onOpen}
    >
      <TableCell className="pl-4 pr-3 py-2.5 align-middle min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label={`Open message ${message.subject}`}
            className="min-w-0 max-w-full truncate rounded text-left text-sm font-semibold text-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <span className="block min-w-0 truncate">{message.subject}</span>
          </button>
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
      </TableCell>
      <TableCell className="px-4 py-2.5 align-middle">
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {message.from.name} &lt;{message.from.email}&gt;
        </span>
      </TableCell>
      <TableCell className="px-4 py-2.5 align-middle">
        {message.receivedAt ? (
          <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {formatDatabaseDateTime(message.receivedAt, { seconds: false })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="pr-4 pl-3 py-2.5 align-middle text-right">
        <span className="text-muted-foreground" aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      </TableCell>
    </TableRow>
  );
}

export function getDisplayMessageCount(detail: AccountDetail): number {
  return Math.max(
    detail.account.messageCount,
    detail.messagesTotal,
    detail.messagesOffset + detail.messages.length,
  );
}

export function splitEmailAddress(email: string): { local: string; domain: string } | null {
  const separatorIndex = email.lastIndexOf("@");
  if (separatorIndex <= 0) return null;
  return {
    local: email.slice(0, separatorIndex),
    domain: email.slice(separatorIndex + 1),
  };
}

export function AccountEmailAddress({ email, className = "" }: { email: string; className?: string }) {
  const parts = splitEmailAddress(email);
  if (!parts) {
    return (
      <span
        className={`truncate text-foreground transition-colors duration-150 group-hover/row:text-primary group-data-[state=selected]/row:text-primary ${className}`}
      >
        {email}
      </span>
    );
  }
  return (
    <span className={`flex min-w-0 items-baseline gap-0.5 ${className}`}>
      <span className="truncate text-foreground transition-colors duration-150 group-hover/row:text-primary group-data-[state=selected]/row:text-primary">
        {parts.local}
      </span>
      <span className="text-foreground transition-colors duration-150 group-hover/row:text-primary group-data-[state=selected]/row:text-primary">
        @{parts.domain}
      </span>
    </span>
  );
}

export function InlineCopyButton({ email }: { email: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copyState === "idle") return undefined;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      setCopyState("copied");
    } catch {
      setCopyState("error");
      toast({
        title: "Copy failed",
        description: "Your browser could not write to the clipboard.",
        variant: "destructive",
      });
    }
  };

  const isCopied = copyState === "copied";
  const isError = copyState === "error";
  const label = isCopied ? `Copied ${email}` : `Copy ${email}`;
  const title = isCopied ? "Copied" : "Copy email";

  return (
    <Button
      aria-label={label}
      className={[
        "h-8 w-8 flex-none rounded-md transition-colors duration-150",
        isCopied
          ? "bg-success/15 text-success hover:bg-success/15"
          : isError
            ? "text-red-600 hover:bg-red-50 hover:text-red-600"
            : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600",
      ].join(" ")}
      onClick={handleCopy}
      size="icon"
      title={title}
      type="button"
      variant="ghost"
      data-testid="inline-copy-button"
      data-state={copyState}
    >
      {isCopied ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}

const statusBadgeStyles: Record<AccountStatus, { variant: React.ComponentProps<typeof Badge>["variant"]; label: string }> = {
  active: { variant: "success", label: "Active" },
  paused: { variant: "warning", label: "Paused" },
  locked: { variant: "default", label: "Locked" },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const config = statusBadgeStyles[status];
  return (
    <Badge
      variant={config.variant}
      className="font-medium transition-[filter,transform] duration-150 group-hover/row:brightness-95 group-data-[state=selected]/row:brightness-95"
    >
      {config.label}
    </Badge>
  );
}

export function AccountMailCount({ count }: { count: number }) {
  return (
    <span className="text-base font-semibold tabular-nums text-foreground transition-colors duration-150 group-hover/row:text-primary group-data-[state=selected]/row:text-primary">
      {count.toLocaleString()}
    </span>
  );
}

function formatDateOnly(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function AccountCreatedAt({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className="text-sm tabular-nums text-muted-foreground transition-colors duration-150 group-hover/row:text-foreground/70 group-data-[state=selected]/row:text-foreground/70"
      title={formatDatabaseDateTime(value)}
    >
      {formatDateOnly(value)}
    </span>
  );
}

export interface AccountStats {
  total: number;
  active: number;
  recentlyCreated: number;
  recentlyCreatedWindowDays?: number;
  loaded: boolean;
}

export function AccountStatsBar({ stats, onClearQuery, isFiltered }: { stats: AccountStats; onClearQuery?: () => void; isFiltered?: boolean }) {
  const activePercent = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const windowDays = stats.recentlyCreatedWindowDays ?? 7;
  const recentLabel = `${windowDays}d`;

  return (
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Account statistics">
      <StatCard
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        label={isFiltered ? "Matching accounts" : "Total accounts"}
        value={stats.total}
        footer={isFiltered ? "Filtered by current search" : "All mailbox service accounts"}
        tone="primary"
        isLoaded={stats.loaded}
      />
      <StatCard
        icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
        label="Active"
        value={stats.active}
        valueSuffix={stats.total > 0 ? ` · ${activePercent}%` : undefined}
        footer={`${stats.total - stats.active} ${stats.total - stats.active === 1 ? "account" : "accounts"} inactive or paused`}
        tone="success"
        isLoaded={stats.loaded}
      />
      <StatCard
        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        label={`New in last ${recentLabel}`}
        value={stats.recentlyCreated}
        footer={
          stats.total > 0
            ? `${Math.round((stats.recentlyCreated / Math.max(stats.total, 1)) * 100)}% of total`
            : "No accounts yet"
        }
        tone="accent"
        isLoaded={stats.loaded}
        onClearQuery={onClearQuery}
        isFiltered={isFiltered}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueSuffix,
  footer,
  tone,
  isLoaded,
  onClearQuery,
  isFiltered,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueSuffix?: string;
  footer: string;
  tone: "primary" | "success" | "accent";
  isLoaded: boolean;
  onClearQuery?: () => void;
  isFiltered?: boolean;
}) {
  const toneMeta = {
    primary: {
      icon: "bg-primary/10 text-primary group-hover:bg-primary/15",
      value: "group-hover:text-primary",
    },
    success: {
      icon: "bg-success/10 text-success group-hover:bg-success/15",
      value: "group-hover:text-success",
    },
    accent: {
      icon: "bg-accent/10 text-accent group-hover:bg-accent/15",
      value: "group-hover:text-accent",
    },
  }[tone];

  return (
    <Card className="group cursor-default border-border/70 shadow-none transition-all duration-200 hover:-translate-y-px hover:border-foreground/15 hover:shadow-sm focus-within:-translate-y-px focus-within:border-foreground/15 focus-within:shadow-sm">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span
            className={`grid h-7 w-7 place-items-center rounded-md transition-colors duration-200 ${toneMeta.icon}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          {isLoaded ? (
            <span
              className={`text-2xl font-semibold tabular-nums text-foreground transition-colors duration-200 ${toneMeta.value}`}
            >
              {value.toLocaleString()}
              {valueSuffix ? <span className="ml-1 text-sm font-medium text-muted-foreground">{valueSuffix}</span> : null}
            </span>
          ) : (
            <span className="block h-7 w-16 animate-pulse rounded bg-muted" aria-hidden="true" />
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {footer}
          {isFiltered && onClearQuery ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={onClearQuery}
                className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Clear search
              </button>
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}

const SKELETON_ROW_COUNT = 6;

export function AccountTableSkeleton({ columnCount = 5 }: { columnCount?: number }) {
  return (
    <>
      <tr className="sr-only" role="status" aria-live="polite">
        <th scope="row" colSpan={columnCount}>Loading accounts...</th>
      </tr>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr key={`skeleton-${index}`} className="border-b border-border/60 last:border-b-0" aria-hidden="true">
          {Array.from({ length: columnCount }, (_, cellIndex) => (
            <td key={`skeleton-cell-${cellIndex}`} className="px-3 py-2.5 align-middle">
              <span
                className={`block h-3.5 animate-pulse rounded bg-muted ${
                  cellIndex === 0 ? "w-44" : cellIndex === columnCount - 1 ? "w-12" : "w-20"
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const MESSAGE_SKELETON_ROW_COUNT = 4;

export function MessageTableSkeleton() {
  return (
    <>
      <tr className="sr-only" role="status" aria-live="polite">
        <th scope="row" colSpan={4}>Loading messages...</th>
      </tr>
      {Array.from({ length: MESSAGE_SKELETON_ROW_COUNT }, (_, index) => (
        <tr key={`msg-skeleton-${index}`} className="border-b border-border/60 last:border-b-0" aria-hidden="true">
          <td className="px-4 py-3 align-middle">
            <span className="block h-4 w-48 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-4 py-3 align-middle">
            <span className="block h-4 w-32 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-4 py-3 align-middle">
            <span className="block h-4 w-20 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-4 py-3 align-middle">
            <span className="block h-4 w-16 animate-pulse rounded bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function AccountEmptyState({
  isFiltered,
  onCreateAccount,
  onClearQuery,
}: {
  isFiltered: boolean;
  onCreateAccount?: () => void;
  onClearQuery?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <Mail className="h-5 w-5" />
      </span>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">
          {isFiltered ? "No accounts match your search" : "No mailbox accounts yet"}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isFiltered
            ? "Try a shorter prefix or domain. The search covers email addresses, labels, and IDs."
            : "Mailbox accounts receive messages for the configured domains. Create one to get started."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {isFiltered && onClearQuery ? (
          <Button onClick={onClearQuery} type="button" variant="secondary" size="sm">
            Clear search
          </Button>
        ) : null}
        {onCreateAccount ? (
          <Button onClick={onCreateAccount} type="button" size="sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Create your first mailbox
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function useGlobalShortcut(
  key: string,
  ref: RefObject<HTMLElement>,
  options: { enabled?: boolean; onTrigger?: () => void } = {},
) {
  const { enabled = true, onTrigger } = options;
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== key) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
        if (isTyping) return;
      }
      event.preventDefault();
      onTrigger?.();
      ref.current?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled, key, onTrigger, ref]);
}

export function CreateAccountDialog({
  domain,
  domains,
  error,
  isCreating,
  onCancel,
  onConfirm,
  onDomainChange,
  onGenerate,
  onPrefixChange,
  prefix,
}: {
  domain: string;
  domains: string[];
  error: string | null;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onDomainChange: (value: string) => void;
  onGenerate: () => void;
  onPrefixChange: (value: string) => void;
  prefix: string;
}) {
  const selectedDomain = domains.includes(domain) ? domain : mailboxDomain;
  const preview = `${normalizeMailboxPrefix(prefix) || "prefix"}@${selectedDomain}`;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  const dialog = (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <article
        aria-labelledby="create-account-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-frame"
        role="dialog"
      >
        <form onSubmit={submit}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-black" id="create-account-title">
                New mailbox account
              </h2>
              <p className="mt-2 truncate text-sm font-bold text-muted-foreground">{preview}</p>
            </div>
            <Button
              aria-label="Random prefix"
              className="w-full flex-none sm:w-auto"
              disabled={isCreating}
              onClick={onGenerate}
              type="button"
              variant="secondary"
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Random prefix
            </Button>
          </div>
          <div className="mt-5">
            <label className="text-sm font-black text-foreground" htmlFor="mailbox-prefix">
              Mailbox prefix
            </label>
            <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)]">
              <Input
                autoFocus
                className="h-12 min-w-0 rounded-lg"
                disabled={isCreating}
                id="mailbox-prefix"
                inputMode="email"
                onChange={(event) => onPrefixChange(event.target.value)}
                placeholder="support"
                value={prefix}
              />
              <div className="min-w-0">
                <label className="sr-only" htmlFor="admin-mailbox-domain">
                  Mailbox domain
                </label>
                <select
                  className="h-12 w-full rounded-lg border border-border bg-card px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  disabled={isCreating}
                  id="admin-mailbox-domain"
                  onChange={(event) => onDomainChange(event.target.value)}
                  value={selectedDomain}
                >
                  {domains.map((item) => (
                    <option key={item} value={item}>
                      @{item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm font-bold text-red-700">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button disabled={isCreating} onClick={onCancel} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={isCreating} type="submit">
              {isCreating ? "Creating..." : "Create account"}
            </Button>
          </div>
        </form>
      </article>
    </div>
  );

  return createPortal(dialog, document.body);
}

export function AccessLinkLoading() {
  const dialog = (
    <div
      aria-label="Generating access link"
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-4 py-6"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground shadow-frame">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <span>Generating access link...</span>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

export function AccessLinkDialog({
  account,
  link,
  onClose,
}: {
  account: AdminAccount;
  link: string;
  onClose: () => void;
}) {
  const titleId = `access-link-${account.id}`;
  const copyAccessLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      toast({
        title: "Access link copied",
        description: account.ownerEmail,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser could not write to the clipboard.",
        variant: "destructive",
      });
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <article
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-frame"
        role="dialog"
      >
        <Button
          aria-label="Close access link dialog"
          className="absolute right-4 top-4 h-9 w-9 rounded-full text-muted-foreground"
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 pr-10">
          <h2 className="text-xl font-black" id={titleId}>
            Access link for {account.ownerEmail}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Anyone with this link can open the mailbox.
          </p>
        </div>
        <div
          aria-label="Mailbox access link"
          className="mt-5 max-h-52 overflow-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-6 text-foreground break-all"
          data-testid="access-link-value"
        >
          {link}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4" data-testid="access-link-footer">
          <Button className="flex-none" onClick={() => void copyAccessLink()} type="button">
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy access link
          </Button>
        </div>
      </article>
    </div>
  );

  return createPortal(dialog, document.body);
}
export function DeleteAccountDialog({
  account,
  error,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  account: AdminAccount;
  error: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = `delete-account-${account.id}`;

  const dialog = (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <article
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-frame"
        role="dialog"
      >
        <h2 className="text-xl font-black" id={titleId}>
          Delete {account.ownerEmail}?
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This will delete the mailbox address and its associated messages, sender permissions, and user bindings.
        </p>
        {isDeleting ? (
          <div
            aria-label="Deleting mailbox account"
            className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Deleting...</span>
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm font-bold text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={isDeleting} onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            className="bg-red-700 text-white hover:bg-red-800"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Confirm delete"}
          </Button>
        </div>
      </article>
    </div>
  );

  return createPortal(dialog, document.body);
}

// Re-export the smaller helpers used by callers for convenience
export { buildMailboxAccessLink, getAccountAddressId, sanitizeMailboxPrefix };