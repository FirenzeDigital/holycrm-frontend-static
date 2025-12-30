// assets/js/events.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedEvents = [];
let cachedMembers = [];
let cachedAttendanceByEvent = new Map(); // eventId -> Map(memberId -> attendanceRecord)

export function initEventsView(church) {
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
        <div class="members-toolbar">
          <div class="members-search">
            <input id="events-search" type="text" placeholder="Buscar (título, lugar, estado)..." />
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
        <h2 id="events-title"></h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Inicio</th>
                <th>Lugar</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="events-tbody">
              <tr><td colspan="5">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Event modal -->
      <div id="event-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="event-modal-title">Evento</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="event-form" class="modal-body">
            <input type="hidden" id="event-id" />

            <div class="field">
              <span>Título</span>
              <input type="text" id="event-title" required />
            </div>

            <div class="field">
              <span>Inicio</span>
              <input type="datetime-local" id="event-starts" required />
            </div>

            <div class="field">
              <span>Fin</span>
              <input type="datetime-local" id="event-ends" />
            </div>

            // <div class="field">
            //   <span>Lugar</span>
            //   <input type="text" id="event-location" />
            // </div>

            <div class="field">
              <span>Misión / Location</span>
              <select id="event-location">
                <option value="">(sin asignar)</option>
              </select>
            </div>

            <div class="field">
              <span>Lugar (texto)</span>
              <input id="event-location-place" type="text" placeholder="Ej: Salón principal" />
            </div>

            <div class="field">
              <span>Ministerio</span>
              <select id="event-ministry">
                <option value="">(sin asignar)</option>
              </select>
            </div>
            
            <div class="field">
              <span>Estado</span>
              <select id="event-status">
                <option value="scheduled">scheduled</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="event-notes" />
            </div>

            <div class="field">
              <span>Tags (JSON)</span>
              <input type="text" id="event-tags" placeholder='["domingo","jovenes"]' />
            </div>

            <div id="event-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Attendance modal -->
      <div id="attendance-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="attendance-modal-title">Asistencia</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <div class="modal-body">
            <div class="members-toolbar" style="margin-bottom:10px">
              <div class="members-search">
                <input id="attendance-search" type="text" placeholder="Buscar persona..." />
              </div>
              <div class="members-actions">
                <button id="attendance-reload" type="button" class="btn-secondary">Recargar</button>
              </div>
            </div>

            <div id="attendance-error" class="error"></div>
            <div id="attendance-success" class="success"></div>

            <div class="table-wrap">
              <table class="users-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="attendance-tbody">
                  <tr><td colspan="4">Cargando...</td></tr>
                </tbody>
              </table>
            </div>

            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    section.dataset.eventsCanCreate = canCreate ? "1" : "0";
    section.dataset.eventsCanUpdate = canUpdate ? "1" : "0";
    section.dataset.eventsCanDelete = canDelete ? "1" : "0";

    section.querySelector("#events-reload").addEventListener("click", async () => {
      await loadEventsForChurch(currentChurchId);
      renderEventsTable();
    });

    section.querySelector("#events-search").addEventListener("input", () => renderEventsTable());

    if (canCreate) {
      section.querySelector("#events-new").addEventListener("click", () => openEventModal({ mode: "create" }));
    }

    // modal close handlers
    section.querySelector("#event-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeEventModal();
    });

    section.querySelector("#attendance-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeAttendanceModal();
    });

    section.querySelector("#event-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveEvent();
    });

    section.querySelector("#attendance-search").addEventListener("input", () => {
      const eventId = section.dataset.attendanceEventId || "";
      if (eventId) renderAttendanceTable(eventId);
    });

    section.querySelector("#attendance-reload").addEventListener("click", async () => {
      const eventId = section.dataset.attendanceEventId || "";
      if (!eventId) return;
      await loadAttendance(eventId);
      renderAttendanceTable(eventId);
    });
  }

  // update title
  const title = document.getElementById("events-title");
  if (title) title.textContent = `Eventos en ${church.name}`;

  // load data
  Promise.all([
    loadEventsForChurch(church.id),
    loadMembersForChurch(church.id),
  ]).then(() => {
    renderEventsTable();
  });


  let cachedEventLocations = [];
  let cachedEventMinistries = [];

  async function loadEventLookups(churchId) {
    try {
      cachedEventLocations = await pb.collection("locations").getFullList({
        filter: `church.id = "${churchId}"`,
        sort: "name",
      });
    } catch { cachedEventLocations = []; }

    try {
      cachedEventMinistries = await pb.collection("ministries").getFullList({
        filter: `church.id = "${churchId}"`,
        sort: "name",
      });
    } catch { cachedEventMinistries = []; }
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

}

