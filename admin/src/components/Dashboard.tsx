import { useEffect, useState } from "react";
import { Mail, Server, Users } from "lucide-react";

import { createAdminClient } from "../api/adminClient";
import type { DashboardData } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { adminApiBaseUrl, mailboxDomain } from "../config/env";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ErrorState, LoadingState } from "./States";

const apiBaseUrl = adminApiBaseUrl;

export function Dashboard() {
  const auth = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createAdminClient({ baseUrl: apiBaseUrl, getCredential: () => auth.credential });
    setData(null);
    setError(null);
    client
      .getDashboard()
      .then(setData)
      .catch(() => setError("Unable to load dashboard data."));
  }, [auth.credential]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dashboard" />;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.35fr)_minmax(280px,0.8fr)]">
      <div className="grid gap-6">
        <Card className="hero-card overflow-hidden p-0" data-testid="dashboard-hero-card">
          <CardContent className="grid min-h-[420px] content-between p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Live service</p>
                <h1 className="text-[clamp(2.2rem,4vw,4.8rem)] font-black leading-[0.96] text-foreground">
                  V-Mail Service
                </h1>
              </div>
              <Badge variant="accent">LIVE</Badge>
            </div>

            <div className="hero-orbit my-6" aria-hidden="true">
              <div className="z-10 grid h-24 w-24 place-items-center rounded-full border-[3px] border-white/80 bg-gradient-to-br from-[#2a2540] to-primary text-xl font-black text-white shadow-[0_16px_30px_rgba(80,92,118,0.18)]">
                VM
              </div>
              <span className="orbit-chip left-5 top-5">{mailboxDomain}</span>
              <span className="orbit-chip bottom-6 left-8 bg-[#eaf8ff]/80">Secure</span>
              <span className="orbit-chip bottom-8 right-6 bg-accent/80 text-accent-foreground">Admin</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatText label="Accounts" value={data.totals.accounts} />
              <StatText label="Messages" value={data.totals.messages} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage / Volume</CardTitle>
            <CardDescription>Monthly operational snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-foreground">{formatNumber(data.totals.messages)}</p>
            <div className="mt-5 h-2 rounded-full bg-white/58">
              <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-[#9ee7ff] via-primary to-white" />
            </div>
            <div className="mt-6 grid gap-4">
              <Progress label="Delivered today" value={data.totals.deliveredToday ?? 0} total={30} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric icon={Users} label="Accounts" value={data.totals.accounts} tone="good" />
          <Metric icon={Mail} label="Addresses" value={data.totals.addresses} tone="watch" />
          <Metric icon={Server} label="Messages" value={data.totals.messages} tone="good" />
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <p className="section-kicker">Inbound stream</p>
              <CardTitle>Mailflow</CardTitle>
              <CardDescription>Inbound messages by recent period</CardDescription>
            </div>
            <span className="rounded-full bg-white/60 px-3 py-1 text-sm font-extrabold text-muted-foreground">Live</span>
          </CardHeader>
          <CardContent>
            <div className="flex h-60 items-end gap-4 overflow-x-auto pb-2">
              {data.mailflow.map((point) => {
                const total = point.delivered + point.failed;
                return (
                  <div className="grid min-w-10 justify-items-center gap-2" key={point.timestamp}>
                    <div
                      className="relative w-7 overflow-hidden rounded-lg bg-[#efe8ff]"
                      style={{ height: `${Math.max(42, total * 5)}px` }}
                    >
                      <span
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary to-[#9ee7ff]"
                        style={{ height: `${Math.max(16, point.delivered * 3)}px` }}
                      />
                    </div>
                    <small className="text-muted-foreground">
                      {new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit" })}
                    </small>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statistic</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto grid h-40 w-40 place-items-center rounded-full bg-[conic-gradient(#7b48df_0_62%,#9ee7ff_62%_80%,rgba(255,255,255,.62)_80%_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white/72 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <span className="text-xs text-muted-foreground">
                  Mail
                  <strong className="block text-2xl text-foreground">{formatNumber(data.totals.messages)}</strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.activity.map((item) => (
              <article className="flex gap-3" key={item.id}>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[14px] bg-accent text-sm font-black text-accent-foreground">
                  {item.title.slice(0, 1)}
                </span>
                <div>
                  <strong className="text-sm">{item.title}</strong>
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function StatText({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[18px] border border-white/70 bg-white/52 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <span className="text-sm text-muted-foreground">{label}</span>
      <strong className="block text-3xl text-foreground">{formatNumber(value)}</strong>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number | null; tone: "good" | "watch" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Badge variant={tone === "good" ? "accent" : "secondary"}>{tone === "good" ? "+ active" : "watch"}</Badge>
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <strong className="mt-4 block text-3xl text-foreground">{formatNumber(value)}</strong>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = Math.min(100, Math.round((value / total) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <strong>{label}</strong>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/58">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatNumber(value: number | null) {
  return value === null ? "N/A" : new Intl.NumberFormat().format(value);
}
