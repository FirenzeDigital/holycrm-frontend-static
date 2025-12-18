// assets/js/users.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "volunteer", label: "Volunteer" },
  { value: "member", label: "Member" },
];

const API_BASE = "https://app.holycrm.app/backend/";

let initialized = false;

export function initUsersView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="users"]');
  if (!section) return;

  if (!can("read", "users")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  const canCreate = can("create", "users");
  const canDelete = can("delete", "users");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Usuarios de la iglesia</h1>

      ${
        canCreate
          ? `
      <form id="user-enrol-form" class="card user-form">
        <div class="field">
          <span>Email del usuario</span>
          <input type="email" id="user-email-input" required />
        </div>
        <div class="field">
          <span>Rol en esta iglesia</span>
          <select id="user-role-select" required>
            ${ROLE_OPTIONS.map(
              (r) => `<option value="${r.value}">${r.label}</option>`
            ).join("")}
          </select>
        </div>
        <button type="submit">Agregar / enrolar usuario</button>
        <div id="user-form-error" class="error"></div>
        <div id="user-form-success" class="success"></div>
      </form>
      `
          : `
      <div class="card">
        <p>No tenés permisos para agregar usuarios.</p>
      </div>
      `
      }

      <div class="card">
        <h2 id="users-title"></h2>
        <table class="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            <tr><td colspan="3">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    if (canCreate) {
      const form = section.querySelector("#user-enrol-form");
      const emailInput = section.querySelector("#user-email-input");
      const roleSelect = section.querySelector("#user-role-select");
      const errorBox = section.querySelector("#user-form-error");
      const successBox = section.querySelector("#user-form-success");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox.textContent = "";
        successBox.textContent = "";

        const emailRaw = emailInput.value.trim();
        const role = roleSelect.value;

        if (!emailRaw) {
          errorBox.textContent = "El email es obligatorio.";
          return;
        }

        const email = emailRaw.toLowerCase();

        try {
          await enrolUserToChurch({ email, role, churchId: church.id });

          successBox.textContent = "Usuario enrolado correctamente.";
          emailInput.value = "";
          roleSelect.value = ROLE_OPTIONS[0].value;

          await loadUsersForChurch(church);
        } catch (err) {
          console.error("Error enrolando usuario:", err);
          errorBox.textContent =
            humanizePbError(err) || err.message || "Error al enrolar usuario.";
        }
      });
    }

    // store canDelete for later use in render loop
    section.dataset.usersCanDelete = canDelete ? "1" : "0";
  }

  const title = document.getElementById("users-title");
  if (title) title.textContent = `Usuarios enrolados en ${church.name}`;

  loadUsersForChurch(church);
}

async function loadUsersForChurch(church) {
  const tbody = document.getElementById("users-tbody");
  if (!tbody || !church) return;

  tbody.innerHTML = `<tr><td colspan="3">Cargando...</td></tr>`;

  const canDelete = document.querySelector('section[data-view="users"]')?.dataset
    ?.usersCanDelete === "1";

  try {
    const memberships = await pb
      .collection("user_church_memberships")
      .getFullList({
        filter: `church.id = "${church.id}"`,
        sort: "email",
      });

    if (!memberships.length) {
      tbody.innerHTML = `<tr><td colspan="3">No hay usuarios enrolados aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    for (const m of memberships) {
      const tr = document.createElement("tr");

      const emailTd = document.createElement("td");
      emailTd.textContent = m.email || "";
      tr.appendChild(emailTd);

      const roleTd = document.createElement("td");
      roleTd.textContent = m.role || "";
      tr.appendChild(roleTd);

      const actionsTd = document.createElement("td");

      if (canDelete) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "Quitar de la iglesia";
        removeBtn.className = "danger-btn";

        removeBtn.addEventListener("click", async () => {
          const ok = window.confirm(
            `¿Quitar al usuario "${m.email || ""}" de "${church.name}"?`
          );
          if (!ok) return;

          try {
            await pb.collection("user_church_memberships").delete(m.id);
            await loadUsersForChurch(church);
          } catch (err) {
            console.error("Error quitando usuario:", err);
            alert(humanizePbError(err) || "Error al quitar el usuario de la iglesia.");
          }
        });

        actionsTd.appendChild(removeBtn);
      } else {
        actionsTd.textContent = "";
      }

      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error cargando usuarios:", err);
    tbody.innerHTML = `<tr><td colspan="3">Error al cargar usuarios.</td></tr>`;
  }
}

async function enrolUserToChurch({ email, role, churchId }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email inválido.");
  if (!churchId) throw new Error("No hay iglesia seleccionada.");

  // Stop early if membership already exists
  try {
    const existing = await pb
      .collection("user_church_memberships")
      .getFirstListItem(`email = "${normalizedEmail}" && church.id = "${churchId}"`);
    if (existing) throw new Error("El usuario ya está enrolado en esta iglesia.");
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  const userId = await ensureUserId(normalizedEmail);

  await pb.collection("user_church_memberships").create({
    email: normalizedEmail,
    user_id: userId,
    church: churchId,
    role,
  });
}

async function ensureUserId(email) {
  const tmpPassword = generatePassword(14);

  try {
    const created = await pb.collection("users").create({
      email,
      password: tmpPassword,
      passwordConfirm: tmpPassword,
      verified: false,
    });
    return created.id;
  } catch (err) {
    // fallback for existing user
    if (err?.status === 400 || err?.status === 409) {
      const resolved = await resolveUserByEmail(email);
      return resolved.id;
    }
    throw err;
  }
}

async function resolveUserByEmail(email) {
  const token = pb.authStore.token;

  const res = await fetch(`${API_BASE}/api/users/resolve-by-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`resolve-by-email failed (${res.status}): ${text}`);
  }

  return await res.json();
}

function generatePassword(length = 12) {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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
