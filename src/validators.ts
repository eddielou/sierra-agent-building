/** Concrete response validators. Each checks the reply against facts from this turn's tool results. */
import type { ValidationContext, Validator } from "./validation.js";

const URL_RE = /https?:\/\/[^\s)>\]"']+/g;
const PROMO_CODE_RE = /EARLY10-[A-Z0-9]{6}/g;
const PRICE_RE = /\$\s?\d[\d,]*(?:\.\d+)?/g;

const matches = (re: RegExp, text: string) => text.match(re) ?? [];
const allToolOutput = (ctx: ValidationContext) => ctx.toolResults.map((t) => t.result).join("\n");

/** Every URL and discount code in the reply must have been returned by a tool this turn. */
export const groundedLinksAndCodes: Validator = {
  name: "grounded-links-and-codes",
  validate(reply, ctx) {
    const evidence = allToolOutput(ctx);
    // Strip sentence punctuation that the regex swallows, e.g. "...tLabels=TRK123."
    const urls = matches(URL_RE, reply).map((u) => u.replace(/[.,!?;:]+$/, ""));
    const ungrounded = [...urls, ...matches(PROMO_CODE_RE, reply)].filter((x) => !evidence.includes(x));
    return ungrounded.length
      ? { ok: false, reason: `Reply contains link/code not returned by any tool: ${ungrounded.join(", ")}` }
      : { ok: true };
  },
};

/** A discount code may only appear if request_early_risers_code returned eligible this turn. */
export const promoGating: Validator = {
  name: "promo-gating",
  validate(reply, ctx) {
    if (!matches(PROMO_CODE_RE, reply).length) return { ok: true };
    const eligible = ctx.toolResults.some((t) => {
      if (t.name !== "request_early_risers_code") return false;
      try {
        return JSON.parse(t.result).eligible === true;
      } catch {
        return false;
      }
    });
    return eligible ? { ok: true } : { ok: false, reason: "Reply contains a discount code but the promo tool did not return an eligible result this turn." };
  },
};

/** The catalog has no prices, so a dollar amount must come from the customer's own message. */
export const noInventedPrices: Validator = {
  name: "no-invented-prices",
  validate(reply, ctx) {
    const evidence = `${ctx.userMessage}\n${allToolOutput(ctx)}`;
    const invented = matches(PRICE_RE, reply).filter((p) => !evidence.includes(p));
    return invented.length
      ? { ok: false, reason: `Reply quotes a price that appears nowhere in the data: ${invented.join(", ")}` }
      : { ok: true };
  },
};

export const DEFAULT_VALIDATORS: Validator[] = [groundedLinksAndCodes, promoGating, noInventedPrices];
