// assets/js/ministries.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedMinistries = [];
let cachedMembers = [];
let cachedMembershipsByMinistry = new Map(); // ministryId -> Map(memberId -> membershipRecord)
let cachedActivitiesByMinistry = new Map();  // ministryId -> activityRecords[]

export function initMinistriesView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="ministries"]');
  if (!section) return;

  if (!can("read", "ministries")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "ministries");
  const canUpdate = can("update", "ministries");
  const canDelete = can("delete", "ministries");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Ministerios</h1>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search">
            <input id="ministries-search" type="text" placeholder="Buscar (nombre, estado)..." />
          </div>
          <div class="members-actions">
            <button id="ministries-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="ministries-new" type="button">Nuevo ministerio</button>` : ""}
          </div>
        </div>

        <div id="ministries-error" class="error"></div>
        <div id="ministries-success" class="success"></div>
      </div>

      <div class="card">
        <h2 id="ministries-title"></h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Líder</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="ministries-tbody">
              <tr><td colspan="4">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Ministry modal -->
      <div id="ministry-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="ministry-modal-title">Ministerio</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="ministry-form" class="modal-body">
            <input type="hidden" id="ministry-id" />

            <div class="field">
              <span>Nombre</span>
              <input type="text" id="ministry-name" required />
            </div>

            <div class="field">
              <span>Líder (miembro)</span>
              <select id="ministry-leader">
                <option value="">(sin asignar)</option>
              </select>
            </div>

            <div class="field">
              <span>Estado</span>
              <select id="ministry-status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="ministry-notes" />
            </div>

            <div id="ministry-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Memberships modal -->
      <div id="ministry-members-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="ministry-members-title">Servidores</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <div class="modal-body">
            <div class="members-toolbar" style="margin-bottom:10px">
              <div class="members-search">
                <input id="ministry-members-search" type="text" placeholder="Buscar persona..." />
              </div>
              <div class="members-actions">
                <button id="ministry-members-reload" type="button" class="btn-secondary">Recargar</button>
              </div>
            </div>

            <div id="ministry-members-error" class="error"></div>
            <div id="ministry-members-success" class="success"></div>

            <div class="table-wrap">
              <table class="users-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="ministry-members-tbody">
                  <tr><td colspan="5">Cargando...</td></tr>
                </tbody>
              </table>
            </div>

            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Activities modal -->
      <div id="ministry-activities-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="ministry-activities-title">Actividades semanales</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <div class="modal-body">
            <div class="members-toolbar" style="margin-bottom:10px">
              <div class="members-search">
                <input id="ministry-activities-search" type="text" placeholder="Buscar actividad..." />
              </div>
              <div class="members-actions">
                <button id="ministry-activities-reload" type="button" class="btn-secondary">Recargar</button>
                ${can("create","ministry_activities") ? `<button id="ministry-activity-new" type="button">Nueva actividad</button>` : ""}
              </div>
            </div>

            <div id="ministry-activities-error" class="error"></div>
            <div id="ministry-activities-success" class="success"></div>

            <div class="table-wrap">
              <table class="users-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Día</th>
                    <th>Hora</th>
                    <th>Lugar</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="ministry-activities-tbody">
                  <tr><td colspan="6">Cargando...</td></tr>
                </tbody>
              </table>
            </div>

            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity edit modal -->
      <div id="activity-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="activity-modal-title">Actividad</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="activity-form" class="modal-body">
            <input type="hidden" id="activity-id" />

            <div class="field">
              <span>Título</span>
              <input type="text" id="activity-title" required />
            </div>

            <div class="field">
              <span>Día</span>
              <select id="activity-weekday">
                <option value="mon">mon</option>
                <option value="tue">tue</option>
                <option value="wed">wed</option>
                <option value="thu">thu</option>
                <option value="fri">fri</option>
                <option value="sat">sat</option>
                <option value="sun">sun</option>
              </select>
            </div>

            <div class="field">
              <span>Hora (HH:MM)</span>
              <input type="text" id="activity-time" placeholder="19:30" required />
            </div>

            <div class="field">
              <span>Duración (min)</span>
              <input type="number" id="activity-duration" min="0" placeholder="90" />
            </div>

            <div class="field">
              <span>Lugar</span>
              <input type="text" id="activity-location" />
            </div>

            <div class="field">
              <span>Estado</span>
              <select id="activity-status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="activity-notes" />
            </div>

            <div id="activity-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    section.querySelector("#ministries-reload").addEventListener("click", async () => {
      await loadMinistries();
      renderMinistriesTable();
    });

    section.querySelector("#ministries-search").addEventListener("input", () => renderMinistriesTable());

    if (canCreate) {
      section.querySelector("#ministries-new").addEventListener("click", () => openMinistryModal({ mode: "create" }));
    }

    section.querySelector("#ministry-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeMinistryModal();
    });

    section.querySelector("#ministry-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveMinistry();
    });

    section.querySelector("#ministry-members-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeMembersModal();
    });

    section.querySelector("#ministry-members-search").addEventListener("input", () => {
      const mid = section.dataset.ministryMembersMinistryId || "";
      if (mid) renderMembersTable(mid);
    });

    section.querySelector("#ministry-members-reload").addEventListener("click", async () => {
      const mid = section.dataset.ministryMembersMinistryId || "";
      if (!mid) return;
      await loadMembers();
      await loadMemberships(mid);
      renderMembersTable(mid);
    });

    section.querySelector("#ministry-activities-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeActivitiesModal();
    });

    section.querySelector("#ministry-activities-search").addEventListener("input", () => {
      const mid = section.dataset.ministryActivitiesMinistryId || "";
      if (mid) renderActivitiesTable(mid);
    });

    section.querySelector("#ministry-activities-reload").addEventListener("click", async () => {
      const mid = section.dataset.ministryActivitiesMinistryId || "";
      if (!mid) return;
      await loadActivities(mid);
      renderActivitiesTable(mid);
    });

    const newActBtn = section.querySelector("#ministry-activity-new");
    if (newActBtn) {
      newActBtn.addEventListener("click", () => openActivityModal({ mode: "create" }));
    }

    section.querySelector("#activity-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeActivityModal();
    });

    section.querySelector("#activity-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveActivity();
    });
  }

  document.getElementById("ministries-title").textContent = `Ministerios en ${church.name}`;

  Promise.all([loadMembers(), loadMinistries()]).then(() => renderMinistriesTable());
}

