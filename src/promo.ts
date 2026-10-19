/** Early Risers promotion: 10% off, 8:00-10:00 AM Pacific. Eligibility is decided in code, not by the LLM. */
import { randomInt } from "node:crypto";
import * as config from "./config.js";

// Unambiguous alphabet (no 0/O/1/I) so codes are easy to read and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type PromoResult =
  | { eligible: false; window: string; current_pacific_time: string }
  | { eligible: true; code: string; discount_percent: number };

export class EarlyRisersPromo {
  private readonly issued = new Map<string, string>(); // sessionId -> code
  private readonly allCodes = new Set<string>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private pacificHour(): number {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: config.PROMO_TIMEZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(this.now());
    return Number(hour);
  }

  isActive(): boolean {
    const hour = this.pacificHour();
    return config.PROMO_START_HOUR <= hour && hour < config.PROMO_END_HOUR;
  }

  requestCode(sessionId: string): PromoResult {
    if (!this.isActive()) {
      return {
        eligible: false,
        window: `${config.PROMO_START_HOUR}:00-${config.PROMO_END_HOUR}:00 AM Pacific Time`,
        current_pacific_time: this.now().toLocaleTimeString("en-US", {
          timeZone: config.PROMO_TIMEZONE,
          hour: "numeric",
          minute: "2-digit",
        }),
      };
    }
    // Idempotent per session so asking twice doesn't mint multiple codes.
    const code = this.issued.get(sessionId) ?? this.mint();
    this.issued.set(sessionId, code);
    return { eligible: true, code, discount_percent: config.PROMO_DISCOUNT_PERCENT };
  }

  private mint(): string {
    for (;;) {
      const suffix = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
      const code = `EARLY10-${suffix}`;
      if (!this.allCodes.has(code)) {
        this.allCodes.add(code);
        return code;
      }
    }
  }
}
