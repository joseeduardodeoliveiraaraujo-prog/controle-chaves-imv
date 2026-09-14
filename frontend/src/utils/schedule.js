export const SHIFTS = ["Manhã", "Tarde"];

export const WEEK_DAY_NAMES = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
];

const DAY_SHORT = {
  "Segunda-feira": "Seg",
  "Terça-feira": "Ter",
  "Quarta-feira": "Qua",
  "Quinta-feira": "Qui",
  "Sexta-feira": "Sex",
};

const EMPTY_ENTRY = { situation: "available", notes: "" };

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shortDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}/${m}`;
}

export function getWeekMonday(baseDate = new Date()) {
  const dayOfWeek = baseDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(baseDate);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  return monday;
}

function fullDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

export function getWeekDates(baseDate = new Date()) {
  const monday = getWeekMonday(baseDate);
  return WEEK_DAY_NAMES.map((dayName, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      dateKey: dateKey(date),
      dayName,
      dayShort: DAY_SHORT[dayName] || dayName,
      short: shortDate(date),
      full: fullDate(date),
    };
  });
}

export function hasSchedule(schedule) {
  if (!schedule) return false;
  if (Array.isArray(schedule)) return schedule.length > 0;
  return Object.keys(schedule).length > 0;
}

function ensureWeekEntries(target, weekDays) {
  weekDays.forEach((day) => {
    if (!target[day.dateKey]) target[day.dateKey] = {};
    SHIFTS.forEach((shift) => {
      if (!target[day.dateKey][shift]) {
        target[day.dateKey][shift] = { ...EMPTY_ENTRY };
      }
    });
  });
}

export function decodeSchedule(schedule, baseDate = new Date()) {
  if (Array.isArray(schedule)) {
    const weekDays = getWeekDates(baseDate);
    const decoded = {};
    schedule.forEach((entry) => {
      if (!entry || !entry.day || !entry.shift) return;
      const day = weekDays.find((d) => d.dayName === entry.day);
      if (!day) return;
      if (!decoded[day.dateKey]) decoded[day.dateKey] = {};
      decoded[day.dateKey][entry.shift] = {
        situation: entry.situation || "available",
        notes: entry.notes || "",
      };
    });
    return decoded;
  }

  if (schedule && typeof schedule === "object") {
    const decoded = {};
    Object.entries(schedule).forEach(([date, shifts]) => {
      if (!shifts || typeof shifts !== "object") return;
      decoded[date] = { ...shifts };
    });
    return decoded;
  }

  return {};
}

export function normalizeSchedule(schedule, baseDate = new Date()) {
  const normalized = decodeSchedule(schedule, baseDate);
  ensureWeekEntries(normalized, getWeekDates(baseDate));
  return normalized;
}

export function parseLocalDate(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

export function businessDaysBetween(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return [];
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );
  const cursor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const days = [];
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({
        dateKey: dateKey(cursor),
        short: shortDate(cursor),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function applyScheduleRange(
  schedule,
  { start, end, shifts, situation, notes }
) {
  const next = { ...(schedule || {}) };
  businessDaysBetween(start, end).forEach(({ dateKey: dayKey }) => {
    const current = next[dayKey] || {};
    next[dayKey] = { ...current };
    shifts.forEach((shift) => {
      next[dayKey][shift] = {
        situation,
        notes: situation === "available" ? "" : notes || "",
      };
    });
  });
  return next;
}

export function createDefaultSchedule(baseDate = new Date()) {
  return normalizeSchedule(null, baseDate);
}