/* ---------------- Data ---------------- */

async function loadMinistries() {
  setText("ministries-error", "");
  setText("ministries-success", "");
  setTableLoading("ministries-tbody", 4);

  try {
    cachedMinistries = await pb.collection("ministries").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "name",
    });
  } catch (err) {
    console.error(err);
    cachedMinistries = [];
    setText("ministries-error", humanizePbError(err) || "Error cargando ministerios.");
  }
}

async function loadMembers() {
  try {
    cachedMembers = await pb.collection("members").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "last_name,first_name",
    });
    fillLeaderOptions();
  } catch (err) {
    console.error(err);
    cachedMembers = [];
  }
}

async function loadMemberships(ministryId) {
  setTableLoading("ministry-members-tbody", 5);
  try {
    const recs = await pb.collection("ministry_memberships").getFullList({
      filter: `church.id = "${currentChurchId}" && ministry.id = "${ministryId}"`,
      sort: "created",
    });
    const map = new Map();
    for (const r of recs) map.set(String(r.member), r);
    cachedMembershipsByMinistry.set(ministryId, map);
  } catch (err) {
    cachedMembershipsByMinistry.set(ministryId, new Map());
    setText("ministry-members-error", humanizePbError(err) || "Error cargando servidores.");
  }
}

async function loadActivities(ministryId) {
  setTableLoading("ministry-activities-tbody", 6);
  try {
    const recs = await pb.collection("ministry_activities").getFullList({
      filter: `church.id = "${currentChurchId}" && ministry.id = "${ministryId}"`,
      sort: "weekday,time",
    });
    cachedActivitiesByMinistry.set(ministryId, recs);
  } catch (err) {
    cachedActivitiesByMinistry.set(ministryId, []);
    setText("ministry-activities-error", humanizePbError(err) || "Error cargando actividades.");
  }
}

/* ---------------- Render ministries ---------------- */

