// assets/js/app.js
import { pb, logout } from "./auth.js";
import { loadPermissionsForChurch, can, getRole } from "./permissions.js";

import { initMembersView } from "./members.js";
import { initUsersView } from "./users.js";
import { initPermissionsView } from "./permissions_ui.js";
import { initEventsView } from "./events.js";
import { initGroupsView } from "./groups.js";
import { initLocationsView } from "./locations.js";
import { initMinistriesView } from "./ministries.js";
import { initRotasView } from "./rotas.js";
import { initCalendarView } from "./calendar.js";
import { initFinanceView } from "./finance.js";

const root = document.getElementById("app");

// ---- Shell state (render once) ----
let churchesState = [];
let currentChurchState = null;
let shellRendered = false;

async function init() {
  if (!pb.authStore.isValid) {
    window.location.href = "login.html";
    return;
  }

  let churches = [];
  let currentChurch = null;

  try {
    const rawChurches = localStorage.getItem("holycrm_churches");
    if (rawChurches) churches = JSON.parse(rawChurches);
  } catch {
    churches = [];
  }

  try {
    const rawCurrent = localStorage.getItem("holycrm_current_church");
    if (rawCurrent) currentChurch = JSON.parse(rawCurrent);
  } catch {
    currentChurch = null;
  }

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

  await loadPermissionsForChurch(currentChurchState.id);

  renderShellOnce();
  applyChurchContextToShell();
  navigateTo(getActiveView() || "dashboard");
}

