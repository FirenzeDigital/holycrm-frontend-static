// assets/js/rotas.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedRoles = [];
let cachedMembers = [];
let cachedAssignments = []; // current month
let currentMonthKey = "";   // YYYY-MM

export function initRotasView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="rotas"]');
  if (!section) return;

  if (!can("read", "service_roles") && !can("read", "service_role_assignments")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Roles mensuales (Rotas)</h1>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search" style="gap:10px;flex-wrap:wrap;">
            <label class="muted" style="display:flex;align-items:center;gap:8px;">
              Mes:
              <input id="rotas-month" type="month" />
            </label>
            <input id="rotas-search" type="text" placeholder="Buscar (rol, persona)..." />
          </div>

          <div class="members-actions">
            <button id="rotas-reload" type="button">Recargar</button>
            ${can("create","service_roles") ? `<button id="rotas-new-role" type="button">Nuevo rol</button>` : ""}
            ${can("create","service_role_assignments") ? `<button id="rotas-new-assignment" type="button">Asignar</button>` : ""}
          </div>
        </div>

        <div id="rotas-error" class="error"></div>
        <div id="rotas-success" class="success"></div>
      </div>

      <div class="card">
        <h2>Asignaciones del mes</h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Rol</th>
                <th>Asignado a</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="rotas-tbody">
              <tr><td colspan="5">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>Roles disponibles</h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Estado</th>
                <th>Descripción</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="roles-tbody">
              <tr><td colspan="4">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Role modal -->
      <div id="role-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="role-modal-title">Rol</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="role-form" class="modal-body">
            <input type="hidden" id="role-id" />

            <div class="field">
              <span>Nombre</span>
              <input type="text" id="role-name" required />
            </div>

            <div class="field">
              <span>Estado</span>
              <select id="role-status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div class="field">
              <span>Descripción</span>
              <input type="text" id="role-description" />
            </div>

            <div id="role-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" data-close="1">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Assignment modal -->
      <div id="assignment-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="assignment-modal-title">Asignación</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="assignment-form" class="modal-body">
            <input type="hidden" id="assignment-id" />

            <div class="field">
              <span>Fecha</span>
              <input type="date" id="assignment-date" required />
            </div>

            <div class="field">
              <span>Rol</span>
              <select id="assignment-role" required></select>
            </div>

            <div class="field">
              <span>Asignado a (miembro)</span>
              <select id="assignment-member">
                <option value="">(sin asignar)</option>
              </select>
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="assignment-notes" />
            </div>

            <div id="assignment-form-error" class="error"></div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" data-close="1">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // init month input
    const monthEl = section.querySelector("#rotas-month");
    monthEl.value = monthKeyFromDate(new Date());
    currentMonthKey = monthEl.value;

    section.querySelector("#rotas-reload").addEventListener("click", async () => {
      await reloadAll();
    });

    section.querySelector("#rotas-search").addEventListener("input", () => {
      renderAssignmentsTable();
      renderRolesTable();
    });

    monthEl.addEventListener("change", async () => {
      currentMonthKey = monthEl.value || monthKeyFromDate(new Date());
      await loadAssignmentsForMonth(currentMonthKey);
      renderAssignmentsTable();
    });

    // role modal close
    section.querySelector("#role-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeRoleModal();
    });

    // assignment modal close
    section.querySelector("#assignment-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeAssignmentModal();
    });

    // role form submit
    section.querySelector("#role-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveRole();
    });

    // assignment form submit
    section.querySelector("#assignment-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveAssignment();
    });

    // new role
    const newRoleBtn = section.querySelector("#rotas-new-role");
    if (newRoleBtn) newRoleBtn.addEventListener("click", () => openRoleModal({ mode: "create" }));

    // new assignment
    const newAssignBtn = section.querySelector("#rotas-new-assignment");
    if (newAssignBtn) newAssignBtn.addEventListener("click", () => openAssignmentModal({ mode: "create" }));
  }

  reloadAll();
}

