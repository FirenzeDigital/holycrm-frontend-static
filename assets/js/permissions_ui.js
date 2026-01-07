// assets/js/permissions_ui.js
import { pb } from "./auth.js";
import { MODULES, can, loadPermissionsForChurch } from "./permissions.js";

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Manager" },
  { key: "volunteer", label: "Volunteer" },
  { key: "member", label: "Member" },
];

const ACTIONS = [
  { key: "c", label: "Add" }, // create
  { key: "r", label: "View" }, // read
  { key: "u", label: "Edit" }, // update
  { key: "d", label: "Remove" }, // delete
];

let initialized = false;

// church: current selected church
// churches: all churches available to user (optional, for context)
export function initPermissionsView(church, churches = []) {
  const section = document.querySelector('section[data-view="permissions"]');
  if (!section) return;

  if (!can("read", "permissions")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  const canWrite = can("update", "permissions") || can("create", "permissions") || can("delete", "permissions");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Permisos</h1>

      <div class="card">
        <p>
          Esto define overrides por iglesia en <code>acl_rules</code>.</br>
          Si no hay overrides para una combinación (rol+módulo), se usan los defaults.
        </p>

        <p>
          <h3>Possible values</h3>
          >> <strong><code>Add</code></strong>.	Allows for the addition of new records.</br>
          >> <strong><code>View</code></strong>. Enables users to view or access information.</br>
          >> <strong><code>Edit</code></strong>. Allows modification of existing data.</br>
          >> <strong><code>Remove</code></strong>. Allows for the deletion of records.</br>	
        </p>

        <div class="perm-actions">
          <button id="perm-reload-btn" type="button">Recargar</button>
          ${canWrite ? `<button id="perm-save-btn" type="button">Guardar cambios</button>` : ""}
          ${canWrite ? `<button id="perm-reset-btn" type="button" class="danger-btn">Reset a defaults</button>` : ""}
        </div>

        <div id="perm-status" class="success"></div>
        <div id="perm-error" class="error"></div>
      </div>

      <div class="card">
        <h2 id="perm-title"></h2>
        <div class="perm-table-wrap">
          <table class="perm-table" id="perm-table"></table>
        </div>
      </div>
    `;

    section.querySelector("#perm-reload-btn").addEventListener("click", async () => {
      await loadAndRender(church);
    });

    if (canWrite) {
      section.querySelector("#perm-save-btn").addEventListener("click", async () => {
        await saveOverrides(church);
      });

      section.querySelector("#perm-reset-btn").addEventListener("click", async () => {
        const ok = confirm("¿Borrar TODOS los overrides de permisos de esta iglesia y volver a defaults?");
        if (!ok) return;
        await resetOverrides(church);
      });
    }
  }

  const title = section.querySelector("#perm-title");
  if (title) title.textContent = `Overrides de permisos en: ${church.name}`;

  loadAndRender(church);
}

async function loadAndRender(church) {
  const section = document.querySelector('section[data-view="permissions"]');
  const status = section.querySelector("#perm-status");
  const error = section.querySelector("#perm-error");
  const table = section.querySelector("#perm-table");

  status.textContent = "";
  error.textContent = "";
  table.innerHTML = "";

  // Load existing overrides from PB
  let overrides = [];
  try {
    overrides = await pb.collection("acl_rules").getFullList({
      filter: `church.id = "${church.id}"`,
      sort: "role,module_key",
    });
  } catch (err) {
    console.error(err);
    error.textContent = "No se pudieron cargar overrides (acl_rules).";
    return;
  }

  // Build lookup map: role|module -> record
  const map = new Map();
  for (const r of overrides) {
    const key = `${r.role}|${r.module_key}`;
    map.set(key, r);
  }

  // Render header
  const thead = document.createElement("thead");
  const hRow = document.createElement("tr");
  hRow.innerHTML = `<th>Rol</th>` + MODULES.map((m) => `<th>${escapeHtml(m.name)}<div class="perm-sub">${ACTIONS.map(a => a.label).join(" ")}</div></th>`).join("");
  thead.appendChild(hRow);

  const tbody = document.createElement("tbody");

  for (const role of ROLES) {
    const tr = document.createElement("tr");
    const roleTd = document.createElement("td");
    roleTd.textContent = role.label;
    tr.appendChild(roleTd);

    for (const mod of MODULES) {
      const cell = document.createElement("td");
      cell.className = "perm-cell";

      const key = `${role.key}|${mod.key}`;
      const existing = map.get(key);

      // values: if override exists -> use it, else empty (meaning: defaults)
      const v = {
        c: existing ? !!existing.can_create : null,
        r: existing ? !!existing.can_read : null,
        u: existing ? !!existing.can_update : null,
        d: existing ? !!existing.can_delete : null,
      };

      // per checkbox: tri-state behavior:
      // - if override exists -> checkbox is checked/unchecked
      // - if no override exists -> checkbox shows defaults as placeholder (we represent by data-default + indeterminate style)
      // Simpler: we always create checkbox, and mark data-has-override.
      cell.appendChild(makeCheckboxGroup(role.key, mod.key, existing?.id || "", v));
      tr.appendChild(cell);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);

  status.textContent = "Cargado.";
}

function makeCheckboxGroup(roleKey, moduleKey, recordId, v) {
  const wrap = document.createElement("div");
  wrap.className = "perm-group";
  wrap.dataset.role = roleKey;
  wrap.dataset.module = moduleKey;
  wrap.dataset.recordId = recordId || "";

  for (const a of ACTIONS) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.action = a.key;

    // If override exists, set value; if not, leave unchecked but mark as "no override"
    if (v[a.key] === true) cb.checked = true;
    if (v[a.key] === false) cb.checked = false;

    // When user clicks any checkbox, we consider this cell "overridden"
    cb.addEventListener("change", () => {
      wrap.dataset.touched = "1";
    });

    const label = document.createElement("label");
    label.className = "perm-check";
    label.appendChild(cb);
    label.appendChild(document.createTextNode(a.label));

    wrap.appendChild(label);
  }

  return wrap;
}

async function saveOverrides(church) {
  const section = document.querySelector('section[data-view="permissions"]');
  const status = section.querySelector("#perm-status");
  const error = section.querySelector("#perm-error");

  status.textContent = "";
  error.textContent = "";

  // Gather all touched cells OR existing overrides
  const groups = Array.from(section.querySelectorAll(".perm-group"));

  // Load current overrides to know existing records not touched
  const existing = await pb.collection("acl_rules").getFullList({
    filter: `church.id = "${church.id}"`,
    sort: "role,module_key",
  });

  const existingMap = new Map();
  for (const r of existing) {
    existingMap.set(`${r.role}|${r.module_key}`, r);
  }

  try {
    for (const g of groups) {
      const role = g.dataset.role;
      const module_key = g.dataset.module;

      // read checkbox values
      const val = {};
      for (const cb of Array.from(g.querySelectorAll("input[type=checkbox]"))) {
        const a = cb.dataset.action;
        val[a] = cb.checked;
      }

      const compositeKey = `${role}|${module_key}`;
      const rec = existingMap.get(compositeKey);

      // Decide create/update:
      // - If record exists => update it to match current checkboxes
      // - If record does NOT exist => create it only if user touched this group
      const touched = g.dataset.touched === "1";

      if (rec) {
        await pb.collection("acl_rules").update(rec.id, {
          church: church.id,
          role,
          module_key,
          can_create: !!val.c,
          can_read: !!val.r,
          can_update: !!val.u,
          can_delete: !!val.d,
        });
      } else if (touched) {
        await pb.collection("acl_rules").create({
          church: church.id,
          role,
          module_key,
          can_create: !!val.c,
          can_read: !!val.r,
          can_update: !!val.u,
          can_delete: !!val.d,
        });
      }
    }

    status.textContent = "Cambios guardados.";

    // Reload ACL for current church so UI updates immediately
    await loadPermissionsForChurch(church.id);
  } catch (err) {
    console.error(err);
    error.textContent = humanizePbError(err) || "Error guardando permisos.";
  }
}

async function resetOverrides(church) {
  const section = document.querySelector('section[data-view="permissions"]');
  const status = section.querySelector("#perm-status");
  const error = section.querySelector("#perm-error");

  status.textContent = "";
  error.textContent = "";

  try {
    const existing = await pb.collection("acl_rules").getFullList({
      filter: `church.id = "${church.id}"`,
    });

    for (const r of existing) {
      await pb.collection("acl_rules").delete(r.id);
    }

    status.textContent = "Overrides eliminados. Se aplican defaults.";
    await loadPermissionsForChurch(church.id);
    await loadAndRender(church);
  } catch (err) {
    console.error(err);
    error.textContent = humanizePbError(err) || "Error reseteando overrides.";
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


// Add this CSS to your stylesheet or inline in permissions_ui.js
const mobilePermissionsCSS = `
@media (max-width: 768px) {
  .permissions-grid {
    grid-template-columns: 1fr !important;
    gap: 1rem !important;
  }
  
  .permission-card {
    padding: 1rem !important;
    margin-bottom: 1rem !important;
  }
  
  .permission-actions {
    flex-direction: column !important;
    gap: 0.5rem !important;
  }
  
  .permission-actions button {
    width: 100% !important;
    margin: 0 !important;
  }
  
  .role-header {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 0.5rem !important;
  }
  
  .module-filters {
    flex-wrap: wrap !important;
    gap: 0.5rem !important;
  }
  
  .module-filters button {
    flex: 1 0 auto !important;
    min-width: 120px !important;
  }
}
`;

// Add this to your initPermissionsView function
function injectMobileStyles() {
  if (!document.getElementById('mobile-permissions-styles')) {
    const style = document.createElement('style');
    style.id = 'mobile-permissions-styles';
    style.textContent = mobilePermissionsCSS;
    document.head.appendChild(style);
  }
}