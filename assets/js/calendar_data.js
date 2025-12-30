// assets/js/calendar_data.js
import { pb } from "./auth.js";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function loadCalendarItems({ churchId, startDate, endDate }) {
  // startDate/endDate: "YYYY-MM-DD"
  // PocketBase datetime strings usually look like: "2025-12-15 18:30:00.000Z"
  const startDT = `${startDate} 00:00:00.000Z`;
  const endDT = `${endDate} 23:59:59.999Z`;

  const [events, rotas, activities] = await Promise.all([
    safeList(
      "events",
      `church.id = "${churchId}" && starts_at >= "${startDT}" && starts_at <= "${endDT}"`,
      "starts_at"
    ),
    safeList(
      "service_role_assignments",
      `church.id = "${churchId}" && date >= "${startDate}" && date <= "${endDate}"`,
      "date"
    ),
    safeList(
      "ministry_activities",
      `church.id = "${churchId}" && status = "active"`,
      "weekday,time"
    ),
  ]);

  const roleNameById = await loadLookupMap("service_roles", churchId, "name");
  const memberNameById = await loadMemberNameMap(churchId);
  const ministryNameById = await loadLookupMap("ministries", churchId, "name");
  const locationNameById = await loadLookupMap("locations", churchId, "name");

  const items = [];

  // 1) Events
  for (const e of events) {
    const { date, time } = splitPbDateTime(e.starts_at);
    if (!date) continue;

    const start = time ? `${date}T${time}` : `${date}T00:00`;
    const end = e.ends_at ? pbDateTimeToLocalISO(e.ends_at) : null;

    items.push({
      id: `event:${e.id}`,
      source: "event",
      title: e.title || "Evento",
      start,
      end,
      allDay: !time,
      meta: {
        eventId: e.id,
        location: e.location || "",
        notes: e.notes || "",
        status: e.status || "",
      },
    });
  }

  // 2) Rotas
  for (const r of rotas) {
    const date = toISODate(r.date);
    if (!date) continue;

    const roleName = roleNameById.get(String(r.service_role)) || "Rol";
    const memberName = r.assigned_member
      ? memberNameById.get(String(r.assigned_member)) || ""
      : "";

    const locRelName = e.location ? (locationNameById.get(String(e.location)) || "") : "";
    const locText = (e.location_place || "").trim();
    const displayLocation = locText || locRelName;

    items.push({
      id: `event:${e.id}`,
      source: "event",
      title: e.title || "Evento",
      start,
      end,
      allDay: !time,
      meta: {
        eventId: e.id,
        location: displayLocation,
        notes: e.notes || "",
        status: e.status || "",
        ministryId: e.ministry || "",
        locationId: e.location || "",
      },
    });
  }

  // 3) Weekly ministry activities → expand occurrences in range
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  for (const a of activities) {
    const weekday = String(a.weekday || "").toLowerCase();
    const weekdayIndex = WEEKDAYS.indexOf(weekday);
    if (weekdayIndex < 0) continue;

    const time = String(a.time || "").trim(); // "HH:MM"
    if (!time) continue;

    const duration = Number(a.duration_minutes || 0);
    const ministryName = ministryNameById.get(String(a.ministry)) || "Ministerio";

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== weekdayIndex) continue;

      const day = toYMD(d);
      const startDT = `${day}T${time}`;
      const endDT = duration > 0 ? addMinutesLocalISO(startDT, duration) : null;

      items.push({
        id: `minact:${a.id}:${day}`,
        source: "ministry_activity",
        title: `${a.title || "Actividad"} (${ministryName})`,
        start: startDT,
        end: endDT,
        allDay: false,
        meta: {
          activityId: a.id,
          ministryId: a.ministry,
          location: a.location_text || "",
          notes: a.notes || "",
        },
      });
    }
  }

  items.sort((x, y) => String(x.start).localeCompare(String(y.start)));
  return items;
}

/* ---------------- helpers ---------------- */

async function safeList(collection, filter, sort) {
  try {
    return await pb.collection(collection).getFullList({ filter, sort });
  } catch (e) {
    console.warn(`calendar safeList failed for ${collection}`, e);
    return [];
  }
}

async function loadLookupMap(collection, churchId, labelField) {
  const map = new Map();
  try {
    const recs = await pb.collection(collection).getFullList({
      filter: `church.id = "${churchId}"`,
      sort: labelField,
    });
    for (const r of recs) map.set(String(r.id), String(r[labelField] || ""));
  } catch {}
  return map;
}

async function loadMemberNameMap(churchId) {
  const map = new Map();
  try {
    const recs = await pb.collection("members").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "last_name,first_name",
    });
    for (const m of recs) {
      const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
      map.set(String(m.id), name);
    }
  } catch {}
  return map;
}

function toISODate(val) {
  if (!val) return "";
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : "";
}

// PB datetime usually: "YYYY-MM-DD HH:MM:SS.sssZ"
function splitPbDateTime(pbDT) {
  if (!pbDT) return { date: "", time: "" };
  const s = String(pbDT);
  const date = s.slice(0, 10);
  const time = s.length >= 16 ? s.slice(11, 16) : "";
  // when it's "YYYY-MM-DDTHH:MM..." this still works because [11,16] hits HH:MM
  return { date, time };
}

function pbDateTimeToLocalISO(pbDT) {
  const { date, time } = splitPbDateTime(pbDT);
  if (!date) return null;
  return time ? `${date}T${time}` : `${date}T00:00`;
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMinutesLocalISO(isoLocal, minutes) {
  // isoLocal: "YYYY-MM-DDTHH:MM" interpreted as local time
  const [d, t] = isoLocal.split("T");
  const [hh, mm] = t.split(":").map(Number);

  let total = hh * 60 + mm + Number(minutes || 0);
  if (total < 0) total = 0;

  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;

  return `${d}T${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}
