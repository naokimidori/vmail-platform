import { Link2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createAdminClient } from "../api/adminClient";
import type { AdminAccount } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { apiBaseUrl, mailboxDomain, mailboxDomains } from "../../config/env";
import { EmptyState, ErrorState, LoadingState } from "./States";
import {
  AccountCreatedAt,
  AccountEmailAddress,
  AccountEmptyState,
  AccountLastActive,
  AccountMailCount,
  AccountStatsBar,
  AccountStatusBadge,
  AccountTableSkeleton,
  AccessLinkDialog,
  AccessLinkLoading,
  CreateAccountDialog,
  DeleteAccountDialog,
  InlineCopyButton,
  PaginationNav,
  createPaginationItems,
  useGlobalShortcut,
  type AccountStats,
} from "./accounts-components";
import {
  ACCOUNTS_PAGE_SIZE,
  RECENT_ACCOUNT_WINDOW_DAYS,
  buildAccountStats,
  buildMailboxAccessLink,
  defaultMailboxDomain,
  generateMailboxPrefix,
  getAccountAddressId,
  normalizeMailboxPrefix,
  sanitizeMailboxPrefix,
  validateMailboxPrefix,
} from "./accounts-utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { toast } from "./ui/use-toast";

const apiBase = apiBaseUrl;

