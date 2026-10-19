/** Runtime configuration: model, data paths, business constants, API key loading. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ORDERS_PATH = path.join(ROOT, "data", "CustomerOrders.json");
export const CATALOG_PATH = path.join(ROOT, "data", "ProductCatalog.json");

export const MODEL = "gpt-4.1-mini";
export const MAX_TOOL_ROUNDS = 6; // guard against runaway tool-call loops within a single user turn

export const TRACKING_URL_TEMPLATE =
  "https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}";

export const PROMO_TIMEZONE = "America/Los_Angeles";
export const PROMO_START_HOUR = 8; // inclusive
export const PROMO_END_HOUR = 10; // exclusive
export const PROMO_DISCOUNT_PERCENT = 10;

/** Read OPENAI_API_KEY from the environment, falling back to a local .env file. */
export function loadApiKey(): string {
  const envFile = path.join(ROOT, ".env");
  if (!process.env.OPENAI_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Set OPENAI_API_KEY in your environment or in a .env file.");
  return key;
}
