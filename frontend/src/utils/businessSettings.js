const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const DEFAULT_BUSINESS_HOURS = DAYS.map((day, index) => ({
  day,
  open: "08:00",
  close: "20:00",
  closed: index === 6,
}));

function cloneDefaultHours() {
  return DEFAULT_BUSINESS_HOURS.map((day) => ({ ...day }));
}

function to24Hour(time, period = "") {
  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  const lowerPeriod = period.toLowerCase();
  if (!lowerPeriod) return hours <= 23 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : null;
  if (hours < 1 || hours > 12) return null;
  const normalizedHours = (hours % 12) + (lowerPeriod === "pm" ? 12 : 0);
  return `${String(normalizedHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function rangeFromText(value) {
  const match = String(value).match(/(\d{1,2}:\d{2})\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  const open = to24Hour(match[1], match[2]);
  const close = to24Hour(match[3], match[4]);
  return open && close ? { open, close } : null;
}

// Convert the old human-readable `hours` setting when structured hours are absent.
export function scheduleFromLegacyHours(hours) {
  const schedule = cloneDefaultHours();
  const weekdayRange = rangeFromText(hours);
  if (weekdayRange) {
    schedule.slice(0, 6).forEach((_, index) => {
      schedule[index] = { ...schedule[index], ...weekdayRange, closed: false };
    });
  }
  const sundayText = String(hours).match(/sunday\s*:\s*([^|]+)/i)?.[1] || "";
  if (/\b(closed|off)\b/i.test(sundayText)) return schedule;
  const sundayRange = rangeFromText(sundayText);
  if (sundayRange) schedule[6] = { ...schedule[6], ...sundayRange, closed: false };
  return schedule;
}

export function parseBusinessHours(value, legacyHours = "") {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length !== 7) return scheduleFromLegacyHours(legacyHours);
    return DAYS.map((day, index) => ({
      day,
      open: /^\d{2}:\d{2}$/.test(parsed[index]?.open || "") ? parsed[index].open : "08:00",
      close: /^\d{2}:\d{2}$/.test(parsed[index]?.close || "") ? parsed[index].close : "20:00",
      closed: Boolean(parsed[index]?.closed),
    }));
  } catch {
    return scheduleFromLegacyHours(legacyHours);
  }
}

export function formatBusinessHours(schedule) {
  const entries = parseBusinessHours(schedule);
  const time = (value) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })
    .format(new Date(`1970-01-01T${value}:00Z`));
  const weekdays = entries.slice(0, 6);
  const sameWeekdayHours = weekdays.every((item) => !item.closed && item.open === weekdays[0].open && item.close === weekdays[0].close);
  const weekdayText = sameWeekdayHours
    ? `Monday–Saturday: ${time(weekdays[0].open)} – ${time(weekdays[0].close)}`
    : weekdays.map((item) => `${item.day}: ${item.closed ? "CLOSED" : `${time(item.open)} – ${time(item.close)}`}`).join(" · ");
  const sunday = entries[6];
  return `${weekdayText} · Sunday: ${sunday.closed ? "CLOSED" : `${time(sunday.open)} – ${time(sunday.close)}`}`;
}

export function phoneDigits(value, fallback = "") {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || fallback;
}

export function validUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
