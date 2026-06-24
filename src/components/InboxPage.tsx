import { Inbox, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { BoundAddress, ParsedMail, RawMail } from "../api/types";
import { createUserClient } from "../api/userClient";
import { useUserAuth } from "../auth/UserAuthContext";
import { apiBaseUrl } from "../config/env";
import { EmptyState, ErrorState, LoadingState } from "./States";
import { MessageDetailDialog } from "./MessageDetailDialog";
import { SectionHeader } from "./UserShell";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const apiBase = apiBaseUrl;
const pageSize = 20;

export function InboxPage() {
  const auth = useUserAuth();
  const client = useMemo(() => createUserClient({ baseUrl: apiBase, getUserToken: () => auth.token }), [auth.token]);
  const [addresses, setAddresses] = useState<BoundAddress[] | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [mails, setMails] = useState<RawMail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ParsedMail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const selectedAddress = addresses?.find((address) => address.id === selectedAddressId) ?? addresses?.[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client
      .listAddresses()
      .then((items) => {
        if (cancelled) return;
        setAddresses(items);
        setSelectedAddressId((current) => (items.some((item) => item.id === current) ? current : items[0]?.id ?? ""));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load mailbox addresses.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, reloadKey]);

  useEffect(() => {
    if (!selectedAddress) {
      setMails([]);
      return;
    }

    let cancelled = false;
    setMails(null);
    setError(null);
    client
      .listMails({ address: selectedAddress.email, limit: pageSize, offset: 0 })
      .then((page) => {
        if (!cancelled) setMails(page.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load messages.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, selectedAddress]);

  const openMessage = async (mail: RawMail) => {
    if (!selectedAddress) return;
    setError(null);
    try {
      const addressToken = await client.getAddressToken(selectedAddress.id);
      setSelectedMessage(await client.getParsedMessage(mail.id, addressToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open message.");
    }
  };

  if (error && !addresses) return <ErrorState message={error} />;
  if (!addresses) return <LoadingState label="Loading inbox" />;

  return (
    <section className="min-w-0">
      <SectionHeader
        title="Inbox"
        description="Read messages received by your temporary mailbox addresses."
        actions={
          <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-5">
        {error ? <ErrorState message={error} /> : null}

        {addresses.length === 0 ? (
          <EmptyState title="No mailbox accounts" description="Create a mailbox before reading messages." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Addresses</CardTitle>
                <CardDescription>Select an inbox.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {addresses.map((address) => (
                  <button
                    className={`w-full rounded-[14px] border px-3 py-2 text-left text-sm font-black transition ${
                      address.id === selectedAddress?.id
                        ? "border-border bg-muted text-foreground"
                        : "border-white/70 bg-white/58 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] hover:bg-white/72"
                    }`}
                    key={address.id}
                    onClick={() => setSelectedAddressId(address.id)}
                  >
                    <span className="block truncate">{address.email}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2">
                  <Inbox className="h-5 w-5 flex-none" aria-hidden="true" />
                  <span className="truncate">Messages</span>
                </CardTitle>
                <CardDescription>
                  {selectedAddress?.email ? `${selectedAddress.email} inbox` : "Select an inbox"} · {mails?.length ?? 0} visible messages
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {!mails ? <LoadingState label="Loading messages" /> : null}
                {mails?.length === 0 ? <EmptyState title="No messages" description="This mailbox has not received any messages yet." /> : null}
                {mails?.map((mail) => {
                  const subject = extractRawSubject(mail.raw);
                  return (
                    <button
                      className="w-full rounded-[18px] border border-white/70 bg-white/58 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition hover:bg-white/78"
                      key={mail.id}
                      onClick={() => void openMessage(mail)}
                      aria-label={`Open ${subject}`}
                    >
                      <p className="break-words font-black text-foreground">{subject}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{extractRawPreview(mail.raw)}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {selectedMessage ? <MessageDetailDialog message={selectedMessage} onClose={() => setSelectedMessage(null)} /> : null}
    </section>
  );
}

function extractRawSubject(raw: string) {
  const match = raw.match(/^Subject:\s*(.+)$/im);
  return match?.[1]?.trim() || "(no subject)";
}

function extractRawPreview(raw: string) {
  const body = raw.split(/\r?\n\r?\n/).slice(1).join("\n\n").trim();
  return body || raw.slice(0, 180);
}
