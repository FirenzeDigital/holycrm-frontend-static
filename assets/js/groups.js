// assets/js/groups.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedGroups = [];
let cachedMembers = [];
let cachedMembershipsByGroup = new Map(); // groupId -> Map(memberId -> membershipRecord)

export function initGroupsView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="groups"]');
  if (!section) return;

  if (!can("read", "groups")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "groups");
  const canUpdate = can("update", "groups");
  const canDelete = can("delete", "groups");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Grupos</h1>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search">
            <input id="groups-search" type="text" placeholder="Buscar (nombre, tipo, estado)..." />
          </div>

          <div class="members-actions">
            <button id="groups-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="groups-new" type="button">Nuevo grupo</button>` : ""}
          </div>
        </div>

        <div id="groups-error" class="error"></div>
        <div id="groups-success" class="success"></div>
      </div>

      <div class="card">
        <h2 id="groups-title"></h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Encuentro</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="groups-tbody">
              <tr><td colspan="5">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Group modal -->
      <div id="group-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="group-modal-title">Grupo</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="group-form" class="modal-body">
            <input type="hidden" id="group-id" />

            <div class="field">
              <span>Nombre</span>
              <input type="text" id="group-name" required />
            </div>

            <div class="field">
              <span>Tipo</span>
              <select id="group-type">
                <option value="small_group">small_group</option>
                <option value="ministry">ministry</option>
                <option value="team">team</option>
                <option value="class">class</option>
              </select>
            </div>

            <div class="field">
              <span>Estado</span>
              <select id="group-status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div class="field">
              <span>Descripción</span>
              <input type="text" id="group-description" />
            </div>

            <div class="field">
              <span>Día de encuentro</span>
              <select id="group-meeting-day">
                <option value="">(sin definir)</option>
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
              <span>Horario</span>
              <input type="text" id="group-meeting-time" placeholder="Ej: 19:30" />
            </div>

            <div class="field">
              <span>Lugar</span>
              <input type="text" id="group-location" />
            </div>

            <div class="field">
              <span>Tags (JSON)</span>
              <input type="text" id="group-tags" placeholder='["jovenes","oracion"]' />
            </div>

            <div id="group-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Membership modal -->
      <div id="group-members-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="group-members-modal-title">Miembros del grupo</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <div class="modal-body">
            <div class="members-toolbar" style="margin-bottom:10px">
              <div class="members-search">
                <input id="group-members-search" type="text" placeholder="Buscar persona..." />
              </div>
              <div class="members-actions">
                <button id="group-members-reload" type="button" class="btn-secondary">Recargar</button>
              </div>
            </div>

            <div id="group-members-error" class="error"></div>
            <div id="group-members-success" class="success"></div>

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
                <tbody id="group-members-tbody">
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
    `;

    section.dataset.groupsCanCreate = canCreate ? "1" : "0";
    section.dataset.groupsCanUpdate = canUpdate ? "1" : "0";
    section.dataset.groupsCanDelete = canDelete ? "1" : "0";

    section.querySelector("#groups-reload").addEventListener("click", async () => {
      await loadGroupsForChurch(currentChurchId);
      renderGroupsTable();
    });

    section.querySelector("#groups-search").addEventListener("input", () => renderGroupsTable());

    if (canCreate) {
      section.querySelector("#groups-new").addEventListener("click", () => openGroupModal({ mode: "create" }));
    }

    // close modals
    section.querySelector("#group-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeGroupModal();
    });

    section.querySelector("#group-members-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeGroupMembersModal();
    });

    // submit group form
    section.querySelector("#group-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveGroup();
    });

    // membership modal search/reload
    section.querySelector("#group-members-search").addEventListener("input", () => {
      const gid = section.dataset.groupMembersGroupId || "";
      if (gid) renderGroupMembersTable(gid);
    });

    section.querySelector("#group-members-reload").addEventListener("click", async () => {
      const gid = section.dataset.groupMembersGroupId || "";
      if (!gid) return;
      await loadGroupMemberships(gid);
      renderGroupMembersTable(gid);
    });
  }

  // title
  const title = document.getElementById("groups-title");
  if (title) title.textContent = `Grupos en ${church.name}`;

  // load
  Promise.all([
    loadGroupsForChurch(church.id),
    loadMembersForChurch(church.id),
  ]).then(() => renderGroupsTable());
}

/* ---------------- Data loaders ---------------- */

async function loadGroupsForChurch(churchId) {
  setText("groups-error", "");
  setText("groups-success", "");
  setTableLoading("groups-tbody", 5);

  try {
    cachedGroups = await pb.collection("groups").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "name",
    });
  } catch (err) {
    console.error("Error cargando groups:", err);
    cachedGroups = [];
    setText("groups-error", humanizePbError(err) || "Error cargando grupos.");
  }
}

async function loadMembersForChurch(churchId) {
  try {
    cachedMembers = await pb.collection("members").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "last_name,first_name",
    });
  } catch (err) {
    console.error("Error cargando members (groups):", err);
    cachedMembers = [];
  }
}

async function loadGroupMemberships(groupId) {
  setText("group-members-error", "");
  setText("group-members-success", "");
  setTableLoading("group-members-tbody", 5);

  try {
    const records = await pb.collection("group_memberships").getFullList({
      filter: `church.id = "${currentChurchId}" && group.id = "${groupId}"`,
      sort: "created",
    });

    const map = new Map();
    for (const r of records) {
      const memberId = r.member;
      if (memberId) map.set(String(memberId), r);
    }
    cachedMembershipsByGroup.set(groupId, map);
  } catch (err) {
    console.error("Error cargando memberships:", err);
    cachedMembershipsByGroup.set(groupId, new Map());
    setText("group-members-error", humanizePbError(err) || "Error cargando miembros del grupo.");
  }
}

/* ---------------- Render: Groups ---------------- */

function renderGroupsTable() {
  const tbody = document.getElementById("groups-tbody");
  const section = document.querySelector('section[data-view="groups"]');
  if (!tbody || !section) return;

  const canUpdate = section.dataset.groupsCanUpdate === "1";
  const canDelete = section.dataset.groupsCanDelete === "1";
  const canManageMemberships =
    can("read", "group_memberships") || can("create", "group_memberships") || can("update", "group_memberships");

  const q = (document.getElementById("groups-search")?.value || "").trim().toLowerCase();

  const filtered = !q
    ? cachedGroups
    : cachedGroups.filter((g) => {
        const name = String(g.name || "").toLowerCase();
        const type = String(g.type || "").toLowerCase();
        const status = String(g.status || "").toLowerCase();
        return name.includes(q) || type.includes(q) || status.includes(q);
      });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay grupos.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const g of filtered) {
    const tr = document.createElement("tr");
    const meeting = formatMeeting(g);

    tr.innerHTML = `
      <td data-label="Nombre">${escapeHtml(g.name || "")}</td>
      <td data-label="Tipo">${escapeHtml(g.type || "")}</td>
      <td data-label="Estado">${escapeHtml(g.status || "")}</td>
      <td data-label="Encuentro">${escapeHtml(meeting)}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actionsTd = tr.querySelector(".row-actions");

    if (canManageMemberships) {
      const mb = document.createElement("button");
      mb.type = "button";
      mb.textContent = "Miembros";
      mb.className = "btn-secondary";
      mb.addEventListener("click", async () => openGroupMembersModal(g));
      actionsTd.appendChild(mb);
    }

    if (canUpdate) {
      const eb = document.createElement("button");
      eb.type = "button";
      eb.textContent = "Editar";
      eb.addEventListener("click", () => openGroupModal({ mode: "edit", record: g }));
      actionsTd.appendChild(eb);
    }

    if (canDelete) {
      const db = document.createElement("button");
      db.type = "button";
      db.textContent = "Eliminar";
      db.className = "danger-btn";
      db.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar grupo "${g.name || ""}"?`);
        if (!ok) return;
        await deleteGroup(g.id);
      });
      actionsTd.appendChild(db);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Groups CRUD ---------------- */

function openGroupModal({ mode, record }) {
  const section = document.querySelector('section[data-view="groups"]');
  if (!section) return;

  const canCreate = section.dataset.groupsCanCreate === "1";
  const canUpdate = section.dataset.groupsCanUpdate === "1";
  if (mode === "create" && !canCreate) return;
  if (mode === "edit" && !canUpdate) return;

  setText("group-form-error", "");

  document.getElementById("group-id").value = record?.id || "";
  document.getElementById("group-name").value = record?.name || "";
  document.getElementById("group-type").value = record?.type || "small_group";
  document.getElementById("group-status").value = record?.status || "active";
  document.getElementById("group-description").value = record?.description || "";
  document.getElementById("group-meeting-day").value = record?.meeting_day || "";
  document.getElementById("group-meeting-time").value = record?.meeting_time || "";
  document.getElementById("group-location").value = record?.location || "";
  document.getElementById("group-tags").value = record?.tags ? JSON.stringify(record.tags) : "";

  document.getElementById("group-modal-title").textContent =
    mode === "create" ? "Nuevo grupo" : "Editar grupo";

  document.getElementById("group-modal").style.display = "block";
}

function closeGroupModal() {
  const modal = document.getElementById("group-modal");
  if (modal) modal.style.display = "none";
}

async function saveGroup() {
  setText("group-form-error", "");
  setText("groups-error", "");
  setText("groups-success", "");

  const id = document.getElementById("group-id").value.trim();
  const name = document.getElementById("group-name").value.trim();
  const type = document.getElementById("group-type").value;
  const status = document.getElementById("group-status").value;
  const description = document.getElementById("group-description").value.trim();
  const meeting_day = document.getElementById("group-meeting-day").value || null;
  const meeting_time = document.getElementById("group-meeting-time").value.trim();
  const location = document.getElementById("group-location").value.trim();
  const tagsRaw = document.getElementById("group-tags").value.trim();

  if (!name) return setText("group-form-error", "Nombre es obligatorio.");

  let tags = null;
  if (tagsRaw) {
    try { tags = JSON.parse(tagsRaw); }
    catch { return setText("group-form-error", 'Tags debe ser JSON válido (ej: ["a","b"]).'); }
  }

  try {
    const payload = {
      church: currentChurchId,
      name,
      type,
      status,
      description,
      meeting_day,
      meeting_time,
      location,
      tags,
    };

    if (!id) {
      await pb.collection("groups").create(payload);
      setText("groups-success", "Grupo creado.");
    } else {
      // don't overwrite church on update unless you want to
      delete payload.church;
      await pb.collection("groups").update(id, payload);
      setText("groups-success", "Grupo actualizado.");
    }

    closeGroupModal();
    await loadGroupsForChurch(currentChurchId);
    renderGroupsTable();
  } catch (err) {
    console.error("Error guardando group:", err);
    setText("group-form-error", humanizePbError(err) || "Error guardando grupo.");
  }
}

async function deleteGroup(id) {
  setText("groups-error", "");
  setText("groups-success", "");

  try {
    // delete memberships for group (no cascade in PB)
    const memberships = await pb.collection("group_memberships").getFullList({
      filter: `church.id = "${currentChurchId}" && group.id = "${id}"`,
      sort: "created",
    });
    for (const m of memberships) {
      try { await pb.collection("group_memberships").delete(m.id); } catch {}
    }

    await pb.collection("groups").delete(id);
    setText("groups-success", "Grupo eliminado.");

    await loadGroupsForChurch(currentChurchId);
    renderGroupsTable();
  } catch (err) {
    console.error("Error eliminando group:", err);
    setText("groups-error", humanizePbError(err) || "Error eliminando grupo.");
  }
}

/* ---------------- Membership modal ---------------- */

async function openGroupMembersModal(groupRecord) {
  const section = document.querySelector('section[data-view="groups"]');
  if (!section) return;

  section.dataset.groupMembersGroupId = groupRecord.id;

  setText("group-members-modal-title", `Miembros — ${groupRecord.name || ""}`);
  document.getElementById("group-members-modal").style.display = "block";

  if (!cachedMembers.length) await loadMembersForChurch(currentChurchId);

  await loadGroupMemberships(groupRecord.id);
  renderGroupMembersTable(groupRecord.id);
}

function closeGroupMembersModal() {
  const section = document.querySelector('section[data-view="groups"]');
  if (section) section.dataset.groupMembersGroupId = "";
  const modal = document.getElementById("group-members-modal");
  if (modal) modal.style.display = "none";
}

function renderGroupMembersTable(groupId) {
  const tbody = document.getElementById("group-members-tbody");
  if (!tbody) return;

  const canWrite =
    can("create", "group_memberships") || can("update", "group_memberships") || can("delete", "group_memberships");

  const q = (document.getElementById("group-members-search")?.value || "").trim().toLowerCase();
  const map = cachedMembershipsByGroup.get(groupId) || new Map();

  const members = !q
    ? cachedMembers
    : cachedMembers.filter((m) => {
        const name = `${m.first_name || ""} ${m.last_name || ""}`.trim().toLowerCase();
        const email = String(m.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay personas para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const m of members) {
    const tr = document.createElement("tr");

    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
    const email = m.email || "";

    const membership = map.get(String(m.id));
    const role = membership?.role || "";
    const status = membership?.status || "";

    tr.innerHTML = `
      <td data-label="Persona">${escapeHtml(name)}</td>
      <td data-label="Email">${escapeHtml(email)}</td>
      <td data-label="Rol">${escapeHtml(role)}</td>
      <td data-label="Estado">${escapeHtml(status)}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actionsTd = tr.querySelector(".row-actions");

    if (!membership) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "Agregar";
      addBtn.className = "btn-secondary";
      addBtn.disabled = !canWrite;
      addBtn.addEventListener("click", async () => {
        await addMemberToGroup(groupId, m.id, "member");
        renderGroupMembersTable(groupId);
      });
      actionsTd.appendChild(addBtn);
    } else {
      // role selector
      const roleSel = document.createElement("select");
      roleSel.disabled = !canWrite;
      roleSel.innerHTML = `
        <option value="leader">leader</option>
        <option value="co_leader">co_leader</option>
        <option value="member">member</option>
      `;
      roleSel.value = membership.role || "member";
      roleSel.addEventListener("change", async () => {
        await updateMembership(membership.id, { role: roleSel.value });
        await loadGroupMemberships(groupId);
        renderGroupMembersTable(groupId);
      });
      actionsTd.appendChild(roleSel);

      const remBtn = document.createElement("button");
      remBtn.type = "button";
      remBtn.textContent = "Quitar";
      remBtn.className = "danger-btn";
      remBtn.disabled = !canWrite;
      remBtn.addEventListener("click", async () => {
        const ok = confirm(`¿Quitar a "${name}" del grupo?`);
        if (!ok) return;
        await removeMemberFromGroup(groupId, m.id);
        renderGroupMembersTable(groupId);
      });
      actionsTd.appendChild(remBtn);
    }

    tbody.appendChild(tr);
  }
}

