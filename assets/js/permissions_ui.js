// assets/js/permissions_ui.js - UPDATED WITH BETTER CSS & CONSOLIDATION
import { pb } from "./auth.js";
import { can, loadPermissionsForChurch } from "./permissions.js";
import { MODULES, MODULE_PERMISSION_MATRIX, getModuleDefaultPermissions } from "./modules.js";

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Manager" },
  { key: "volunteer", label: "Volunteer" },
  { key: "member", label: "Member" },
];

const ACTIONS = [
  { key: "c", label: "Add", icon: "+" },
  { key: "r", label: "View", icon: "👁️" },
  { key: "u", label: "Edit", icon: "✏️" },
  { key: "d", label: "Remove", icon: "🗑️" },
];

let initialized = false;
let currentOverrides = [];
let currentChurch = null;

export function initPermissionsView(church, churches = []) {
  const section = document.querySelector('section[data-view="permissions"]');
  if (!section) return;

  if (!can("read", "permissions")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  const canWrite = can("update", "permissions") || can("create", "permissions") || can("delete", "permissions");
  currentChurch = church;

  if (!initialized) {
    initialized = true;
    injectMobileStyles();
    
    section.innerHTML = `
      <h1>Permisos</h1>

      <div class="card perm-info-card">
        <div class="perm-header">
          <div>
            <h3>Overrides de permisos</h3>
            <p class="muted">Configura permisos específicos para: <strong>${escapeHtml(church.name)}</strong></p>
          </div>
          <div class="perm-header-actions">
            <button id="perm-reload-btn" type="button" class="icon-btn" title="Recargar">↻</button>
          </div>
        </div>

        <div class="perm-info">
          <p><strong>Los valores posibles:</strong></p>
          <div class="perm-action-info">
            <span class="perm-action-badge">+ Add</span> Crear nuevos registros
          </div>
          <div class="perm-action-info">
            <span class="perm-action-badge">👁️ View</span> Ver/leer información
          </div>
          <div class="perm-action-info">
            <span class="perm-action-badge">✏️ Edit</span> Modificar datos existentes
          </div>
          <div class="perm-action-info">
            <span class="perm-action-badge">🗑️ Remove</span> Eliminar registros
          </div>
          <p class="muted" style="margin-top: 12px;">
            <small>Si no hay override para un rol+módulo, se usan los valores por defecto.</small>
          </p>
        </div>

        <div id="perm-status" class="success"></div>
        <div id="perm-error" class="error"></div>
      </div>

      <!-- Role Tabs for Desktop, Dropdown for Mobile -->
      <div class="card perm-role-selector-card">
        <div class="perm-role-header">
          <h3>Seleccionar Rol</h3>
          <select id="perm-role-select" class="perm-role-select-mobile">
            ${ROLES.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}
          </select>
        </div>
        
        <!-- Desktop Role Tabs -->
        <div class="perm-role-tabs" id="perm-role-tabs">
          ${ROLES.map(r => `
            <button class="perm-role-tab ${r.key === 'admin' ? 'active' : ''}" data-role="${r.key}">${r.label}</button>
          `).join('')}
        </div>
      </div>

      <!-- Module Filters -->
      <div class="card perm-filter-card">
        <div class="perm-filter-header">
          <h3>Filtrar Módulos</h3>
          <button id="perm-toggle-all" class="text-btn">Mostrar todos</button>
        </div>
        <div class="perm-filter-buttons" id="perm-filter-buttons">
          <!-- Will be populated with module groups -->
        </div>
        <div class="perm-search">
          <input type="text" id="perm-module-search" placeholder="Buscar módulo..." />
        </div>
      </div>

      <!-- Permissions Grid -->
      <div class="card perm-grid-card">
        <div class="perm-grid-header">
          <h3 id="perm-current-role">Permisos para: <span>Admin</span></h3>
          <div class="perm-bulk-actions">
            ${canWrite ? `
              <button id="perm-save-btn" type="button" class="btn-primary">Guardar cambios</button>
              <button id="perm-reset-btn" type="button" class="danger-btn">Resetear defaults</button>
            ` : ''}
          </div>
        </div>
        
        <div id="perm-grid-container">
          <!-- Will be populated with module cards -->
          <div class="perm-loading">Cargando permisos...</div>
        </div>
      </div>
    `;

    // Event Listeners
    section.querySelector("#perm-reload-btn").addEventListener("click", async () => {
      await loadAndRender(church);
    });

    // Role selection
    const roleSelect = section.querySelector("#perm-role-select");
    const roleTabs = section.querySelector("#perm-role-tabs");
    
    roleSelect.addEventListener("change", (e) => {
      const role = e.target.value;
      updateRoleView(role);
    });

    roleTabs.addEventListener("click", (e) => {
      if (e.target.classList.contains("perm-role-tab")) {
        const role = e.target.dataset.role;
        updateRoleView(role);
      }
    });

    // Module search
    const moduleSearch = section.querySelector("#perm-module-search");
    if (moduleSearch) {
      moduleSearch.addEventListener("input", (e) => {
        filterModules(e.target.value);
      });
    }

    // Toggle all modules
    const toggleAllBtn = section.querySelector("#perm-toggle-all");
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        filterModules('');
        if (moduleSearch) moduleSearch.value = '';
      });
    }

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

  loadAndRender(church);
}