await loadEventLookups(church.id);
fillEventLookupSelects();

/* ---------------- Data loaders ---------------- */

async function loadEventsForChurch(churchId) {
  setText("events-error", "");
  setText("events-success", "");
  setTableLoading("events-tbody", 5);

  try {
    cachedEvents = await pb.collection("events").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "-starts_at",
    });
  } catch (err) {
    console.error("Error cargando events:", err);
    cachedEvents = [];
    setText("events-error", humanizePbError(err) || "Error cargando eventos.");
  }
}

async function loadMembersForChurch(churchId) {
  try {
    cachedMembers = await pb.collection("members").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "last_name,first_name",
    });
  } catch (err) {
    console.error("Error cargando members (attendance):", err);
    cachedMembers = [];
  }
}

async function loadAttendance(eventId) {
  setText("attendance-error", "");
  setText("attendance-success", "");
  setTableLoading("attendance-tbody", 4);

  try {
    const records = await pb.collection("event_attendance").getFullList({
      filter: `church.id = "${currentChurchId}" && event.id = "${eventId}"`,
      sort: "created",
    });

    const map = new Map();
    for (const r of records) {
      const memberId = r.member;
      if (memberId) map.set(String(memberId), r);
    }
    cachedAttendanceByEvent.set(eventId, map);
  } catch (err) {
    console.error("Error cargando attendance:", err);
    cachedAttendanceByEvent.set(eventId, new Map());
    setText("attendance-error", humanizePbError(err) || "Error cargando asistencia.");
  }
}

/* ---------------- Render: Events ---------------- */

function renderEventsTable() {
  const tbody = document.getElementById("events-tbody");
  const section = document.querySelector('section[data-view="events"]');
  if (!tbody || !section) return;

  const canUpdate = section.dataset.eventsCanUpdate === "1";
  const canDelete = section.dataset.eventsCanDelete === "1";
  const canReadAttendance = can("read", "event_attendance") || can("read", "events"); // pragmatic
  const canWriteAttendance = can("update", "event_attendance") || can("create", "event_attendance");

  const q = (document.getElementById("events-search")?.value || "").trim().toLowerCase();

  const filtered = !q
    ? cachedEvents
    : cachedEvents.filter((ev) => {
        const title = String(ev.title || "").toLowerCase();
        const location = String(ev.location || "").toLowerCase();
        const locationText = String(ev.location_place || "").toLowerCase();
        const status = String(ev.status || "").toLowerCase();
        return title.includes(q) || location.includes(q) || status.includes(q);
      });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay eventos.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const ev of filtered) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Título">${escapeHtml(ev.title || "")}</td>
      <td data-label="Inicio">${escapeHtml(formatDateTime(ev.starts_at))}</td>
      <td data-label="Ubicacion">${escapeHtml(ev.location || "")}</td>
      <td data-label="Lugar">${escapeHtml(ev.location_place || "")}</td>
      <td data-label="Estado">${escapeHtml(ev.status || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actionsTd = tr.querySelector(".row-actions");

    if (canReadAttendance) {
      const attBtn = document.createElement("button");
      attBtn.type = "button";
      attBtn.textContent = "Asistencia";
      attBtn.className = "btn-secondary";
      attBtn.addEventListener("click", async () => {
        await openAttendanceModal(ev);
      });
      actionsTd.appendChild(attBtn);
    }

    if (canUpdate) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openEventModal({ mode: "edit", record: ev }));
      actionsTd.appendChild(editBtn);
    }

    if (canDelete) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Eliminar";
      delBtn.className = "danger-btn";
      delBtn.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar evento "${ev.title || ""}"?`);
        if (!ok) return;
        await deleteEvent(ev.id);
      });
      actionsTd.appendChild(delBtn);
    }

    // Attendance write hint (not required, but helps UX)
    if (!canWriteAttendance && canReadAttendance) {
      // no-op
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Render: Attendance ---------------- */

async function openAttendanceModal(eventRecord) {
  const section = document.querySelector('section[data-view="events"]');
  if (!section) return;

  section.dataset.attendanceEventId = eventRecord.id;

  setText("attendance-modal-title", `Asistencia — ${eventRecord.title || ""}`);
  document.getElementById("attendance-modal").style.display = "block";

  // Ensure members loaded
  if (!cachedMembers.length) await loadMembersForChurch(currentChurchId);

  await loadAttendance(eventRecord.id);
  renderAttendanceTable(eventRecord.id);
}

function closeAttendanceModal() {
  const section = document.querySelector('section[data-view="events"]');
  if (section) section.dataset.attendanceEventId = "";
  const modal = document.getElementById("attendance-modal");
  if (modal) modal.style.display = "none";
}

function renderAttendanceTable(eventId) {
  const tbody = document.getElementById("attendance-tbody");
  const section = document.querySelector('section[data-view="events"]');
  if (!tbody || !section) return;

  const canWriteAttendance = can("update", "event_attendance") || can("create", "event_attendance");
  const q = (document.getElementById("attendance-search")?.value || "").trim().toLowerCase();

  const attMap = cachedAttendanceByEvent.get(eventId) || new Map();

  const members = !q
    ? cachedMembers
    : cachedMembers.filter((m) => {
        const name = `${m.first_name || ""} ${m.last_name || ""}`.trim().toLowerCase();
        const email = String(m.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="4">No hay personas para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const m of members) {
    const tr = document.createElement("tr");

    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
    const email = m.email || "";

    const att = attMap.get(String(m.id));
    const status = att?.status || "unknown";

    tr.innerHTML = `
      <td data-label="Persona">${escapeHtml(name)}</td>
      <td data-label="Email">${escapeHtml(email)}</td>
      <td data-label="Estado">${escapeHtml(status)}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actionsTd = tr.querySelector(".row-actions");

    const mkBtn = (label, nextStatus) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.className = "btn-secondary";
      b.disabled = !canWriteAttendance;
      b.addEventListener("click", async () => {
        await upsertAttendance(eventId, m.id, nextStatus);
        renderAttendanceTable(eventId);
      });
      return b;
    };

    actionsTd.appendChild(mkBtn("Presente", "present"));
    actionsTd.appendChild(mkBtn("Ausente", "absent"));
    actionsTd.appendChild(mkBtn("N/A", "unknown"));

    tbody.appendChild(tr);
  }
}

