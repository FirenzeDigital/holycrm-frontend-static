// assets/js/app.js
import { pb, logout } from "./auth.js";
import { loadPermissionsForChurch, can, getRole } from "./permissions.js";

// Special (non-generic) views kept for now
import { initCalendarView } from "./calendar.js";
import { initFinanceRecordsView } from "./finance_transactions.js";
import { initFinanceCategoriesView } from "./finance_categories.js";
import { initUsersView } from "./users.js";
import { initPermissionsView } from "./permissions_ui.js";

const root = document.getElementById("app");

// -------------------- state --------------------
let churchesState = [];
let currentChurchState = null;
let shellRendered = false;

let generatedIndex = { modules: [] };
let currentView = "dashboard";

const rendererCache = new Map(); // moduleKey -> GenericModuleRenderer instance

// -------------------- helpers --------------------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toUrl(path) {
  const p = String(path || "").replace(/^\/+/, "");
  const base = new URL(".", window.location.href);
  return new URL(p, base).toString();
}

function getMain() {
  return root.querySelector(".app-main");
}

function getSidebarMenu() {
  return root.querySelector(".sidebar-menu");
}

function getActiveView() {
  return currentView || "dashboard";
}

function setActiveLink(view) {
  const links = root.querySelectorAll(".app-sidebar a[data-view]");
  links.forEach((l) => l.classList.toggle("active", l.getAttribute("data-view") === view));
}

function showSection(view) {
  const sections = root.querySelectorAll(".app-main section[data-view]");
  sections.forEach((s) => {
    s.style.display = s.getAttribute("data-view") === view ? "block" : "none";
  });
}

function getGeneratedMeta(id) {
  return (generatedIndex.modules || []).find((m) => m?.id === id) || null;
}

// -------------------- special modules --------------------
const SPECIAL_MODULES = [
  {
    id: "calendar",
    label: "Calendario",
    category: "main",
    icon: "",
    canShow: () => can("read", "calendar") || can("read", "events") || can("read", "members"),
    init: (church) => initCalendarView(church),
  },
  {
    id: "finance_transactions",
    label: "Movimientos",
    category: "finance",
    icon: "",
    canShow: () => can("read", "finance_transactions") || can("read", "finance"),
    init: (church) => initFinanceRecordsView(church),
  },
  {
    id: "finance_categories",
    label: "Categorías",
    category: "finance",
    icon: "",
    canShow: () => can("read", "finance_categories") || can("read", "finance"),
    init: (church) => initFinanceCategoriesView(church),
  },
  {
    id: "users",
    label: "Usuarios",
    category: "admin",
    icon: "",
    canShow: () => can("read", "users"),
    init: (church) => initUsersView(church),
  },
  {
    id: "permissions",
    label: "Permisos",
    category: "admin",
    icon: "",
    canShow: () => can("read", "permissions"),
    init: (church, churches) => initPermissionsView(church, churches),
  },
];

const CATEGORY_ORDER = ["main", "finance", "admin", "generated"];
const CATEGORY_LABELS = {
  main: "Main Modules",
  finance: "Finanzas",
  admin: "Administration",
  generated: "Generados",
};

// -------------------- loading --------------------
async function loadGeneratedIndexSafe() {
  try {
    const url = toUrl(`config/modules.json?ts=${Date.now()}`);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { modules: [] };
    const json = await res.json();
    if (!json || !Array.isArray(json.modules)) return { modules: [] };
    return json;
  } catch {
    return { modules: [] };
  }
}