// Just update getDefaultPermissions to use the imported function:
function getDefaultPermissions(role, moduleKey) {
  return getModuleDefaultPermissions(moduleKey, role);
}

async function loadAndRender(church) {
  const section = document.querySelector('section[data-view="permissions"]');
  if (!section) return;
  
  const status = section.querySelector("#perm-status");
  const error = section.querySelector("#perm-error");
  const gridContainer = section.querySelector("#perm-grid-container");

  if (!gridContainer) {
    console.error("perm-grid-container not found! Check your HTML structure.");
    return;
  }

  status.textContent = "";
  error.textContent = "";
  gridContainer.innerHTML = '<div class="perm-loading">Cargando permisos...</div>';

  try {
    // Load existing overrides
    currentOverrides = await pb.collection("acl_rules").getFullList({
      filter: `church.id = "${church.id}"`,
      sort: "role,module_key",
    });
    
    // Initialize module filters
    initModuleFilters();
    
    // Render for current role (default: admin)
    const currentRole = section.querySelector(".perm-role-tab.active")?.dataset.role || "admin";
    updateRoleView(currentRole);
    
    status.textContent = "Permisos cargados correctamente";
  } catch (err) {
    console.error("Error loading permissions:", err);
    error.textContent = "No se pudieron cargar los overrides.";
    if (gridContainer) {
      gridContainer.innerHTML = `<div class="perm-error">Error cargando permisos: ${err.message}</div>`;
    }
  }
}

function initModuleFilters() {
  const container = document.querySelector("#perm-filter-buttons");
  if (!container) return;
  
  // Group modules by prefix for better organization
  const moduleGroups = {
    'main': MODULES.filter(m => ['members', 'events', 'groups', 'locations', 'ministries'].includes(m.key)),
    'finance': MODULES.filter(m => m.key.includes('finance')),
    'services': MODULES.filter(m => m.key.includes('service') || m.key === 'calendar'),
    'admin': MODULES.filter(m => ['users', 'permissions'].includes(m.key)),
    'other': MODULES.filter(m => !['members', 'events', 'groups', 'locations', 'ministries', 'users', 'permissions'].includes(m.key) && 
                                 !m.key.includes('finance') && !m.key.includes('service') && m.key !== 'calendar')
  };
  
  let html = '';
  for (const [groupName, modules] of Object.entries(moduleGroups)) {
    if (modules.length > 0) {
      const label = groupName === 'main' ? 'Principal' : 
                   groupName === 'finance' ? 'Finanzas' :
                   groupName === 'services' ? 'Servicios' :
                   groupName === 'admin' ? 'Administración' : 'Otros';
      
      html += `<button class="perm-filter-btn" data-filter="${groupName}">${label} (${modules.length})</button>`;
    }
  }
  
  container.innerHTML = html;
  
  // Add filter button listeners
  container.querySelectorAll(".perm-filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const filter = e.target.dataset.filter;
      filterByGroup(filter);
    });
  });
}

