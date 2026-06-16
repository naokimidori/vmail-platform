import { useEffect, useMemo, useState } from "react";
import { Server } from "lucide-react";

import { createAdminClient } from "../api/adminClient";
import type { SystemStatus } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { adminApiBaseUrl } from "../../config/env";
import { formatBeijingDateTime } from "../utils/date";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ErrorState, LoadingState } from "./States";

const apiBaseUrl = adminApiBaseUrl;

export function SystemStatusPage() {
  const auth = useAdminAuth();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBaseUrl, getCredential: () => auth.credential }),
    [auth.credential],
  );

  useEffect(() => {
    setStatus(null);
    setError(null);
    client
      .getStatus()
      .then(setStatus)
      .catch(() => setError("Unable to read system status."));
  }, [client]);

  if (error) return <ErrorState message={error} />;
  if (!status) return <LoadingState label="Checking service" />;

  return (
    <section className="grid gap-6">
      <Card className="hero-card">
        <CardHeader>
          <p className="section-kicker">Reachability</p>
          <CardTitle className="text-3xl">Service Check</CardTitle>
          <CardDescription>Checks whether the admin statistics endpoint is reachable.</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusItem label="Statistics API" value={status.status} />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Last checked: {formatBeijingDateTime(status.checkedAt)} · {status.message}
      </p>
    </section>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-white/70 bg-white/46 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-[16px] bg-accent text-accent-foreground">
          <Server className="h-5 w-5" aria-hidden="true" />
        </div>
        <strong className="text-xl">{label}</strong>
      </div>
      <Badge variant={value === "healthy" ? "accent" : "secondary"}>{value}</Badge>
    </article>
  );
}
