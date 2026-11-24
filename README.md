# clinic-booking-widget

A small appointment picker for clinics. The visitor chooses a day, a free time and a treatment, enters a name and mobile number, and the widget opens WhatsApp with a pre-filled booking request to the clinic. No backend, no framework, no dependencies in the widget itself.

It sends nothing on its own. The visitor presses send in WhatsApp, and the clinic confirms by replying. That keeps it honest: this is a **request**, not an instant confirmed booking.

## Try it

```bash
npm install
npm run serve        # then open http://localhost:4173
```

## Use it on a page

```html
<link rel="stylesheet" href="src/widget.css" />
<div id="booking"></div>
<script type="module">
  import { createBookingWidget } from "./src/widget.js";

  createBookingWidget(document.getElementById("booking"), {
    clinicName: "Demo Dental Clinic",
    whatsappNumber: "91XXXXXXXXXX",
    timezone: "Asia/Kolkata",
    timezoneLabel: "India time (IST)",
    slotMinutes: 30,
    leadMinutes: 60,
    weekly: {
      mon: [["09:30", "20:30"]], tue: [["09:30", "20:30"]], wed: [["09:30", "20:30"]],
      thu: [["09:30", "20:30"]], fri: [["09:30", "20:30"]],
      sat: [["09:30", "18:00"]], sun: [],
    },
    closedDates: ["2026-12-25"],
    booked: [{ date: "2026-11-24", time: "11:00" }],
    treatments: [
      { id: "consult", label: "Consultation", fee: 500 },
    ],
  });
</script>
```

See `index.html` for a complete example.

## Behaviour worth knowing

- A slot must **end** by closing time and **start** at least `leadMinutes` from now.
- Slots in `booked` and days in `closedDates` are not offered.
- "Now" is calculated in the clinic's time zone, so a visitor abroad sees the same slots as one in India.
- The phone field accepts Indian mobile numbers (10 digits starting 6-9, optional +91 or 0). Anything else blocks sending and explains why.
- The send link is a real `<a>` with `aria-disabled` until the form is valid. The form works by keyboard.

## Known limits

- `booked` is a list you supply. The widget does not know about bookings made elsewhere, so two people can request the same slot. The clinic resolves that when replying.
- Opening hours are one set per weekday; there is no lunch break or per-doctor schedule yet.

## Tests

```bash
npm run test:unit    # node:test, no browser
npm run test:e2e     # Playwright, uses Google Chrome installed on the machine
npm test             # both
```

The browser tests fix the clock (Tuesday 24 Nov 2026, 10:00 IST), so results do not depend on the day they run. Test names such as `TC-10` match a test-design sample for this widget: see https://karndevsinh.in/qa-evaluation.

## Licence

MIT. Copyright 2026 Karndevsinh Jhala.
