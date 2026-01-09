// assets/js/finance_transactions.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

// Declare currentSection at the module level
let currentSection = null;
let currentChurchId = null;
let cachedCategories = [];
let cachedTransactions = [];
let editingTxId = null;

// Keep your $ function but update it to use currentSection
const $ = (selector) => {
  // Remove any leading #
  const id = selector.replace(/^#+/, '');
  
  if (!id) {
    console.warn("Empty selector passed to $()");
    return null;
  }
  
  const el = currentSection 
    ? currentSection.querySelector(`#${id}`)
    : document.getElementById(id);
    
  if (!el) console.warn(`Element #${id} not found`);
  return el;
};

/* ========================================================= */
/* ENTRY POINT */
/* ========================================================= */

export async function initFinanceRecordsView(church) {
  console.log("initFinanceRecordsView called with church:", church?.id);
  
  if (!church) {
    console.error("No church provided!");
    return;
  }

  const section = document.querySelector('section[data-view="finance_transactions"]');
  console.log("Section found:", !!section);
  
  if (!section) return;

  // Set currentSection at the module level
  currentSection = section;

  // Check permissions
  const hasPermission = can("read", "finance_transactions");
  console.log("Has permission for finance_transactions:", hasPermission);
  
  if (!hasPermission) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  currentChurchId = church.id;
  console.log("Current church ID:", currentChurchId);

  if (!section.querySelector("#fin-body")) {
    renderLayout(section);
  }
  wireEvents(section);

  await loadCategories();
  await loadTransactions();

  if (section.querySelector("#fin-body")) {
    console.log("#fin-body exists after render");
    renderCategorySelects();
    renderTable();
    renderTotals();
  } else {
    console.error("#fin-body NOT found after render!");
  }
}

/* ========================================================= */
/* DATA */
/* ========================================================= */

async function loadCategories() {
  try {
    cachedCategories = await pb.collection("finance_categories").getFullList({
      filter: `church="${currentChurchId}" && active=true`,
      sort: "sort,name"
    });
    console.log(`Loaded ${cachedCategories.length} categories`);
  } catch (error) {
    console.error("Error loading categories:", error);
    cachedCategories = [];
  }
}

async function loadTransactions() {
  console.log("Loading transactions for church:", currentChurchId);
  
  try {
    cachedTransactions = await pb.collection("finance_transactions").getFullList({
      filter: `church.id="${currentChurchId}"`,
      expand: "category",
      sort: "-date"
    });
    
    console.log(`Loaded ${cachedTransactions.length} transactions`);
    console.log("Sample transaction:", cachedTransactions[0]);
    
    // Check if expand worked
    if (cachedTransactions.length > 0) {
      console.log("Expand category:", cachedTransactions[0].expand?.category);
    }
  } catch (error) {
    console.error("Error loading transactions:", error);
    cachedTransactions = [];
  }
}

/* ========================================================= */
/* LAYOUT */
/* ========================================================= */

function renderLayout(section) {
  section.innerHTML = `
    <h1>Movimientos</h1>

    <div class="dashboard-grid">
      <div class="card dash-card">
        <h3>Ingresos</h3>
        <div class="dash-metric" id="fin-income">0</div>
      </div>
      <div class="card dash-card">
        <h3>Egresos</h3>
        <div class="dash-metric" id="fin-expense">0</div>
      </div>
      <div class="card dash-card">
        <h3>Balance</h3>
        <div class="dash-metric" id="fin-balance">0</div>
      </div>
    </div>

    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="date" id="fin-from">
          <input type="date" id="fin-to">
          <select id="fin-cat-filter"></select>
        </div>
        <div class="members-actions">
          ${can("create", "finance_transactions") ? `<button id="fin-new">Nuevo</button>` : ""}
        </div>
      </div>
    </div>

    <div class="card">
      <table class="users-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Concepto</th>
            <th>Monto</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="fin-body"></tbody>
      </table>
    </div>

    ${renderModal()}
  `;
}

function renderModal() {
  return `
    <div id="fin-modal" class="modal" style="display:none">
      <div class="modal-backdrop" data-close="1"></div>
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="fin-modal-title">Transacción</h3>
          <button type="button" class="modal-close" data-close="1">×</button>
        </div>

        <form id="fin-form" class="modal-body">
          <div class="field">
            <span>Fecha</span>
            <input type="date" id="fin-date" required>
          </div>

          <div class="field">
            <span>Categoría</span>
            <select id="fin-cat" required></select>
          </div>

          <div class="field">
            <span>Concepto</span>
            <input type="text" id="fin-concept" required>
          </div>

          <div class="field">
            <span>Monto</span>
            <input type="number" id="fin-amount" min="0.01" step="0.01" required>
          </div>

          <div class="field">
            <span>Moneda</span>
            <select id="fin-currency">
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div id="fin-error" class="error"></div>

          <div class="modal-footer">
            <button type="button" data-close="1">Cancelar</button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/* ========================================================= */
/* EVENTS */
/* ========================================================= */

function wireEvents(section) {
  console.log("Wiring events for finance section");
  
  const newButton = section.querySelector("#fin-new");
  console.log("New button found:", !!newButton);
  
  if (newButton) {
    newButton.addEventListener("click", () => {
      console.log("New button clicked!");
      openModal();
    });
  }
  
  section.addEventListener("click", (e) => {
    if (e.target?.dataset?.close === "1") closeModal();
  });

  const form = section.querySelector("#fin-form");
  if (form) {
    form.addEventListener("submit", saveTx);
  }

  ["fin-from", "fin-to", "fin-cat-filter"].forEach(id => {
    const element = section.querySelector(`#${id}`);
    if (element) {
      element.addEventListener("change", () => {
        renderTable();
        renderTotals();
      });
    }
  });
}

