import { useMemo, useState } from "react";

import { createAdminClient } from "../api/adminClient";
import type { SearchResult } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { adminApiBaseUrl } from "../../config/env";
import { MessageDetailDialog, MessageDetailLoading, useMessageDetailTransition } from "./MessageDetailDialog";
import { EmptyState, ErrorState } from "./States";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

const apiBaseUrl = adminApiBaseUrl;

export function SearchPage() {
  const auth = useAdminAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ accounts: [], messages: [] });
  const [error, setError] = useState<string | null>(null);
  const { closeMessage, openMessage, pendingMessage, selectedMessage } = useMessageDetailTransition();
  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBaseUrl, getCredential: () => auth.credential }),
    [auth.credential],
  );

  async function runSearch() {
    setError(null);
    closeMessage();
    try {
      setResults(await client.search(query));
    } catch {
      setError("Unable to search live mailbox data.");
    }
  }

  const hasResults = results.accounts.length > 0 || results.messages.length > 0;

  return (
    <section className="grid gap-6">
      <Card className="rounded-[1.4rem] border-border shadow-[0_18px_48px_rgba(20,63,51,0.08)]">
        <CardHeader>
          <CardTitle className="text-3xl">Mail Search</CardTitle>
          <CardDescription>Search accounts, addresses, senders, recipients, and subjects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              className="h-12 rounded-2xl"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search account / mailbox / subject"
            />
            <Button className="h-12 rounded-2xl font-black" type="button" onClick={runSearch}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error} />
      ) : !hasResults ? (
        <EmptyState title="No results yet" description="Enter a query to inspect mailbox data across all accounts." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ResultCard title="Accounts" count={results.accounts.length}>
            {results.accounts.map((account) => (
              <article className="rounded-2xl border border-border bg-card p-4" key={account.id}>
                <strong>{account.displayName}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{account.ownerEmail}</p>
                <Badge className="mt-3" variant="accent">{account.addresses.length} addresses</Badge>
              </article>
            ))}
          </ResultCard>
          <ResultCard title="Messages" count={results.messages.length}>
            {results.messages.map((message) => (
              <button
                className="grid rounded-2xl border border-border bg-card p-4 text-left transition hover:bg-mint/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={message.id}
                type="button"
                onClick={() => openMessage(message)}
                aria-label={`Open message ${message.subject}`}
              >
                <strong>{message.subject}</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  {message.from.name} to {message.to.map((item) => item.email).join(", ")}
                </p>
              </button>
            ))}
          </ResultCard>
        </div>
      )}
      {pendingMessage ? <MessageDetailLoading /> : null}
      {selectedMessage ? (
        <MessageDetailDialog message={selectedMessage} onClose={closeMessage} />
      ) : null}
    </section>
  );
}

function ResultCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="rounded-[1.4rem] border-border shadow-[0_18px_48px_rgba(20,63,51,0.08)]">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Badge variant="secondary">{count}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}