async function upsertAttendance(eventId, memberId, status) {
  const canWrite = can("update", "event_attendance") || can("create", "event_attendance");
  if (!canWrite) return;

  setText("attendance-error", "");
  setText("attendance-success", "");

  const map = cachedAttendanceByEvent.get(eventId) || new Map();
  const existing = map.get(String(memberId));

  try {
    if (existing) {
      const updated = await pb.collection("event_attendance").update(existing.id, { status });
      map.set(String(memberId), updated);
    } else {
      const created = await pb.collection("event_attendance").create({
        church: currentChurchId,
        event: eventId,
        member: memberId,
        status,
      });
      map.set(String(memberId), created);
    }
    cachedAttendanceByEvent.set(eventId, map);
    setText("attendance-success", "Asistencia actualizada.");
  } catch (err) {
    console.error("Error upsert attendance:", err);
    setText("attendance-error", humanizePbError(err) || "Error guardando asistencia.");
  }
}

/* ---------------- Event CRUD ---------------- */

function openEventModal({ mode, record }) {
  const section = document.querySelector('section[data-view="events"]');
  if (!section) return;

  const canCreate = section.dataset.eventsCanCreate === "1";
  const canUpdate = section.dataset.eventsCanUpdate === "1";

  if (mode === "create" && !canCreate) return;
  if (mode === "edit" && !canUpdate) return;

  setText("event-form-error", "");

  document.getElementById("event-id").value = record?.id || "";
  document.getElementById("event-title").value = record?.title || "";

  document.getElementById("event-starts").value = toLocalDatetimeInput(record?.starts_at) || "";
  document.getElementById("event-ends").value = toLocalDatetimeInput(record?.ends_at) || "";

  document.getElementById("event-location").value = record?.location || "";
  document.getElementById("event-location-place").value = record?.location_place || "";
  document.getElementById("event-ministry").value = record?.ministry || "";
  document.getElementById("event-status").value = record?.status || "scheduled";
  document.getElementById("event-notes").value = record?.notes || "";
  document.getElementById("event-tags").value = record?.tags ? JSON.stringify(record.tags) : "";

  document.getElementById("event-modal-title").textContent =
    mode === "create" ? "Nuevo evento" : "Editar evento";

  document.getElementById("event-modal").style.display = "block";
}

function closeEventModal() {
  const modal = document.getElementById("event-modal");
  if (modal) modal.style.display = "none";
}

