import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

import { createAdminClient } from "../api/adminClient";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { apiBaseUrl } from "../../config/env";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DotMap } from "../../components/ui/dot-map";
import { VmailLogo } from "../../components/ui/vmail-logo";

const apiBase = apiBaseUrl;

export function LoginScreen() {
  const auth = useAdminAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

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
        baseUrl: apiBase,
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
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-frame flex flex-col md:flex-row"
        >
          <aside className="relative hidden md:block w-1/2 h-[600px] overflow-hidden border-b md:border-b-0 md:border-r border-border bg-gradient-to-br from-accent/5 via-accent/10 to-accent/5">
            <DotMap />
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-6"
              >
                <VmailLogo className="h-16 w-16 rounded-xl shadow-button" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="text-sm font-semibold text-muted-foreground"
              >
                V-Mail Admin
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="mt-1 text-3xl font-bold text-foreground"
              >
                Mail console.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground"
              >
                Manage mailboxes, registration, and service health from a single place.
              </motion.p>
            </div>
          </aside>

          <section className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center bg-card">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Super admin access</h1>
              <p className="mt-1 text-muted-foreground">Enter the admin password</p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="admin-password" className="block text-sm font-medium text-foreground">
                    Admin password
                  </label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={isPasswordVisible ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition hover:text-foreground"
                      onClick={() => setIsPasswordVisible((value) => !value)}
                    >
                      {isPasswordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onHoverStart={() => setIsButtonHovered(true)}
                  onHoverEnd={() => setIsButtonHovered(false)}
                  className="pt-2"
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative w-full h-11 overflow-hidden bg-gradient-to-r from-accent to-accent-hover hover:from-accent-hover hover:to-accent-hover"
                  >
                    <span className="relative z-10 inline-flex items-center justify-center">
                      {isSubmitting ? "Checking..." : "Enter dashboard"}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </span>
                    {isButtonHovered ? (
                      <motion.span
                        initial={{ left: "-100%" }}
                        animate={{ left: "100%" }}
                        transition={{ duration: 0.9, ease: "easeInOut" }}
                        className="pointer-events-none absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ filter: "blur(8px)" }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </Button>
                </motion.div>

                <div className="flex items-center justify-between text-sm pt-2">
                  <span className="text-muted-foreground">
                    Need a mailbox?{" "}
                    <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/">
                      Open user portal
                    </Link>
                  </span>
                </div>
              </form>
            </motion.div>
          </section>
        </motion.div>
      </div>
    </main>
  );
}
