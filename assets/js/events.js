// assets/js/events.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedEvents = [];
let cachedMembers = [];
let cachedAttendanceByEvent = new Map(); // eventId -> Map(memberId -> attendanceRecord)

// --- Event lookups (locations + ministries) ---
let cachedEventLocations = [];
let cachedEventMinistries = [];

async function loadEventLookups(churchId) {
  try {
    cachedEventLocations = await pb.collection("locations").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "name",
    });
  } catch {
    cachedEventLocations = [];
  }

  try {
    cachedEventMinistries = await pb.collection("ministries").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "name",
    });
  } catch {
    cachedEventMinistries = [];
  }
}

function fillEventLookupSelects() {
  const locSel = document.getElementById("event-location");
  if (locSel) {
    const current = locSel.value || "";
    locSel.innerHTML =
      `<option value="">(sin asignar)</option>` +
      cachedEventLocations
        .map((l) => `<option value="${l.id}">${escapeHtml(l.name || "")}</option>`)
        .join("");
    locSel.value = current;
  }

  const minSel = document.getElementById("event-ministry");
  if (minSel) {
    const current = minSel.value || "";
    minSel.innerHTML =
      `<option value="">(sin asignar)</option>` +
      cachedEventMinistries
        .map((m) => `<option value="${m.id}">${escapeHtml(m.name || "")}</option>`)
        .join("");
    minSel.value = current;
  }
}

