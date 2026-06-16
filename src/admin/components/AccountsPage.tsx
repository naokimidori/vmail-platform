import { ChevronLeft, ChevronRight, Copy, Link, Loader2, LogIn, MoreHorizontal, Plus, RefreshCw, Shuffle, Trash2, X } from "lucide-react";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { createAdminClient } from "../api/adminClient";
import type { AccountDetail, AdminAccount, MailMessage } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { adminApiBaseUrl, mailboxDomain, publicMailboxUrl } from "../../config/env";
import { formatDatabaseDateTime } from "../utils/date";
import { extractMessageVerificationCode } from "../utils/verificationCode";
import { MessageDetailDialog, MessageDetailLoading, useMessageDetailTransition } from "./MessageDetailDialog";
import { EmptyState, ErrorState, LoadingState } from "./States";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { toast } from "./ui/use-toast";

const apiBaseUrl = adminApiBaseUrl;
const pageSize = 10;
const randomMailboxNames = [
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
type AccountMenuState = { accountId: string; mode: "click" | "hover" } | null;

export function AccountsPage() {
  const auth = useAdminAuth();
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const { closeMessage, openMessage, pendingMessage, selectedMessage } = useMessageDetailTransition();
  const [accountMenu, setAccountMenu] = useState<AccountMenuState>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createPrefix, setCreatePrefix] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [accessLinkDialog, setAccessLinkDialog] = useState<{ account: AdminAccount; link: string } | null>(null);
  const [accessLinkLoadingAccountId, setAccessLinkLoadingAccountId] = useState<string | null>(null);
  const [accountsReloadKey, setAccountsReloadKey] = useState(0);
  const queryText = debouncedQuery.trim().toLowerCase();

  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBaseUrl, getCredential: () => auth.credential }),
    [auth.credential],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    setError(null);
    setIsAccountsLoading(true);
    setAccounts(null);
    client
      .listAccountsPage({ limit: pageSize, offset: pageOffset, query: queryText || undefined })
      .then((page) => {
        if (cancelled) return;
        setAccounts(page.items);
        setTotalAccounts((currentTotal) =>
          page.total > 0 || queryText ? page.total : Math.max(currentTotal, page.offset + page.items.length),
        );
        setSelectedId((currentId) => {
          if (page.items.length === 0) return "";
          return page.items.some((item) => item.id === currentId) ? currentId : page.items[0].id;
        });
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load live mailbox accounts.");
      })
      .finally(() => {
        if (!cancelled) setIsAccountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountsReloadKey, client, pageOffset, queryText]);

  useEffect(() => {
    setPageOffset(0);
  }, [queryText]);

  const syncAccountDetail = useCallback((nextDetail: AccountDetail) => {
    const nextMessageCount = getDisplayMessageCount(nextDetail);
    const syncedDetail = {
      ...nextDetail,
      account: {
        ...nextDetail.account,
        messageCount: nextMessageCount,
      },
    };

    setDetail(syncedDetail);
    setAccounts((currentAccounts) =>
      currentAccounts?.map((account) =>
        account.id === syncedDetail.account.id
          ? { ...account, messageCount: Math.max(account.messageCount, nextMessageCount) }
          : account,
      ) ?? currentAccounts,
    );
  }, []);

  const loadAccountDetail = useCallback(
    (options: { preserveDetail?: boolean } = {}) => {
      if (!selectedId) {
        setDetail(null);
        return Promise.resolve();
      }

      setDetailError(null);
      closeMessage();
      setIsDetailLoading(true);
      setIsDetailRefreshing(Boolean(options.preserveDetail));
      if (!options.preserveDetail) {
        setDetail(null);
      }

      return client
        .getAccount(selectedId, { limit: pageSize, offset: messageOffset })
        .then(syncAccountDetail)
        .catch(() => setDetailError("Unable to load mailbox account details."))
        .finally(() => {
          setIsDetailLoading(false);
          setIsDetailRefreshing(false);
        });
    },
    [client, closeMessage, messageOffset, selectedId, syncAccountDetail],
  );

  useEffect(() => {
    let cancelled = false;

    if (!selectedId) {
      setDetail(null);
      return;
    }

    setDetailError(null);
    closeMessage();
    setIsDetailLoading(true);
    setDetail(null);
    client
      .getAccount(selectedId, { limit: pageSize, offset: messageOffset })
      .then((nextDetail) => {
        if (!cancelled) syncAccountDetail(nextDetail);
      })
      .catch(() => {
        if (!cancelled) setDetailError("Unable to load mailbox account details.");
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, closeMessage, messageOffset, selectedId, syncAccountDetail]);

  useEffect(() => {
    setMessageOffset(0);
  }, [selectedId]);

  if (error) return <ErrorState message={error} />;
  if (!accounts && !isAccountsLoading) return <LoadingState label="Loading accounts" />;

  const visibleAccounts = accounts ?? [];
  const totalPages = Math.max(1, Math.ceil(totalAccounts / pageSize));
  const currentPage = Math.floor(pageOffset / pageSize) + 1;
  const canGoPrevious = pageOffset > 0;
  const canGoNext = pageOffset + pageSize < totalAccounts;
  const pageItems = createPaginationItems(currentPage, totalPages);
  const messageTotal = detail?.messagesTotal ?? 0;
  const messageTotalPages = Math.max(1, Math.ceil(messageTotal / pageSize));
  const messageCurrentPage = Math.floor(messageOffset / pageSize) + 1;
  const messagePageItems = createPaginationItems(messageCurrentPage, messageTotalPages);
  const canGoPreviousMessages = messageOffset > 0;
  const canGoNextMessages = detail ? messageOffset + pageSize < detail.messagesTotal : false;
  const goToPage = (nextPage: number) => {
    setPageOffset((nextPage - 1) * pageSize);
  };
  const goToMessagePage = (nextPage: number) => {
    setMessageOffset((nextPage - 1) * pageSize);
  };
  const enterAccount = (account: AdminAccount) => {
    setMessageOffset(0);
    setSelectedId(account.id);
    setAccountMenu(null);
  };
  const openAccountMenuOnHover = (accountId: string) => {
    setAccountMenu({ accountId, mode: "hover" });
  };
  const closeAccountMenuOnHover = (accountId: string) => {
    setAccountMenu((current) => (current?.accountId === accountId && current.mode === "hover" ? null : current));
  };
  const toggleAccountMenuOnClick = (accountId: string) => {
    setAccountMenu((current) =>
      current?.accountId === accountId && current.mode === "click" ? null : { accountId, mode: "click" },
    );
  };
  const requestDeleteAccount = (account: AdminAccount) => {
    setDeleteError(null);
    setDeleteTarget(account);
    setAccountMenu(null);
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

    setAccountMenu(null);
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
  const copyAccountEmail = async (account: AdminAccount) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(account.ownerEmail);
      toast({
        title: "Email copied",
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
  const openCreateDialog = () => {
    setCreatePrefix("");
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };
  const closeCreateDialog = () => {
    if (isCreating) return;
    setIsCreateDialogOpen(false);
    setCreatePrefix("");
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
    try {
      const account = await client.createAddress({ prefix });
      toast({
        title: "Mailbox account created",
        description: account.ownerEmail,
      });
      setIsCreateDialogOpen(false);
      setCreatePrefix("");
      setSelectedId(account.id);
      setMessageOffset(0);
      setAccountsReloadKey((key) => key + 1);
    } catch {
      setCreateError("Unable to create this mailbox account.");
      toast({
        title: "Create failed",
        description: `Could not create ${prefix}@${mailboxDomain}. Try again later.`,
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
      if (selectedId === deleteTarget.id) {
        setSelectedId("");
        setDetail(null);
      }
      toast({
        title: "Mailbox address deleted",
        description: `${deleteTarget.ownerEmail} was deleted from the mailbox service.`,
      });
      setDeleteTarget(null);
      setAccountsReloadKey((key) => key + 1);
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

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-3xl">Accounts</CardTitle>
            <CardDescription>All mailbox service accounts.</CardDescription>
          </div>
          <Button className="w-full flex-none sm:w-auto" onClick={openCreateDialog} type="button">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New mailbox account
          </Button>
        </CardHeader>
        <CardContent>
          <Input
            className="h-12 rounded-[16px]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts"
          />
          <div className="responsive-table-wrap relative mt-5 overflow-visible">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="bg-white/45">
                  <TableHead>Account</TableHead>
                  <TableHead className="w-24 pr-6 text-right">Mail</TableHead>
                  <TableHead className="w-28 px-3 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAccountsLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12">
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Loading accounts...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {!isAccountsLoading ? visibleAccounts.map((account) => (
                  <TableRow
                    className={account.id === selectedId ? "bg-accent/55" : "hover:bg-white/45"}
                    key={account.id}
                  >
                    <TableCell className="min-w-0 py-3">
                      <Button
                        variant="ghost"
                        className="h-auto min-w-0 w-full justify-start rounded-[14px] p-3 text-left"
                        onClick={() => {
                          setMessageOffset(0);
                          setSelectedId(account.id);
                        }}
                        aria-label={`Open ${account.ownerEmail} account`}
                      >
                        <span className="min-w-0">
                          <strong className="block min-w-0 truncate font-black">{account.ownerEmail}</strong>
                        </span>
                      </Button>
                    </TableCell>
                    <TableCell className="pr-6 text-right font-bold">{account.messageCount}</TableCell>
                    <TableCell className="w-28 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          aria-label={`Copy ${account.ownerEmail}`}
                          className="h-9 w-9 rounded-full text-muted-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyAccountEmail(account);
                          }}
                          size="icon"
                          title={`Copy ${account.ownerEmail}`}
                          type="button"
                          variant="ghost"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <AccountActionsMenu
                          account={account}
                          isOpen={accountMenu?.accountId === account.id}
                          onClose={() => setAccountMenu(null)}
                          onAccessLink={() => void requestAccessLink(account)}
                          onDelete={() => requestDeleteAccount(account)}
                          onEnter={() => enterAccount(account)}
                          onHoverClose={() => closeAccountMenuOnHover(account.id)}
                          onHoverOpen={() => openAccountMenuOnHover(account.id)}
                          onToggle={() => toggleAccountMenuOnClick(account.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )) : null}
                {!isAccountsLoading && visibleAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12">
                      <EmptyState
                        title="No accounts found"
                        description="No mailbox accounts match the current view."
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </table>
          </div>
          {!isAccountsLoading ? (
            <PaginationNav
              ariaLabel="Accounts pagination"
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              currentPage={currentPage}
              onNext={() => setPageOffset(pageOffset + pageSize)}
              onPage={goToPage}
              onPrevious={() => setPageOffset(Math.max(0, pageOffset - pageSize))}
              pageItems={pageItems}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>Account details</CardTitle>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
              <CardDescription className="min-w-0 truncate">{detail?.account.ownerEmail ?? "Selected account"}</CardDescription>
              {detail?.account.createdAt ? (
                <CardDescription className="flex-none">
                  Created: {formatDatabaseDateTime(detail.account.createdAt)}
                </CardDescription>
              ) : null}
              {detail ? (
                <Badge className="flex-none" variant="secondary">
                  {detail.account.messageCount} message{detail.account.messageCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          </div>
          <Button
            aria-label="Refresh account messages"
            className="flex-none"
            disabled={!detail || isDetailLoading}
            onClick={() => void loadAccountDetail({ preserveDetail: true })}
            size="icon"
            variant="secondary"
          >
            <RefreshCw className={isDetailRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          {isDetailRefreshing ? <InlineLoading label="Refreshing messages" className="mb-4" /> : null}
          {detailError ? (
            <ErrorState message={detailError} />
          ) : !selectedId ? (
            <EmptyState
              title="No account selected"
              description="Select or create a mailbox account to view messages."
            />
          ) : detail ? (
            <div className="grid gap-4">
              {detail.messages.length === 0 ? (
                <div>
                  <EmptyState title="No messages found" description="This mailbox has no readable messages from the admin mail endpoint." />
                </div>
              ) : (
                <div className="overflow-hidden rounded-[22px] border border-white/70 bg-white/42">
                  {detail.messages.map((message) => (
                    <AccountMessageRow key={message.id} message={message} onOpen={() => openMessage(message)} />
                  ))}
                </div>
              )}
              <PaginationNav
                ariaLabel="Account messages pagination"
                canGoNext={canGoNextMessages}
                canGoPrevious={canGoPreviousMessages}
                currentPage={messageCurrentPage}
                onNext={() => setMessageOffset(messageOffset + pageSize)}
                onPage={goToMessagePage}
                onPrevious={() => setMessageOffset(Math.max(0, messageOffset - pageSize))}
                pageItems={messagePageItems}
              />
            </div>
          ) : (
            <LoadingState label="Loading account detail" />
          )}
        </CardContent>
      </Card>
      {pendingMessage ? <MessageDetailLoading /> : null}
      {selectedMessage ? (
        <MessageDetailDialog message={selectedMessage} onClose={closeMessage} />
      ) : null}
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
          error={createError}
          isCreating={isCreating}
          onCancel={closeCreateDialog}
          onConfirm={() => void createMailboxAccount()}
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

function AccountMessageRow({ message, onOpen }: { message: MailMessage; onOpen: () => void }) {
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
      className="grid w-full cursor-pointer gap-2 border-b border-border p-4 text-left transition last:border-b-0 hover:bg-white/55"
      onClick={onOpen}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label={`Open message ${message.subject}`}
            className="min-w-0 max-w-full truncate rounded-[10px] text-left font-black text-foreground outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <span className="block min-w-0 truncate">{message.subject}</span>
          </button>
          {verificationCode ? (
            <Button
              aria-label={`Copy code ${verificationCode}`}
              className="h-7 flex-none rounded-full border-primary/20 bg-primary/10 px-2 text-xs font-black text-primary hover:bg-primary/15"
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

function getDisplayMessageCount(detail: AccountDetail) {
  return Math.max(
    detail.account.messageCount,
    detail.messagesTotal,
    detail.messagesOffset + detail.messages.length,
  );
}

function getAccountAddressId(account: AdminAccount) {
  return account.addresses.find((address) => address.isPrimary)?.id ?? account.addresses[0]?.id ?? account.id;
}

function buildMailboxAccessLink(jwt: string) {
  const url = new URL(publicMailboxUrl);
  url.searchParams.set("jwt", jwt);
  return url.toString();
}

function sanitizeMailboxPrefix(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 64);
}

function normalizeMailboxPrefix(value: string) {
  return sanitizeMailboxPrefix(value.trim()).replace(/^[._-]+|[._-]+$/g, "");
}

function validateMailboxPrefix(prefix: string) {
  if (!prefix) return "Enter a mailbox prefix.";
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(prefix)) {
    return "Use 1-64 letters, numbers, dots, underscores, or hyphens. Start and end with a letter or number.";
  }
  return null;
}

function generateMailboxPrefix() {
  const name = randomMailboxNames[Math.floor(Math.random() * randomMailboxNames.length)] ?? "alex";
  const digitsLength = 2 + Math.floor(Math.random() * 5);
  const min = 10 ** (digitsLength - 1);
  const max = 10 ** digitsLength - 1;
  const digits = String(min + Math.floor(Math.random() * (max - min + 1)));

  return `${name}${digits}`;
}

function CreateAccountDialog({
  error,
  isCreating,
  onCancel,
  onConfirm,
  onGenerate,
  onPrefixChange,
  prefix,
}: {
  error: string | null;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onGenerate: () => void;
  onPrefixChange: (value: string) => void;
  prefix: string;
}) {
  const preview = `${normalizeMailboxPrefix(prefix) || "prefix"}@${mailboxDomain}`;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  const dialog = (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#151a27]/35 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <article
        aria-labelledby="create-account-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-[24px] border border-white/70 bg-card p-6 shadow-frame backdrop-blur-xl"
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
            <div className="mt-2 flex min-w-0 items-center rounded-[16px] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] focus-within:ring-2 focus-within:ring-ring">
              <Input
                autoFocus
                className="h-12 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isCreating}
                id="mailbox-prefix"
                inputMode="email"
                onChange={(event) => onPrefixChange(event.target.value)}
                placeholder="support"
                value={prefix}
              />
              <span className="min-w-0 flex-none truncate pr-3 text-sm font-bold text-muted-foreground">
                @{mailboxDomain}
              </span>
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

function AccessLinkLoading() {
  const dialog = (
    <div
      aria-label="Generating access link"
      className="fixed inset-0 z-50 grid place-items-center bg-[#151a27]/20 px-4 py-6 backdrop-blur-[2px]"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-[18px] border border-white/70 bg-card px-5 py-4 text-sm font-black text-foreground shadow-frame backdrop-blur-xl">
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        <span>Generating access link...</span>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function AccessLinkDialog({
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
      className="fixed inset-0 z-50 grid place-items-center bg-[#151a27]/35 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <article
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-xl rounded-[24px] border border-white/70 bg-card p-6 shadow-frame backdrop-blur-xl"
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
          className="mt-5 max-h-52 overflow-auto rounded-[16px] border border-white/70 bg-white/72 p-4 font-mono text-xs leading-6 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] break-all"
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

function AccountActionsMenu({
  account,
  isOpen,
  onAccessLink,
  onClose,
  onDelete,
  onEnter,
  onHoverClose,
  onHoverOpen,
  onToggle,
}: {
  account: AdminAccount;
  isOpen: boolean;
  onAccessLink: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEnter: () => void;
  onHoverClose: () => void;
  onHoverOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="relative flex justify-end"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          onHoverClose();
        }
      }}
      onFocus={onHoverOpen}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
      onMouseEnter={onHoverOpen}
      onMouseLeave={onHoverClose}
    >
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Account actions for ${account.ownerEmail}`}
        className="h-9 w-9 rounded-full"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        size="icon"
        variant="ghost"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
      {isOpen ? (
        <div
          aria-label={`Actions for ${account.ownerEmail}`}
          className="absolute right-0 top-10 z-30 min-w-28 overflow-hidden rounded-[16px] border border-white/70 bg-white/80 p-1 text-sm shadow-glass backdrop-blur-xl"
          role="menu"
        >
          <button
            className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left font-bold text-foreground hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              onEnter();
            }}
            role="menuitem"
            type="button"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Open
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left font-bold text-foreground hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              onAccessLink();
            }}
            role="menuitem"
            type="button"
          >
            <Link className="h-4 w-4" aria-hidden="true" />
            Link
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left font-bold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            role="menuitem"
            type="button"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DeleteAccountDialog({
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
      className="fixed inset-0 z-50 grid place-items-center bg-[#151a27]/35 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <article
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-[24px] border border-white/70 bg-card p-6 shadow-frame backdrop-blur-xl"
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
            className="mt-4 flex items-center gap-2 rounded-[14px] border border-red-200 bg-red-50/70 px-3 py-2 text-sm font-bold text-red-800"
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

function createPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
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

function PaginationNav({
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
              className={item === currentPage ? "h-10 w-10 border border-white/70 bg-white/70" : "h-10 w-10"}
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

function InlineLoading({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-border bg-white/55 px-4 py-3 text-sm font-medium text-muted-foreground ${className}`}
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}...</span>
    </div>
  );
}
