const KEY = 'sylve-cookie-consent'

/** 'accepted' | 'essential' | null (not chosen yet). */
export function getCookieConsent() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setCookieConsent(value) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // storage blocked -- the banner will just show again next visit
  }
}

/** Anything optional (analytics, etc.) added later should check this first. */
export function optionalCookiesAllowed() {
  return getCookieConsent() === 'accepted'
}

export const OPEN_COOKIE_SETTINGS = 'sylve:open-cookie-settings'
