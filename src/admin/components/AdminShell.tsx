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
import { VmailLogo } from "../../components/ui/vmail-logo";
import { Button } from "./ui/button";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/accounts", label: "Accounts", icon: Users },
  { to: "/admin/settings", label: "Mail Setting", icon: Settings },
  { to: "/admin/status", label: "Service Check", icon: Server },
];

export function AdminShell() {
  const auth = useAdminAuth();

  return (
    <div className="page-shell text-foreground">
      <div className="site-frame" data-testid="admin-site-frame">
        <div className="site-layer flex h-screen">
          <aside className="sticky top-0 w-[64px] flex-none flex flex-col overflow-y-auto h-full border-r border-border bg-card md:w-[240px]">
            <div className="flex items-center gap-2.5 border-b border-border p-4">
              <VmailLogo className="h-8 w-8 flex-none" />
              <strong className="hidden text-sm font-semibold tracking-tight text-foreground md:block">
                V-Mail Admin
              </strong>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin"}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")
                  }
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 flex-none" aria-hidden="true" />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2 border-t border-border p-3">
              <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="hidden min-w-0 flex-1 md:block">
                <div className="truncate text-sm font-medium text-foreground">Super Admin</div>
                <div className="truncate text-xs text-muted-foreground">Administrator</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-none rounded-full"
                type="button"
                onClick={auth.logout}
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