function updateRoleView(role) {
  // Update UI
  const tabs = document.querySelectorAll(".perm-role-tab");
  const roleSelect = document.querySelector("#perm-role-select");
  const currentRoleSpan = document.querySelector("#perm-current-role span");
  
  tabs.forEach(tab => tab.classList.remove("active"));
  const activeTab = document.querySelector(`.perm-role-tab[data-role="${role}"]`);
  if (activeTab) activeTab.classList.add("active");
  
  if (roleSelect) roleSelect.value = role;
  if (currentRoleSpan) {
    currentRoleSpan.textContent = ROLES.find(r => r.key === role)?.label || role;
  }
  
  // Render modules for this role
  renderModulesForRole(role);
}

function renderModulesForRole(role) {
  const container = document.querySelector("#perm-grid-container");
  if (!container) return;
  
  const overrideMap = new Map();
  
  // Build override map for this role
  currentOverrides
    .filter(o => o.role === role)
    .forEach(o => {
      overrideMap.set(o.module_key, o);
    });
  
  // Create module cards
  const cards = MODULES.map(mod => {
    const override = overrideMap.get(mod.key);
    const hasOverride = !!override;
    
    // Get default values for this role
    const defaultValues = getDefaultPermissions(role, mod.key);
    
    return createModuleCard(mod, role, override, defaultValues, hasOverride);
  }).join('');
  
  container.innerHTML = cards;
  
  // Add event listeners to checkboxes
  container.querySelectorAll(".perm-action-checkbox").forEach(cb => {
    cb.addEventListener("change", function() {
      const card = this.closest(".perm-module-card");
      if (card) {
        card.dataset.touched = "1";
        card.classList.add("perm-module-modified");
      }
    });
  });
}

function createModuleCard(module, role, override, defaults, hasOverride) {
  const values = override ? {
    c: !!override.can_create,
    r: !!override.can_read,
    u: !!override.can_update,
    d: !!override.can_delete
  } : defaults;
  
  const recordId = override?.id || '';
  
  // Create checkboxes for each action
  const checkboxes = ACTIONS.map(action => {
    const isChecked = values[action.key];
    const isDefault = !hasOverride;
    
    return `
      <label class="perm-action-item ${isDefault ? 'perm-action-default' : ''}">
        <input type="checkbox" 
               class="perm-action-checkbox"
               data-action="${action.key}"
               ${isChecked ? 'checked' : ''}
               ${isDefault ? 'data-default="true"' : ''}>
        <span class="perm-action-icon">${action.icon}</span>
        <span class="perm-action-label">${action.label}</span>
      </label>
    `;
  }).join('');
  
  return `
    <div class="perm-module-card ${hasOverride ? 'perm-module-overridden' : ''}" 
         data-module="${module.key}" 
         data-role="${role}"
         data-record-id="${recordId}">
      <div class="perm-module-header">
        <h4>${module.name}</h4>
        <div class="perm-module-status">
          ${hasOverride ? '<span class="perm-override-badge">Override</span>' : '<span class="perm-default-badge">Default</span>'}
        </div>
      </div>
      <div class="perm-module-actions">
        ${checkboxes}
      </div>
      <div class="perm-module-info">
        <small class="muted">${module.key}</small>
      </div>
    </div>
  `;
}

