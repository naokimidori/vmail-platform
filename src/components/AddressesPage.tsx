import { Copy, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { BoundAddress } from "../api/types";
import { createUserClient } from "../api/userClient";
import { useUserAuth } from "../auth/UserAuthContext";
import { apiBaseUrl, mailboxDomain, mailboxDomains } from "../config/env";
import { EmptyState, ErrorState, LoadingState } from "./States";
import { SectionHeader } from "./UserShell";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { toast } from "./ui/use-toast";

const apiBase = apiBaseUrl;
const defaultMailboxDomain = mailboxDomain;

export function AddressesPage() {
  const auth = useUserAuth();
  const client = useMemo(() => createUserClient({ baseUrl: apiBase, getUserToken: () => auth.token }), [auth.token]);
  const [addresses, setAddresses] = useState<BoundAddress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedDomain, setSelectedDomain] = useState(defaultMailboxDomain);
  const [isCreating, setIsCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const selectedMailboxDomain = mailboxDomains.includes(selectedDomain) ? selectedDomain : defaultMailboxDomain;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client
      .listAddresses()
      .then((items) => {
        if (!cancelled) setAddresses(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load mailbox addresses.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, reloadKey]);

  const createAddress = async (event: FormEvent) => {
    event.preventDefault();
    const mailboxName = name.trim();
    if (!mailboxName) {
      setError("Enter a mailbox name.");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await client.createAndBindAddress({ name: mailboxName, domain: selectedMailboxDomain, enableRandomSubdomain: false });
      setName("");
      setIsCreateOpen(false);
      setReloadKey((value) => value + 1);
      toast({ title: "Mailbox created", description: `${mailboxName}@${selectedMailboxDomain} is ready.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create mailbox.");
    } finally {
      setIsCreating(false);
    }
  };

  if (error && !addresses) return <ErrorState message={error} />;
  if (!addresses) return <LoadingState label="Loading mailboxes" />;

  return (
    <section className="min-w-0">
      <SectionHeader
        title="Mailbox accounts"
        description="Create and manage temporary inbox addresses tied to this user account."
        actions={
          <>
            <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New mailbox
            </Button>
          </>
        }
      />

      <div className="grid gap-5">
        {error ? <ErrorState message={error} /> : null}

        {isCreateOpen ? (
          <Card className="hero-card">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>New mailbox</CardTitle>
                <CardDescription>The address will be created and bound to your account.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Close new mailbox" onClick={() => setIsCreateOpen(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)_auto] sm:items-end" onSubmit={createAddress}>
                <div className="min-w-0">
                  <label className="text-sm font-bold" htmlFor="mailbox-name">Mailbox name</label>
                  <Input id="mailbox-name" className="mt-2 h-12 rounded-[16px]" value={name} onChange={(event) => setName(event.target.value)} placeholder="support" />
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-bold" htmlFor="mailbox-domain">Mailbox domain</label>
                  <select
                    className="mt-2 h-12 w-full rounded-[16px] border border-white/70 bg-white/58 px-4 text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] outline-none focus:ring-2 focus:ring-ring"
                    id="mailbox-domain"
                    onChange={(event) => setSelectedDomain(event.target.value)}
                    value={selectedMailboxDomain}
                  >
                    {mailboxDomains.map((domain) => (
                      <option key={domain} value={domain}>
                        @{domain}
                      </option>
                    ))}
                  </select>
                </div>
                <Button className="h-12 rounded-[16px]" disabled={isCreating} type="submit">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  Create mailbox
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {addresses.length === 0 ? (
          <EmptyState title="No mailbox accounts" description="Create your first temporary mailbox to start receiving messages." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {addresses.map((address) => (
              <Card key={address.id} className="min-w-0 overflow-hidden">
                <CardHeader>
                  <CardTitle className="break-all text-lg">{address.email}</CardTitle>
                  <CardDescription>{address.mailCount} mails</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <Badge variant="accent">{address.sendCount} sent</Badge>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard?.writeText(address.email);
                      toast({ title: "Address copied", description: address.email });
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
