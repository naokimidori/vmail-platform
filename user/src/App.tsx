import { Navigate, Route, Routes } from "react-router-dom";

import { AdminApp } from "./admin/AdminApp";
import { UserAuthProvider, useUserAuth } from "./auth/UserAuthContext";
import { AddressesPage } from "./components/AddressesPage";
import { InboxPage } from "./components/InboxPage";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { SettingsPage } from "./components/SettingsPage";
import { UserShell } from "./components/UserShell";
import { Toaster } from "./components/ui/toaster";

function UserRoutes() {
  const auth = useUserAuth();

  if (!auth.isAuthenticated) {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route element={<UserShell />}>
        <Route index element={<AddressesPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <UserAuthProvider>
      <UserRoutes />
      <Toaster />
    </UserAuthProvider>
  );
}
