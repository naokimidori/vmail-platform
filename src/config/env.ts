export const apiBaseUrl = import.meta.env.API_BASE_URL ?? "mock";

export function parseMailboxDomains(value: string | undefined) {
  const domains = Array.from(new Set((value ?? "")
    .split(",")
    .map((domain) => domain.trim().replace(/^@+/, "").toLowerCase())
    .filter(Boolean)));
  return domains.length > 0 ? domains : ["example.com"];
}

export const mailboxDomains = parseMailboxDomains(import.meta.env.MAILBOX_DOMAINS);
export const mailboxDomain = mailboxDomains[0];
export const publicMailboxUrl = import.meta.env.PUBLIC_MAILBOX_URL ?? "https://mail.example.com";