export function AccountListPage() {
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const [pageAccounts, setPageAccounts] = useState<AdminAccount[] | null>(null);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [allAccounts, setAllAccounts] = useState<AdminAccount[] | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [accountsReloadKey, setAccountsReloadKey] = useState(0);
  const [statsReloadKey, setStatsReloadKey] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createPrefix, setCreatePrefix] = useState("");
  const [createDomain, setCreateDomain] = useState(defaultMailboxDomain());
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [accessLinkDialog, setAccessLinkDialog] = useState<{ account: AdminAccount; link: string } | null>(null);
  const [accessLinkLoadingAccountId, setAccessLinkLoadingAccountId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const queryText = debouncedQuery.trim().toLowerCase();
  const isFiltered = queryText.length > 0;

  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBase, getCredential: () => auth.credential }),
    [auth.credential],
  );

  useGlobalShortcut("/", searchInputRef, { enabled: !isCreateDialogOpen && !deleteTarget });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    setError(null);
    setIsPageLoading(true);
    setPageAccounts(null);
    client
      .listAccountsPage({ limit: ACCOUNTS_PAGE_SIZE, offset: pageOffset, query: queryText || undefined })
      .then((page) => {
        if (cancelled) return;
        setPageAccounts(page.items);
        setTotalAccounts((currentTotal) =>
          page.total > 0 || queryText ? page.total : Math.max(currentTotal, page.offset + page.items.length),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load live mailbox accounts.");
      })
      .finally(() => {
        if (!cancelled) setIsPageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountsReloadKey, client, pageOffset, queryText]);

  useEffect(() => {
    let cancelled = false;
    client
      .listAccounts()
      .then((items) => {
        if (!cancelled) setAllAccounts(items);
      })
      .catch(() => {
        if (!cancelled) setAllAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, statsReloadKey]);

  useEffect(() => {
    setPageOffset(0);
  }, [queryText]);

  const visibleAccounts = pageAccounts ?? [];

  if (error) return <ErrorState message={error} />;
  if (!pageAccounts && !isPageLoading) return <LoadingState label="Loading accounts" />;

  const totalPages = Math.max(1, Math.ceil(totalAccounts / ACCOUNTS_PAGE_SIZE));
  const currentPage = Math.floor(pageOffset / ACCOUNTS_PAGE_SIZE) + 1;
  const canGoPrevious = pageOffset > 0;
  const canGoNext = pageOffset + ACCOUNTS_PAGE_SIZE < totalAccounts;
  const pageItems = createPaginationItems(currentPage, totalPages);
  const goToPage = (nextPage: number) => {
    setPageOffset((nextPage - 1) * ACCOUNTS_PAGE_SIZE);
  };

  const statsSource = isFiltered ? visibleAccounts : allAccounts;
  const stats: AccountStats = statsSource
    ? {
        ...buildAccountStats(statsSource),
        loaded: true,
        recentlyCreatedWindowDays: RECENT_ACCOUNT_WINDOW_DAYS,
      }
    : {
        total: 0,
        active: 0,
        recentlyCreated: 0,
        loaded: false,
        recentlyCreatedWindowDays: RECENT_ACCOUNT_WINDOW_DAYS,
      };

  const enterAccount = (account: AdminAccount) => {
    navigate(`/admin/accounts/${encodeURIComponent(account.ownerEmail)}`);
  };
  const requestDeleteAccount = (account: AdminAccount) => {
    setDeleteError(null);
    setDeleteTarget(account);
  };
  const requestAccessLink = async (account: AdminAccount) => {
    const addressId = getAccountAddressId(account);
    if (!addressId) {
      toast({
        title: "Unable to generate access link",
        description: "No address ID was found for this mailbox account.",
        variant: "destructive",
      });
      return;
    }

    setAccessLinkLoadingAccountId(account.id);
    try {
      const jwt = await client.getAddressAccessJwt(addressId);
      setAccessLinkDialog({ account, link: buildMailboxAccessLink(jwt) });
    } catch {
      toast({
        title: "Access link generation failed",
        description: `Could not get an access token for ${account.ownerEmail}. Try again later.`,
        variant: "destructive",
      });
    } finally {
      setAccessLinkLoadingAccountId(null);
    }
  };
  const openCreateDialog = () => {
    setCreatePrefix("");
    setCreateDomain(mailboxDomain);
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };
  const closeCreateDialog = () => {
    if (isCreating) return;
    setIsCreateDialogOpen(false);
    setCreatePrefix("");
    setCreateDomain(mailboxDomain);
    setCreateError(null);
  };
  const generateRandomPrefix = () => {
    setCreatePrefix(generateMailboxPrefix());
    setCreateError(null);
  };
  const createMailboxAccount = async () => {
    const prefix = normalizeMailboxPrefix(createPrefix);
    const validationError = validateMailboxPrefix(prefix);

    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    const domain = mailboxDomains.includes(createDomain) ? createDomain : mailboxDomain;
    try {
      const account = await client.createAddress({ prefix, domain });
      toast({
        title: "Mailbox account created",
        description: account.ownerEmail,
      });
      setIsCreateDialogOpen(false);
      setCreatePrefix("");
      setCreateDomain(mailboxDomain);
      setAccountsReloadKey((key) => key + 1);
      setStatsReloadKey((key) => key + 1);
      navigate(`/admin/accounts/${encodeURIComponent(account.ownerEmail)}`);
    } catch {
      setCreateError("Unable to create this mailbox account.");
      toast({
        title: "Create failed",
        description: `Could not create ${prefix}@${domain}. Try again later.`,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };
  const confirmDeleteAccount = async () => {
    if (!deleteTarget) return;

    const addressId = getAccountAddressId(deleteTarget);
    if (!addressId) {
      setDeleteError("Unable to find an address ID for this account.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await client.deleteAddress(addressId);
      toast({
        title: "Mailbox address deleted",
        description: `${deleteTarget.ownerEmail} was deleted from the mailbox service.`,
      });
      setDeleteTarget(null);
      setAccountsReloadKey((key) => key + 1);
      setStatsReloadKey((key) => key + 1);
    } catch {
      setDeleteError("Delete failed. Try again later.");
      toast({
        title: "Delete failed",
        description: `Could not delete ${deleteTarget.ownerEmail}. Try again later.`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  const clearQuery = () => setQuery("");

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="text-foreground">Accounts</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Mailbox accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">All mailbox service accounts.</p>
        </div>
        <Button onClick={openCreateDialog} type="button" variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New mailbox account
        </Button>
      </header>

      <AccountStatsBar
        stats={stats}
        isFiltered={isFiltered}
        onClearQuery={isFiltered ? clearQuery : undefined}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">
                All accounts
                {totalAccounts > 0 ? (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{totalAccounts} total</span>
                ) : null}
              </CardTitle>
            </div>
            <div className="relative w-full max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                className="h-9 rounded-md pl-8 pr-16 text-sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search accounts"
                aria-label="Search accounts (press /)"
                aria-keyshortcuts="/"
                type="search"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                /
              </kbd>
              {query ? (
                <button
                  type="button"
                  onClick={clearQuery}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-9"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="responsive-table-wrap">
            <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col />
                <col className="w-28" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-20" />
                <col className="w-40" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 pr-3 max-w-[200px]">Account</TableHead>
                  <TableHead className="px-3">Status</TableHead>
                  <TableHead className="px-3">Created</TableHead>
                  <TableHead className="px-3">Last active</TableHead>
                  <TableHead className="px-3">Mail</TableHead>
                  <TableHead className="pr-4 pl-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? <AccountTableSkeleton columnCount={6} /> : null}
                {!isPageLoading
                  ? visibleAccounts.map((account) => (
                      <TableRow
                        className="group/row transition-all duration-150 hover:bg-muted/50"
                        key={account.id}
                        data-testid="account-row"
                      >
                        <TableCell className="pl-4 pr-3 py-2 align-middle max-w-[200px]">
                          <Button
                            variant="ghost"
                            className="h-auto min-w-0 justify-start rounded-md px-2 py-1.5 text-left hover:bg-transparent"
                            onClick={() => enterAccount(account)}
                            aria-label={`Open ${account.ownerEmail} account`}
                          >
                            <AccountEmailAddress email={account.ownerEmail} className="min-w-0" />
                          </Button>
                        </TableCell>
                        <TableCell className="px-3 py-2 align-middle">
                          <AccountStatusBadge status={account.status} />
                        </TableCell>
                        <TableCell className="px-3 py-2 align-middle">
                          <AccountCreatedAt value={account.createdAt} />
                        </TableCell>
                        <TableCell className="px-3 py-2 align-middle">
                          <AccountLastActive value={account.lastActiveAt} />
                        </TableCell>
                        <TableCell className="px-3 py-2 align-middle">
                          <AccountMailCount count={account.messageCount} />
                        </TableCell>
                        <TableCell className="pr-4 pl-3 py-2 align-middle">
                          <div className="flex items-center gap-0.5">
                            <InlineCopyButton email={account.ownerEmail} />
                            <Button
                              aria-label={`Get access link for ${account.ownerEmail}`}
                              className="h-8 w-8 rounded-md text-sky-600/70 transition-colors hover:bg-sky-50 hover:text-sky-700 focus-visible:text-sky-700 disabled:opacity-50"
                              disabled={accessLinkLoadingAccountId === account.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void requestAccessLink(account);
                              }}
                              size="icon"
                              title={`Get access link for ${account.ownerEmail}`}
                              type="button"
                              variant="ghost"
                            >
                              {accessLinkLoadingAccountId === account.id ? (
                                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" aria-hidden="true" />
                              ) : (
                                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              aria-label={`Delete ${account.ownerEmail}`}
                              className="h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestDeleteAccount(account);
                              }}
                              size="icon"
                              title={`Delete ${account.ownerEmail}`}
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
                {!isPageLoading && visibleAccounts.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-0">
                      <AccountEmptyState
                        isFiltered={isFiltered}
                        onCreateAccount={openCreateDialog}
                        onClearQuery={isFiltered ? clearQuery : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </table>
          </div>
          {!isPageLoading ? (
            <div className="border-t border-border/60 px-4 py-3">
              <PaginationNav
                ariaLabel="Accounts pagination"
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                currentPage={currentPage}
                onNext={() => setPageOffset(pageOffset + ACCOUNTS_PAGE_SIZE)}
                onPage={goToPage}
                onPrevious={() => setPageOffset(Math.max(0, pageOffset - ACCOUNTS_PAGE_SIZE))}
                pageItems={pageItems}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
      {accessLinkLoadingAccountId ? <AccessLinkLoading /> : null}
      {accessLinkDialog ? (
        <AccessLinkDialog
          account={accessLinkDialog.account}
          link={accessLinkDialog.link}
          onClose={() => setAccessLinkDialog(null)}
        />
      ) : null}
      {isCreateDialogOpen ? (
        <CreateAccountDialog
          domain={createDomain}
          domains={mailboxDomains}
          error={createError}
          isCreating={isCreating}
          onCancel={closeCreateDialog}
          onConfirm={() => void createMailboxAccount()}
          onDomainChange={(value) => setCreateDomain(value)}
          onGenerate={generateRandomPrefix}
          onPrefixChange={(value) => {
            setCreatePrefix(sanitizeMailboxPrefix(value));
            setCreateError(null);
          }}
          prefix={createPrefix}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteAccountDialog
          account={deleteTarget}
          error={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void confirmDeleteAccount()}
        />
      ) : null}
    </section>
  );
}
