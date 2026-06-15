export const ADMIN_CREDENTIAL_STORAGE_KEY = "v-mail-admin-credential";

function getDefaultStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

export function readAdminCredential(storage = getDefaultStorage()): string | null {
  return storage?.getItem(ADMIN_CREDENTIAL_STORAGE_KEY) ?? null;
}

export function writeAdminCredential(
  credential: string,
  storage = getDefaultStorage(),
): void {
  storage?.setItem(ADMIN_CREDENTIAL_STORAGE_KEY, credential);
}

export function clearAdminCredential(storage = getDefaultStorage()): void {
  storage?.removeItem(ADMIN_CREDENTIAL_STORAGE_KEY);
}
