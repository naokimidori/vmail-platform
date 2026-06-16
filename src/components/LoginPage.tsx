import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";

import { createUserClient } from "../api/userClient";
import { useUserAuth } from "../auth/UserAuthContext";
import { userApiBaseUrl } from "../config/env";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

const apiBaseUrl = userApiBaseUrl;

export function LoginPage() {
  const auth = useUserAuth();
  const client = useMemo(() => createUserClient({ baseUrl: apiBaseUrl, getUserToken: () => auth.token }), [auth.token]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const session = await client.login({ email: nextEmail, password });
      auth.login({ email: nextEmail, token: session.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell text-foreground">
      <div className="site-frame grid place-items-center" data-testid="login-site-frame">
        <section
          className="site-layer login-layout-grid grid min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]"
          style={{ width: "min(100%, calc(100vw - 48px))", maxWidth: "64rem" }}
        >
          <div className="min-w-0 max-w-2xl">
            <p className="section-kicker">User Portal</p>
            <h1 className="mb-6 max-w-full break-words text-[clamp(2rem,9vw,5.8rem)] font-black leading-[1.02] text-foreground">
              Temporary mail.
            </h1>
            <p className="max-w-xl text-[clamp(1rem,1.6vw,1.24rem)] leading-8 text-muted-foreground">
              Create inboxes, collect codes, and keep every address tied to your account.
            </p>
          </div>

          <Card className="hero-card min-w-0 w-full max-w-full overflow-hidden rounded-[28px]">
            <CardHeader className="space-y-4 p-6 pb-4 sm:p-8 sm:pb-4">
              <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-primary text-primary-foreground shadow-purple">
                <Mail className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="section-kicker">V-Mail</p>
                <CardTitle className="mt-2 text-3xl text-foreground">Log in to V-Mail</CardTitle>
                <CardDescription className="mt-3">Manage your temporary mailbox accounts.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 sm:p-8 sm:pt-2">
              <form className="grid gap-4" onSubmit={submit}>
                <label className="text-sm font-bold" htmlFor="login-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    className="h-12 rounded-[16px] pl-10"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </div>
                <label className="text-sm font-bold" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    className="h-12 rounded-[16px] pl-10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                  />
                </div>
                {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
                <Button className="h-12 w-full rounded-[16px] font-black" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Logging in..." : "Log in"}
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                New here? <Link className="font-black text-primary hover:text-primary-hover" to="/register">Create an account</Link>
              </p>
              <div className="mt-4 flex justify-center border-t border-border pt-4">
                <Link
                  className="inline-flex min-h-10 items-center gap-2 rounded-[14px] px-3 text-sm font-black text-[#2f3a50] transition hover:bg-white/58 hover:text-foreground"
                  to="/admin"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Admin access
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
