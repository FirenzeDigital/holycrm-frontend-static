// assets/js/finance.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedCategories = [];

export async function initFinanceView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="finance"]');
  if (!section) return;

  // Permissions gate
  if (!(can("read", "finance_categories") || can("read", "finance_transactions") || can("read", "finance"))) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a este módulo.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "finance_categories");
  const canUpdate = can("update", "finance_categories");
  const canDelete = can("delete", "finance_categories");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Finanzas</h1>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search">
            <input id="finance-categories-search" type="text" placeholder="Buscar categoría..." />
          </div>

          <div class="members-actions">
            <button id="finance-categories-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="finance-categories-new" type="button">Nueva categoría</button>` : ""}
          </div>
        </div>

        <div id="finance-categories-error" class="error"></div>
        <div id="finance-categories-success" class="success"></div>
      </div>

      <div class="card">
        <h2 id="finance-categories-title"></h2>
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Activa</th>
                <th>Orden</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="finance-categories-tbody">
              <tr><td colspan="5">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Category modal -->
      <div id="finance-category-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="finance-category-modal-title">Categoría</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="finance-category-form" class="modal-body">
            <input type="hidden" id="finance-category-id" />

            <div class="field">
              <span>Nombre</span>
              <input type="text" id="finance-category-name" required />
            </div>

            <div class="field">
              <span>Tipo</span>
              <select id="finance-category-kind">
                <option value="income">income</option>
                <option value="expense">expense</option>
              </select>
            </div>

            <div class="field">
              <span>Activa</span>
              <input type="checkbox" id="finance-category-active" checked />
            </div>

            <div class="field">
              <span>Orden</span>
              <input type="number" id="finance-category-sort" placeholder="0" />
            </div>

            <div id="finance-category-form-error" class="error"></div>

            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    section.dataset.financeCategoriesCanCreate = canCreate ? "1" : "0";
    section.dataset.financeCategoriesCanUpdate = canUpdate ? "1" : "0";
    section.dataset.financeCategoriesCanDelete = canDelete ? "1" : "0";

    section.querySelector("#finance-categories-reload").addEventListener("click", async () => {
      await loadCategories();
      renderCategoriesTable();
    });

    section.querySelector("#finance-categories-search").addEventListener("input", () => {
      renderCategoriesTable();
    });

    if (canCreate) {
      section.querySelector("#finance-categories-new").addEventListener("click", () => {
        openCategoryModal({ mode: "create" });
      });
    }

    section.querySelector("#finance-category-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeCategoryModal();
    });

    section.querySelector("#finance-category-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveCategory();
    });
  }

  const title = document.getElementById("finance-categories-title");
  if (title) title.textContent = `Categorías — ${church.name}`;

  await loadCategories();
  renderCategoriesTable();
}

/* ---------------- Loaders ---------------- */

async function loadCategories() {
  setText("finance-categories-error", "");
  setText("finance-categories-success", "");
  setTableLoading("finance-categories-tbody", 5);

  try {
    cachedCategories = await pb.collection("finance_categories").getFullList({
      filter: `church.id = "${currentChurchId}"`,
      sort: "sort,name",
    });
  } catch (err) {
    console.error("Error cargando finance_categories:", err);
    cachedCategories = [];
    setText("finance-categories-error", humanizePbError(err) || "Error cargando categorías.");
  }
}

/* ---------------- Render ---------------- */

