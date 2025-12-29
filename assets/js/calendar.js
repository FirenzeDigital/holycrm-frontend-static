// assets/js/calendar.js
import { can } from "./permissions.js";
import { loadCalendarItems } from "./calendar_data.js";
import { openEventModalById } from "./events.js";
import { openMinistryActivityModalById } from "./ministries.js";
import { initRotasView } from "./rotas.js";

let initialized = false;
let currentChurchId = null;
let cachedItems = [];

export async function initCalendarView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="calendar"]');
  if (!section) return;

  if (!can("read", "calendar")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Calendario</h1>

      <div class="card">
        <div class="members-toolbar" style="gap:10px;flex-wrap:wrap;">
          <div class="members-search" style="gap:10px;flex-wrap:wrap;">
            <label class="muted" style="display:flex;align-items:center;gap:8px;">
              Desde:
              <input id="cal-start" type="date" />
            </label>
            <label class="muted" style="display:flex;align-items:center;gap:8px;">
              Hasta:
              <input id="cal-end" type="date" />
            </label>
            <input id="cal-search" type="text" placeholder="Buscar (título, lugar, notas)..." />
          </div>

          <div class="members-actions">
            <button id="cal-reload" type="button">Recargar</button>
          </div>
        </div>

        <div id="cal-error" class="error"></div>
        <div id="cal-success" class="success"></div>
      </div>

      <div class="card">
        <h2>Agenda</h2>
        <div id="cal-list"></div>
      </div>
    `;

    const { start, end } = defaultRange7();
    section.querySelector("#cal-start").value = start;
    section.querySelector("#cal-end").value = end;

    section.querySelector("#cal-reload").addEventListener("click", async () => {
      await reload();
    });

    section.querySelector("#cal-search").addEventListener("input", () => {
      renderList();
    });

    section.querySelector("#cal-start").addEventListener("change", async () => {
      await reload();
    });

    section.querySelector("#cal-end").addEventListener("change", async () => {
      await reload();
    });
  }

  await reload();
}

async function reload() {
  setText("cal-error", "");
  setText("cal-success", "");

  const startDate = document.getElementById("cal-start")?.value;
  const endDate = document.getElementById("cal-end")?.value;

  if (!startDate || !endDate) {
    setText("cal-error", "Seleccioná un rango válido.");
    return;
  }

  if (startDate > endDate) {
    setText("cal-error", "El rango es inválido (desde > hasta).");
    return;
  }

  try {
    cachedItems = await loadCalendarItems({
      churchId: currentChurchId,
      startDate,
      endDate,
    });
    renderList();
  } catch (err) {
    console.error("Calendar reload error:", err);
    setText("cal-error", "Error cargando calendario.");
    cachedItems = [];
    renderList();
  }
}

function renderList() {
  const listEl = document.getElementById("cal-list");
  if (!listEl) return;

  const q = (document.getElementById("cal-search")?.value || "").trim().toLowerCase();

  const items = !q
    ? cachedItems
    : cachedItems.filter((it) => {
        const title = String(it.title || "").toLowerCase();
        const location = String(it.meta?.location || "").toLowerCase();
        const notes = String(it.meta?.notes || "").toLowerCase();
        return title.includes(q) || location.includes(q) || notes.includes(q);
      });

  if (!items.length) {
    listEl.innerHTML = `<div class="muted">No hay items en este rango.</div>`;
    return;
  }

  // group by day
  const byDay = new Map();
  for (const it of items) {
    const day = String(it.start).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(it);
  }

  const days = Array.from(byDay.keys()).sort();

  listEl.innerHTML = days
    .map((day) => {
      const entries = byDay.get(day) || [];
      const rows = entries
        .map((it) => renderItem(it))
        .join("");

      return `
        <div class="card" style="margin:12px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;">${escapeHtml(formatDate(day))}</h3>
            <span class="muted">${entries.length} item(s)</span>
          </div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">
            ${rows}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderItem(it) {
  const time = it.allDay ? "Todo el día" : it.start.slice(11, 16);
  const sourceLabel = sourceBadge(it.source);

  let actions = "";

  if (it.source === "event" && can("update", "events")) {
    actions = `
      <button class="btn-small" data-action="edit-event" data-id="${it.meta.eventId}">
        Editar
      </button>
    `;
  }

  if (it.source === "ministry_activity" && can("update", "ministry_activities")) {
    actions = `
      <button class="btn-small" data-action="edit-activity" data-id="${it.meta.activityId}">
        Editar
      </button>
    `;
  }

  if (it.source === "rota" && can("update", "service_role_assignments")) {
    actions = `
      <button class="btn-small" data-action="edit-rota" data-id="${it.meta.assignmentId}">
        Editar
      </button>
    `;
  }

  return `
    <div class="calendar-item">
      <div class="calendar-item-header">
        <div>
          ${sourceLabel}
          <strong>${escapeHtml(it.title)}</strong>
        </div>
        <div class="calendar-time">${time}</div>
      </div>

      ${it.meta.location ? `<div class="muted">📍 ${escapeHtml(it.meta.location)}</div>` : ""}
      ${it.meta.notes ? `<div class="muted">${escapeHtml(it.meta.notes)}</div>` : ""}

      <div class="calendar-actions">
        ${actions}
      </div>
    </div>
  `;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "edit-event") {
    openEventModalById(id);
  }

  if (action === "edit-activity") {
    openMinistryActivityModalById(id);
  }

  if (action === "edit-rota") {
    // Reusa el módulo de rotas
    const church = JSON.parse(localStorage.getItem("holycrm_current_church"));
    initRotasView(church);
    setTimeout(() => {
      alert("Abrí la asignación desde el módulo de Rotas.");
    }, 200);
  }
});

function sourceBadge(src) {
  const map = {
    event: "Evento",
    ministry_activity: "Ministerio",
    rota: "Rota",
  };
  const label = map[src] || src;
  return `<span class="role-pill" style="font-size:12px;">${escapeHtml(label)}</span>`;
}

function defaultRange7() {
  const d = new Date();
  const start = toYMD(d);
  const endD = new Date(d);
  endD.setDate(endD.getDate() + 14);
  const end = toYMD(endD);
  return { start, end };
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(ymd) {
  // simple
  return ymd;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
