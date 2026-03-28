export function isMarketOpen(now: Date = new Date()): boolean {
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric", minute: "numeric", hour12: false, weekday: "short",
  }).formatToParts(now);

  const weekday = et.find(p => p.type === "weekday")?.value;
  const hour = parseInt(et.find(p => p.type === "hour")?.value ?? "0");
  const minute = parseInt(et.find(p => p.type === "minute")?.value ?? "0");

  if (weekday === "Sat" || weekday === "Sun") return false;

  const timeMinutes = hour * 60 + minute;
  return timeMinutes >= 570 && timeMinutes < 960; // 9:30 AM - 4:00 PM
}
