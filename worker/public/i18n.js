import en from "./i18n/en.js";
import pl from "./i18n/pl.js";

const LANGUAGES = { en, pl };

// ?lang= wins (handy for testing), then the browser's preferences.
const wanted = [new URLSearchParams(location.search).get("lang"), ...navigator.languages, navigator.language];
export const lang = wanted.map((tag) => tag?.split("-")[0].toLowerCase()).find((code) => Object.hasOwn(LANGUAGES, code)) ?? "en";

export const has = (key) => Object.hasOwn(en, key);

// A key missing everywhere shows up as itself rather than breaking the page.
export function t(key, params = {}) {
  const text = LANGUAGES[lang][key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name]);
}

export function translatePage() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) node.placeholder = t(node.dataset.i18nPlaceholder);
}
