import { describe, expect, it } from "vitest";

import { cx } from "./cx.js";

describe("cx", () => {
  it("joins class names with a space", () => {
    expect(cx("btn", "btn-primary")).toBe("btn btn-primary");
  });

  it("skips falsy values", () => {
    expect(cx("btn", undefined, false, null, "", "active")).toBe("btn active");
  });

  it("returns an empty string when nothing is passed", () => {
    expect(cx()).toBe("");
  });
});
