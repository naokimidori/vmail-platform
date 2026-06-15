import { Navigate, Route, Routes } from "react-router-dom";

import { AdminAuthProvider, useAdminAuth } from "./auth/AdminAuthContext";
import { AccountsPage } from "./components/AccountsPage";
import { AdminShell } from "./components/AdminShell";
import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { SystemStatusPage } from "./components/SystemStatusPage";
import { UserSettingsPage } from "./components/UserSettingsPage";

function ProtectedAdminApp() {
  const auth = useAdminAuth();

  if (!auth.isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="settings" element={<UserSettingsPage />} />
        <Route path="status" element={<SystemStatusPage />} />
        <Route path="search" element={<Navigate to="/admin/accounts" replace />} />
        <Route path="activity" element={<Navigate to="/admin/accounts" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <ProtectedAdminApp />
    </AdminAuthProvider>
  );
}
