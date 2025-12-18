// assets/js/members.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let cachedMembers = [];
let currentChurchId = null;

export function initMembersView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="members"]');
  if (!section) return;

  if (!can("read", "members")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "members");
  const canUpdate = can("update", "members");
  const canDelete = can("delete", "members");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Personas</h1>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search">
            <input id="members-search" type="text" placeholder="Buscar (nombre, email, teléfono)..." />
          </div>

          <div class="members-actions">
            <button id="members-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="members-new" type="button">Nueva persona</button>` : ""}
          </div>
        </div>

        <div id="members-error" class="error"></div>
        <div id="members-success" class="success"></div>
      </div>

      <div class="card">
        <h2 id="members-title"></h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="members-tbody">
              <tr><td colspan="5">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal -->
      <div id="member-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="member-modal-title">Persona</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="member-form" class="modal-body">
            <input type="hidden" id="member-id" />

            <div class="field">
              <span>Nombre</span>
              <input type="text" id="member-first-name" required />
            </div>

            <div class="field">
              <span>Apellido</span>
              <input type="text" id="member-last-name" required />
            </div>

            <div class="field">
              <span>Email</span>
              <input type="email" id="member-email" />
            </div>

            <div class="field">
              <span>Teléfono</span>
              <input type="text" id="member-phone" />
            </div>

            <div class="field">
              <span>Estado</span>
              <select id="member-status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="member-notes" />
            </div>

            <div class="field">
              <span>Tags (JSON)</span>
              <input type="text" id="member-tags" placeholder='["tag1","tag2"]' />
            </div>

            <div id="member-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" data-close="1">Cancelar</button>
              <button id="member-save" type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    section.dataset.membersCanCreate = canCreate ? "1" : "0";
    section.dataset.membersCanUpdate = canUpdate ? "1" : "0";
    section.dataset.membersCanDelete = canDelete ? "1" : "0";

    section.querySelector("#members-reload").addEventListener("click", async () => {
      await loadMembersForChurch(currentChurchId);
      renderMembersTable();
    });

    const searchInput = section.querySelector("#members-search");
    searchInput.addEventListener("input", () => renderMembersTable());

    if (canCreate) {
      section.querySelector("#members-new").addEventListener("click", () => {
        openMemberModal({ mode: "create" });
      });
    }

    const modal = section.querySelector("#member-modal");
    modal.addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeMemberModal();
    });

    section.querySelector("#member-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveMember();
    });
  }

  const title = document.getElementById("members-title");
  if (title) title.textContent = `Personas en ${church.name}`;

  loadMembersForChurch(church.id).then(() => renderMembersTable());
}

async function loadMembersForChurch(churchId) {
  const tbody = document.getElementById("members-tbody");
  const errBox = document.getElementById("members-error");
  const okBox = document.getElementById("members-success");

  if (errBox) errBox.textContent = "";
  if (okBox) okBox.textContent = "";
  if (tbody) tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

  try {
    cachedMembers = await pb.collection("members").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "last_name,first_name",
    });
  } catch (err) {
    console.error("Error cargando members:", err);
    cachedMembers = [];
    if (errBox) errBox.textContent = humanizePbError(err) || "Error cargando personas.";
  }
}

function renderMembersTable() {
  const tbody = document.getElementById("members-tbody");
  const section = document.querySelector('section[data-view="members"]');
  if (!tbody || !section) return;

  const canUpdate = section.dataset.membersCanUpdate === "1";
  const canDelete = section.dataset.membersCanDelete === "1";

  const q = (document.getElementById("members-search")?.value || "").trim().toLowerCase();

  const filtered = !q
    ? cachedMembers
    : cachedMembers.filter((m) => {
        const fullName = `${m.first_name || ""} ${m.last_name || ""}`.trim().toLowerCase();
        return (
          fullName.includes(q) ||
          String(m.email || "").toLowerCase().includes(q) ||
          String(m.phone || "").toLowerCase().includes(q) ||
          String(m.status || "").toLowerCase().includes(q)
        );
      });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay resultados.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const m of filtered) {
    const tr = document.createElement("tr");
    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();

    tr.innerHTML = `
      <td data-label="Nombre">${escapeHtml(name)}</td>
      <td data-label="Email">${escapeHtml(m.email || "")}</td>
      <td data-label="Teléfono">${escapeHtml(m.phone || "")}</td>
      <td data-label="Estado">${escapeHtml(m.status || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actionsTd = tr.querySelector(".row-actions");

    if (canUpdate) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openMemberModal({ mode: "edit", record: m }));
      actionsTd.appendChild(editBtn);
    }

    if (canDelete) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Eliminar";
      delBtn.className = "danger-btn";
      delBtn.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar "${name}"?`);
        if (!ok) return;
        await deleteMember(m.id);
      });
      actionsTd.appendChild(delBtn);
    }

    tbody.appendChild(tr);
  }
}

