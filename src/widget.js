import {
  buildMessage,
  formatDate,
  generateSlots,
  normalisePhone,
  nowInZone,
  upcomingDates,
  whatsappUrl,
} from "./slots.js";

let instanceCounter = 0;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/**
 * Renders a booking form into `container`.
 * Nothing is sent automatically: the patient taps a link that opens WhatsApp
 * with the message pre-filled, and reception confirms the slot.
 */
export function createBookingWidget(container, config) {
  const id = `cbw${(instanceCounter += 1)}`;
  const zone = config.timezone ?? "Asia/Kolkata";
  const state = { date: null, time: null, treatmentId: config.treatments[0].id };

  const now = () => nowInZone(new Date(), zone);

  const daysGroup = el("div", { class: "cbw-days", role: "group", "aria-labelledby": `${id}-days` });
  const slotsGroup = el("div", { class: "cbw-slots", role: "group", "aria-labelledby": `${id}-slots` });
  const emptyNote = el("p", { class: "cbw-empty", hidden: "" });
  const treatmentSelect = el("select", { id: `${id}-treatment`, name: "treatment" },
    config.treatments.map((t) =>
      el("option", { value: t.id, text: t.fee ? `${t.label} (Rs ${t.fee})` : t.label })));
  const nameInput = el("input", { id: `${id}-name`, name: "name", type: "text", autocomplete: "name", required: "" });
  const phoneInput = el("input", { id: `${id}-phone`, name: "phone", type: "tel", inputmode: "tel", autocomplete: "tel", required: "" });
  const errorNote = el("p", { class: "cbw-error", role: "alert" });
  const summary = el("p", { class: "cbw-summary", "aria-live": "polite" });
  const sendLink = el("a", {
    class: "cbw-send",
    role: "link",
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-disabled": "true",
    text: "Send request on WhatsApp",
  });

  container.classList.add("cbw");
  container.replaceChildren(
    el("h2", { text: config.heading ?? "Book an appointment" }),
    el("p", { class: "cbw-zone", text: `Times are shown in ${config.timezoneLabel ?? zone}.` }),
    el("p", { id: `${id}-days`, class: "cbw-label", text: "Choose a day" }),
    daysGroup,
    el("p", { id: `${id}-slots`, class: "cbw-label", text: "Choose a time" }),
    slotsGroup,
    emptyNote,
    el("label", { for: `${id}-treatment`, text: "Treatment" }),
    treatmentSelect,
    el("label", { for: `${id}-name`, text: "Your name" }),
    nameInput,
    el("label", { for: `${id}-phone`, text: "Mobile number" }),
    phoneInput,
    errorNote,
    summary,
    sendLink,
    el("p", { class: "cbw-note", text: "This sends a request. The clinic will confirm your time on WhatsApp." }),
  );

  function currentTreatment() {
    return config.treatments.find((t) => t.id === state.treatmentId);
  }

  function renderDays() {
    const dates = upcomingDates(config, now(), config.daysToShow ?? 7);
    if (!dates.includes(state.date)) {
      state.date = dates[0] ?? null;
      state.time = null;
    }
    const today = now().date;
    daysGroup.replaceChildren(...dates.map((date) => {
      const label = date === today ? "Today" : formatDate(date);
      const button = el("button", { type: "button", "aria-pressed": String(date === state.date), "data-date": date, text: label });
      button.addEventListener("click", () => {
        state.date = date;
        state.time = null;
        render();
      });
      return button;
    }));
  }

  function renderSlots() {
    const slots = state.date ? generateSlots(config, state.date, now()) : [];
    if (state.time && !slots.some((s) => s.time === state.time)) state.time = null;
    slotsGroup.replaceChildren(...slots.map((slot) => {
      const button = el("button", { type: "button", "aria-pressed": String(slot.time === state.time), "data-time": slot.time, text: slot.label });
      button.addEventListener("click", () => {
        state.time = slot.time;
        render();
      });
      return button;
    }));
    emptyNote.hidden = slots.length > 0;
    emptyNote.textContent = slots.length > 0 ? "" : "No free times for this day. Please choose another day.";
  }

  /** Returns the problems that stop the request from being sent. */
  function problems() {
    const list = [];
    if (!state.date || !state.time) list.push("Choose a day and a time.");
    if (!nameInput.value.trim()) list.push("Enter your name.");
    if (!normalisePhone(phoneInput.value)) list.push("Enter a valid 10-digit Indian mobile number.");
    return list;
  }

  function renderLink() {
    const issues = problems();
    if (issues.length > 0) {
      sendLink.removeAttribute("href");
      sendLink.setAttribute("aria-disabled", "true");
    } else {
      const text = buildMessage({
        clinicName: config.clinicName,
        name: nameInput.value.trim(),
        phone: normalisePhone(phoneInput.value),
        treatment: currentTreatment(),
        date: state.date,
        time: state.time,
      });
      sendLink.setAttribute("href", whatsappUrl(config.whatsappNumber, text));
      sendLink.setAttribute("aria-disabled", "false");
    }
    summary.textContent = state.date && state.time
      ? `${formatDate(state.date)}, ${slotsGroup.querySelector('[aria-pressed="true"]')?.textContent ?? ""} - ${currentTreatment().label}`
      : "";
  }

  function render() {
    renderDays();
    renderSlots();
    renderLink();
  }

  treatmentSelect.addEventListener("change", () => {
    state.treatmentId = treatmentSelect.value;
    renderLink();
  });
  for (const input of [nameInput, phoneInput]) {
    input.addEventListener("input", () => {
      errorNote.textContent = "";
      renderLink();
    });
  }
  sendLink.addEventListener("click", (event) => {
    const issues = problems();
    if (issues.length > 0) {
      event.preventDefault();
      errorNote.textContent = issues.join(" ");
    }
  });

  render();
  return { refresh: render };
}
