// assets/js/finance_categories.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;
let cachedCategories = [];

export async function initFinanceCategoriesView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="finance_categories"]');
  if (!section) return;

  if (!can("read", "finance_categories")) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  currentChurchId = church.id;

  if (!initialized) {
    initialized = true;
    renderLayout(section);
    bindEvents(section);
  }

  await loadCategories();
  renderTable();
}

/* ---------------- Layout ---------------- */

function renderLayout(section) {
  section.innerHTML = `
    <h1>Categorías financieras</h1>

    <div class="card">
      <div class="members-toolbar">
        <div></div>
        <div class="members-actions">
          ${can("create", "finance_categories") ? `<button id="cat-new">Nueva</button>` : ""}
        </div>
      </div>
    </div>

    <div class="card">
      <table class="users-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Activa</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="cat-body"></tbody>
      </table>
    </div>

    ${renderModal()}
  `;
}

function renderModal() {
  return `
    <div id="cat-modal" class="modal" style="display:none">
      <div class="modal-backdrop" data-close="1"></div>
      <div class="modal-card">
        <form id="cat-form" class="modal-body">
          <h3 id="cat-title">Categoría</h3>

          <input type="hidden" id="cat-id">
          <input type="text" id="cat-name" placeholder="Nombre" required>

          <select id="cat-kind">
            <option value="income">Ingreso</option>
            <option value="expense">Egreso</option>
          </select>

          <label>
            <input type="checkbox" id="cat-active" checked>
            Activa
          </label>

          <div id="cat-error" class="error"></div>

          <div class="modal-footer">
            <button type="button" data-close="1">Cancelar</button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/* ---------------- Events ---------------- */

function bindEvents(section) {
  section.addEventListener("click", e => {
    if (e.target?.dataset?.close) closeModal();
  });

  section.querySelector("#cat-new")?.addEventListener("click", () => openModal());
  section.querySelector("#cat-form")?.addEventListener("submit", saveCategory);
}

/* ---------------- Data ---------------- */

async function loadCategories() {
  cachedCategories = await pb.collection("finance_categories").getFullList({
    filter: `church.id="${currentChurchId}"`,
    sort: "sort,name"
  });
}

/* ---------------- Render ---------------- */

function renderTable() {
  const body = document.getElementById("cat-body");
  body.innerHTML = "";

  cachedCategories.forEach(c => {
    body.innerHTML += `
      <tr>
        <td>${c.name}</td>
        <td>${c.kind}</td>
        <td>${c.active ? "Sí" : "No"}</td>
        <td class="row-actions">
          ${can("update", "finance_categories") ? `<button data-edit="${c.id}">Editar</button>` : ""}
          ${can("delete", "finance_categories") ? `<button class="danger-btn" data-del="${c.id}">Eliminar</button>` : ""}
        </td>
      </tr>
    `;
  });

  body.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openModal(b.dataset.edit))
  );

  body.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => deleteCategory(b.dataset.del))
  );
}

/* ---------------- CRUD ---------------- */

function openModal(id = null) {
  document.getElementById("cat-error").textContent = "";
  document.getElementById("cat-form").reset();

  if (id) {
    const c = cachedCategories.find(x => x.id === id);
    document.getElementById("cat-id").value = id;
    document.getElementById("cat-name").value = c.name;
    document.getElementById("cat-kind").value = c.kind;
    document.getElementById("cat-active").checked = c.active;
  } else {
    document.getElementById("cat-id").value = "";
  }

  document.getElementById("cat-modal").style.display = "block";
}

function closeModal() {
  document.getElementById("cat-modal").style.display = "none";
}

async function saveCategory(e) {
  e.preventDefault();

  const id = document.getElementById("cat-id").value;
  const payload = {
    church: [currentChurchId],
    name: document.getElementById("cat-name").value.trim(),
    kind: document.getElementById("cat-kind").value,
    active: document.getElementById("cat-active").checked
  };

  if (id) {
    await pb.collection("finance_categories").update(id, payload);
  } else {
    await pb.collection("finance_categories").create(payload);
  }

  closeModal();
  await loadCategories();
  renderTable();
}

async function deleteCategory(id) {
  const used = await pb.collection("finance_transactions").getFirstListItem(
    `category.id="${id}"`
  ).catch(() => null);

  if (used) {
    alert("No se puede eliminar una categoría con movimientos asociados.");
    return;
  }

  if (!confirm("¿Eliminar categoría?")) return;

  await pb.collection("finance_categories").delete(id);
  await loadCategories();
  renderTable();
}
