/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import en from "../public/i18n/en.js";
import html from "../public/setup.html?raw";
import script from "../public/setup.js?raw";

const languages = import.meta.glob<Record<string, string>>("../public/i18n/*.js", { eager: true, import: "default" });
const translations = Object.entries(languages)
  .map(([path, strings]) => [path.split("/").pop()!, strings] as const)
  .filter(([file]) => file !== "en.js");

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
const usedKeys = [...html.matchAll(/data-i18n(?:-placeholder)?="(\w+)"/g), ...script.matchAll(/\bt\("(\w+)"/g)].map(([, key]) => key);

describe("wizard translations", () => {
  it("define every key the page uses", () => {
    expect(usedKeys.length).toBeGreaterThan(0);
    expect(usedKeys.filter((key) => !Object.hasOwn(en, key))).toEqual([]);
  });

  it("include at least one language besides English", () => {
    expect(translations.length).toBeGreaterThan(0);
  });

  it.each(translations)("%s covers the English base with the same placeholders", (file, strings) => {
    // The wizard loads i18n/<code>.js only for a two- or three-letter language code.
    expect(file).toMatch(/^[a-z]{2,3}\.js$/);
    expect(Object.keys(strings).sort()).toEqual(Object.keys(en).sort());
    for (const [key, text] of Object.entries(strings)) {
      expect(placeholders(text), key).toEqual(placeholders(en[key as keyof typeof en]));
    }
  });
});
