// Pure scheduling and message helpers. No DOM access, so everything here is unit tested.
// Dates are "YYYY-MM-DD" strings and times are "HH:MM" strings, both in the clinic's local time.

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toMinutes(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
  if (!match) throw new Error(`Invalid time: ${hhmm}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${hhmm}`);
  return hours * 60 + minutes;
}

export function minutesToHHMM(total) {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** 12-hour label, for example 690 -> "11:30 am". */
export function formatTime(total) {
  const hours24 = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, "0");
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${suffix}`;
}

function parseDate(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`Invalid date: ${dateStr}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function weekdayIndex(dateStr) {
  const { y, m, d } = parseDate(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateStr, count) {
  const { y, m, d } = parseDate(dateStr);
  return new Date(Date.UTC(y, m - 1, d + count)).toISOString().slice(0, 10);
}

/** "Tue 24 Nov" (short) or "Tue 24 Nov 2026" (with year). */
export function formatDate(dateStr, withYear = false) {
  const { y, m, d } = parseDate(dateStr);
  const base = `${DAY_NAMES[weekdayIndex(dateStr)]} ${d} ${MONTH_NAMES[m - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

/** The clinic's local date and minutes-since-midnight for a given instant. */
export function nowInZone(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * Free slots for one date. A slot is offered only if it is inside opening hours,
 * ends before closing, starts at least `leadMinutes` from now, and is not booked.
 */
export function generateSlots(config, date, now) {
  if (date < now.date) return [];
  if ((config.closedDates ?? []).includes(date)) return [];
  const windows = config.weekly[DAY_KEYS[weekdayIndex(date)]] ?? [];
  const step = config.slotMinutes ?? 30;
  const lead = config.leadMinutes ?? 0;
  const taken = new Set(
    (config.booked ?? []).filter((b) => b.date === date).map((b) => toMinutes(b.time)),
  );
  const slots = [];
  for (const [start, end] of windows) {
    const close = toMinutes(end);
    for (let t = toMinutes(start); t + step <= close; t += step) {
      if (date === now.date && t < now.minutes + lead) continue;
      if (taken.has(t)) continue;
      slots.push({ time: minutesToHHMM(t), minutes: t, label: formatTime(t) });
    }
  }
  return slots;
}

/** The next `count` dates that still have at least one free slot. */
export function upcomingDates(config, now, count = 7, searchDays = 60) {
  const dates = [];
  for (let i = 0; i < searchDays && dates.length < count; i += 1) {
    const date = addDays(now.date, i);
    if (generateSlots(config, date, now).length > 0) dates.push(date);
  }
  return dates;
}

/** Indian mobile number to "91XXXXXXXXXX", or null if it is not valid. */
export function normalisePhone(input) {
  const cleaned = String(input ?? "").replace(/[\s\-()]/g, "");
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(cleaned);
  return match ? `91${match[1]}` : null;
}

export function buildMessage({ clinicName, name, phone, treatment, date, time }) {
  const lines = [
    `Hello ${clinicName}, I would like to book an appointment.`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Treatment: ${treatment.label}${treatment.fee ? ` (Rs ${treatment.fee})` : ""}`,
    `Date: ${formatDate(date, true)}`,
    `Time: ${formatTime(toMinutes(time))}`,
  ];
  return lines.join("\n");
}

export function whatsappUrl(clinicNumber, text) {
  const digits = String(clinicNumber).replace(/\D/g, "");
  if (!digits) throw new Error("A clinic WhatsApp number is required");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