async function loadModuleConfigDirect(moduleKey) {
  // If later you add "path" in config/modules.json, support it here
  const meta = getGeneratedMeta(moduleKey);
  const rawPath = meta?.path ? String(meta.path).replace(/^\/+/, "") : `modules/${moduleKey}.json`;
  const url = toUrl(`${rawPath}${rawPath.includes("?") ? "&" : "?"}ts=${Date.now()}`);

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) throw new Error(`Failed to load module JSON (${res.status}) from ${url}`);

  const t = text.trim();
  if (t.startsWith("<!doctype") || t.startsWith("<html")) {
    throw new Error(`Expected JSON but got HTML from ${url} (rewrite/fallback/cache).`);
  }

  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}: ${e.message}`);
  }

  if (!cfg || typeof cfg !== "object") throw new Error(`Module JSON is not an object: ${url}`);
  return cfg;
}

// -------------------- rendering --------------------
function renderShellOnce() {
  if (shellRendered) return;
  shellRendered = true;

  // THIS is the “classic admin template” structure your CSS was built for.
  root.innerHTML = `
    <header class="app-header">
      <div class="app-header-left">
        <button id="sidebar-toggle" type="button" aria-label="Toggle sidebar">☰</button>
        <div class="brand">HolyCRM.app</div>
      </div>
      <div class="app-header-right">
        <button id="logout-btn" class="btn-secondary" type="button">Salir</button>
      </div>
    </header>

    <div class="app-layout">
      <nav class="app-sidebar" aria-label="Sidebar">
        <ul class="sidebar-menu"></ul>

        <div class="sidebar-bottom">
          <div class="sidebar-meta">
            <div class="pill">Rol: <strong id="sidebar-role"></strong></div>

            <label class="sidebar-label">
              <span>Iglesia</span>
              <select id="church-switcher-select"></select>
            </label>
          </div>
          </br>
          <h5><center>holycrm.app</center>
          <hr align="center" width="20%">
          <center>Software for churches</center></h5>
        </div>
      </nav>

      <div id="drawer-backdrop" class="drawer-backdrop" style="display:none"></div>

      <main class="app-main" id="app-main"></main>
    </div>
  `;

  // ---- Sidebar toggle (mobile drawer + desktop collapse) ----
  const toggleBtn = document.getElementById("sidebar-toggle");
  const backdrop = document.getElementById("drawer-backdrop");

  function syncBackdrop() {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const open = document.body.classList.contains("sidebar-open");
    if (!backdrop) return;
    backdrop.style.display = isMobile && open ? "block" : "none";
  }

  toggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (isMobile) document.body.classList.toggle("sidebar-open");
    else document.body.classList.toggle("sidebar-collapsed");
    syncBackdrop();
  });

  backdrop?.addEventListener("click", () => {
    document.body.classList.remove("sidebar-open");
    syncBackdrop();
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.remove("sidebar-open");
    }
    syncBackdrop();
  });

  syncBackdrop();

  // ---- Logout ----
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    logout();
    window.location.href = "login.html";
  });

  // ---- Church switcher ----
  document.getElementById("church-switcher-select")?.addEventListener("change", onChurchChanged);

  // ---- Menu click delegation ----
  const sidebar = root.querySelector(".app-sidebar");
  sidebar?.addEventListener("click", async (e) => {
    const link = e.target.closest("a[data-view]");
    if (!link) return;
    e.preventDefault();

    const view = link.getAttribute("data-view");
    await navigateTo(view);

    // close mobile drawer
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.remove("sidebar-open");
      syncBackdrop();
    }
  });

  // Support internal navigation events (optional)
  window.addEventListener("navigate-to", async (e) => {
    const v = e?.detail?.view;
    if (v) await navigateTo(v);
  });
}

function ensureSections() {
  const main = getMain();
  if (!main) return;

  function ensure(id, html) {
    if (main.querySelector(`section[data-view="${id}"]`)) return;
    const s = document.createElement("section");
    s.setAttribute("data-view", id);
    s.style.display = "none";
    s.innerHTML = html;
    main.appendChild(s);
  }

  // Dashboard (same as your working one)
  ensure(
    "dashboard",
    `
      <h1>Dashboard</h1>
      <div class="dashboard-grid">
        <div class="card dash-card">
          <h3>Church</h3>
          <div class="dash-metric" id="dash-current-church"></div>
          <div class="muted" style="margin-top:6px;">Cambiala desde el sidebar.</div>
        </div>
        <div class="card dash-card">
          <h3>Accesos</h3>
          <div class="muted">El menú se adapta según permisos.</div>
        </div>
      </div>
    `
  );

  // Special sections
  for (const sm of SPECIAL_MODULES) {
    ensure(sm.id, `<h1>${escapeHtml(sm.label)}</h1><p>Cargando...</p>`);
  }

  // Generated sections
  for (const m of generatedIndex.modules || []) {
    if (!m?.id) continue;
    ensure(m.id, `<h1>${escapeHtml(m.label || m.id)}</h1><p>Cargando...</p>`);
  }
}

function renderMenu() {
  const menu = getSidebarMenu();
  if (!menu) return;

  // Build groups
  const groups = { main: [], finance: [], admin: [], generated: [] };

  // Special (only if allowed)
  for (const sm of SPECIAL_MODULES) {
    if (!sm.canShow()) continue;
    groups[sm.category]?.push({
      id: sm.id,
      label: sm.label,
      icon: sm.icon || "",
      kind: "special",
    });
  }

  // Generated (only if allowed)
  const genAllowed = (generatedIndex.modules || [])
    .filter((m) => m?.id)
    .filter((m) => can("read", m.resource || m.id))
    .map((m) => ({
      id: m.id,
      label: m.label || m.id,
      icon: m.icon || "",
      kind: "generated",
      category: groups[m.category] ? m.category : "generated",
    }));

  for (const gm of genAllowed) {
    groups[gm.category].push(gm);
  }

  // Render (same structure as your working template)
  const active = getActiveView();
  let html = "";

  // Dashboard
  html += `
    <li data-nav="dashboard">
      <a href="#" data-view="dashboard" class="${active === "dashboard" ? "active" : ""}">Dashboard</a>
    </li>
  `;

  for (const cat of CATEGORY_ORDER) {
    const items = groups[cat];
    if (!items || !items.length) continue;

    html += `<li data-nav="divider"><hr align="center" width="20%"></li>`;
    html += `<li data-nav="cat"><span class="muted">${escapeHtml(CATEGORY_LABELS[cat] || cat)}</span></li>`;

    for (const item of items) {
      html += `
        <li data-nav="${escapeHtml(item.id)}">
          <a href="#" data-view="${escapeHtml(item.id)}" class="${active === item.id ? "active" : ""}">
            ${item.icon ? `${escapeHtml(item.icon)} ` : ""}${escapeHtml(item.label)}
          </a>
        </li>
      `;
    }
  }

  menu.innerHTML = html;
}

function applyChurchContextToShell() {
  // role
  const roleStrong = document.getElementById("sidebar-role");
  if (roleStrong) roleStrong.textContent = escapeHtml(getRole() || "");

  // church selector
  const sel = document.getElementById("church-switcher-select");
  if (sel) {
    sel.innerHTML = churchesState
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}" ${c.id === currentChurchState?.id ? "selected" : ""}>${escapeHtml(
            c.name
          )}</option>`
      )
      .join("");
  }

  // dashboard metric
  const dash = document.getElementById("dash-current-church");
  if (dash) dash.textContent = escapeHtml(currentChurchState?.name || "");

  renderMenu();
}

