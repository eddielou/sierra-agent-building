/** Order lookup against the static CustomerOrders dataset. */
import { readFileSync } from "node:fs";
import { TRACKING_URL_TEMPLATE } from "./config.js";

export type OrderRecord = Record<string, unknown>;

/**
 * Value of the first key containing any fragment (case-insensitive). Keeps the loader
 * tolerant of key-naming differences (e.g. OrderNumber vs order_number).
 */
function pick(record: OrderRecord, ...fragments: string[]): unknown {
  for (const [key, value] of Object.entries(record)) {
    const k = key.toLowerCase().replaceAll("_", "");
    if (fragments.some((f) => k.includes(f))) return value;
  }
  return undefined;
}

const normOrder = (v: unknown) => String(v ?? "").trim().replace(/^#+/, "").toUpperCase();
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

export class OrderStore {
  constructor(private readonly orders: OrderRecord[]) {}

  static fromFile(path: string): OrderStore {
    return new OrderStore(JSON.parse(readFileSync(path, "utf8")));
  }

  /**
   * Return the order only if BOTH email and order number match, else null.
   * Requiring both means a guessed order number alone never reveals another customer's data.
   */
  lookup(email: string, orderNumber: string): OrderRecord | null {
    const match = this.orders.find(
      (o) =>
        normOrder(pick(o, "ordernum", "orderid")) === normOrder(orderNumber) &&
        normEmail(pick(o, "email")) === normEmail(email),
    );
    return match ? OrderStore.present(match) : null;
  }

  private static present(order: OrderRecord): OrderRecord {
    const result = Object.fromEntries(
      Object.entries(order).filter(([k]) => !k.toLowerCase().includes("email")),
    );
    const tracking = pick(order, "tracking");
    result.tracking_url = tracking
      ? TRACKING_URL_TEMPLATE.replace("{trackingNumber}", String(tracking))
      : null;
    return result;
  }
}
