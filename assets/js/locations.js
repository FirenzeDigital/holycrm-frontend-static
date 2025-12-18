// assets/js/locations.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedLocations = [];
let cachedMembers = [];

export function initLocationsView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="locations"]');
  if (!section) return;

  if (!can("read", "locations")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "locations");
  const canUpdate = can("update", "locations");
  const canDelete = can("delete", "locations");

  const canAssignMember = can("update", "members"); // assignment is a members update

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Misiones / Ubicaciones</h1>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search">
            <input id="locations-search" type="text" placeholder="Buscar (nombre, ciudad, estado)..." />
          </div>
          <div class="members-actions">
            <button id="locations-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="locations-new" type="button">Nueva misión</button>` : ""}
          </div>
        </div>

        <div id="locations-error" class="error"></div>
        <div id="locations-success" class="success"></div>
      </div>

      <div class="card">
        <h2 id="locations-title"></h2>

        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Pastor/Encargado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="locations-tbody">
              <tr><td colspan="5">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Location modal -->
      <div id="location-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="location-modal-title">Misión</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="location-form" class="modal-body">
            <input type="hidden" id="location-id" />

            <div class="field">
              <span>Nombre</span>
              <input type="text" id="location-name" required />
            </div>

            <div class="field">
              <span>Ciudad</span>
              <input type="text" id="location-city" />
            </div>

            <div class="field">
              <span>Pastor/Encargado</span>
              <input type="text" id="location-pastor" />
            </div>

            <div class="field">
              <span>Inauguración</span>
              <input type="date" id="location-inauguration" />
            </div>

            <div class="field">
              <span>Estado</span>
              <select id="location-status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="location-notes" />
            </div>

            <div id="location-form-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Members assignment modal -->
      <div id="location-members-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="location-members-title">Miembros</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <div class="modal-body">
            <div class="members-toolbar" style="margin-bottom:10px">
              <div class="members-search">
                <input id="location-members-search" type="text" placeholder="Buscar persona..." />
              </div>
              <div class="members-actions">
                <button id="location-members-reload" type="button" class="btn-secondary">Recargar</button>
              </div>
            </div>

            <div class="muted" style="margin-bottom:10px">
              ${canAssignMember ? "Asigná o desasigná miembros a esta misión." : "Solo lectura (sin permiso para asignar)."}
            </div>

            <div id="location-members-error" class="error"></div>
            <div id="location-members-success" class="success"></div>

            <div class="table-wrap">
              <table class="users-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Email</th>
                    <th>Misión actual</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="location-members-tbody">
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

    section.dataset.locationsCanCreate = canCreate ? "1" : "0";
    section.dataset.locationsCanUpdate = canUpdate ? "1" : "0";
    section.dataset.locationsCanDelete = canDelete ? "1" : "0";
    section.dataset.locationsCanAssignMember = canAssignMember ? "1" : "0";

    section.querySelector("#locations-reload").addEventListener("click", async () => {
      await loadLocations();
      renderLocationsTable();
    });

    section.querySelector("#locations-search").addEventListener("input", () => renderLocationsTable());

    if (canCreate) {
      section.querySelector("#locations-new").addEventListener("click", () => openLocationModal({ mode: "create" }));
    }

    section.querySelector("#location-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeLocationModal();
    });

    section.querySelector("#location-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveLocation();
    });

    section.querySelector("#location-members-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeLocationMembersModal();
    });

    section.querySelector("#location-members-search").addEventListener("input", () => {
      const locId = section.dataset.locationMembersLocationId || "";
      if (locId) renderLocationMembersTable(locId);
    });

    section.querySelector("#location-members-reload").addEventListener("click", async () => {
      const locId = section.dataset.locationMembersLocationId || "";
      if (!locId) return;
      await loadMembers();
      renderLocationMembersTable(locId);
    });
  }

  const title = document.getElementById("locations-title");
  if (title) title.textContent = `Misiones / ubicaciones en ${church.name}`;

  Promise.all([loadLocations(), loadMembers()]).then(() => renderLocationsTable());
}

/* ---------------- Loaders ---------------- */

async function loadLocations() {
  setText("locations-error", "");
  setText("locations-success", "");
  setTableLoading("locations-tbody", 5);

  try {
    cachedLocations = await pb.collection("locations").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "name",
    });
  } catch (err) {
    console.error("Error cargando locations:", err);
    cachedLocations = [];
    setText("locations-error", humanizePbError(err) || "Error cargando misiones.");
  }
}

