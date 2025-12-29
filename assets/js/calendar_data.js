// assets/js/calendar_data.js
import { pb } from "./auth.js";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function loadCalendarItems({ churchId, startDate, endDate }) {
  // startDate/endDate: "YYYY-MM-DD"
  const [events, rotas, activities] = await Promise.all([
    safeList("events", `church.id = "${churchId}" && start_date >= "${startDate}" && start_date <= "${endDate}"`, "start_date"),
    safeList("service_role_assignments", `church.id = "${churchId}" && date >= "${startDate}" && date <= "${endDate}"`, "date"),
    safeList("ministry_activities", `church.id = "${churchId}" && status = "active"`, "weekday,time"),
  ]);

  const roleNameById = await loadLookupMap("service_roles", churchId, "name");
  const memberNameById = await loadMemberNameMap(churchId);
  const ministryNameById = await loadLookupMap("ministries", churchId, "name");

  const items = [];

  // 1) Events (single instances)
  for (const e of events) {
    const date = toISODate(e.start_date);
    if (!date) continue;

    const startTime = (e.start_time || "").trim();
    const endTime = (e.end_time || "").trim();

    const start = startTime ? `${date}T${startTime}` : `${date}T00:00`;
    const end = endTime ? `${date}T${endTime}` : null;

    items.push({
      id: `event:${e.id}`,
      source: "event",
      title: e.title || "Evento",
      start,
      end,
      allDay: !startTime,
      meta: {
        eventId: e.id,
        location: e.location_text || "",
        notes: e.notes || "",
      },
    });
  }

  // 2) Rotas (monthly roles assignments)
  for (const r of rotas) {
    const date = toISODate(r.date);
    if (!date) continue;

    const roleName = roleNameById.get(String(r.service_role)) || "Rol";
    const memberName = r.assigned_member ? (memberNameById.get(String(r.assigned_member)) || "") : "";

    items.push({
      id: `rota:${r.id}`,
      source: "rota",
      title: `${roleName}${memberName ? ` — ${memberName}` : ""}`,
      start: `${date}T09:00`,
      end: null,
      allDay: true,
      meta: {
        assignmentId: r.id,
        roleId: r.service_role,
        assignedMemberId: r.assigned_member || "",
        notes: r.notes || "",
      },
    });
  }

  // 3) Weekly ministry activities (expand into occurrences in the range)
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  for (const a of activities) {
    const weekday = String(a.weekday || "").toLowerCase();
    const weekdayIndex = WEEKDAYS.indexOf(weekday);
    if (weekdayIndex < 0) continue;

    const time = (a.time || "").trim();
    if (!time) continue;

    const duration = Number(a.duration_minutes || 0);
    const ministryName = ministryNameById.get(String(a.ministry)) || "Ministerio";

    // generate occurrences
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== weekdayIndex) continue;

      const day = toYMD(d);
      const startDT = `${day}T${time}`;
      const endDT = duration > 0 ? addMinutesISO(startDT, duration) : null;

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

  // sort by start
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

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMinutesISO(iso, minutes) {
  try {
    const dt = new Date(iso);
    dt.setMinutes(dt.getMinutes() + minutes);
    return dt.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM (UTC-ish) – good enough for now
  } catch {
    return null;
  }
}
