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




const root = document.getElementById("app");

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

  await loadPermissionsForChurch(currentChurch.id);
  renderShell(currentChurch, churches);
}

function renderShell(currentChurch, churches) {
  const showMembers = can("read", "members");
  const showUsers = can("read", "users");
  const showPermissions = can("read", "permissions");
  const showEvents = can("read", "events");
  const showGroups = can("read", "groups");
  const showLocations = can("read", "locations");
  const showMinistries = can("read", "ministries");



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

        <!-- <div class="sidebar-top">
        </div> -->

        
        <ul class="sidebar-menu">
          <li><a href="#" data-view="dashboard" class="active">Dashboard</a></li>
          ${showMembers ? `<li><a href="#" data-view="members">Personas</a></li>` : ""}
          ${showGroups ? `<li><a href="#" data-view="groups">Grupos</a></li>` : ""}
          ${showEvents ? `<li><a href="#" data-view="events">Eventos</a></li>` : ""}
          ${showLocations ? `<li><a href="#" data-view="locations">Misiones</a></li>` : ""}
          ${showMinistries ? `<li><a href="#" data-view="ministries">Ministerios</a></li>` : ""}
          <hr align="center" width="20%">
          ${showUsers ? `<li><a href="#" data-view="users">Usuarios</a></li>` : ""}
          ${showPermissions ? `<li><a href="#" data-view="permissions">Permisos</a></li>` : ""}
        </ul>

        <div class="sidebar-bottom">
          <div class="sidebar-meta">
            <div class="pill">Rol: <strong>${escapeHtml(getRole() || "")}</strong></div>

            <label class="sidebar-label">
              <span>Iglesia</span>
              <select id="church-switcher-select">
                ${churches
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${
                        c.id === currentChurch.id ? "selected" : ""
                      }>${escapeHtml(c.name)}</option>`
                  )
                  .join("")}
              </select>
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
              <div class="dash-metric">${escapeHtml(currentChurch.name)}</div>
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
      </main>
    </div>
  `;


  // Toggle sidebar (mobile drawer + desktop collapse)
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
        // desktop: collapse/expand
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
    // if you resize to desktop, close drawer
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





  

  document.getElementById("logout-btn").addEventListener("click", () => {
    logout();
    window.location.href = "login.html";
  });

  const churchSelect = document.getElementById("church-switcher-select");
  churchSelect.addEventListener("change", async () => {
    const newId = churchSelect.value;
    const newChurch = churches.find((c) => c.id === newId);
    if (!newChurch) return;

    localStorage.setItem("holycrm_current_church", JSON.stringify(newChurch));
    await loadPermissionsForChurch(newChurch.id);
    renderShell(newChurch, churches);
  });

  const links = root.querySelectorAll(".app-sidebar a[data-view]");
  const sections = root.querySelectorAll(".app-main section[data-view]");

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.getAttribute("data-view");

      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      sections.forEach((s) => {
        const isTarget = s.getAttribute("data-view") === view;
        s.style.display = isTarget ? "block" : "none";
        if (!isTarget) return;

        const church = currentChurchFromStorage();

        if (view === "members") {
          if (!can("read", "members")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initMembersView(church);
        }

        if (view === "users") {
          if (!can("read", "users")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initUsersView(church);
        }

        if (view === "permissions") {
          if (!can("read", "permissions")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initPermissionsView(church, churches);
        }

        if (view === "events") {
          if (!can("read", "events")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initEventsView(church);
        }

        if (view === "groups") {
          if (!can("read", "groups")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initGroupsView(church);
        }

        if (view === "locations") {
          if (!can("read", "locations")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initLocationsView(church);
        }        

        if (view === "ministries") {
          if (!can("read", "ministries")) {
            s.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
            return;
          }
          initMinistriesView(church);
        }


      });
    });
  });
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
