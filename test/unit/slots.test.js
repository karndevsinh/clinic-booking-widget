import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  buildMessage,
  formatDate,
  formatTime,
  generateSlots,
  normalisePhone,
  nowInZone,
  toMinutes,
  upcomingDates,
  weekdayIndex,
  whatsappUrl,
} from "../../src/slots.js";

const config = {
  slotMinutes: 30,
  leadMinutes: 60,
  weekly: {
    mon: [["09:30", "20:30"]],
    tue: [["09:30", "20:30"]],
    wed: [["09:30", "20:30"]],
    thu: [["09:30", "20:30"]],
    fri: [["09:30", "20:30"]],
    sat: [["09:30", "18:00"]],
    sun: [],
  },
  closedDates: ["2026-12-25"],
  booked: [{ date: "2026-11-24", time: "11:00" }],
};

// Tuesday 24 November 2026, 10:00 clinic time.
const tuesdayMorning = { date: "2026-11-24", minutes: 10 * 60 };

test("date helpers", () => {
  assert.equal(weekdayIndex("2026-11-24"), 2); // Tuesday
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(formatDate("2026-11-24"), "Tue 24 Nov");
  assert.equal(formatDate("2026-11-24", true), "Tue 24 Nov 2026");
});

test("time helpers", () => {
  assert.equal(toMinutes("09:30"), 570);
  assert.throws(() => toMinutes("25:00"));
  assert.throws(() => toMinutes("nine"));
  assert.equal(formatTime(0), "12:00 am");
  assert.equal(formatTime(12 * 60), "12:00 pm");
  assert.equal(formatTime(18 * 60 + 30), "6:30 pm");
});

test("TC-01: only future slots inside opening hours, respecting the lead time", () => {
  const slots = generateSlots(config, "2026-11-24", tuesdayMorning);
  assert.equal(slots[0].label, "11:30 am"); // 11:00 is booked, nothing before 11:00 (10:00 + 60 min lead)
  assert.equal(slots.at(-1).label, "8:00 pm"); // 8:30 pm slot would run past closing
  assert.equal(slots.length, 18);
});

test("TC-02: nothing is offered when the lead time pushes past closing", () => {
  const lateEvening = { date: "2026-11-24", minutes: 20 * 60 + 25 };
  assert.deepEqual(generateSlots(config, "2026-11-24", lateEvening), []);
});

test("booked slots are not offered", () => {
  const times = generateSlots(config, "2026-11-24", tuesdayMorning).map((s) => s.time);
  assert.ok(!times.includes("11:00"));
});

test("past dates, closed dates and closed weekdays have no slots", () => {
  assert.deepEqual(generateSlots(config, "2026-11-23", tuesdayMorning), []);
  assert.deepEqual(generateSlots(config, "2026-12-25", tuesdayMorning), []);
  assert.deepEqual(generateSlots(config, "2026-11-29", tuesdayMorning), []); // Sunday
});

test("a future day ignores the lead time", () => {
  const slots = generateSlots(config, "2026-11-25", tuesdayMorning);
  assert.equal(slots[0].label, "9:30 am");
});

test("upcomingDates skips days with no free slots", () => {
  const dates = upcomingDates(config, tuesdayMorning, 5);
  assert.deepEqual(dates, ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]);
  const fridayLate = { date: "2026-11-27", minutes: 21 * 60 };
  const next = upcomingDates(config, fridayLate, 2);
  assert.deepEqual(next, ["2026-11-28", "2026-11-30"]); // today is full, Sunday is closed
});

test("TC-10: clinic time does not depend on the visitor's time zone", () => {
  const instant = new Date("2026-11-24T04:30:00Z"); // 10:00 in India
  assert.deepEqual(nowInZone(instant, "Asia/Kolkata"), { date: "2026-11-24", minutes: 600 });
  assert.deepEqual(nowInZone(instant, "America/New_York"), { date: "2026-11-23", minutes: 23 * 60 + 30 });
  const justAfterMidnight = new Date("2026-11-24T18:35:00Z"); // 00:05 next day in India
  assert.deepEqual(nowInZone(justAfterMidnight, "Asia/Kolkata"), { date: "2026-11-25", minutes: 5 });
});

test("TC-11: phone validation", () => {
  assert.equal(normalisePhone("98765 43210"), "919876543210");
  assert.equal(normalisePhone("+91 98765-43210"), "919876543210");
  assert.equal(normalisePhone("09876543210"), "919876543210");
  assert.equal(normalisePhone("98ab"), null);
  assert.equal(normalisePhone("12345"), null);
  assert.equal(normalisePhone("5876543210"), null); // Indian mobiles start with 6-9
  assert.equal(normalisePhone(""), null);
  assert.equal(normalisePhone(undefined), null);
});

test("TC-04: message and WhatsApp link", () => {
  const text = buildMessage({
    clinicName: "Test Clinic",
    name: "Asha",
    phone: "919876543210",
    treatment: { label: "Consultation", fee: 500 },
    date: "2026-11-24",
    time: "18:30",
  });
  assert.match(text, /Hello Test Clinic/);
  assert.match(text, /Name: Asha/);
  assert.match(text, /Treatment: Consultation \(Rs 500\)/);
  assert.match(text, /Date: Tue 24 Nov 2026/);
  assert.match(text, /Time: 6:30 pm/);

  const url = whatsappUrl("+91 90000 00000", text);
  assert.ok(url.startsWith("https://wa.me/919000000000?text="));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), text);
  assert.throws(() => whatsappUrl("not a number", text));
});

test("free treatments leave out the fee", () => {
  const text = buildMessage({
    clinicName: "C", name: "N", phone: "1", treatment: { label: "First visit", fee: 0 },
    date: "2026-11-24", time: "10:00",
  });
  assert.match(text, /Treatment: First visit\n/);
});