function openMemberModal({ mode, record }) {
  const section = document.querySelector('section[data-view="members"]');
  if (!section) return;

  const canCreate = section.dataset.membersCanCreate === "1";
  const canUpdate = section.dataset.membersCanUpdate === "1";
  if (mode === "create" && !canCreate) return;
  if (mode === "edit" && !canUpdate) return;

  document.getElementById("member-form-error").textContent = "";

  document.getElementById("member-id").value = record?.id || "";
  document.getElementById("member-first-name").value = record?.first_name || "";
  document.getElementById("member-last-name").value = record?.last_name || "";
  document.getElementById("member-email").value = record?.email || "";
  document.getElementById("member-phone").value = record?.phone || "";
  document.getElementById("member-status").value = record?.status || "active";
  document.getElementById("member-notes").value = record?.notes || "";
  document.getElementById("member-tags").value = record?.tags ? JSON.stringify(record.tags) : "";

  document.getElementById("member-modal-title").textContent =
    mode === "create" ? "Nueva persona" : "Editar persona";

  document.getElementById("member-modal").style.display = "block";
}

function closeMemberModal() {
  document.getElementById("member-modal").style.display = "none";
}

async function saveMember() {
  const errBox = document.getElementById("member-form-error");
  const okBox = document.getElementById("members-success");
  const listErrBox = document.getElementById("members-error");

  errBox.textContent = "";
  if (okBox) okBox.textContent = "";
  if (listErrBox) listErrBox.textContent = "";

  const id = document.getElementById("member-id").value.trim();
  const first_name = document.getElementById("member-first-name").value.trim();
  const last_name = document.getElementById("member-last-name").value.trim();
  const email = document.getElementById("member-email").value.trim();
  const phone = document.getElementById("member-phone").value.trim();
  const status = document.getElementById("member-status").value;
  const notes = document.getElementById("member-notes").value.trim();
  const tagsRaw = document.getElementById("member-tags").value.trim();

  if (!first_name || !last_name) {
    errBox.textContent = "Nombre y apellido son obligatorios.";
    return;
  }

  let tags = null;
  if (tagsRaw) {
    try {
      tags = JSON.parse(tagsRaw);
    } catch {
      errBox.textContent = 'Tags debe ser JSON válido (ej: ["a","b"]).';
      return;
    }
  }

  try {
    if (!id) {
      await pb.collection("members").create({
        church: currentChurchId,
        first_name,
        last_name,
        email: email || null,
        phone,
        status,
        notes,
        tags,
      });
      if (okBox) okBox.textContent = "Persona creada.";
    } else {
      await pb.collection("members").update(id, {
        first_name,
        last_name,
        email: email || null,
        phone,
        status,
        notes,
        tags,
      });
      if (okBox) okBox.textContent = "Persona actualizada.";
    }

    closeMemberModal();
    await loadMembersForChurch(currentChurchId);
    renderMembersTable();
  } catch (err) {
    console.error("Error guardando member:", err);
    errBox.textContent = humanizePbError(err) || "Error guardando persona.";
  }
}

async function deleteMember(id) {
  const errBox = document.getElementById("members-error");
  const okBox = document.getElementById("members-success");
  if (errBox) errBox.textContent = "";
  if (okBox) okBox.textContent = "";

  try {
    await pb.collection("members").delete(id);
    if (okBox) okBox.textContent = "Persona eliminada.";
    await loadMembersForChurch(currentChurchId);
    renderMembersTable();
  } catch (err) {
    console.error("Error eliminando member:", err);
    if (errBox) errBox.textContent = humanizePbError(err) || "Error eliminando persona.";
  }
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