function renderShellOnce() {
  if (shellRendered) return;
  shellRendered = true;

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
        <ul class="sidebar-menu">
          <li data-nav="dashboard"><a href="#" data-view="dashboard" class="active">Dashboard</a></li>

          <li data-nav="members"><a href="#" data-view="members">Personas</a></li>
          <li data-nav="groups"><a href="#" data-view="groups">Grupos</a></li>
          <li data-nav="events"><a href="#" data-view="events">Eventos</a></li>
          <li data-nav="locations"><a href="#" data-view="locations">Misiones</a></li>
          <li data-nav="ministries"><a href="#" data-view="ministries">Ministerios</a></li>
          <li data-nav="rotas"><a href="#" data-view="rotas">Roles mensuales</a></li>
          <li data-nav="calendar"><a href="#" data-view="calendar">Calendario</a></li>
          <li data-nav="finance"><a href="#" data-view="finance">Finanzas</a></li>

          <li data-nav="divider"><hr align="center" width="20%"></li>

          <li data-nav="users"><a href="#" data-view="users">Usuarios</a></li>
          <li data-nav="permissions"><a href="#" data-view="permissions">Permisos</a></li>
        </ul>

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

      <main class="app-main" id="app-main">
        <section data-view="dashboard">
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
        </section>

        <section data-view="members" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="users" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="permissions" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="events" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="groups" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="locations" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="ministries" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="rotas" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="calendar" style="display:none"><h1>Cargando módulo...</h1></section>
        <section data-view="finance" style="display:none"><h1>Cargando módulo...</h1></section>
      </main>
    </div>
  `;

  // ---- Sidebar toggle (mobile drawer + desktop collapse) ----
  const toggleBtn = document.getElementById("sidebar-toggle");
  const backdrop = document.getElementById("drawer-backdrop");

  function setBackdrop() {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const open = document.body.classList.contains("sidebar-open");
    if (!backdrop) return;
    backdrop.style.display = isMobile && open ? "block" : "none";
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      if (isMobile) {
        document.body.classList.toggle("sidebar-open");
      } else {
        document.body.classList.toggle("sidebar-collapsed");
      }
      setBackdrop();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      setBackdrop();
    });
  }

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.remove("sidebar-open");
    }
    setBackdrop();
  });

  // Close drawer when clicking a menu item (mobile)
  const sidebarLinks = root.querySelectorAll(".app-sidebar a[data-view]");
  sidebarLinks.forEach((l) => {
    l.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      setBackdrop();
    });
  });

  setBackdrop();

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", () => {
    logout();
    window.location.href = "login.html";
  });

  // ---- Church switcher (do NOT re-render shell) ----
  document.getElementById("church-switcher-select").addEventListener("change", onChurchChanged);

  // ---- Navigation (wire once) ----
  const links = root.querySelectorAll(".app-sidebar a[data-view]");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.getAttribute("data-view");
      navigateTo(view);
    });
  });
}

async function onChurchChanged() {
  const churchSelect = document.getElementById("church-switcher-select");
  const newId = churchSelect.value;

  const newChurch = churchesState.find((c) => c.id === newId);
  if (!newChurch) return;

  currentChurchState = newChurch;
  localStorage.setItem("holycrm_current_church", JSON.stringify(newChurch));

  await loadPermissionsForChurch(newChurch.id);

  applyChurchContextToShell();

  // Re-run current view init (fixes the “Cargando módulo...” issue without F5)
  const view = getActiveView() || "dashboard";
  navigateTo(view);
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
          `<option value="${c.id}" ${c.id === currentChurchState?.id ? "selected" : ""}>${escapeHtml(
            c.name
          )}</option>`
      )
      .join("");
  }

  // dashboard metric
  const dash = document.getElementById("dash-current-church");
  if (dash) dash.textContent = escapeHtml(currentChurchState?.name || "");

  // menu visibility
  const showMembers = can("read", "members");
  const showUsers = can("read", "users");
  const showPermissions = can("read", "permissions");
  const showEvents = can("read", "events");
  const showGroups = can("read", "groups");
  const showLocations = can("read", "locations");
  const showMinistries = can("read", "ministries");
  const showRotas = can("read", "service_role_assignments") || can("read", "service_roles");
  const showCalendar = can("read", "calendar");
  const showFinance = can("read", "finance_transactions");

  setNavVisible("members", showMembers);
  setNavVisible("groups", showGroups);
  setNavVisible("events", showEvents);
  setNavVisible("locations", showLocations);
  setNavVisible("ministries", showMinistries);
  setNavVisible("rotas", showRotas);
  setNavVisible("calendar", showCalendar);
  setNavVisible("users", showUsers);
  setNavVisible("permissions", showPermissions);

  // divider only if there is something below it visible
  const dividerNeeded = showUsers || showPermissions;
  setNavVisible("divider", dividerNeeded);

  // If the active view just became forbidden, bounce to dashboard
  const active = getActiveView();
  if (active && active !== "dashboard" && !canView(active, showRotas)) {
    navigateTo("dashboard");
  }
}

function setNavVisible(view, visible) {
  const li = root.querySelector(`.sidebar-menu li[data-nav="${view}"]`);
  if (!li) return;
  li.style.display = visible ? "" : "none";
}

function getActiveView() {
  return root.querySelector(".app-sidebar a.active[data-view]")?.getAttribute("data-view") || null;
}

function setActiveLink(view) {
  const links = root.querySelectorAll(".app-sidebar a[data-view]");
  links.forEach((l) => {
    l.classList.toggle("active", l.getAttribute("data-view") === view);
  });
}

function showSection(view) {
  const sections = root.querySelectorAll(".app-main section[data-view]");
  sections.forEach((s) => {
    const isTarget = s.getAttribute("data-view") === view;
    s.style.display = isTarget ? "block" : "none";
  });
}

function canView(view, showRotasComputed) {
  if (view === "dashboard") return true;
  if (view === "members") return can("read", "members");
  if (view === "users") return can("read", "users");
  if (view === "permissions") return can("read", "permissions");
  if (view === "events") return can("read", "events");
  if (view === "groups") return can("read", "groups");
  if (view === "locations") return can("read", "locations");
  if (view === "ministries") return can("read", "ministries");
  if (view === "rotas") return !!showRotasComputed;
  if (view === "calendar") return can("read", "calendar");
  if (view === "finance") return can("read", "finance");
  if (view === "finance_transactions") return can("read", "finance_transactions");
  return false;
}

function navigateTo(view) {
  // permissions gate
  const showRotasComputed = can("read", "service_role_assignments") || can("read", "service_roles");
  if (!canView(view, showRotasComputed)) {
    const section = root.querySelector(`.app-main section[data-view="${view}"]`);
    if (section) {
      section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
      showSection(view);
      setActiveLink(view);
    } else {
      showSection("dashboard");
      setActiveLink("dashboard");
    }
    return;
  }

  setActiveLink(view);
  showSection(view);

  const church = currentChurchState || currentChurchFromStorage();

  // Module inits (re-run on church switch; shell DOM is not destroyed anymore)
  if (view === "members") return initMembersView(church);
  if (view === "users") return initUsersView(church);
  if (view === "permissions") return initPermissionsView(church, churchesState);
  if (view === "events") return initEventsView(church);
  if (view === "groups") return initGroupsView(church);
  if (view === "locations") return initLocationsView(church);
  if (view === "ministries") return initMinistriesView(church);
  if (view === "rotas") return initRotasView(church);
  if (view === "calendar") return initCalendarView(church);
  if (view === "finance") return initFinanceView(church);
  if (view === "finance_transactions") return initFinanceView(church);
  // if (view === "finance") {
  //   if (!can("read", "finance_transactions")) {
  //     s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
  //     return;
  //   }
  //   initFinanceView(church);
  // }

  // dashboard: no-op
}

function currentChurchFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("holycrm_current_church"));
  } catch {
    return null;
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

init();
