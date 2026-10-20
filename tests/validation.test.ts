import { describe, expect, it } from "vitest";
import { ResponseValidator, type Validator } from "../src/validation.js";

const ctx = { userMessage: "hi", toolResults: [] };

describe("ResponseValidator ", () => {
  it("passes replies through untouched when no validators are registered", () => {
    expect(new ResponseValidator().run("hello", ctx)).toEqual({ reply: "hello", ok: true, reasons: [], results: [] });
  });

  it("reports failures without altering the reply", () => {
    const failing: Validator = { name: "always-fails", validate: () => ({ ok: false, reason: "nope" }) };
    const report = new ResponseValidator([failing]).run("hello", ctx);
    expect(report.reply).toBe("hello");
    expect(report.ok).toBe(false);
    expect(report.reasons).toEqual(["nope"]);
    expect(report.results).toEqual([{ validator: "always-fails", result: { ok: false, reason: "nope" } }]);
  });
});