function renderCategoriesTable() {
  const tbody = document.getElementById("finance-categories-tbody");
  const section = document.querySelector('section[data-view="finance"]');
  if (!tbody || !section) return;

  const canUpdate = section.dataset.financeCategoriesCanUpdate === "1";
  const canDelete = section.dataset.financeCategoriesCanDelete === "1";

  const q = (document.getElementById("finance-categories-search")?.value || "")
    .trim()
    .toLowerCase();

  const filtered = !q
    ? cachedCategories
    : cachedCategories.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const kind = String(c.kind || "").toLowerCase();
        return name.includes(q) || kind.includes(q);
      });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay categorías.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const cat of filtered) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Nombre">${escapeHtml(cat.name || "")}</td>
      <td data-label="Tipo">${escapeHtml(cat.kind || "")}</td>
      <td data-label="Activa">${cat.active ? "Sí" : "No"}</td>
      <td data-label="Orden">${escapeHtml(String(cat.sort ?? ""))}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actions = tr.querySelector(".row-actions");

    if (canUpdate) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openCategoryModal({ mode: "edit", record: cat }));
      actions.appendChild(editBtn);
    }

    if (canDelete) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Eliminar";
      delBtn.className = "danger-btn";
      delBtn.addEventListener("click", async () => {
        const ok = confirm(`¿Eliminar categoría "${cat.name || ""}"?`);
        if (!ok) return;
        await deleteCategory(cat.id);
      });
      actions.appendChild(delBtn);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- CRUD ---------------- */

function openCategoryModal({ mode, record }) {
  const section = document.querySelector('section[data-view="finance"]');
  if (!section) return;

  const canCreate = section.dataset.financeCategoriesCanCreate === "1";
  const canUpdate = section.dataset.financeCategoriesCanUpdate === "1";
  if (mode === "create" && !canCreate) return;
  if (mode === "edit" && !canUpdate) return;

  setText("finance-category-form-error", "");

  document.getElementById("finance-category-id").value = record?.id || "";
  document.getElementById("finance-category-name").value = record?.name || "";
  document.getElementById("finance-category-kind").value = record?.kind || "expense";
  document.getElementById("finance-category-active").checked = record?.active !== false; // default true
  document.getElementById("finance-category-sort").value =
    record?.sort === 0 || record?.sort ? String(record.sort) : "";

  document.getElementById("finance-category-modal-title").textContent =
    mode === "create" ? "Nueva categoría" : "Editar categoría";

  document.getElementById("finance-category-modal").style.display = "block";
}

function closeCategoryModal() {
  const modal = document.getElementById("finance-category-modal");
  if (modal) modal.style.display = "none";
}

async function saveCategory() {
  setText("finance-category-form-error", "");
  setText("finance-categories-error", "");
  setText("finance-categories-success", "");

  const id = document.getElementById("finance-category-id").value.trim();
  const name = document.getElementById("finance-category-name").value.trim();
  const kind = document.getElementById("finance-category-kind").value;
  const active = !!document.getElementById("finance-category-active").checked;
  const sortRaw = (document.getElementById("finance-category-sort").value || "").trim();

  if (!name) return setText("finance-category-form-error", "Nombre es obligatorio.");

  const sort = sortRaw === "" ? null : Number(sortRaw);
  if (sortRaw !== "" && Number.isNaN(sort)) {
    return setText("finance-category-form-error", "Orden debe ser un número.");
  }

  const payload = {
    name,
    kind,
    active,
    sort,
  };

  try {
    if (!id) {
      await pb.collection("finance_categories").create({
        church: currentChurchId,
        ...payload,
      });
      setText("finance-categories-success", "Categoría creada.");
    } else {
      await pb.collection("finance_categories").update(id, payload);
      setText("finance-categories-success", "Categoría actualizada.");
    }

    closeCategoryModal();
    await loadCategories();
    renderCategoriesTable();
  } catch (err) {
    console.error("Error guardando finance_category:", err);
    setText("finance-category-form-error", humanizePbError(err) || "Error guardando categoría.");
  }
}

async function deleteCategory(id) {
  setText("finance-categories-error", "");
  setText("finance-categories-success", "");

  try {
    await pb.collection("finance_categories").delete(id);
    setText("finance-categories-success", "Categoría eliminada.");
    await loadCategories();
    renderCategoriesTable();
  } catch (err) {
    console.error("Error eliminando finance_category:", err);
    setText("finance-categories-error", humanizePbError(err) || "Error eliminando categoría.");
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
