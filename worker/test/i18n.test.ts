/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import en from "../public/i18n/en.js";
import pl from "../public/i18n/pl.js";
import html from "../public/setup.html?raw";
import script from "../public/setup.js?raw";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
const usedKeys = [...html.matchAll(/data-i18n(?:-placeholder)?="(\w+)"/g), ...script.matchAll(/\bt\("(\w+)"/g)].map(([, key]) => key);

describe("wizard translations", () => {
  it("define every key the page uses", () => {
    expect(usedKeys.length).toBeGreaterThan(0);
    expect(usedKeys.filter((key) => !Object.hasOwn(en, key))).toEqual([]);
  });

  it.each([["pl", pl]] as const)("%s covers the English base with the same placeholders", (_, strings) => {
    expect(Object.keys(strings).sort()).toEqual(Object.keys(en).sort());
    for (const [key, text] of Object.entries(strings)) {
      expect(placeholders(text), key).toEqual(placeholders(en[key as keyof typeof en]));
    }
  });
});
