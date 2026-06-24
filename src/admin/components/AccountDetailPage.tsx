import { ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { createAdminClient } from "../api/adminClient";
import type { AccountDetail } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { apiBaseUrl } from "../../config/env";
import { formatDatabaseDateTime } from "../utils/date";
import { MessageDetailDialog, MessageDetailLoading, useMessageDetailTransition } from "./MessageDetailDialog";
import { EmptyState, ErrorState, LoadingState } from "./States";
import {
  AccountMessageRow,
  AccountMessageTableRow,
  InlineLoading,
  MessageTableSkeleton,
  PaginationNav,
  createPaginationItems,
  getDisplayMessageCount,
} from "./accounts-components";
import { ACCOUNTS_PAGE_SIZE } from "./accounts-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const apiBase = apiBaseUrl;

export function AccountDetailPage() {
  const { email } = useParams<{ email: string }>();
  const auth = useAdminAuth();
  const decodedEmail = email ? decodeURIComponent(email) : "";
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const { closeMessage, openMessage, pendingMessage, selectedMessage } = useMessageDetailTransition();
  const [reloadKey, setReloadKey] = useState(0);

  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBaseUrl, getCredential: () => auth.credential }),
    [auth.credential],
  );

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
  }, []);

  const loadAccountDetail = useCallback(
    (options: { preserveDetail?: boolean } = {}) => {
      if (!decodedEmail) {
        return Promise.resolve();
      }

      setError(null);
      closeMessage();
      setIsDetailLoading(true);
      setIsDetailRefreshing(Boolean(options.preserveDetail));
      if (!options.preserveDetail) {
        setDetail(null);
      }

      return client
        .getAccount(decodedEmail, { limit: ACCOUNTS_PAGE_SIZE, offset: messageOffset })
        .then(syncAccountDetail)
        .catch(() => setError("Unable to load mailbox account details."))
        .finally(() => {
          setIsDetailLoading(false);
          setIsDetailRefreshing(false);
        });
    },
    [client, closeMessage, decodedEmail, messageOffset, syncAccountDetail],
  );

  useEffect(() => {
    let cancelled = false;

    if (!decodedEmail) {
      setError("Account email is missing from the URL.");
      return;
    }

    setError(null);
    closeMessage();
    setIsDetailLoading(true);
    setDetail(null);
    client
      .getAccount(decodedEmail, { limit: ACCOUNTS_PAGE_SIZE, offset: messageOffset })
      .then((nextDetail) => {
        if (!cancelled) syncAccountDetail(nextDetail);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load mailbox account details.");
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, closeMessage, decodedEmail, messageOffset, reloadKey, syncAccountDetail]);

  useEffect(() => {
    setMessageOffset(0);
  }, [decodedEmail]);

  if (error) return <ErrorState message={error} />;

  const currentCrumb = detail?.account.ownerEmail ?? decodedEmail;

  return (
    <section className="grid gap-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link to="/admin/accounts" className="transition hover:text-foreground">
          Accounts
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate text-foreground">{currentCrumb}</span>
      </nav>

      {!detail ? (
        <LoadingState label="Loading account" />
      ) : (
        <DetailContent
          detail={detail}
          isDetailLoading={isDetailLoading}
          isDetailRefreshing={isDetailRefreshing}
          messageOffset={messageOffset}
          setMessageOffset={setMessageOffset}
          loadAccountDetail={loadAccountDetail}
          openMessage={openMessage}
        />
      )}

      {pendingMessage ? <MessageDetailLoading /> : null}
      {selectedMessage ? (
        <MessageDetailDialog message={selectedMessage} onClose={closeMessage} />
      ) : null}
    </section>
  );
}

type DetailContentProps = {
  detail: AccountDetail;
  isDetailLoading: boolean;
  isDetailRefreshing: boolean;
  messageOffset: number;
  setMessageOffset: (n: number) => void;
  loadAccountDetail: (options?: { preserveDetail?: boolean }) => Promise<void>;
  openMessage: (message: import("../api/types").MailMessage) => void;
};

function DetailContent({
  detail,
  isDetailLoading,
  isDetailRefreshing,
  messageOffset,
  setMessageOffset,
  loadAccountDetail,
  openMessage,
}: DetailContentProps) {
  const messageTotal = detail.messagesTotal;
  const messageTotalPages = Math.max(1, Math.ceil(messageTotal / ACCOUNTS_PAGE_SIZE));
  const messageCurrentPage = Math.floor(messageOffset / ACCOUNTS_PAGE_SIZE) + 1;
  const messagePageItems = createPaginationItems(messageCurrentPage, messageTotalPages);
  const canGoPreviousMessages = messageOffset > 0;
  const canGoNextMessages = messageOffset + ACCOUNTS_PAGE_SIZE < detail.messagesTotal;
  const goToMessagePage = (nextPage: number) => {
    setMessageOffset((nextPage - 1) * ACCOUNTS_PAGE_SIZE);
  };
  const messageCount = detail.account.messageCount;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {detail.account.ownerEmail}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {detail.account.createdAt ? (
              <span className="flex-none">Created: {formatDatabaseDateTime(detail.account.createdAt)}</span>
            ) : null}
            <Badge className="flex-none" variant="secondary">
              {messageCount} message{messageCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
        <Button
          aria-label="Refresh account messages"
          className="flex-none gap-2"
          disabled={isDetailLoading}
          onClick={() => void loadAccountDetail({ preserveDetail: true })}
          size="sm"
          variant="secondary"
        >
          <RefreshCw className={isDetailRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">
                Messages
                {messageTotal > 0 ? (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{messageTotal} total</span>
                ) : null}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isDetailRefreshing ? <InlineLoading label="Refreshing messages" className="mb-0" /> : null}
          {detail.messages.length === 0 ? (
            <EmptyState
              title="No messages found"
              description="This mailbox has no readable messages from the admin mail endpoint."
            />
          ) : (
            <>
              <div className="responsive-table-wrap">
                <table className="w-full caption-bottom text-sm">
                  <colgroup>
                    <col className="w-[min(280px,45%)]" />
                    <col className="w-[min(180px,25%)]" />
                    <col className="w-28" />
                    <col className="w-12" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 pr-3">Subject</TableHead>
                      <TableHead className="px-4">From</TableHead>
                      <TableHead className="px-4">Received</TableHead>
                      <TableHead className="pr-4 pl-3"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isDetailRefreshing ? <MessageTableSkeleton /> : null}
                    {!isDetailRefreshing && detail.messages.map((message) => (
                      <AccountMessageTableRow
                        key={message.id}
                        message={message}
                        onOpen={() => openMessage(message)}
                      />
                    ))}
                  </TableBody>
                </table>
              </div>
              <div className="border-t border-border/60 px-4 py-3">
                <PaginationNav
                  ariaLabel="Account messages pagination"
                  canGoNext={canGoNextMessages}
                  canGoPrevious={canGoPreviousMessages}
                  currentPage={messageCurrentPage}
                  onNext={() => setMessageOffset(messageOffset + ACCOUNTS_PAGE_SIZE)}
                  onPage={goToMessagePage}
                  onPrevious={() => setMessageOffset(Math.max(0, messageOffset - ACCOUNTS_PAGE_SIZE))}
                  pageItems={messagePageItems}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}