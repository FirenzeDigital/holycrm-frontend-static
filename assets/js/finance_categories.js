// assets/js/finance.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";


/* ------------------------------------------------------------------ */
/* State */
/* ------------------------------------------------------------------ */

let initialized = false;
let currentChurchId = null;

let cachedCategories = [];
let cachedTransactions = [];

/* ------------------------------------------------------------------ */
/* PUBLIC ENTRY POINT — DO NOT BREAK */
/* ------------------------------------------------------------------ */

export async function initFinanceCategoriesView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="finance_categories"]');
  if (!section) return;

  if (
    !(
      can("read", "finance_categories") ||
      can("read", "finance_transactions")
    )
  ) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a Finanzas.</p>`;
    return;
  }

  currentChurchId = church.id;

  if (!initialized) {
    initialized = true;
    renderBaseLayout(section);
    bindStaticEvents(section);
  }

  await loadCategories();
  await loadTransactions();

  renderCategoriesSelect();
  renderTransactionsTable();
  renderTotals();
}

/* ------------------------------------------------------------------ */
/* Layout */
/* ------------------------------------------------------------------ */

function renderBaseLayout(section) {
  section.innerHTML = `
    <h1>Finanzas</h1>

    <!-- Summary -->
    <div class="dashboard-grid">
      <div class="card dash-card">
        <h3>Ingresos</h3>
        <div class="dash-metric" id="fin-total-income">—</div>
      </div>
      <div class="card dash-card">
        <h3>Egresos</h3>
        <div class="dash-metric" id="fin-total-expense">—</div>
      </div>
      <div class="card dash-card">
        <h3>Balance</h3>
        <div class="dash-metric" id="fin-balance">—</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="date" id="fin-from" />
          <input type="date" id="fin-to" />
          <select id="fin-category-filter">
            <option value="">Todas las categorías</option>
          </select>
        </div>

        <div class="members-actions">
          ${
            can("create", "finance_transactions")
              ? `<button id="fin-new-tx">Nueva transacción</button>`
              : ""
          }
        </div>
      </div>
    </div>

    <!-- Transactions -->
    <div class="card">
      <div class="table-wrap">
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
          <tbody id="fin-tx-tbody">
            <tr><td colspan="6">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Transaction modal -->
    <div id="fin-tx-modal" class="modal" style="display:none">
      <div class="modal-backdrop" data-close="1"></div>
      <div class="modal-card">
        <div class="modal-header">
          <h3>Nueva transacción</h3>
          <button class="modal-close" data-close="1">×</button>
        </div>

        <form id="fin-tx-form" class="modal-body">
          <div class="field">
            <span>Fecha</span>
            <input type="date" id="fin-tx-date" required />
          </div>

          <div class="field">
            <span>Categoría</span>
            <select id="fin-tx-category" required></select>
          </div>

          <div class="field">
            <span>Concepto</span>
            <input type="text" id="fin-tx-concept" required />
          </div>

          <div class="field">
            <span>Monto</span>
            <input type="number" id="fin-tx-amount" min="0.01" step="0.01" required />
          </div>

          <div class="field">
            <span>Moneda</span>
            <select id="fin-tx-currency">
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div id="fin-tx-error" class="error"></div>

          <div class="modal-footer">
            <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Events */
/* ------------------------------------------------------------------ */

