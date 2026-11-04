export type BrowserStoragePersistence = "local" | "session" | "memory";

const warnedKeys = new Set<string>();

function warnOnce(key: string, message: string, error: unknown) {
  const warningKey = `${message}:${key}`;
  if (warnedKeys.has(warningKey)) return;
  warnedKeys.add(warningKey);
  console.warn(message, { key, error });
}

/**
 * Browser storage is preference persistence, never an analytical dependency.
 * A full or unavailable origin must not abort a React effect or blank a panel.
 */
export function setBrowserStorageItem(
  key: string,
  value: string,
): BrowserStoragePersistence {
  if (typeof window === "undefined") return "memory";
  try {
    window.localStorage.setItem(key, value);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // A successful durable write is sufficient.
    }
    return "local";
  } catch (error) {
    warnOnce(key, "Local browser storage unavailable; using tab storage", error);
  }
  try {
    window.sessionStorage.setItem(key, value);
    return "session";
  } catch (error) {
    warnOnce(key, "Tab browser storage unavailable; using live memory", error);
    return "memory";
  }
}

/** Read the active tab fallback before an older durable preference. */
export function getBrowserStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue !== null) return sessionValue;
  } catch {
    // Continue to durable storage.
  }
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    warnOnce(key, "Browser storage could not be read", error);
    return null;
  }
}
