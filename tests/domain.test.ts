import { describe, expect, it } from "vitest";
import { CATALOG_PATH, ORDERS_PATH } from "../src/config.js";
import { ProductCatalog } from "../src/catalog.js";
import { OrderStore } from "../src/orders.js";
import { EarlyRisersPromo, pacificTimeToday } from "../src/promo.js";

// Pacific Daylight Time (UTC-7) on 2026-10-19: 9:00 AM PT == 16:00 UTC.
const pacific = (hour: number, minute = 0) =>
  new EarlyRisersPromo(() => new Date(Date.UTC(2026, 9, 19, hour + 7, minute)));

describe("orders", () => {
  const store = OrderStore.fromFile(ORDERS_PATH);

  it("requires matching email and order number", () => {
    const order = store.lookup(" JOHN.DOE@example.com ", "w001")!;
    expect(order.tracking_url).toMatch(/tLabels=TRK123456789$/);
    expect(Object.keys(order).some((k) => k.toLowerCase().includes("email"))).toBe(false);
    expect(store.lookup("jane.smith@example.com", "#W001")).toBeNull();
  });

  it("has no tracking url without a tracking number", () => {
    expect(store.lookup("alice.johnson@example.com", "#W003")!.tracking_url).toBeNull();
  });
});

describe("catalog", () => {
  const catalog = ProductCatalog.fromFile(CATALOG_PATH);

  it("searches by keyword and looks up by SKU", () => {
    expect(catalog.search("backpack for hiking")[0].SKU).toBe("SOBP001");
    expect(catalog.search("kayak paddle")).toEqual([]);
    expect((catalog.bySku("SOTN002")!.ProductName as string).endsWith("Skis")).toBe(true);
  });
});

describe("early risers promo", () => {
  it("honors window boundaries", () => {
    expect(pacific(7, 59).requestCode("s").eligible).toBe(false);
    expect(pacific(8, 0).requestCode("s").eligible).toBe(true);
    expect(pacific(9, 59).requestCode("s").eligible).toBe(true);
    expect(pacific(10, 0).requestCode("s").eligible).toBe(false);
  });

  it("converts other timezones to Pacific", () => {
    // 9 AM Eastern (EDT, UTC-4) is 6 AM Pacific; 11 AM Eastern is 8 AM Pacific.
    expect(new EarlyRisersPromo(() => new Date("2026-10-19T09:00:00-04:00")).isActive()).toBe(false);
    expect(new EarlyRisersPromo(() => new Date("2026-10-19T11:00:00-04:00")).isActive()).toBe(true);
  });

  it("issues unique codes per session, stable within one", () => {
    const p = pacific(9);
    const code = (id: string) => (p.requestCode(id) as { code: string }).code;
    expect(code("a")).not.toBe(code("b"));
    expect(code("a")).toBe(code("a"));
  });
});

describe("pacificTimeToday", () => {
  it("maps Pacific wall-clock times to UTC across DST", () => {
    const summer = new Date("2026-10-19T20:00:00Z"); // 1 PM PDT
    const winter = new Date("2026-12-01T20:00:00Z"); // noon PST
    expect(pacificTimeToday("09:00", summer).toISOString()).toBe("2026-10-19T16:00:00.000Z");
    expect(pacificTimeToday("18:01", winter).toISOString()).toBe("2026-12-02T02:01:00.000Z");
    expect(pacificTimeToday("7:59", summer).toISOString()).toBe("2026-10-19T14:59:00.000Z");
  });

  it("uses the Pacific date, not the UTC date", () => {
    const lateUtc = new Date("2026-10-20T03:00:00Z"); // 8 PM PDT on Oct 19
    expect(pacificTimeToday("09:00", lateUtc).toISOString()).toBe("2026-10-19T16:00:00.000Z");
  });

  it("rejects malformed times", () => {
    expect(() => pacificTimeToday("25:00")).toThrow();
    expect(() => pacificTimeToday("9am")).toThrow();
  });

  it("feeds the promo window check", () => {
    const at = (t: string) => new EarlyRisersPromo(() => pacificTimeToday(t)).isActive();
    expect([at("07:59"), at("08:00"), at("09:59"), at("10:00"), at("18:01")]).toEqual([false, true, true, false, false]);
  });
});
