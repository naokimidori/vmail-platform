import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";

import { createAdminClient } from "../api/adminClient";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { adminApiBaseUrl } from "../config/env";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { TechLogo } from "./TechLogo";

const apiBaseUrl = adminApiBaseUrl;

export function LoginScreen() {
  const auth = useAdminAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const candidate = password.trim();
    if (!candidate) {
      setError("Enter the admin password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const client = createAdminClient({
        baseUrl: apiBaseUrl,
        getCredential: () => candidate,
      });
      await client.getStatus();
      auth.login(candidate);
    } catch {
      setError("Admin password was rejected.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell text-foreground">
      <div className="site-frame grid place-items-center" data-testid="login-site-frame">
        <section
          className="site-layer login-layout-grid grid min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]"
          style={{ width: "min(100%, calc(100vw - 48px))", maxWidth: "64rem" }}
        >
          <div className="min-w-0 max-w-2xl">
            <p className="section-kicker">Admin Console</p>
            <h1 className="mb-6 max-w-full break-words text-[clamp(2rem,9vw,5.8rem)] font-black leading-[1.02] text-foreground">
              Mail console.
            </h1>
            <p className="max-w-xl text-[clamp(1rem,1.6vw,1.24rem)] leading-8 text-muted-foreground">
              Use the existing admin password to open the management console.
            </p>
          </div>

          <Card className="hero-card min-w-0 w-full max-w-full overflow-hidden rounded-[28px]">
            <CardHeader className="space-y-4 p-6 pb-4 sm:p-8 sm:pb-4">
              <TechLogo className="h-14 w-14" />
              <div>
                <p className="section-kicker">V-Mail Admin</p>
                <CardTitle className="mt-2 text-3xl text-foreground">Super admin access</CardTitle>
                <CardDescription className="mt-3">
                  Use the existing admin password to open the management console.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 sm:p-8 sm:pt-2">
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="text-sm font-bold" htmlFor="admin-password">
                  Admin password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    className="h-12 rounded-[16px] pl-10"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
                <Button className="h-12 w-full rounded-[16px] font-black" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Checking..." : "Enter dashboard"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
