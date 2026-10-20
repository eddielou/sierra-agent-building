import { describe, expect, it } from "vitest";
import type { ValidationContext } from "../src/validation.js";
import { groundedLinksAndCodes, noInventedPrices, promoGating } from "../src/validators.js";

const URL = "https://tools.usps.com/go/TrackConfirmAction?tLabels=TRK123";
const lookup = { name: "lookup_order", arguments: "{}", result: JSON.stringify({ order: { tracking_url: URL } }) };
const promo = (eligible: boolean) => ({
  name: "request_early_risers_code",
  arguments: "{}",
  result: JSON.stringify(eligible ? { eligible, code: "EARLY10-ABC234" } : { eligible }),
});
const ctx = (toolResults: ValidationContext["toolResults"] = [], userMessage = "hi"): ValidationContext => ({ userMessage, toolResults });

describe("groundedLinksAndCodes", () => {
  it("accepts links and codes returned by tools, ignoring trailing punctuation", () => {
    expect(groundedLinksAndCodes.validate(`Track it here: ${URL}.`, ctx([lookup]))).toEqual({ ok: true });
    expect(groundedLinksAndCodes.validate("Code: EARLY10-ABC234!", ctx([promo(true)]))).toEqual({ ok: true });
  });

  it("rejects links and codes no tool returned", () => {
    expect(groundedLinksAndCodes.validate(`See ${URL}`, ctx()).ok).toBe(false);
    expect(groundedLinksAndCodes.validate("Use EARLY10-ZZZZZZ", ctx([promo(true)])).ok).toBe(false);
  });
});

describe("promoGating", () => {
  it("allows a code only when the promo tool returned eligible this turn", () => {
    expect(promoGating.validate("Here: EARLY10-ABC234", ctx([promo(true)]))).toEqual({ ok: true });
    expect(promoGating.validate("Here: EARLY10-ABC234", ctx([promo(false)])).ok).toBe(false);
    expect(promoGating.validate("Here: EARLY10-ABC234", ctx()).ok).toBe(false);
  });

  it("ignores replies without a code", () => {
    expect(promoGating.validate("The promo runs 8-10 AM PT.", ctx([promo(false)]))).toEqual({ ok: true });
  });
});

describe("noInventedPrices", () => {
  it("rejects dollar amounts that appear nowhere in the data", () => {
    expect(noInventedPrices.validate("It's only $49.99!", ctx()).ok).toBe(false);
  });

  it("allows an amount the customer themselves mentioned", () => {
    expect(noInventedPrices.validate("Nothing under $100 yet.", ctx([], "anything under $100?"))).toEqual({ ok: true });
  });

  it("passes replies with no prices", () => {
    expect(noInventedPrices.validate("It's in stock!", ctx())).toEqual({ ok: true });
  });
});