async function reloadAll() {
  setText("rotas-error", "");
  setText("rotas-success", "");

  await Promise.all([
    loadRoles(),
    loadMembers(),
  ]);

  // ensure month stays consistent
  const section = document.querySelector('section[data-view="rotas"]');
  const monthEl = section?.querySelector("#rotas-month");
  currentMonthKey = monthEl?.value || monthKeyFromDate(new Date());

  await loadAssignmentsForMonth(currentMonthKey);

  fillAssignmentRoleOptions();
  fillAssignmentMemberOptions();

  renderRolesTable();
  renderAssignmentsTable();
}

/* ---------------- Loaders ---------------- */

async function loadRoles() {
  setTableLoading("roles-tbody", 4);
  try {
    cachedRoles = await pb.collection("service_roles").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "name",
    });
  } catch (err) {
    console.error("Error cargando roles:", err);
    cachedRoles = [];
    setText("rotas-error", humanizePbError(err) || "Error cargando roles.");
  }
}

async function loadMembers() {
  try {
    cachedMembers = await pb.collection("members").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "last_name,first_name",
    });
  } catch (err) {
    console.error("Error cargando members (rotas):", err);
    cachedMembers = [];
  }
}

async function loadAssignmentsForMonth(monthKey) {
  setTableLoading("rotas-tbody", 5);
  try {
    const { start, end } = monthRange(monthKey);
    // PocketBase date field filter works with string comparisons on ISO date format
    cachedAssignments = await pb.collection("service_role_assignments").getFullList({
      filter: `church.id = "${currentChurchId}" && date >= "${start}" && date <= "${end}"`,
      sort: "date,created",
    });
  } catch (err) {
    console.error("Error cargando assignments:", err);
    cachedAssignments = [];
    setText("rotas-error", humanizePbError(err) || "Error cargando asignaciones.");
  }
}

/* ---------------- Render roles ---------------- */

