import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Mail, RefreshCw, Users } from "lucide-react";

import { createAdminClient } from "../api/adminClient";
import type { DashboardData, SystemHealth } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { apiBaseUrl } from "../../config/env";
import { formatBeijingDateTime } from "../utils/date";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ErrorState, LoadingState } from "./States";

const apiBase = apiBaseUrl;
const autoRefreshIntervalMs = 30_000;

export function Dashboard() {
  const auth = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cancelledRef = useRef(false);

  const refresh = useCallback(
    async (silent: boolean) => {
      if (cancelledRef.current) return;
      if (!silent) setIsRefreshing(true);
      setError(null);
      try {
        const client = createAdminClient({ baseUrl: apiBase, getCredential: () => auth.credential });
        const next = await client.getDashboard();
        if (cancelledRef.current) return;
        setData(next);
      } catch {
        if (cancelledRef.current) return;
        if (!silent) setError("Unable to load dashboard data.");
      } finally {
        if (cancelledRef.current) return;
        if (!silent) setIsRefreshing(false);
      }
    },
    [auth.credential],
  );

  useEffect(() => {
    cancelledRef.current = false;
    void refresh(false);
    const timer = window.setInterval(() => void refresh(true), autoRefreshIntervalMs);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dashboard" />;

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Service health and mailbox activity.</p>
        </div>
        <Button
          aria-label="Refresh dashboard"
          className="gap-2"
          disabled={isRefreshing}
          onClick={() => void refresh(false)}
          size="sm"
          variant="secondary"
        >
          <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <ServiceHealthCard
        checkedAt={data.system.checkedAt}
        latencyMs={data.system.latencyMs}
        status={data.system.status}
        systemMessage={data.system.message}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <AccountsMetricCard accounts={data.totals.accounts} />
        <AddressesMetricCard addresses={data.totals.addresses} />
        <MessagesMetricCard mailflow={data.mailflow} messages={data.totals.messages} />
      </div>

      {data.mailflow.length >= 2 ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Mailflow</CardTitle>
              <CardDescription>Inbound messages by recent period</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-foreground" />
                Delivered
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-warning" />
                Failed
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <MailflowChart points={data.mailflow} />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function ServiceHealthCard({
  checkedAt,
  latencyMs,
  status,
  systemMessage,
}: {
  checkedAt: string;
  latencyMs: number | null;
  status: SystemHealth;
  systemMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">V-Mail Mailbox</CardTitle>
          <HealthBadge status={status} />
        </div>
        <CardDescription className="mt-1">
          {systemMessage || "Mailbox service is reachable."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Latency</dt>
            <dd className="mt-1 flex items-center gap-2 text-base font-semibold">
              {latencyMs !== null ? <LatencyPulse latencyMs={latencyMs} /> : null}
              <span className={latencyTone(latencyMs)}>{formatLatency(latencyMs)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Last checked</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {checkedAt ? formatBeijingDateTime(checkedAt) : "—"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function HealthBadge({ status }: { status: SystemHealth }) {
  if (status === "healthy") return <Badge variant="success">healthy</Badge>;
  if (status === "degraded") return <Badge variant="warning">degraded</Badge>;
  return <Badge variant="secondary">offline</Badge>;
}

function AccountsMetricCard({ accounts }: { accounts: number | null }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">all-time</span>
        </div>
        <strong className="mt-4 block text-3xl font-semibold text-foreground">{formatNumber(accounts)}</strong>
        <p className="mt-1 text-sm text-muted-foreground">Mailbox accounts</p>
      </CardContent>
    </Card>
  );
}

function AddressesMetricCard({ addresses }: { addresses: number | null }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">addresses</span>
        </div>
        <strong className="mt-4 block text-3xl font-semibold text-foreground">{formatNumber(addresses)}</strong>
        <p className="mt-1 text-sm text-muted-foreground">Mailbox addresses</p>
      </CardContent>
    </Card>
  );
}

function MessagesMetricCard({
  mailflow,
  messages,
}: {
  mailflow: DashboardData["mailflow"];
  messages: number | null;
}) {
  const spark = useMemo(() => {
    if (mailflow.length === 0) return [] as number[];
    const max = Math.max(1, ...mailflow.map((point) => point.delivered));
    return mailflow.map((point) => (point.delivered / max) * 100);
  }, [mailflow]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">{mailflow.length >= 2 ? "trend" : "total"}</span>
        </div>
        <strong className="mt-4 block text-3xl font-semibold text-foreground">{formatNumber(messages)}</strong>
        <p className="mt-1 text-sm text-muted-foreground">Messages</p>
        {spark.length >= 2 ? (
          <Sparkline className="mt-3 h-8" values={spark} />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No trend yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function Sparkline({ className, values }: { className?: string; values: number[] }) {
  const w = 120;
  const h = 32;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(h - (v / 100) * h).toFixed(2)}`)
    .join(" ");
  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Recent delivered trend"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground"
        points={points}
      />
    </svg>
  );
}

function MailflowChart({ points }: { points: DashboardData["mailflow"] }) {
  const max = useMemo(() => {
    const peak = Math.max(0, ...points.map((p) => p.delivered + p.failed));
    return Math.max(1, peak);
  }, [points]);

  return (
    <div className="flex h-56 items-end gap-3 overflow-x-auto pb-1" role="img" aria-label="Mailflow chart">
      {points.map((point) => {
        const total = point.delivered + point.failed;
        const totalHeight = Math.max(4, (total / max) * 200);
        const deliveredHeight = total > 0 ? (point.delivered / total) * totalHeight : 0;
        const failedHeight = totalHeight - deliveredHeight;
        const stamp = new Date(point.timestamp);
        const label = `${stamp.getHours().toString().padStart(2, "0")}:${stamp.getMinutes().toString().padStart(2, "0")}`;
        return (
          <div className="grid w-6 flex-none justify-items-center gap-1" key={point.timestamp}>
            <div
              className="flex h-52 w-2 flex-col-reverse overflow-hidden rounded-sm bg-muted"
              style={{ height: `${totalHeight}px` }}
            >
              <div className="w-full bg-foreground" style={{ height: `${deliveredHeight}px` }} />
              <div className="w-full bg-warning" style={{ height: `${failedHeight}px` }} />
            </div>
            <small className="text-[10px] text-muted-foreground">{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat().format(value);
}

function formatLatency(value: number | null): string {
  if (value === null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function latencyTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value < 1000) return "text-success";
  if (value < 3000) return "text-warning";
  return "text-red-600";
}

function latencyDotBg(value: number): string {
  if (value < 1000) return "bg-success";
  if (value < 3000) return "bg-warning";
  return "bg-red-600";
}

function LatencyPulse({ latencyMs }: { latencyMs: number }) {
  const dot = latencyDotBg(latencyMs);
  return (
    <span aria-hidden="true" className="relative inline-flex h-2.5 w-2.5">
      <span
        className={[
          "absolute inset-0 inline-flex rounded-full opacity-75 animate-ping motion-reduce:animate-none",
          dot,
        ].join(" ")}
      />
      <span className={["relative inline-flex h-2.5 w-2.5 rounded-full", dot].join(" ")} />
    </span>
  );
}