function renderMinistriesTable() {
  const tbody = document.getElementById("ministries-tbody");
  if (!tbody) return;

  const q = (document.getElementById("ministries-search")?.value || "").trim().toLowerCase();

  const list = !q
    ? cachedMinistries
    : cachedMinistries.filter((m) => {
        const name = String(m.name || "").toLowerCase();
        const status = String(m.status || "").toLowerCase();
        return name.includes(q) || status.includes(q);
      });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4">No hay ministerios.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const m of list) {
    const tr = document.createElement("tr");

    const leaderName = m.leader_member
      ? memberNameById(m.leader_member)
      : "";

    tr.innerHTML = `
      <td data-label="Nombre">${escapeHtml(m.name || "")}</td>
      <td data-label="Líder">${escapeHtml(leaderName)}</td>
      <td data-label="Estado">${escapeHtml(m.status || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (can("read","ministry_memberships") || can("create","ministry_memberships") || can("update","ministry_memberships")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-secondary";
      b.textContent = "Servidores";
      b.addEventListener("click", async () => openMembersModal(m));
      actions.appendChild(b);
    }

    if (can("read","ministry_activities")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-secondary";
      b.textContent = "Actividades";
      b.addEventListener("click", async () => openActivitiesModal(m));
      actions.appendChild(b);
    }

    if (can("update","ministries")) {
      const eb = document.createElement("button");
      eb.type = "button";
      eb.textContent = "Editar";
      eb.addEventListener("click", () => openMinistryModal({ mode:"edit", record:m }));
      actions.appendChild(eb);
    }

    if (can("delete","ministries")) {
      const db = document.createElement("button");
      db.type = "button";
      db.className = "danger-btn";
      db.textContent = "Eliminar";
      db.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar "${m.name}"?`);
        if (!ok) return;
        await deleteMinistry(m.id);
      });
      actions.appendChild(db);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Ministry CRUD ---------------- */

function fillLeaderOptions() {
  const sel = document.getElementById("ministry-leader");
  if (!sel) return;

  const current = sel.value || "";
  sel.innerHTML = `<option value="">(sin asignar)</option>`;
  for (const m of cachedMembers) {
    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
    sel.insertAdjacentHTML("beforeend", `<option value="${m.id}">${escapeHtml(name)}</option>`);
  }
  sel.value = current;
}

function openMinistryModal({ mode, record }) {
  if (mode === "create" && !can("create","ministries")) return;
  if (mode === "edit" && !can("update","ministries")) return;

  setText("ministry-form-error","");

  document.getElementById("ministry-id").value = record?.id || "";
  document.getElementById("ministry-name").value = record?.name || "";
  document.getElementById("ministry-status").value = record?.status || "active";
  document.getElementById("ministry-notes").value = record?.notes || "";
  fillLeaderOptions();
  document.getElementById("ministry-leader").value = record?.leader_member || "";

  document.getElementById("ministry-modal-title").textContent = mode === "create" ? "Nuevo ministerio" : "Editar ministerio";
  document.getElementById("ministry-modal").style.display = "block";
}

function closeMinistryModal() {
  document.getElementById("ministry-modal").style.display = "none";
}

async function saveMinistry() {
  setText("ministry-form-error","");
  setText("ministries-error","");
  setText("ministries-success","");

  const id = document.getElementById("ministry-id").value.trim();
  const name = document.getElementById("ministry-name").value.trim();
  const status = document.getElementById("ministry-status").value;
  const notes = document.getElementById("ministry-notes").value.trim();
  const leader_member = document.getElementById("ministry-leader").value || null;

  if (!name) return setText("ministry-form-error","Nombre es obligatorio.");

  try {
    const payload = { church: currentChurchId, name, status, notes, leader_member };

    if (!id) {
      await pb.collection("ministries").create(payload);
      setText("ministries-success","Ministerio creado.");
    } else {
      delete payload.church;
      await pb.collection("ministries").update(id, payload);
      setText("ministries-success","Ministerio actualizado.");
    }

    closeMinistryModal();
    await loadMinistries();
    renderMinistriesTable();
  } catch (err) {
    setText("ministry-form-error", humanizePbError(err) || "Error guardando ministerio.");
  }
}

async function deleteMinistry(id) {
  setText("ministries-error","");
  setText("ministries-success","");

  try {
    // delete memberships & activities (no cascade)
    const mem = await pb.collection("ministry_memberships").getFullList({
      filter: `church.id = "${currentChurchId}" && ministry.id = "${id}"`,
      sort: "created",
    });
    for (const r of mem) { try { await pb.collection("ministry_memberships").delete(r.id); } catch {} }

    const acts = await pb.collection("ministry_activities").getFullList({
      filter: `church.id = "${currentChurchId}" && ministry.id = "${id}"`,
      sort: "created",
    });
    for (const r of acts) { try { await pb.collection("ministry_activities").delete(r.id); } catch {} }

    await pb.collection("ministries").delete(id);
    setText("ministries-success","Ministerio eliminado.");

    await loadMinistries();
    renderMinistriesTable();
  } catch (err) {
    setText("ministries-error", humanizePbError(err) || "Error eliminando ministerio.");
  }
}

/* ---------------- Memberships modal ---------------- */

