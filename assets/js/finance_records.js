import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;
let cachedCategories = [];
let cachedTransactions = [];

export async function initFinanceRecordsView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="finance_records"]');
  if (!section) return;

  if (!can("read", "finance_transactions")) {
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
  await loadTransactions();

  renderCategorySelects();
  renderTable();
  renderTotals();
}

/* ---------------- Layout ---------------- */

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
        <form id="fin-form" class="modal-body">
          <h3>Nueva transacción</h3>

          <input type="date" id="fin-date" required>
          <select id="fin-cat" required></select>
          <input type="text" id="fin-concept" placeholder="Concepto" required>
          <input type="number" id="fin-amount" min="0.01" step="0.01" required>

          <select id="fin-currency">
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>

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

/* ---------------- Events ---------------- */

function bindEvents(section) {
  section.addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });

  section.querySelector("#fin-new")?.addEventListener("click", openModal);
  section.querySelector("#fin-form")?.addEventListener("submit", saveTx);

  ["fin-from", "fin-to", "fin-cat-filter"].forEach((id) => {
    section.querySelector(`#${id}`)?.addEventListener("change", () => {
      renderTable();
      renderTotals();
    });
  });
}

/* ---------------- Data ---------------- */

async function loadCategories() {
  cachedCategories = await pb.collection("finance_categories").getFullList({
    filter: `church.id="${currentChurchId}" && active=true`,
    sort: "sort,name"
  });
}

async function loadTransactions() {
  cachedTransactions = await pb.collection("finance_transactions").getFullList({
    filter: `church.id="${currentChurchId}"`,
    expand: "category",
    sort: "-date"
  });
}

/* ---------------- Render ---------------- */

function renderCategorySelects() {
  const opts = `<option value="">Todas</option>` +
    cachedCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  document.getElementById("fin-cat-filter").innerHTML = opts;
  document.getElementById("fin-cat").innerHTML =
    cachedCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderTable() {
  const body = document.getElementById("fin-body");
  body.innerHTML = "";

  const from = document.getElementById("fin-from").value;
  const to = document.getElementById("fin-to").value;
  const cat = document.getElementById("fin-cat-filter").value;

  let rows = cachedTransactions;
  if (from) rows = rows.filter(r => r.date >= from);
  if (to) rows = rows.filter(r => r.date <= to);
  if (cat) rows = rows.filter(r => r.category === cat);

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5">Sin movimientos</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const sign = r.direction === "expense" ? "-" : "+";
    body.innerHTML += `
      <tr>
        <td>${r.date}</td>
        <td>${r.direction}</td>
        <td>${r.expand?.category?.name || ""}</td>
        <td>${r.concept}</td>
        <td>${sign}${r.amount} ${r.currency}</td>
      </tr>
    `;
  });
}

function renderTotals() {
  let inc = 0, exp = 0;

  cachedTransactions.forEach(t => {
    if (t.direction === "income") inc += t.amount;
    else exp += t.amount;
  });

  document.getElementById("fin-income").textContent = inc.toFixed(2);
  document.getElementById("fin-expense").textContent = exp.toFixed(2);
  document.getElementById("fin-balance").textContent = (inc - exp).toFixed(2);
}

/* ---------------- CRUD ---------------- */

function openModal() {
  document.getElementById("fin-error").textContent = "";
  document.getElementById("fin-form").reset();
  document.getElementById("fin-modal").style.display = "block";
}

function closeModal() {
  document.getElementById("fin-modal").style.display = "none";
}

async function saveTx(e) {
  e.preventDefault();

  const catId = document.getElementById("fin-cat").value;
  const cat = cachedCategories.find(c => c.id === catId);
  if (!cat) return;

  await pb.collection("finance_transactions").create({
    church: currentChurchId,
    date: document.getElementById("fin-date").value,
    category: catId,
    direction: cat.kind,
    concept: document.getElementById("fin-concept").value,
    amount: Number(document.getElementById("fin-amount").value),
    currency: document.getElementById("fin-currency").value
  });

  closeModal();
  await loadTransactions();
  renderTable();
  renderTotals();
}
