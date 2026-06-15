import {
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  Server,
  Users,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAdminAuth } from "../auth/AdminAuthContext";
import { Button } from "./ui/button";
import { TechLogo } from "./TechLogo";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Users },
  { to: "/settings", label: "Mail Setting", icon: Settings },
  { to: "/status", label: "Service Check", icon: Server },
];

export function AdminShell() {
  const auth = useAdminAuth();

  return (
    <div className="page-shell text-foreground">
      <div className="site-frame" data-testid="admin-site-frame">
        <div className="site-layer grid min-h-[calc(100vh-76px)] grid-rows-[auto_minmax(0,1fr)] gap-8">
          <header className="top-nav">
            <div className="flex min-w-0 items-center gap-3">
              <TechLogo className="h-10 w-10" />
              <div className="min-w-0">
                <p className="section-kicker mb-0">V-Mail Console</p>
                <strong className="block truncate text-lg font-black text-foreground">V-MAIL</strong>
              </div>
            </div>

            <nav className="top-nav-links" aria-label="Admin navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "relative inline-flex min-h-11 flex-none items-center gap-2 rounded-[14px] px-4 text-sm font-extrabold text-[#2f3a50] transition",
                      isActive
                        ? "bg-white/64 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] after:absolute after:inset-x-4 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-foreground"
                        : "hover:bg-white/45 hover:text-foreground",
                    ].join(" ")
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex justify-end">
              <div className="inline-flex items-center gap-3 rounded-[18px] border border-white/70 bg-white/58 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                </div>
                <strong className="hidden text-sm sm:block">Super Admin</strong>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  type="button"
                  onClick={auth.logout}
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