/* ========================================================= */
/* RENDER */
/* ========================================================= */

function renderCategorySelects() {
  const opts =
    `<option value="">Todas</option>` +
    cachedCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  const catFilter = $("fin-cat-filter");
  const catSelect = $("fin-cat");

  if (!catFilter || !catSelect) {
    console.error("Category filter or select not found");
    return;
  }

  catFilter.innerHTML = opts;
  catSelect.innerHTML = cachedCategories
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join("");
}

function renderTable() {
  const body = $("fin-body");
  if (!body) {
    console.error("#fin-body not found");
    return;
  }
  
  body.innerHTML = "";

  if (!cachedTransactions.length) {
    body.innerHTML = `<tr><td colspan="6">Sin movimientos</td></tr>`;
    return;
  }

  cachedTransactions.forEach(t => {
    const sign = t.direction === "expense" ? "-" : "+";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${t.date.split(' ')[0] || t.date}</td>
      <td>${t.direction === "income" ? "Ingreso" : "Egreso"}</td>
      <td>${t.expand?.category?.name || ""}</td>
      <td>${t.concept || ""}</td>
      <td>${sign}${(t.amount_cents / 100).toFixed(2)} ${t.currency}</td>
      <td class="row-actions">
        ${can("update", "finance_transactions") ? `<button data-edit="${t.id}">Editar</button>` : ""}
        ${can("delete", "finance_transactions") ? `<button class="danger-btn" data-del="${t.id}">Eliminar</button>` : ""}
      </td>
    `;
    body.appendChild(row);
  });

  // Attach event listeners
  body.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => openModal(b.dataset.edit));
  });

  body.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => deleteTx(b.dataset.del));
  });
}

function renderTotals() {
  const incEl = $("fin-income");
  const expEl = $("fin-expense");
  const balEl = $("fin-balance");

  if (!incEl || !expEl || !balEl) {
    console.error("Total elements not found");
    return;
  }

  let inc = 0, exp = 0;
  cachedTransactions.forEach(t => {
    t.direction === "income" ? inc += t.amount_cents : exp += t.amount_cents;
  });

  incEl.textContent = (inc / 100).toFixed(2);
  expEl.textContent = (exp / 100).toFixed(2);
  balEl.textContent = ((inc - exp) / 100).toFixed(2);
}

/* ========================================================= */
/* CRUD */
/* ========================================================= */

function openModal(id = null) {
  if (!currentSection) {
    console.error("currentSection is not defined!");
    return;
  }
  
  const form = $("fin-form");
  const modal = $("fin-modal");
  const title = $("fin-modal-title");

  if (!form || !modal || !title) {
    console.error("Modal elements not found");
    return;
  }

  editingTxId = id;
  form.reset();
  const errorEl = $("fin-error");
  if (errorEl) errorEl.textContent = "";

  if (id) {
    const t = cachedTransactions.find(x => x.id === id);
    title.textContent = "Editar transacción";
    $("fin-date").value = t.date.split('T')[0]; // Format for date input
    $("fin-cat").value = t.category;
    $("fin-concept").value = t.concept || "";
    $("fin-amount").value = (t.amount_cents / 100).toFixed(2);
    $("fin-currency").value = t.currency;
  } else {
    title.textContent = "Nueva transacción";
    // Set today's date as default
    $("fin-date").value = new Date().toISOString().split('T')[0];
  }

  modal.style.display = "block";
}

function closeModal() {
  const modal = $("fin-modal");
  if (modal) {
    modal.style.display = "none";
  }
  editingTxId = null;
}

async function saveTx(e) {
  e.preventDefault();

  const cat = cachedCategories.find(c => c.id === $("fin-cat").value);
  const amount = Number($("fin-amount").value);
  const date = $("fin-date").value;
  const concept = $("fin-concept").value.trim();

  if (!cat) {
    $("fin-error").textContent = "Selecciona una categoría.";
    return;
  }
  
  if (amount <= 0) {
    $("fin-error").textContent = "Monto debe ser mayor a 0.";
    return;
  }
  
  if (!date) {
    $("fin-error").textContent = "Fecha es requerida.";
    return;
  }
  
  if (!concept) {
    $("fin-error").textContent = "Concepto es requerido.";
    return;
  }

  const payload = {
    church: currentChurchId,
    date: date,
    category: cat.id,
    direction: cat.kind,
    concept: concept,
    amount_cents: Math.round(amount * 100),
    currency: $("fin-currency").value
  };

  console.log("Saving transaction:", payload);

  try {
    if (editingTxId) {
      await pb.collection("finance_transactions").update(editingTxId, payload);
    } else {
      await pb.collection("finance_transactions").create(payload);
    }

    closeModal();
    await loadTransactions();
    renderTable();
    renderTotals();
  } catch (error) {
    console.error("Error saving transaction:", error);
    $("fin-error").textContent = error.message || "Error al guardar";
  }
}

async function deleteTx(id) {
  if (!confirm("¿Eliminar movimiento?")) return;
  
  try {
    await pb.collection("finance_transactions").delete(id);
    await loadTransactions();
    renderTable();
    renderTotals();
  } catch (error) {
    console.error("Error deleting transaction:", error);
    alert("Error al eliminar: " + error.message);
  }
}