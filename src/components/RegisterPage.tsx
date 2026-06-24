import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";

import { createUserClient } from "../api/userClient";
import { useUserAuth } from "../auth/UserAuthContext";
import { apiBaseUrl } from "../config/env";
import { ErrorState, LoadingState } from "./States";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { TurnstileChallenge } from "./TurnstileChallenge";

const apiBase = apiBaseUrl;

export function RegisterPage() {
  const auth = useUserAuth();
  const navigate = useNavigate();
  const client = useMemo(() => createUserClient({ baseUrl: apiBase, getUserToken: () => auth.token }), [auth.token]);
  const [settings, setSettings] = useState<{
    registrationEnabled: boolean;
    mailVerificationEnabled: boolean;
    cfTurnstileSiteKey: string | null;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([client.getOpenSettings(), client.getPublicSettings().catch(() => null)])
      .then(([openSettings, publicSettings]) => {
        if (!cancelled) {
          setSettings({
            registrationEnabled: openSettings.registrationEnabled,
            mailVerificationEnabled: openSettings.mailVerificationEnabled,
            cfTurnstileSiteKey: publicSettings?.cfTurnstileSiteKey ?? null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load registration settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const sendCode = async () => {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("Enter your email before requesting a code.");
      return;
    }
    if (settings?.cfTurnstileSiteKey && !cfToken) {
      setError("Complete the security check before requesting a code.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsSendingCode(true);
    try {
      const result = await client.verifyCode({ email: nextEmail, cfToken: cfToken || undefined });
      if (!result.success) {
        throw new Error("Verification code request was rejected.");
      }
      setNotice(
        result.expirationTtl
          ? `Verification code sent. Check your email. It expires in ${Math.ceil(result.expirationTtl / 60)} minutes.`
          : "Verification code sent. Check your email.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send verification code.");
      setCfToken("");
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleTurnstileToken = useCallback((token: string) => {
    setCfToken(token);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (settings?.mailVerificationEnabled && !code.trim()) {
      setError("Enter the verification code.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await client.register({ email: nextEmail, password, code: code.trim() || undefined });
      const session = await client.login({ email: nextEmail, password });
      auth.login({ email: nextEmail, token: session.token });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !settings) {
    return (
      <main className="page-shell text-foreground">
        <div className="site-frame grid place-items-center">
          <ErrorState message={error} />
        </div>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="page-shell text-foreground">
        <div className="site-frame grid place-items-center">
          <LoadingState label="Loading registration" />
        </div>
      </main>
    );
  }

  if (!settings.registrationEnabled) {
    return (
      <main className="page-shell text-foreground">
        <div className="site-frame grid place-items-center">
          <ErrorState message="User registration is closed." />
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell text-foreground">
      <div className="site-frame grid place-items-center">
        <Card className="hero-card w-full max-w-md overflow-hidden rounded-[28px]">
          <CardHeader className="space-y-4 p-6 pb-4 sm:p-8 sm:pb-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background shadow-soft">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="section-kicker">V-Mail</p>
              <CardTitle className="mt-2 text-3xl text-foreground">Create an account</CardTitle>
              <CardDescription className="mt-3">Register to create and manage temporary mailbox addresses.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-2 sm:p-8 sm:pt-2">
            <form className="grid gap-4" onSubmit={submit}>
              <label className="text-sm font-bold" htmlFor="register-email">Email</label>
              <Input id="register-email" className="h-12 rounded-[16px]" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              <label className="text-sm font-bold" htmlFor="register-password">Password</label>
              <Input id="register-password" className="h-12 rounded-[16px]" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" />
              {settings.mailVerificationEnabled ? (
                <div className="grid gap-3">
                  {settings.cfTurnstileSiteKey ? (
                    <TurnstileChallenge siteKey={settings.cfTurnstileSiteKey} onToken={handleTurnstileToken} resetKey={turnstileResetKey} />
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="min-w-0">
                      <label className="text-sm font-bold" htmlFor="register-code">Verification code</label>
                      <Input id="register-code" className="mt-2 h-12 rounded-[16px]" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" />
                    </div>
                    <Button className="h-12 rounded-[16px]" variant="secondary" disabled={isSendingCode} onClick={sendCode}>
                      {isSendingCode ? "Sending..." : "Send code"}
                    </Button>
                  </div>
                </div>
              ) : null}
              {notice ? <p role="status" className="text-sm font-bold text-emerald-800">{notice}</p> : null}
              {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
              <Button className="h-12 w-full rounded-[16px] font-black" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creating..." : "Create account"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already registered? <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/login">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
