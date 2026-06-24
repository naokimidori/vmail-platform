import { mailboxDomain, publicMailboxUrl } from "../../config/env";
import type { AdminAccount } from "../api/types";

export const ACCOUNTS_PAGE_SIZE = 10;

export const RECENT_ACCOUNT_WINDOW_DAYS = 7;

export function buildAccountStats(accounts: AdminAccount[], now: Date = new Date()) {
  const cutoff = now.getTime() - RECENT_ACCOUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let active = 0;
  let recentlyCreated = 0;

  for (const account of accounts) {
    if (account.status === "active") active += 1;
    if (account.createdAt) {
      const createdAt = new Date(account.createdAt).getTime();
      if (!Number.isNaN(createdAt) && createdAt >= cutoff) recentlyCreated += 1;
    }
  }

  return {
    total: accounts.length,
    active,
    recentlyCreated,
  };
}

export const randomMailboxNames = [
  "alex",
  "avery",
  "blake",
  "casey",
  "chloe",
  "dylan",
  "emma",
  "ethan",
  "grace",
  "harper",
  "henry",
  "jack",
  "james",
  "leah",
  "logan",
  "lucas",
  "mason",
  "mia",
  "nora",
  "oliver",
  "owen",
  "riley",
  "sophia",
  "zoe",
];

export function sanitizeMailboxPrefix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 64);
}

export function normalizeMailboxPrefix(value: string): string {
  return sanitizeMailboxPrefix(value.trim()).replace(/^[._-]+|[._-]+$/g, "");
}

export function validateMailboxPrefix(prefix: string): string | null {
  if (!prefix) return "Enter a mailbox prefix.";
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(prefix)) {
    return "Use 1-64 letters, numbers, dots, underscores, or hyphens. Start and end with a letter or number.";
  }
  return null;
}

export function generateMailboxPrefix(): string {
  const name = randomMailboxNames[Math.floor(Math.random() * randomMailboxNames.length)] ?? "alex";
  const digitsLength = 2 + Math.floor(Math.random() * 5);
  const min = 10 ** (digitsLength - 1);
  const max = 10 ** digitsLength - 1;
  const digits = String(min + Math.floor(Math.random() * (max - min + 1)));
  return `${name}${digits}`;
}

export function getAccountAddressId(account: AdminAccount): string | undefined {
  return (
    account.addresses.find((address) => address.isPrimary)?.id ??
    account.addresses[0]?.id ??
    account.id
  );
}

export function buildMailboxAccessLink(jwt: string): string {
  const url = new URL(publicMailboxUrl);
  url.searchParams.set("jwt", jwt);
  return url.toString();
}

export function defaultMailboxDomain(): string {
  return mailboxDomain;
}