async function addMemberToGroup(groupId, memberId, role) {
  setText("group-members-error", "");
  setText("group-members-success", "");

  try {
    const created = await pb.collection("group_memberships").create({
      church: currentChurchId,
      group: groupId,
      member: memberId,
      role: role || "member",
      status: "active",
    });

    const map = cachedMembershipsByGroup.get(groupId) || new Map();
    map.set(String(memberId), created);
    cachedMembershipsByGroup.set(groupId, map);

    setText("group-members-success", "Agregado al grupo.");
  } catch (err) {
    console.error("Error add membership:", err);
    setText("group-members-error", humanizePbError(err) || "Error agregando al grupo.");
  }
}

async function updateMembership(membershipId, patch) {
  setText("group-members-error", "");
  try {
    await pb.collection("group_memberships").update(membershipId, patch);
    setText("group-members-success", "Actualizado.");
  } catch (err) {
    console.error("Error update membership:", err);
    setText("group-members-error", humanizePbError(err) || "Error actualizando.");
  }
}

async function removeMemberFromGroup(groupId, memberId) {
  setText("group-members-error", "");
  setText("group-members-success", "");

  const map = cachedMembershipsByGroup.get(groupId) || new Map();
  const membership = map.get(String(memberId));
  if (!membership) return;

  try {
    await pb.collection("group_memberships").delete(membership.id);
    map.delete(String(memberId));
    cachedMembershipsByGroup.set(groupId, map);
    setText("group-members-success", "Quitado del grupo.");
  } catch (err) {
    console.error("Error remove membership:", err);
    setText("group-members-error", humanizePbError(err) || "Error quitando del grupo.");
  }
}

/* ---------------- Helpers ---------------- */

function formatMeeting(g) {
  const day = g.meeting_day || "";
  const time = (g.meeting_time || "").trim();
  if (!day && !time) return "";
  if (day && time) return `${day} ${time}`;
  return day || time;
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