function filterModules(searchTerm) {
  const cards = document.querySelectorAll(".perm-module-card");
  const search = searchTerm.toLowerCase();
  
  cards.forEach(card => {
    const moduleName = card.querySelector("h4")?.textContent.toLowerCase() || '';
    const moduleKey = card.dataset.module.toLowerCase();
    
    if (search === '' || moduleName.includes(search) || moduleKey.includes(search)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

function filterByGroup(groupName) {
  const groups = {
    'main': ['members', 'events', 'groups', 'locations', 'ministries'],
    'finance': MODULES.filter(m => m.key.includes('finance')).map(m => m.key),
    'services': [...MODULES.filter(m => m.key.includes('service')).map(m => m.key), 'calendar'],
    'admin': ['users', 'permissions'],
    'other': MODULES.filter(m => 
      !['members', 'events', 'groups', 'locations', 'ministries', 'users', 'permissions'].includes(m.key) && 
      !m.key.includes('finance') && !m.key.includes('service') && m.key !== 'calendar'
    ).map(m => m.key)
  };
  
  const cards = document.querySelectorAll(".perm-module-card");
  const moduleKeys = groups[groupName] || [];
  
  cards.forEach(card => {
    if (moduleKeys.includes(card.dataset.module)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

async function saveOverrides(church) {
  const section = document.querySelector('section[data-view="permissions"]');
  if (!section) return;
  
  const status = section.querySelector("#perm-status");
  const error = section.querySelector("#perm-error");
  const currentRole = section.querySelector(".perm-role-tab.active")?.dataset.role || "admin";

  status.textContent = "";
  error.textContent = "";

  try {
    // Get all modified cards for current role
    const modifiedCards = Array.from(section.querySelectorAll(`.perm-module-card[data-role="${currentRole}"][data-touched="1"]`));
    
    for (const card of modifiedCards) {
      const moduleKey = card.dataset.module;
      const recordId = card.dataset.recordId;
      
      // Get checkbox values
      const checkboxes = card.querySelectorAll(".perm-action-checkbox");
      const values = {
        c: checkboxes[0]?.checked || false,
        r: checkboxes[1]?.checked || false,
        u: checkboxes[2]?.checked || false,
        d: checkboxes[3]?.checked || false
      };
      
      // Check if all values match defaults (then delete override if exists)
      const defaults = getDefaultPermissions(currentRole, moduleKey);
      const matchesDefaults = values.c === defaults.c && 
                             values.r === defaults.r && 
                             values.u === defaults.u && 
                             values.d === defaults.d;
      
      if (recordId) {
        if (matchesDefaults) {
          // Delete override since it matches defaults
          await pb.collection("acl_rules").delete(recordId);
        } else {
          // Update existing override
          await pb.collection("acl_rules").update(recordId, {
            church: church.id,
            role: currentRole,
            module_key: moduleKey,
            can_create: values.c,
            can_read: values.r,
            can_update: values.u,
            can_delete: values.d,
          });
        }
      } else if (!matchesDefaults) {
        // Create new override
        await pb.collection("acl_rules").create({
          church: church.id,
          role: currentRole,
          module_key: moduleKey,
          can_create: values.c,
          can_read: values.r,
          can_update: values.u,
          can_delete: values.d,
        });
      }
    }
    
    status.textContent = "Cambios guardados correctamente";
    
    // Reload to reflect changes
    await loadAndRender(church);
    await loadPermissionsForChurch(church.id);
    
  } catch (err) {
    console.error(err);
    error.textContent = "Error guardando permisos: " + (err.message || "Error desconocido");
  }
}

async function resetOverrides(church) {
  const section = document.querySelector('section[data-view="permissions"]');
  if (!section) return;
  
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
    error.textContent = "Error reseteando overrides: " + (err.message || "Error desconocido");
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

// Add mobile-friendly CSS
function injectMobileStyles() {
  if (!document.getElementById('mobile-permissions-styles')) {
    const style = document.createElement('style');
    style.id = 'mobile-permissions-styles';
    style.textContent = `
      /* Permissions Mobile-First Styles - IMPROVED VISIBILITY */
      .perm-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      
      .perm-header-actions {
        display: flex;
        gap: 8px;
      }
      
      .icon-btn {
        padding: 8px 12px;
        border-radius: 10px;
        background: rgba(255,255,255,0.1);
        border: 1px solid var(--border);
        cursor: pointer;
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      .text-btn {
        background: none;
        border: none;
        color: var(--primary) !important; /* Ensure text is visible */
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        font-size: 0.9rem;
      }
      
      .perm-action-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
      }
      
      .perm-action-badge {
        display: inline-block;
        padding: 4px 8px;
        background: rgba(37,99,235,0.1);
        border: 1px solid rgba(37,99,235,0.2);
        border-radius: 6px;
        font-size: 0.85rem;
        min-width: 60px;
        text-align: center;
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      /* Role Selector - IMPROVED VISIBILITY */
      .perm-role-selector-card {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--surface);
        margin-bottom: 12px;
      }
      
      .perm-role-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .perm-role-select-mobile {
        display: block;
        width: 100%;
        max-width: 200px;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      .perm-role-tabs {
        display: none;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .perm-role-tab {
        padding: 8px 16px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface-2);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9rem;
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      .perm-role-tab:hover {
        background: rgba(37,99,235,0.05);
        border-color: rgba(37,99,235,0.3);
      }
      
      .perm-role-tab.active {
        background: var(--primary) !important;
        color: white !important;
        border-color: var(--primary) !important;
        font-weight: 600;
      }
      
      /* Module Filters - IMPROVED VISIBILITY */
      .perm-filter-card {
        margin-bottom: 12px;
      }
      
      .perm-filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .perm-filter-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      
      .perm-filter-btn {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-2);
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      .perm-filter-btn:hover {
        background: rgba(37,99,235,0.1);
        border-color: rgba(37,99,235,0.3);
      }
      
      .perm-search input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      /* Module Grid */
      .perm-grid-header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .perm-bulk-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .perm-module-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        background: var(--surface-2);
        transition: all 0.2s;
      }
      
      .perm-module-overridden {
        border-left: 4px solid var(--primary);
      }
      
      .perm-module-modified {
        background: rgba(255,215,0,0.05);
        border-color: gold;
      }
      
      .perm-module-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .perm-override-badge {
        background: rgba(37,99,235,0.1);
        color: var(--primary) !important;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      
      .perm-default-badge {
        background: rgba(100,116,139,0.1);
        color: var(--muted) !important;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      
      .perm-module-actions {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .perm-action-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 8px;
        background: rgba(255,255,255,0.5);
        cursor: pointer;
        transition: all 0.2s;
        color: var(--text) !important; /* Ensure text is visible */
      }
      
      .perm-action-item:hover {
        background: rgba(37,99,235,0.05);
      }
      
      .perm-action-default {
        opacity: 0.7;
      }
      
      .perm-action-icon {
        font-size: 1.2rem;
      }
      
      .perm-action-label {
        flex: 1;
        font-size: 0.9rem;
      }
      
      .perm-action-checkbox {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      
      .perm-loading {
        text-align: center;
        padding: 40px;
        color: var(--muted) !important;
      }
      
      /* Responsive Design */
      @media (min-width: 768px) {
        .perm-role-tabs {
          display: flex;
        }
        
        .perm-role-select-mobile {
          display: none;
        }
        
        .perm-grid-header {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }
        
        .perm-module-actions {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      
      @media (max-width: 767px) {
        .perm-module-card {
          padding: 12px;
        }
        
        .perm-module-actions {
          grid-template-columns: 1fr;
        }
        
        .perm-bulk-actions {
          flex-direction: column;
        }
        
        .perm-bulk-actions button {
          width: 100%;
        }
        
        .perm-role-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        
        .perm-role-select-mobile {
          max-width: 100%;
        }
      }
      
      /* Ensure all text is visible in cards */
      .perm-module-card h4 {
        color: var(--text) !important;
        margin: 0;
      }
      
      .perm-module-info small {
        color: var(--muted) !important;
      }
    `;
    document.head.appendChild(style);
  }
}
