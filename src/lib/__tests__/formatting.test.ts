import { describe, it, expect } from "vitest";
import { currency } from "@/lib/fleet-data";
import { cn } from "@/lib/utils";

describe("currency", () => {
  it("appends the ج.م suffix", () => {
    expect(currency(1000)).toMatch(/ج\.م$/);
  });

  it("formats zero without throwing", () => {
    expect(currency(0)).toContain("ج.م");
  });

  it("uses Arabic-locale digit grouping for large numbers", () => {
    // Node's ar-EG locale renders Eastern Arabic-Indic digits (١٬٢٣٤٬٥٦٧)
    // rather than Western digits — browsers may differ by OS/ICU config.
    // We assert on the grouping structure, not the literal digit glyphs.
    const result = currency(1234567);
    const groups = result.replace(" ج.م", "").split(/[,٬]/);
    expect(groups).toHaveLength(3);
  });
});

describe("cn (className merge)", () => {
  it("merges plain class strings", () => {
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  it("lets a later Tailwind class override an earlier conflicting one", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});
