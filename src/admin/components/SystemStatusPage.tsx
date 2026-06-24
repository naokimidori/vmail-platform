import { useEffect, useMemo, useState } from "react";
import { Server } from "lucide-react";

import { createAdminClient } from "../api/adminClient";
import type { SystemStatus as SystemStatusType } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { apiBaseUrl } from "../../config/env";
import { formatBeijingDateTime } from "../utils/date";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ErrorState, LoadingState } from "./States";

const apiBase = apiBaseUrl;

export function SystemStatusPage() {
  const auth = useAdminAuth();
  const [status, setStatus] = useState<SystemStatusType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBase, getCredential: () => auth.credential }),
    [auth.credential],
  );

  const load = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const next = await client.getStatus();
      setStatus(next);
    } catch {
      setError("Unable to read system status.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  if (error) return <ErrorState message={error} />;
  if (!status) return <LoadingState label="Checking service" />;

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-xl">Service Check</CardTitle>
            <CardDescription className="mt-1">
              Whether the admin statistics endpoint is reachable.
            </CardDescription>
          </div>
          <Button
            aria-label="Refresh service status"
            className="flex-none"
            disabled={isRefreshing}
            onClick={load}
            size="icon"
            variant="secondary"
          >
            <Server className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          <StatusItem status={status} />
          <p className="mt-4 text-xs text-muted-foreground">
            Last checked {formatBeijingDateTime(status.checkedAt)} · {status.message}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function StatusItem({ status }: { status: SystemStatusType }) {
  const variant = status.status === "healthy" ? "success" : status.status === "degraded" ? "warning" : "secondary";
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Server className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <strong className="block text-base font-semibold text-foreground">Statistics API</strong>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {status.latencyMs === null ? "Latency unavailable" : `Latency ${status.latencyMs} ms`}
          </p>
        </div>
      </div>
      <Badge variant={variant}>{status.status}</Badge>
    </article>
  );
}
