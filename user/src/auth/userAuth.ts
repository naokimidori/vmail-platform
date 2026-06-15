export const USER_TOKEN_STORAGE_KEY = "v-mail-user-token";
export const USER_EMAIL_STORAGE_KEY = "v-mail-user-email";

export interface StoredUserSession {
  email: string;
  token: string;
}

export function readUserSession(): StoredUserSession | null {
  const token = window.localStorage.getItem(USER_TOKEN_STORAGE_KEY);
  const email = window.localStorage.getItem(USER_EMAIL_STORAGE_KEY);
  if (!token || !email) return null;
  return { email, token };
}

export function writeUserSession(session: StoredUserSession) {
  window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, session.token);
  window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, session.email);
}

export function updateUserToken(token: string) {
  const email = window.localStorage.getItem(USER_EMAIL_STORAGE_KEY);
  if (!email) return;
  writeUserSession({ email, token });
}

export function clearUserSession() {
  window.localStorage.removeItem(USER_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
}
