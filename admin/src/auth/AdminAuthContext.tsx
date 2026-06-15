import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from "./adminAuth";

type AdminAuthContextValue = {
  credential: string | null;
  isAuthenticated: boolean;
  login: (credential: string) => void;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(
  undefined,
);

type AdminAuthProviderProps = {
  children: ReactNode;
};

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [credential, setCredential] = useState(() => readAdminCredential());

  const logout = useCallback(() => {
    clearAdminCredential();
    setCredential(null);
  }, []);

  const login = useCallback((nextCredential: string) => {
    const trimmedCredential = nextCredential.trim();

    if (trimmedCredential.length === 0) {
      clearAdminCredential();
      setCredential(null);
      return;
    }

    writeAdminCredential(trimmedCredential);
    setCredential(trimmedCredential);
  }, []);

  const value = useMemo(
    () => ({
      credential,
      isAuthenticated: credential !== null,
      login,
      logout,
    }),
    [credential, login, logout],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }

  return context;
}
