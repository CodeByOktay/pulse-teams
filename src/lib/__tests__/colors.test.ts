import { describe, it, expect } from "vitest";
import { getAvatarColor, LABEL_COLOR_PALETTE } from "../colors";

describe("colors utility", () => {
  it("should return deterministic colors for the same input", () => {
    const color1 = getAvatarColor("Oktay");
    const color2 = getAvatarColor("Oktay");
    expect(color1).toBe(color2);

    const prjColor1 = getAvatarColor("PRJ-10");
    const prjColor2 = getAvatarColor("PRJ-10");
    expect(prjColor1).toBe(prjColor2);
  });

  it("should return valid hex colors", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    expect(hexRegex.test(getAvatarColor("TestUser"))).toBe(true);
    expect(hexRegex.test(getAvatarColor("AnotherUser"))).toBe(true);
  });

  it("should provide an array of label colors with valid hex format", () => {
    expect(LABEL_COLOR_PALETTE.length).toBeGreaterThanOrEqual(8);
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const color of LABEL_COLOR_PALETTE) {
      expect(hexRegex.test(color)).toBe(true);
    }
  });
});
