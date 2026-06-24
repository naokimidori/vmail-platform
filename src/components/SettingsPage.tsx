import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { UserSettings } from "../api/types";
import { createUserClient } from "../api/userClient";
import { useUserAuth } from "../auth/UserAuthContext";
import { apiBaseUrl } from "../config/env";
import { ErrorState, LoadingState } from "./States";
import { SectionHeader } from "./UserShell";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const apiBase = apiBaseUrl;

export function SettingsPage() {
  const auth = useUserAuth();
  const { refreshToken, token } = auth;
  const client = useMemo(() => createUserClient({ baseUrl: apiBase, getUserToken: () => token }), [token]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .getSettings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        if (value.refreshedUserToken) {
          refreshToken(value.refreshedUserToken);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, refreshToken]);

  if (error) return <ErrorState message={error} />;
  if (!settings) return <LoadingState label="Loading settings" />;

  return (
    <section className="min-w-0">
      <SectionHeader title="Settings" description="Your account identity and V-Mail API session state." />
      <Card className="hero-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Account
          </CardTitle>
          <CardDescription>User API settings returned by the Worker.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Info label="Email" value={settings.userEmail} />
          <Info label="User ID" value={settings.userId} />
          <Info label="Role" value={settings.role ?? "none"} />
          <div>
            <p className="section-kicker mb-2">Admin role</p>
            <Badge variant={settings.isAdmin ? "accent" : "secondary"}>{settings.isAdmin ? "yes" : "no"}</Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-white/70 bg-white/46 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <p className="section-kicker mb-2">{label}</p>
      <p className="break-all text-sm font-black text-foreground">{value}</p>
    </div>
  );
}
