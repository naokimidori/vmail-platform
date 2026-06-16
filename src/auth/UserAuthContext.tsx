import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { clearUserSession, readUserSession, updateUserToken, writeUserSession, type StoredUserSession } from "./userAuth";

type UserAuthContextValue = {
  email: string | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (session: StoredUserSession) => void;
  refreshToken: (token: string) => void;
  logout: () => void;
};

const UserAuthContext = createContext<UserAuthContextValue | undefined>(undefined);

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredUserSession | null>(() => readUserSession());

  const login = useCallback((nextSession: StoredUserSession) => {
    writeUserSession(nextSession);
    setSession(nextSession);
  }, []);

  const refreshToken = useCallback((token: string) => {
    setSession((current) => {
      if (!current || current.token === token) return current;
      updateUserToken(token);
      return { ...current, token };
    });
  }, []);

  const logout = useCallback(() => {
    clearUserSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      email: session?.email ?? null,
      token: session?.token ?? null,
      isAuthenticated: session !== null,
      login,
      refreshToken,
      logout,
    }),
    [login, logout, refreshToken, session],
  );

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (context === undefined) {
    throw new Error("useUserAuth must be used within a UserAuthProvider");
  }
  return context;
}
