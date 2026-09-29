// Older builds stored the parent's email, password and PIN here in plain text
// for "quick login". Credentials must never live in browser storage; this module
// only wipes whatever an older build left behind.
const LEGACY_KEY = "centsibility.parent.quicklogin";

export function purgeStoredCredentials() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage unavailable: nothing to purge */
  }
}