function renderRolesTable() {
  const tbody = document.getElementById("roles-tbody");
  if (!tbody) return;

  const q = (document.getElementById("rotas-search")?.value || "").trim().toLowerCase();

  const list = !q
    ? cachedRoles
    : cachedRoles.filter((r) => {
        const name = String(r.name || "").toLowerCase();
        const st = String(r.status || "").toLowerCase();
        return name.includes(q) || st.includes(q);
      });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4">No hay roles.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const r of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Rol">${escapeHtml(r.name || "")}</td>
      <td data-label="Estado">${escapeHtml(r.status || "")}</td>
      <td data-label="Descripción">${escapeHtml(r.description || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (can("update", "service_roles")) {
      const eb = document.createElement("button");
      eb.type = "button";
      eb.textContent = "Editar";
      eb.addEventListener("click", () => openRoleModal({ mode: "edit", record: r }));
      actions.appendChild(eb);
    }

    if (can("delete", "service_roles")) {
      const db = document.createElement("button");
      db.type = "button";
      db.className = "danger-btn";
      db.textContent = "Eliminar";
      db.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar rol "${r.name}"?`);
        if (!ok) return;

        // guard: if there are assignments, confirm harder
        const used = cachedAssignments.some(a => String(a.service_role) === String(r.id));
        if (used) {
          const ok2 = confirm("Este rol tiene asignaciones este mes. ¿Eliminar igual? (No borra otros meses automáticamente)");
          if (!ok2) return;
        }

        await deleteRole(r.id);
      });
      actions.appendChild(db);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Render assignments ---------------- */

function renderAssignmentsTable() {
  const tbody = document.getElementById("rotas-tbody");
  if (!tbody) return;

  const q = (document.getElementById("rotas-search")?.value || "").trim().toLowerCase();

  const list = !q
    ? cachedAssignments
    : cachedAssignments.filter((a) => {
        const roleName = roleNameById(a.service_role).toLowerCase();
        const memberName = memberNameById(a.assigned_member).toLowerCase();
        const notes = String(a.notes || "").toLowerCase();
        return roleName.includes(q) || memberName.includes(q) || notes.includes(q);
      });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay asignaciones en este mes.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const a of list) {
    const tr = document.createElement("tr");

    const roleName = roleNameById(a.service_role);
    const memberName = a.assigned_member ? memberNameById(a.assigned_member) : "";
    const date = a.date ? String(a.date).slice(0, 10) : "";

    tr.innerHTML = `
      <td data-label="Fecha">${escapeHtml(date)}</td>
      <td data-label="Rol">${escapeHtml(roleName)}</td>
      <td data-label="Asignado a">${escapeHtml(memberName)}</td>
      <td data-label="Notas">${escapeHtml(a.notes || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (can("update", "service_role_assignments")) {
      const eb = document.createElement("button");
      eb.type = "button";
      eb.textContent = "Editar";
      eb.addEventListener("click", () => openAssignmentModal({ mode: "edit", record: a }));
      actions.appendChild(eb);
    }

    if (can("delete", "service_role_assignments")) {
      const db = document.createElement("button");
      db.type = "button";
      db.className = "danger-btn";
      db.textContent = "Eliminar";
      db.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar asignación de "${roleName}" el ${date}?`);
        if (!ok) return;
        await deleteAssignment(a.id);
      });
      actions.appendChild(db);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Role modal CRUD ---------------- */

function openRoleModal({ mode, record }) {
  if (mode === "create" && !can("create", "service_roles")) return;
  if (mode === "edit" && !can("update", "service_roles")) return;

  setText("role-form-error", "");

  document.getElementById("role-id").value = record?.id || "";
  document.getElementById("role-name").value = record?.name || "";
  document.getElementById("role-status").value = record?.status || "active";
  document.getElementById("role-description").value = record?.description || "";

  document.getElementById("role-modal-title").textContent =
    mode === "create" ? "Nuevo rol" : "Editar rol";

  document.getElementById("role-modal").style.display = "block";
}

function closeRoleModal() {
  document.getElementById("role-modal").style.display = "none";
}

async function saveRole() {
  setText("role-form-error", "");
  setText("rotas-error", "");
  setText("rotas-success", "");

  const id = document.getElementById("role-id").value.trim();
  const name = document.getElementById("role-name").value.trim();
  const status = document.getElementById("role-status").value;
  const description = document.getElementById("role-description").value.trim();

  if (!name) return setText("role-form-error", "Nombre es obligatorio.");

  try {
    const payload = { church: currentChurchId, name, status, description };

    if (!id) {
      await pb.collection("service_roles").create(payload);
      setText("rotas-success", "Rol creado.");
    } else {
      delete payload.church;
      await pb.collection("service_roles").update(id, payload);
      setText("rotas-success", "Rol actualizado.");
    }

    closeRoleModal();
    await loadRoles();
    fillAssignmentRoleOptions();
    renderRolesTable();
  } catch (err) {
    setText("role-form-error", humanizePbError(err) || "Error guardando rol.");
  }
}

async function deleteRole(roleId) {
  setText("rotas-error", "");
  setText("rotas-success", "");

  try {
    await pb.collection("service_roles").delete(roleId);
    setText("rotas-success", "Rol eliminado.");

    await loadRoles();
    fillAssignmentRoleOptions();
    renderRolesTable();
  } catch (err) {
    setText("rotas-error", humanizePbError(err) || "Error eliminando rol.");
  }
}

/* ---------------- Assignment modal CRUD ---------------- */

function openAssignmentModal({ mode, record }) {
  if (mode === "create" && !can("create", "service_role_assignments")) return;
  if (mode === "edit" && !can("update", "service_role_assignments")) return;

  setText("assignment-form-error", "");

  fillAssignmentRoleOptions();
  fillAssignmentMemberOptions();

  document.getElementById("assignment-id").value = record?.id || "";
  document.getElementById("assignment-date").value = record?.date ? String(record.date).slice(0,10) : defaultDateForMonth(currentMonthKey);
  document.getElementById("assignment-role").value = record?.service_role || (cachedRoles[0]?.id || "");
  document.getElementById("assignment-member").value = record?.assigned_member || "";
  document.getElementById("assignment-notes").value = record?.notes || "";

  document.getElementById("assignment-modal-title").textContent =
    mode === "create" ? "Nueva asignación" : "Editar asignación";

  document.getElementById("assignment-modal").style.display = "block";
}

function closeAssignmentModal() {
  document.getElementById("assignment-modal").style.display = "none";
}

function fillAssignmentRoleOptions() {
  const sel = document.getElementById("assignment-role");
  if (!sel) return;

  const current = sel.value || "";
  sel.innerHTML = "";

  const activeRoles = cachedRoles.filter(r => (r.status || "active") === "active");
  for (const r of activeRoles) {
    sel.insertAdjacentHTML("beforeend", `<option value="${r.id}">${escapeHtml(r.name || "")}</option>`);
  }
  sel.value = current && activeRoles.some(r => r.id === current) ? current : (activeRoles[0]?.id || "");
}

function fillAssignmentMemberOptions() {
  const sel = document.getElementById("assignment-member");
  if (!sel) return;

  const current = sel.value || "";
  sel.innerHTML = `<option value="">(sin asignar)</option>`;
  for (const m of cachedMembers) {
    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
    sel.insertAdjacentHTML("beforeend", `<option value="${m.id}">${escapeHtml(name)}</option>`);
  }
  sel.value = current;
}

async function saveAssignment() {
  setText("assignment-form-error", "");
  setText("rotas-error", "");
  setText("rotas-success", "");

  const id = document.getElementById("assignment-id").value.trim();
  const date = document.getElementById("assignment-date").value;
  const service_role = document.getElementById("assignment-role").value;
  const assigned_member = document.getElementById("assignment-member").value || null;
  const notes = document.getElementById("assignment-notes").value.trim();

  if (!date) return setText("assignment-form-error", "Fecha es obligatoria.");
  if (!service_role) return setText("assignment-form-error", "Rol es obligatorio.");

  try {
    const payload = {
      church: currentChurchId,
      service_role,
      date,
      assigned_member,
      notes,
    };

    if (!id) {
      await pb.collection("service_role_assignments").create(payload);
      setText("rotas-success", "Asignación creada.");
    } else {
      delete payload.church;
      await pb.collection("service_role_assignments").update(id, payload);
      setText("rotas-success", "Asignación actualizada.");
    }

    closeAssignmentModal();
    await loadAssignmentsForMonth(currentMonthKey);
    renderAssignmentsTable();
  } catch (err) {
    setText("assignment-form-error", humanizePbError(err) || "Error guardando asignación.");
  }
}

async function deleteAssignment(id) {
  setText("rotas-error", "");
  setText("rotas-success", "");

  try {
    await pb.collection("service_role_assignments").delete(id);
    setText("rotas-success", "Asignación eliminada.");
    await loadAssignmentsForMonth(currentMonthKey);
    renderAssignmentsTable();
  } catch (err) {
    setText("rotas-error", humanizePbError(err) || "Error eliminando asignación.");
  }
}

/* ---------------- Helpers ---------------- */

function roleNameById(id) {
  if (!id) return "";
  const r = cachedRoles.find(x => x.id === id);
  return r?.name || "";
}

function memberNameById(id) {
  if (!id) return "";
  const m = cachedMembers.find(x => x.id === id);
  if (!m) return "";
  return `${m.first_name || ""} ${m.last_name || ""}`.trim();
}

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

function monthKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(monthKey) {
  // returns ISO YYYY-MM-DD for filter comparisons
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${yStr}-${mStr}-01`;
  const last = new Date(y, m, 0); // day 0 next month = last day of current month
  const end = `${yStr}-${mStr}-${String(last.getDate()).padStart(2, "0")}`;
  return { start, end };
}

function defaultDateForMonth(monthKey) {
  const [y, m] = String(monthKey || "").split("-");
  return `${y}-${m}-01`;
}
