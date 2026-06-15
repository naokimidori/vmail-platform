import { useEffect, useMemo, useState } from "react";
import { MailCheck, Save, UserPlus } from "lucide-react";

import { createAdminClient } from "../api/adminClient";
import type { AdminUserSettings } from "../api/types";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { adminApiBaseUrl } from "../config/env";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ErrorState, LoadingState } from "./States";

const apiBaseUrl = adminApiBaseUrl;

export function UserSettingsPage() {
  const auth = useAdminAuth();
  const [settings, setSettings] = useState<AdminUserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const client = useMemo(
    () => createAdminClient({ baseUrl: apiBaseUrl, getCredential: () => auth.credential }),
    [auth.credential],
  );

  useEffect(() => {
    setSettings(null);
    setError(null);
    setNotice(null);
    client
      .getUserSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to read mail settings."));
  }, [client]);

  const update = (patch: Partial<AdminUserSettings>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
    setNotice(null);
  };

  const save = async () => {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await client.updateUserSettings(settings);
      setNotice("Mail settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save mail settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (error && !settings) return <ErrorState message={error} />;
  if (!settings) return <LoadingState label="Loading mail settings" />;

  return (
    <section className="grid gap-6">
      <Card className="hero-card">
        <CardHeader>
          <p className="section-kicker">Mail Access</p>
          <CardTitle className="text-3xl">Mail Setting</CardTitle>
          <CardDescription>Control ordinary-user account creation and email verification.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <SettingSwitch
            checked={settings.registrationEnabled}
            description="Allows new ordinary users to create accounts from the public register page."
            icon={UserPlus}
            label="User registration"
            onChange={(checked) => update({ registrationEnabled: checked })}
          />
          <SettingSwitch
            checked={settings.mailVerificationEnabled}
            description="Requires a verification code before an ordinary-user account is created."
            icon={MailCheck}
            label="Email verification code"
            onChange={(checked) => update({ mailVerificationEnabled: checked })}
          />
          {notice ? <p className="text-sm font-bold text-emerald-800">{notice}</p> : null}
          {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
          <div>
            <Button className="h-11 px-5" disabled={isSaving} onClick={save}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSaving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SettingSwitch({
  checked,
  description,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  icon: typeof UserPlus;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-white/70 bg-white/46 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid h-11 w-11 flex-none place-items-center rounded-[16px] bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <strong className="block text-xl">{label}</strong>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className={[
            "relative h-7 w-12 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            checked
              ? "border-primary bg-primary"
              : "border-[#c8d0df] bg-white/76 shadow-[inset_0_1px_2px_rgba(38,48,68,0.12)]",
          ].join(" ")}
          onClick={() => onChange(!checked)}
        >
          <span
            aria-hidden="true"
            className={[
              "absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-[0_2px_6px_rgba(38,48,68,0.22)] transition-transform duration-200",
              checked ? "translate-x-5" : "translate-x-1",
            ].join(" ")}
          />
        </button>
        <span className={["w-16 text-sm font-black", checked ? "text-primary" : "text-muted-foreground"].join(" ")}>
          {checked ? "Enabled" : "Disabled"}
        </span>
      </div>
    </article>
  );
}