async function onChurchChanged() {
  const churchSelect = document.getElementById("church-switcher-select");
  const newId = churchSelect?.value;
  const newChurch = churchesState.find((c) => c.id === newId);
  if (!newChurch) return;

  currentChurchState = newChurch;
  localStorage.setItem("holycrm_current_church", JSON.stringify(newChurch));

  await loadPermissionsForChurch(newChurch.id);
  applyChurchContextToShell();

  await navigateTo(getActiveView() || "dashboard");
}

// -------------------- navigation/rendering --------------------
function canView(view) {
  if (view === "dashboard") return true;

  const gen = getGeneratedMeta(view);
  if (gen) return can("read", gen.resource || gen.id);

  const sm = SPECIAL_MODULES.find((x) => x.id === view);
  if (sm) return sm.canShow();

  return false;
}

async function renderGeneratedModule(view, church) {
  const section = getMain()?.querySelector(`section[data-view="${view}"]`);
  if (!section) return;

  const meta = getGeneratedMeta(view);
  section.innerHTML = `<h1>${escapeHtml(meta?.label || view)}</h1><p>Cargando...</p>`;

  const cfg = await loadModuleConfigDirect(view);

  // Always re-import renderer fresh (keeps you safe if you tweak code)
  const { GenericModuleRenderer } = await import("./core/GenericModuleRenderer.js");

  let renderer = rendererCache.get(view);
  if (!renderer) {
    renderer = new GenericModuleRenderer({ moduleKey: view, config: cfg });
    rendererCache.set(view, renderer);
  } else {
    renderer.config = cfg;
  }

  await renderer.render({ container: section, churchId: church.id });
}

async function renderSpecialModule(view, church) {
  const sm = SPECIAL_MODULES.find((x) => x.id === view);
  if (!sm?.init) return;

  if (view === "permissions") sm.init(church, churchesState);
  else sm.init(church);
}

async function navigateTo(view) {
  if (!view) view = "dashboard";

  // Permission gate
  if (!canView(view)) view = "dashboard";

  currentView = view;
  setActiveLink(view);
  showSection(view);

  if (view === "dashboard") return;

  const church = currentChurchState;
  if (!church) return;

  // Generated takes priority (NO legacy members anymore)
  if (getGeneratedMeta(view)) {
    try {
      await renderGeneratedModule(view, church);
    } catch (e) {
      console.error(e);
      const section = getMain()?.querySelector(`section[data-view="${view}"]`);
      if (section) {
        section.innerHTML = `
          <h1>${escapeHtml(getGeneratedMeta(view)?.label || view)}</h1>
          <div style="padding:12px;border:1px solid #fca5a5;background:#fef2f2;border-radius:10px;">
            ${escapeHtml(e?.message || String(e))}
          </div>
        `;
      }
    }
    return;
  }

  // Special
  await renderSpecialModule(view, church);
}

// -------------------- init --------------------
async function init() {
  if (!pb.authStore.isValid) {
    window.location.href = "login.html";
    return;
  }

  let churches = [];
  let currentChurch = null;

  try {
    const raw = localStorage.getItem("holycrm_churches");
    if (raw) churches = JSON.parse(raw);
  } catch {}

  try {
    const raw = localStorage.getItem("holycrm_current_church");
    if (raw) currentChurch = JSON.parse(raw);
  } catch {}

  if (!Array.isArray(churches) || churches.length === 0) {
    window.location.href = "login.html";
    return;
  }

  if (!currentChurch || !churches.find((c) => c.id === currentChurch.id)) {
    currentChurch = churches[0];
    localStorage.setItem("holycrm_current_church", JSON.stringify(currentChurch));
  }

  churchesState = churches;
  currentChurchState = currentChurch;

  // Load permissions first (menu depends on it)
  await loadPermissionsForChurch(currentChurchState.id);

  // Load generated module index
  generatedIndex = await loadGeneratedIndexSafe();

  // Render UI (classic template)
  renderShellOnce();
  ensureSections();
  applyChurchContextToShell();

  await navigateTo("dashboard");
}

document.addEventListener("DOMContentLoaded", init);

