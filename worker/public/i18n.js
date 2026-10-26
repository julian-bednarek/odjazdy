import en from "./i18n/en.js";

// A language is just a file in i18n/ named by its code; the code also limits the import to that folder.
const LANGUAGE_CODE = /^[a-z]{2,3}$/;

async function load(code) {
  if (code === "en") return en;
  try {
    return (await import(`./i18n/${code}.js`)).default;
  } catch {
    return null;
  }
}

// ?lang= wins (handy for testing), then the browser's preferences, then English.
async function pick() {
  const wanted = [new URLSearchParams(location.search).get("lang"), ...navigator.languages, navigator.language];
  const codes = new Set(wanted.map((tag) => tag?.split("-")[0].toLowerCase()).filter((code) => LANGUAGE_CODE.test(code ?? "")));
  for (const code of codes) {
    const strings = await load(code);
    if (strings) return [code, strings];
  }
  return ["en", en];
}

const [code, strings] = await pick();
export const lang = code;

export const has = (key) => Object.hasOwn(en, key);

// A key missing everywhere shows up as itself rather than breaking the page.
export function t(key, params = {}) {
  const text = strings[key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name]);
}

export function translatePage() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) node.placeholder = t(node.dataset.i18nPlaceholder);
}
