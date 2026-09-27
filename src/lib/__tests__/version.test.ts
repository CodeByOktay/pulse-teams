import { describe, it, expect } from "vitest";
import { APP_VERSION } from "@/lib/version";
import packageInfo from "../../../package.json";

describe("App Version Synchronization", () => {
  it("exports the version matching package.json", () => {
    expect(APP_VERSION).toBe(packageInfo.version);
    expect(APP_VERSION).toBe("0.6.7");
  });

  it("follows standard semver format", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/);
  });
});
