import { isMarketOpen } from "@/lib/market-hours";

describe("isMarketOpen", () => {
  it("returns true during market hours on a weekday", () => {
    const date = new Date("2026-03-25T15:00:00Z"); // 10 AM ET
    expect(isMarketOpen(date)).toBe(true);
  });

  it("returns false on weekends", () => {
    const saturday = new Date("2026-03-28T15:00:00Z");
    expect(isMarketOpen(saturday)).toBe(false);
  });

  it("returns false after 4 PM ET", () => {
    const afterClose = new Date("2026-03-25T21:30:00Z"); // 4:30 PM ET
    expect(isMarketOpen(afterClose)).toBe(false);
  });
});