async function saveEvent() {
  setText("event-form-error", "");
  setText("events-error", "");
  setText("events-success", "");

  const id = document.getElementById("event-id").value.trim();
  const title = document.getElementById("event-title").value.trim();
  const starts = document.getElementById("event-starts").value;
  const ends = document.getElementById("event-ends").value;
  const location = document.getElementById("event-location").value || null;
  const location_place = document.getElementById("event-location-place").value.trim();
  const ministry = document.getElementById("event-ministry").value || null;  
  const status = document.getElementById("event-status").value;
  const notes = document.getElementById("event-notes").value.trim();
  const tagsRaw = document.getElementById("event-tags").value.trim();

  payload.location = location;
  payload.location_place = location_place;
  payload.ministry = ministry;

  if (!title) return setText("event-form-error", "Título es obligatorio.");
  if (!starts) return setText("event-form-error", "Inicio es obligatorio.");

  let tags = null;
  if (tagsRaw) {
    try {
      tags = JSON.parse(tagsRaw);
    } catch {
      return setText("event-form-error", 'Tags debe ser JSON válido (ej: ["a","b"]).');
    }
  }

  try {
    if (!id) {
      await pb.collection("events").create({
        church: currentChurchId,
        title,
        starts_at: fromLocalDatetimeInput(starts),
        ends_at: ends ? fromLocalDatetimeInput(ends) : null,
        location,
        status,
        notes,
        tags,
      });
      setText("events-success", "Evento creado.");
    } else {
      await pb.collection("events").update(id, {
        title,
        starts_at: fromLocalDatetimeInput(starts),
        ends_at: ends ? fromLocalDatetimeInput(ends) : null,
        location,
        status,
        notes,
        tags,
      });
      setText("events-success", "Evento actualizado.");
    }

    closeEventModal();
    await loadEventsForChurch(currentChurchId);
    renderEventsTable();
  } catch (err) {
    console.error("Error guardando event:", err);
    setText("event-form-error", humanizePbError(err) || "Error guardando evento.");
  }
}

async function deleteEvent(id) {
  setText("events-error", "");
  setText("events-success", "");

  try {
    // optional: delete attendance for that event
    // (PocketBase doesn't do cascades automatically)
    const attendance = await pb.collection("event_attendance").getFullList({
      filter: `church.id = "${currentChurchId}" && event.id = "${id}"`,
      sort: "created",
    });
    for (const a of attendance) {
      try { await pb.collection("event_attendance").delete(a.id); } catch {}
    }

    await pb.collection("events").delete(id);
    setText("events-success", "Evento eliminado.");

    await loadEventsForChurch(currentChurchId);
    renderEventsTable();
  } catch (err) {
    console.error("Error eliminando event:", err);
    setText("events-error", humanizePbError(err) || "Error eliminando evento.");
  }
}

/* ---------------- Helpers ---------------- */

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}

function setTableLoading(tbodyId, cols) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${cols}">Cargando...</td></tr>`;
}

function humanizePbError(err) {
  const data = err?.data?.data;
  if (data && typeof data === "object") {
    for (const f of Object.keys(data)) {
      const fm = data[f]?.message;
      if (fm) return fm;
    }
  }
  return err?.data?.message || err?.message || "";
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function toLocalDatetimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// datetime-local gives local time; PB expects ISO with timezone.
// Convert local to ISO string.
function fromLocalDatetimeInput(localValue) {
  const d = new Date(localValue);
  return d.toISOString();
}


// --- EXPORTS PARA CALENDAR ---

export async function openEventModalById(eventId) {
  try {
  // Ensure the Events view (and its modal inputs) exists in DOM
  const church = safeGetCurrentChurch();
  if (church) {
    // If the modal inputs are missing, the view hasn't been initialized yet
    if (!document.getElementById("event-id") || !document.getElementById("event-title")) {
      initEventsView(church);
    }
  }

  const record = await pb.collection("events").getOne(eventId);
  openEventModal({ mode: "edit", record });
  } catch (err) {
    console.error("Error abriendo evento desde calendario:", err);
    alert("No se pudo abrir el evento.");
  }

  // Force modal to be globally visible (not hidden with section display:none)
  const modal = document.getElementById("event-modal");
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  if (modal) modal.style.display = "block";
}

function safeGetCurrentChurch() {
  try {
    return JSON.parse(localStorage.getItem("holycrm_current_church"));
  } catch {
    return null;
  }
}