function bindStaticEvents(section) {
  section.addEventListener("click", (e) => {
    if (e.target?.dataset?.close === "1") {
      closeTxModal();
    }
  });

  section.querySelector("#fin-new-tx")?.addEventListener("click", openTxModal);

  section.querySelector("#fin-tx-form")?.addEventListener("submit", saveTransaction);

  ["fin-from", "fin-to", "fin-category-filter"].forEach((id) => {
    section.querySelector(`#${id}`)?.addEventListener("change", () => {
      renderTransactionsTable();
      renderTotals();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Loaders */
/* ------------------------------------------------------------------ */

async function loadCategories() {
  cachedCategories = await pb.collection("finance_categories").getFullList({
    filter: `church.id = "${currentChurchId}" && active = true`,
    sort: "sort,name",
  });
}

async function loadTransactions() {
  cachedTransactions = await pb.collection("finance_transactions").getFullList({
    filter: `church.id = "${currentChurchId}"`,
    sort: "-date",
    expand: "category",
  });
}

/* ------------------------------------------------------------------ */
/* Render */
/* ------------------------------------------------------------------ */

function renderCategoriesSelect() {
  const sel1 = document.getElementById("fin-category-filter");
  const sel2 = document.getElementById("fin-tx-category");

  if (!sel1 || !sel2) return;

  const opts = cachedCategories.map(
    (c) => `<option value="${c.id}">${c.name}</option>`
  );

  sel1.innerHTML = `<option value="">Todas</option>` + opts.join("");
  sel2.innerHTML = opts.join("");
}

function renderTransactionsTable() {
  const tbody = document.getElementById("fin-tx-tbody");
  if (!tbody) return;

  const from = document.getElementById("fin-from")?.value;
  const to = document.getElementById("fin-to")?.value;
  const cat = document.getElementById("fin-category-filter")?.value;

  let rows = cachedTransactions;

  if (from) rows = rows.filter((t) => t.date >= from);
  if (to) rows = rows.filter((t) => t.date <= to);
  if (cat) rows = rows.filter((t) => t.category === cat);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">Sin movimientos.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const t of rows) {
    const tr = document.createElement("tr");

    const sign = t.direction === "expense" ? "-" : "+";

    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.direction}</td>
      <td>${t.expand?.category?.name || ""}</td>
      <td>${escapeHtml(t.concept || "")}</td>
      <td>${sign}${t.amount} ${t.currency}</td>
      <td></td>
    `;

    tbody.appendChild(tr);
  }
}

function renderTotals() {
  let income = 0;
  let expense = 0;

  const from = document.getElementById("fin-from")?.value;
  const to = document.getElementById("fin-to")?.value;
  const cat = document.getElementById("fin-category-filter")?.value;

  let rows = cachedTransactions;
  if (from) rows = rows.filter((t) => t.date >= from);
  if (to) rows = rows.filter((t) => t.date <= to);
  if (cat) rows = rows.filter((t) => t.category === cat);

  for (const t of rows) {
    if (t.direction === "income") income += t.amount;
    else expense += t.amount;
  }

  document.getElementById("fin-total-income").textContent = income.toFixed(2);
  document.getElementById("fin-total-expense").textContent = expense.toFixed(2);
  document.getElementById("fin-balance").textContent = (income - expense).toFixed(2);
}

/* ------------------------------------------------------------------ */
/* Transactions CRUD */
/* ------------------------------------------------------------------ */

function openTxModal() {
  document.getElementById("fin-tx-error").textContent = "";
  document.getElementById("fin-tx-form").reset();
  document.getElementById("fin-tx-modal").style.display = "block";
}

function closeTxModal() {
  document.getElementById("fin-tx-modal").style.display = "none";
}

async function saveTransaction(e) {
  e.preventDefault();

  const date = document.getElementById("fin-tx-date").value;
  const categoryId = document.getElementById("fin-tx-category").value;
  const concept = document.getElementById("fin-tx-concept").value.trim();
  const amount = Number(document.getElementById("fin-tx-amount").value);
  const currency = document.getElementById("fin-tx-currency").value;

  const category = cachedCategories.find((c) => c.id === categoryId);
  if (!category) return;

  try {
    await pb.collection("finance_transactions").create({
      church: currentChurchId,
      date,
      amount,
      currency,
      category: categoryId,
      direction: category.kind,
      concept,
    });

    closeTxModal();
    await loadTransactions();
    renderTransactionsTable();
    renderTotals();
  } catch (err) {
    document.getElementById("fin-tx-error").textContent =
      err?.message || "Error guardando transacción.";
  }
}

/* ------------------------------------------------------------------ */
/* Utils */
/* ------------------------------------------------------------------ */

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