async function openMembersModal(ministryRecord) {
  document.querySelector('section[data-view="ministries"]').dataset.ministryMembersMinistryId = ministryRecord.id;

  setText("ministry-members-title", `Servidores — ${ministryRecord.name}`);
  setText("ministry-members-error","");
  setText("ministry-members-success","");

  document.getElementById("ministry-members-modal").style.display = "block";

  if (!cachedMembers.length) await loadMembers();
  await loadMemberships(ministryRecord.id);
  renderMembersTable(ministryRecord.id);
}

function closeMembersModal() {
  const section = document.querySelector('section[data-view="ministries"]');
  section.dataset.ministryMembersMinistryId = "";
  document.getElementById("ministry-members-modal").style.display = "none";
}

function renderMembersTable(ministryId) {
  const tbody = document.getElementById("ministry-members-tbody");
  if (!tbody) return;

  const canWrite = can("create","ministry_memberships") || can("update","ministry_memberships") || can("delete","ministry_memberships");

  const q = (document.getElementById("ministry-members-search")?.value || "").trim().toLowerCase();
  const map = cachedMembershipsByMinistry.get(ministryId) || new Map();

  const members = !q ? cachedMembers : cachedMembers.filter((m)=>{
    const n = `${m.first_name||""} ${m.last_name||""}`.trim().toLowerCase();
    const e = String(m.email||"").toLowerCase();
    return n.includes(q) || e.includes(q);
  });

  tbody.innerHTML = "";
  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay personas.</td></tr>`;
    return;
  }

  for (const m of members) {
    const name = `${m.first_name||""} ${m.last_name||""}`.trim();
    const email = m.email || "";
    const membership = map.get(String(m.id));

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Persona">${escapeHtml(name)}</td>
      <td data-label="Email">${escapeHtml(email)}</td>
      <td data-label="Rol">${escapeHtml(membership?.role || "")}</td>
      <td data-label="Estado">${escapeHtml(membership?.status || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (!membership) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn-secondary";
      add.textContent = "Agregar";
      add.disabled = !canWrite;
      add.addEventListener("click", async ()=> {
        await addMembership(ministryId, m.id, "servant");
        await loadMemberships(ministryId);
        renderMembersTable(ministryId);
      });
      actions.appendChild(add);
    } else {
      const sel = document.createElement("select");
      sel.disabled = !canWrite;
      sel.innerHTML = `
        <option value="leader">leader</option>
        <option value="co_leader">co_leader</option>
        <option value="servant">servant</option>
      `;
      sel.value = membership.role || "servant";
      sel.addEventListener("change", async ()=>{
        await pb.collection("ministry_memberships").update(membership.id, { role: sel.value });
        await loadMemberships(ministryId);
        renderMembersTable(ministryId);
      });
      actions.appendChild(sel);

      const rem = document.createElement("button");
      rem.type = "button";
      rem.className = "danger-btn";
      rem.textContent = "Quitar";
      rem.disabled = !canWrite;
      rem.addEventListener("click", async ()=>{
        const ok = confirm(`¿Quitar a "${name}"?`);
        if (!ok) return;
        await pb.collection("ministry_memberships").delete(membership.id);
        await loadMemberships(ministryId);
        renderMembersTable(ministryId);
      });
      actions.appendChild(rem);
    }

    tbody.appendChild(tr);
  }
}

async function addMembership(ministryId, memberId, role) {
  setText("ministry-members-error","");
  try {
    await pb.collection("ministry_memberships").create({
      church: currentChurchId,
      ministry: ministryId,
      member: memberId,
      role: role || "servant",
      status: "active",
    });
    setText("ministry-members-success","Agregado.");
  } catch (err) {
    setText("ministry-members-error", humanizePbError(err) || "Error agregando.");
  }
}

/* ---------------- Activities modal ---------------- */

async function openActivitiesModal(ministryRecord) {
  document.querySelector('section[data-view="ministries"]').dataset.ministryActivitiesMinistryId = ministryRecord.id;

  setText("ministry-activities-title", `Actividades — ${ministryRecord.name}`);
  setText("ministry-activities-error","");
  setText("ministry-activities-success","");

  document.getElementById("ministry-activities-modal").style.display = "block";

  await loadActivities(ministryRecord.id);
  renderActivitiesTable(ministryRecord.id);
}

function closeActivitiesModal() {
  const section = document.querySelector('section[data-view="ministries"]');
  section.dataset.ministryActivitiesMinistryId = "";
  document.getElementById("ministry-activities-modal").style.display = "none";
}

function renderActivitiesTable(ministryId) {
  const tbody = document.getElementById("ministry-activities-tbody");
  if (!tbody) return;

  const canUpd = can("update","ministry_activities");
  const canDel = can("delete","ministry_activities");

  const q = (document.getElementById("ministry-activities-search")?.value || "").trim().toLowerCase();
  const list = cachedActivitiesByMinistry.get(ministryId) || [];
  const filtered = !q ? list : list.filter(a=>{
    const t = String(a.title||"").toLowerCase();
    const d = String(a.weekday||"").toLowerCase();
    return t.includes(q) || d.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6">No hay actividades.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  for (const a of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Título">${escapeHtml(a.title||"")}</td>
      <td data-label="Día">${escapeHtml(a.weekday||"")}</td>
      <td data-label="Hora">${escapeHtml(a.time||"")}</td>
      <td data-label="Lugar">${escapeHtml(a.location_text||"")}</td>
      <td data-label="Estado">${escapeHtml(a.status||"")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (canUpd) {
      const eb = document.createElement("button");
      eb.type = "button";
      eb.textContent = "Editar";
      eb.addEventListener("click", ()=> openActivityModal({ mode:"edit", record:a }));
      actions.appendChild(eb);
    }

    if (canDel) {
      const db = document.createElement("button");
      db.type = "button";
      db.className = "danger-btn";
      db.textContent = "Eliminar";
      db.addEventListener("click", async ()=>{
        const ok = confirm(`¿Eliminar "${a.title}"?`);
        if (!ok) return;
        await pb.collection("ministry_activities").delete(a.id);
        await loadActivities(ministryId);
        renderActivitiesTable(ministryId);
      });
      actions.appendChild(db);
    }

    tbody.appendChild(tr);
  }
}

/* Activity edit modal */
function openActivityModal({ mode, record }) {
  const section = document.querySelector('section[data-view="ministries"]');
  const ministryId = section.dataset.ministryActivitiesMinistryId || "";

  if (mode === "create" && !can("create","ministry_activities")) return;
  if (mode === "edit" && !can("update","ministry_activities")) return;
  if (!ministryId) return;

  setText("activity-form-error","");

  document.getElementById("activity-id").value = record?.id || "";
  document.getElementById("activity-title").value = record?.title || "";
  document.getElementById("activity-weekday").value = record?.weekday || "sun";
  document.getElementById("activity-time").value = record?.time || "";
  document.getElementById("activity-duration").value = record?.duration_minutes ?? "";
  document.getElementById("activity-location").value = record?.location_text || "";
  document.getElementById("activity-status").value = record?.status || "active";
  document.getElementById("activity-notes").value = record?.notes || "";

  document.getElementById("activity-modal-title").textContent = mode === "create" ? "Nueva actividad" : "Editar actividad";
  document.getElementById("activity-modal").style.display = "block";
}

function closeActivityModal() {
  document.getElementById("activity-modal").style.display = "none";
}

async function saveActivity() {
  const section = document.querySelector('section[data-view="ministries"]');
  const ministryId = section.dataset.ministryActivitiesMinistryId || "";

  setText("activity-form-error","");

  const id = document.getElementById("activity-id").value.trim();
  const title = document.getElementById("activity-title").value.trim();
  const weekday = document.getElementById("activity-weekday").value;
  const time = document.getElementById("activity-time").value.trim();
  const duration_minutes = document.getElementById("activity-duration").value;
  const location_text = document.getElementById("activity-location").value.trim();
  const status = document.getElementById("activity-status").value;
  const notes = document.getElementById("activity-notes").value.trim();

  if (!title) return setText("activity-form-error","Título es obligatorio.");
  if (!time) return setText("activity-form-error","Hora es obligatoria.");
  if (!ministryId) return setText("activity-form-error","Ministerio no seleccionado.");

  const payload = {
    church: currentChurchId,
    ministry: ministryId,
    title,
    weekday,
    time,
    duration_minutes: duration_minutes === "" ? null : Number(duration_minutes),
    location_text,
    status,
    notes,
  };

  try {
    if (!id) {
      await pb.collection("ministry_activities").create(payload);
      setText("ministry-activities-success","Actividad creada.");
    } else {
      delete payload.church;
      delete payload.ministry;
      await pb.collection("ministry_activities").update(id, payload);
      setText("ministry-activities-success","Actividad actualizada.");
    }

    closeActivityModal();
    await loadActivities(ministryId);
    renderActivitiesTable(ministryId);
  } catch (err) {
    setText("activity-form-error", humanizePbError(err) || "Error guardando actividad.");
  }
}

/* ---------------- Helpers ---------------- */

function memberNameById(id) {
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