export async function initEventsView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="events"]');
  if (!section) return;

  if (!can("read", "events")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "events");
  const canUpdate = can("update", "events");
  const canDelete = can("delete", "events");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Eventos</h1>

      <div class="card">
        <div class="members-toolbar" style="gap:10px;flex-wrap:wrap;">
          <div class="members-search" style="gap:10px;flex-wrap:wrap;">
            <input id="events-search" type="text" placeholder="Buscar por título o lugar..." />
          </div>
          <div class="members-actions">
            <button id="events-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="events-new" type="button">Nuevo evento</button>` : ""}
          </div>
        </div>
        <div id="events-error" class="error"></div>
        <div id="events-success" class="success"></div>
      </div>

      <div class="card">
        <h2>Listado</h2>
        <div style="overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Inicio</th>
                <th>Lugar</th>
                <th>Estado</th>
                <th style="width:1%"></th>
              </tr>
            </thead>
            <tbody id="events-tbody">
              <tr><td colspan="5" class="muted">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- EVENT MODAL -->
      <div class="modal-overlay" id="event-modal" style="display:none;">
        <div class="modal" style="max-width:720px;">
          <div class="modal-header">
            <h3 id="event-modal-title">Evento</h3>
            <button class="icon-btn" id="event-modal-close" type="button">×</button>
          </div>

          <div class="modal-body">
            <input type="hidden" id="event-id" />

            <div class="form-grid">
              <label class="field">
                <span>Título</span>
                <input id="event-title" type="text" />
              </label>

              <label class="field">
                <span>Inicio</span>
                <input id="event-starts-at" type="datetime-local" />
              </label>

              <label class="field">
                <span>Fin</span>
                <input id="event-ends-at" type="datetime-local" />
              </label>

              <div class="field">
                <span>Misión / Location</span>
                <select id="event-location">
                  <option value="">(sin asignar)</option>
                </select>
              </div>

              <label class="field">
                <span>Lugar (texto)</span>
                <input id="event-location-place" type="text" placeholder="Ej: Salón principal" />
              </label>

              <div class="field">
                <span>Ministerio</span>
                <select id="event-ministry">
                  <option value="">(sin asignar)</option>
                </select>
              </div>

              <label class="field">
                <span>Estado</span>
                <select id="event-status">
                  <option value="scheduled">scheduled</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>

              <label class="field" style="grid-column:1/-1;">
                <span>Notas</span>
                <textarea id="event-notes" rows="3"></textarea>
              </label>

              <label class="field" style="grid-column:1/-1;">
                <span>Tags (JSON)</span>
                <textarea id="event-tags" rows="2" placeholder='{"category":"general"}'></textarea>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button id="event-cancel" type="button" class="btn-secondary">Cancelar</button>
            <button id="event-save" type="button">Guardar</button>
          </div>
        </div>
      </div>

      <!-- ATTENDANCE MODAL -->
      <div class="modal-overlay" id="attendance-modal" style="display:none;">
        <div class="modal" style="max-width:820px;">
          <div class="modal-header">
            <h3>Asistencia</h3>
            <button class="icon-btn" id="attendance-modal-close" type="button">×</button>
          </div>

          <div class="modal-body">
            <div class="members-toolbar" style="gap:10px;flex-wrap:wrap;">
              <div class="members-actions">
                <button id="attendance-reload" type="button">Recargar</button>
              </div>
            </div>

            <div id="attendance-error" class="error"></div>

            <div style="overflow:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Email</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody id="attendance-tbody">
                  <tr><td colspan="3" class="muted">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="modal-footer">
            <button id="attendance-close" type="button" class="btn-secondary">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    // Ensure lookups exist for selects (locations + ministries)
    await loadEventLookups(currentChurchId);
    fillEventLookupSelects();

    // Move modals to body so they don't get hidden by section display:none
    const eventModal = document.getElementById("event-modal");
    if (eventModal && eventModal.parentElement !== document.body) document.body.appendChild(eventModal);

    const attendanceModal = document.getElementById("attendance-modal");
    if (attendanceModal && attendanceModal.parentElement !== document.body) document.body.appendChild(attendanceModal);

    // UI handlers
    section.querySelector("#events-reload").addEventListener("click", async () => {
      await loadEventsForChurch(currentChurchId);
      renderEventsTable();
    });

    section.querySelector("#events-search").addEventListener("input", () => {
      renderEventsTable();
    });

    const newBtn = section.querySelector("#events-new");
    if (newBtn) {
      newBtn.addEventListener("click", () => openEventModal({ mode: "create", record: null }));
    }

    document.getElementById("event-modal-close").addEventListener("click", closeEventModal);
    document.getElementById("event-cancel").addEventListener("click", closeEventModal);
    document.getElementById("event-save").addEventListener("click", saveEventFromModal);

    document.getElementById("attendance-modal-close").addEventListener("click", closeAttendanceModal);
    document.getElementById("attendance-close").addEventListener("click", closeAttendanceModal);
    document.getElementById("attendance-reload").addEventListener("click", async () => {
      const eventId = document.getElementById("attendance-modal").dataset.eventId || "";
      if (!eventId) return;
      await loadAttendanceForEvent(eventId);
      renderAttendanceTable(eventId);
    });

    // initial load
    await loadMembersForChurch(currentChurchId);
    await loadEventsForChurch(currentChurchId);
    renderEventsTable();
  } else {
    // church changed (or re-entered view) -> refresh lookups and data
    await loadEventLookups(currentChurchId);
    fillEventLookupSelects();
    await loadMembersForChurch(currentChurchId);
    await loadEventsForChurch(currentChurchId);
    renderEventsTable();
  }

  /* ---------- render helpers ---------- */

  function renderEventsTable() {
    const tbody = document.getElementById("events-tbody");
    if (!tbody) return;

    const q = (document.getElementById("events-search")?.value || "").trim().toLowerCase();

    const list = !q
      ? cachedEvents
      : cachedEvents.filter((ev) => {
          const t = String(ev.title || "").toLowerCase();
          const lp = String(ev.location_place || "").toLowerCase();
          return t.includes(q) || lp.includes(q);
        });

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">No hay eventos.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((ev) => {
        const starts = formatDateTime(ev.starts_at);
        const place = ev.location_place || "";
        const status = (ev.status && typeof ev.status === "string") ? ev.status : (ev.status?.value || ev.status || "");
        return `
          <tr>
            <td>${escapeHtml(ev.title || "")}</td>
            <td>${escapeHtml(starts)}</td>
            <td>${escapeHtml(place)}</td>
            <td>${escapeHtml(status || "")}</td>
            <td style="white-space:nowrap;text-align:right;">
              ${canUpdate ? `<button class="btn-secondary btn-small" data-action="edit" data-id="${ev.id}">Editar</button>` : ""}
              <button class="btn-secondary btn-small" data-action="attendance" data-id="${ev.id}">Asistencia</button>
              ${canDelete ? `<button class="btn-danger btn-small" data-action="delete" data-id="${ev.id}">Borrar</button>` : ""}
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === "edit") {
          const record = await pb.collection("events").getOne(id);
          openEventModal({ mode: "edit", record });
        }

        if (action === "attendance") {
          await openAttendanceModal(id);
        }

        if (action === "delete") {
          if (!confirm("¿Borrar este evento?")) return;
          try {
            await pb.collection("events").delete(id);
            await loadEventsForChurch(currentChurchId);
            renderEventsTable();
          } catch (err) {
            console.error(err);
            setText("events-error", "No se pudo borrar el evento.");
          }
        }
      });
    });
  }

  function openEventModal({ mode, record }) {
    const modal = document.getElementById("event-modal");
    if (!modal) return;

    // make sure selects are filled
    fillEventLookupSelects();

    document.getElementById("event-modal-title").textContent =
      mode === "edit" ? "Editar evento" : "Nuevo evento";

    document.getElementById("event-id").value = record?.id || "";
    document.getElementById("event-title").value = record?.title || "";
    document.getElementById("event-starts-at").value = toDatetimeLocal(record?.starts_at || "");
    document.getElementById("event-ends-at").value = toDatetimeLocal(record?.ends_at || "");
    document.getElementById("event-location").value = record?.location || "";
    document.getElementById("event-location-place").value = record?.location_place || "";
    document.getElementById("event-ministry").value = record?.ministry || "";
    document.getElementById("event-status").value = coerceStatus(record?.status);
    document.getElementById("event-notes").value = record?.notes || "";
    document.getElementById("event-tags").value =
      record?.tags ? safeJsonStringify(record.tags) : "";

    modal.style.display = "block";
    document.body.classList.add("modal-open");
  }

  function closeEventModal() {
    const modal = document.getElementById("event-modal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
  }

  async function saveEventFromModal() {
    setText("events-error", "");
    setText("events-success", "");

    const id = document.getElementById("event-id").value || "";
    const title = document.getElementById("event-title").value.trim();
    const starts_at = fromDatetimeLocal(document.getElementById("event-starts-at").value);
    const ends_at = fromDatetimeLocal(document.getElementById("event-ends-at").value);
    const location = document.getElementById("event-location").value || null;
    const location_place = document.getElementById("event-location-place").value.trim();
    const ministry = document.getElementById("event-ministry").value || null;
    const status = document.getElementById("event-status").value || "scheduled";
    const notes = document.getElementById("event-notes").value || "";
    const tagsRaw = document.getElementById("event-tags").value.trim();

    if (!title) {
      setText("events-error", "El título es obligatorio.");
      return;
    }
    if (!starts_at) {
      setText("events-error", "La fecha/hora de inicio es obligatoria.");
      return;
    }

    let tags = null;
    if (tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        setText("events-error", "Tags JSON inválido.");
        return;
      }
    }

    const payload = {
      church: currentChurchId,
      title,
      starts_at,
      ends_at: ends_at || null,
      location,
      location_place,
      ministry,
      status,
      notes,
      tags,
    };

    try {
      if (id) {
        await pb.collection("events").update(id, payload);
      } else {
        await pb.collection("events").create(payload);
      }

      closeEventModal();
      await loadEventsForChurch(currentChurchId);
      renderEventsTable();
      setText("events-success", "Guardado.");
    } catch (err) {
      console.error(err);
      setText("events-error", "No se pudo guardar el evento.");
    }
  }

  async function openAttendanceModal(eventId) {
    const modal = document.getElementById("attendance-modal");
    if (!modal) return;

    modal.dataset.eventId = eventId;
    modal.style.display = "block";
    document.body.classList.add("modal-open");

    await loadAttendanceForEvent(eventId);
    renderAttendanceTable(eventId);
  }

  function closeAttendanceModal() {
    const modal = document.getElementById("attendance-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.dataset.eventId = "";
    document.body.classList.remove("modal-open");
  }

  function renderAttendanceTable(eventId) {
    const tbody = document.getElementById("attendance-tbody");
    if (!tbody) return;

    const attMap = cachedAttendanceByEvent.get(eventId) || new Map();

    if (!cachedMembers.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="muted">No hay miembros.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedMembers
      .map((m) => {
        const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
        const email = m.email || "";
        const att = attMap.get(m.id);
        const state = att?.status || "unknown";

        const canMark = can("update", "event_attendance");

        return `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(email)}</td>
            <td>
              ${
                canMark
                  ? `<select data-att="status" data-member="${m.id}">
                      <option value="unknown" ${state === "unknown" ? "selected" : ""}>unknown</option>
                      <option value="present" ${state === "present" ? "selected" : ""}>present</option>
                      <option value="absent" ${state === "absent" ? "selected" : ""}>absent</option>
                    </select>`
                  : `<span class="muted">${escapeHtml(state)}</span>`
              }
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll('select[data-att="status"]').forEach((sel) => {
      sel.addEventListener("change", async () => {
        const memberId = sel.dataset.member;
        const status = sel.value;

        try {
          await upsertAttendance(eventId, memberId, status);
          await loadAttendanceForEvent(eventId);
        } catch (err) {
          console.error(err);
          setText("attendance-error", "No se pudo guardar asistencia.");
        }
      });
    });
  }

  /* ---------- data ---------- */

  async function loadEventsForChurch(churchId) {
    try {
      cachedEvents = await pb.collection("events").getFullList({
        filter: `church.id = "${churchId}"`,
        sort: "-starts_at",
      });
    } catch (err) {
      console.error(err);
      cachedEvents = [];
    }
  }

  async function loadMembersForChurch(churchId) {
    try {
      cachedMembers = await pb.collection("members").getFullList({
        filter: `church.id = "${churchId}"`,
        sort: "last_name,first_name",
      });
    } catch (err) {
      console.error(err);
      cachedMembers = [];
    }
  }

  async function loadAttendanceForEvent(eventId) {
    try {
      const rows = await pb.collection("event_attendance").getFullList({
        filter: `event.id = "${eventId}"`,
        sort: "created",
      });
      const map = new Map();
      for (const r of rows) map.set(r.member, r);
      cachedAttendanceByEvent.set(eventId, map);
    } catch (err) {
      console.error(err);
      cachedAttendanceByEvent.set(eventId, new Map());
    }
  }

  async function upsertAttendance(eventId, memberId, status) {
    const existingMap = cachedAttendanceByEvent.get(eventId) || new Map();
    const existing = existingMap.get(memberId);

    if (existing?.id) {
      await pb.collection("event_attendance").update(existing.id, { status });
      return;
    }

    await pb.collection("event_attendance").create({
      church: currentChurchId,
      event: eventId,
      member: memberId,
      status,
    });
  }

  /* ---------- utils ---------- */

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "";
  }

  function formatDateTime(pbDT) {
    if (!pbDT) return "";
    const s = String(pbDT);
    const date = s.slice(0, 10);
    const time = s.length >= 16 ? s.slice(11, 16) : "";
    return time ? `${date} ${time}` : date;
  }

  function toDatetimeLocal(pbDT) {
    if (!pbDT) return "";
    const s = String(pbDT);
    const date = s.slice(0, 10);
    const time = s.length >= 16 ? s.slice(11, 16) : "00:00";
    return `${date}T${time}`;
  }

  function fromDatetimeLocal(localVal) {
    if (!localVal) return "";
    const [d, t] = localVal.split("T");
    if (!d || !t) return "";
    return `${d} ${t}:00.000Z`;
  }

  function coerceStatus(status) {
    if (!status) return "scheduled";
    if (typeof status === "string") return status;
    if (typeof status === "object" && status.value) return String(status.value);
    return "scheduled";
  }

  function safeJsonStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch {
      return "";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

// --- EXPORTS PARA CALENDAR ---
export async function openEventModalById(eventId) {
  try {
    const church = safeGetCurrentChurch();
    if (church) {
      // ensure view exists (creates DOM inputs)
      if (!document.getElementById("event-id") || !document.getElementById("event-title")) {
        await initEventsView(church);
      }
    }

    const record = await pb.collection("events").getOne(eventId);

    // open modal (inputs now exist)
    const modal = document.getElementById("event-modal");
    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
    if (modal) modal.style.display = "block";

    // reuse internal openEventModal by simulating "edit" click
    // simplest: call init and then click edit in table isn't ideal; so we populate directly:
    document.getElementById("event-id").value = record?.id || "";
    document.getElementById("event-title").value = record?.title || "";
    document.getElementById("event-starts-at").value = record?.starts_at ? record.starts_at.slice(0, 16).replace(" ", "T") : "";
    document.getElementById("event-ends-at").value = record?.ends_at ? record.ends_at.slice(0, 16).replace(" ", "T") : "";
    document.getElementById("event-location").value = record?.location || "";
    document.getElementById("event-location-place").value = record?.location_place || "";
    document.getElementById("event-ministry").value = record?.ministry || "";
    document.getElementById("event-status").value = (typeof record?.status === "string" ? record.status : (record?.status?.value || "scheduled"));
    document.getElementById("event-notes").value = record?.notes || "";
    document.getElementById("event-tags").value = record?.tags ? JSON.stringify(record.tags) : "";

    document.getElementById("event-modal-title").textContent = "Editar evento";
    document.body.classList.add("modal-open");
  } catch (err) {
    console.error("Error abriendo evento desde calendario:", err);
    alert("No se pudo abrir el evento.");
  }
}

function safeGetCurrentChurch() {
  try {
    return JSON.parse(localStorage.getItem("holycrm_current_church"));
  } catch {
    return null;
  }
}