async function loadMembers() {
  try {
    cachedMembers = await pb.collection("members").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "last_name,first_name",
    });
  } catch (err) {
    console.error("Error cargando members:", err);
    cachedMembers = [];
  }
}

/* ---------------- Render locations ---------------- */

function renderLocationsTable() {
  const tbody = document.getElementById("locations-tbody");
  const section = document.querySelector('section[data-view="locations"]');
  if (!tbody || !section) return;

  const canUpdate = section.dataset.locationsCanUpdate === "1";
  const canDelete = section.dataset.locationsCanDelete === "1";

  const q = (document.getElementById("locations-search")?.value || "").trim().toLowerCase();

  const filtered = !q
    ? cachedLocations
    : cachedLocations.filter((l) => {
        const name = String(l.name || "").toLowerCase();
        const city = String(l.city || "").toLowerCase();
        const status = String(l.status || "").toLowerCase();
        return name.includes(q) || city.includes(q) || status.includes(q);
      });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay misiones.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const loc of filtered) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Nombre">${escapeHtml(loc.name || "")}</td>
      <td data-label="Ciudad">${escapeHtml(loc.city || "")}</td>
      <td data-label="Pastor/Encargado">${escapeHtml(loc.pastor_name || "")}</td>
      <td data-label="Estado">${escapeHtml(loc.status || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    const membersBtn = document.createElement("button");
    membersBtn.type = "button";
    membersBtn.textContent = "Miembros";
    membersBtn.className = "btn-secondary";
    membersBtn.addEventListener("click", async () => openLocationMembersModal(loc));
    actions.appendChild(membersBtn);

    if (canUpdate) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openLocationModal({ mode: "edit", record: loc }));
      actions.appendChild(editBtn);
    }

    if (canDelete) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Eliminar";
      delBtn.className = "danger-btn";
      delBtn.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar misión "${loc.name || ""}"?`);
        if (!ok) return;
        await deleteLocation(loc.id);
      });
      actions.appendChild(delBtn);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Location CRUD ---------------- */

function openLocationModal({ mode, record }) {
  const section = document.querySelector('section[data-view="locations"]');
  if (!section) return;

  const canCreate = section.dataset.locationsCanCreate === "1";
  const canUpdate = section.dataset.locationsCanUpdate === "1";
  if (mode === "create" && !canCreate) return;
  if (mode === "edit" && !canUpdate) return;

  setText("location-form-error", "");

  document.getElementById("location-id").value = record?.id || "";
  document.getElementById("location-name").value = record?.name || "";
  document.getElementById("location-city").value = record?.city || "";
  document.getElementById("location-pastor").value = record?.pastor_name || "";
  document.getElementById("location-inauguration").value = toDateInput(record?.inauguration_date);
  document.getElementById("location-status").value = record?.status || "active";
  document.getElementById("location-notes").value = record?.notes || "";

  document.getElementById("location-modal-title").textContent =
    mode === "create" ? "Nueva misión" : "Editar misión";

  document.getElementById("location-modal").style.display = "block";
}

function closeLocationModal() {
  document.getElementById("location-modal").style.display = "none";
}

async function saveLocation() {
  setText("location-form-error", "");
  setText("locations-error", "");
  setText("locations-success", "");

  const id = document.getElementById("location-id").value.trim();
  const name = document.getElementById("location-name").value.trim();
  const city = document.getElementById("location-city").value.trim();
  const pastor_name = document.getElementById("location-pastor").value.trim();
  const inauguration_date = document.getElementById("location-inauguration").value;
  const status = document.getElementById("location-status").value;
  const notes = document.getElementById("location-notes").value.trim();

  if (!name) return setText("location-form-error", "Nombre es obligatorio.");

  try {
    const payload = {
      church: currentChurchId,
      name,
      city,
      pastor_name,
      inauguration_date: inauguration_date || null,
      status,
      notes,
    };

    if (!id) {
      await pb.collection("locations").create(payload);
      setText("locations-success", "Misión creada.");
    } else {
      delete payload.church;
      await pb.collection("locations").update(id, payload);
      setText("locations-success", "Misión actualizada.");
    }

    closeLocationModal();
    await loadLocations();
    renderLocationsTable();
  } catch (err) {
    console.error("Error guardando location:", err);
    setText("location-form-error", humanizePbError(err) || "Error guardando misión.");
  }
}

async function deleteLocation(id) {
  setText("locations-error", "");
  setText("locations-success", "");

  try {
    // Detach members pointing to this location
    const members = await pb.collection("members").getFullList({
      filter: `church.id = "${currentChurchId}" && location.id = "${id}"`,
      sort: "created",
    });

    for (const m of members) {
      try {
        await pb.collection("members").update(m.id, { location: null });
      } catch {}
    }

    await pb.collection("locations").delete(id);
    setText("locations-success", "Misión eliminada.");

    await loadLocations();
    await loadMembers();
    renderLocationsTable();
  } catch (err) {
    console.error("Error eliminando location:", err);
    setText("locations-error", humanizePbError(err) || "Error eliminando misión.");
  }
}

/* ---------------- Member assignment ---------------- */

async function openLocationMembersModal(locationRecord) {
  const section = document.querySelector('section[data-view="locations"]');
  if (!section) return;

  section.dataset.locationMembersLocationId = locationRecord.id;

  setText("location-members-title", `Miembros — ${locationRecord.name || ""}`);
  document.getElementById("location-members-modal").style.display = "block";

  if (!cachedMembers.length) await loadMembers();
  renderLocationMembersTable(locationRecord.id);
}

function closeLocationMembersModal() {
  const section = document.querySelector('section[data-view="locations"]');
  if (section) section.dataset.locationMembersLocationId = "";
  document.getElementById("location-members-modal").style.display = "none";
}

function renderLocationMembersTable(locationId) {
  const tbody = document.getElementById("location-members-tbody");
  const section = document.querySelector('section[data-view="locations"]');
  if (!tbody || !section) return;

  const canAssign = section.dataset.locationsCanAssignMember === "1";
  const q = (document.getElementById("location-members-search")?.value || "").trim().toLowerCase();

  const members = !q
    ? cachedMembers
    : cachedMembers.filter((m) => {
        const name = `${m.first_name || ""} ${m.last_name || ""}`.trim().toLowerCase();
        const email = String(m.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });

  tbody.innerHTML = "";

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="4">No hay personas.</td></tr>`;
    return;
  }

  const locationName = (cachedLocations.find((l) => l.id === locationId)?.name) || "";

  for (const m of members) {
    const tr = document.createElement("tr");

    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
    const email = m.email || "";

    const currentLocId = m.location || null;
    const currentLocName =
      currentLocId ? (cachedLocations.find((l) => l.id === currentLocId)?.name || "(otra misión)") : "";

    tr.innerHTML = `
      <td data-label="Persona">${escapeHtml(name)}</td>
      <td data-label="Email">${escapeHtml(email)}</td>
      <td data-label="Misión actual">${escapeHtml(currentLocName)}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (String(currentLocId || "") === String(locationId)) {
      const detach = document.createElement("button");
      detach.type = "button";
      detach.textContent = "Quitar";
      detach.className = "danger-btn";
      detach.disabled = !canAssign;
      detach.addEventListener("click", async () => {
        await setMemberLocation(m.id, null);
        await loadMembers();
        renderLocationMembersTable(locationId);
      });
      actions.appendChild(detach);
    } else {
      const attach = document.createElement("button");
      attach.type = "button";
      attach.textContent = currentLocId ? "Mover aquí" : "Asignar";
      attach.className = "btn-secondary";
      attach.disabled = !canAssign;
      attach.addEventListener("click", async () => {
        const ok =
          !currentLocId ||
          confirm(`Este miembro ya está en "${currentLocName}". ¿Mover a "${locationName}"?`);
        if (!ok) return;

        await setMemberLocation(m.id, locationId);
        await loadMembers();
        renderLocationMembersTable(locationId);
      });
      actions.appendChild(attach);
    }

    tbody.appendChild(tr);
  }
}

async function setMemberLocation(memberId, locationIdOrNull) {
  setText("location-members-error", "");
  setText("location-members-success", "");

  try {
    await pb.collection("members").update(memberId, {
      location: locationIdOrNull,
    });
    setText("location-members-success", "Actualizado.");
  } catch (err) {
    console.error("Error asignando misión:", err);
    setText("location-members-error", humanizePbError(err) || "Error asignando misión.");
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

function toDateInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return "";
  }
}
