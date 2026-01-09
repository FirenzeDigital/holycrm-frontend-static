// assets/js/finance_transactions.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let currentChurchId = null;

let cachedCategories = [];
let cachedTransactions = [];

let editingTxId = null;

/* ========================================================= */
/* ENTRY POINT */
/* ========================================================= */

export async function initFinanceRecordsView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="finance_transactions"]');
  if (!section) return;

  if (!can("read", "finance_transactions")) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  currentChurchId = church.id;

  if (!section.querySelector("#fin-body")) {
    renderLayout(section);
    wireEvents(section);
  }

  await loadCategories();
  await loadTransactions();

  if (section.querySelector("#fin-body")) {
    renderCategorySelects();
    renderTable();
    renderTotals();
  }
}

/* ========================================================= */
/* DATA */
/* ========================================================= */

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
  section.addEventListener("click", (e) => {
    if (e.target?.dataset?.close === "1") closeModal();
  });

  section.querySelector("#fin-new")?.addEventListener("click", () => openModal());

  section.querySelector("#fin-form")?.addEventListener("submit", saveTx);

  ["fin-from", "fin-to", "fin-cat-filter"].forEach(id => {
    section.querySelector(`#${id}`)?.addEventListener("change", () => {
      renderTable();
      renderTotals();
    });
  });
}

/* ========================================================= */
/* RENDER */
/* ========================================================= */

function renderCategorySelects() {
  const opts =
    `<option value="">Todas</option>` +
    cachedCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  const catFilter = $("#fin-cat-filter");
  const catSelect = $("#fin-cat");

  if (!catFilter || !catSelect) return;

  catFilter.innerHTML = opts;
  catSelect.innerHTML = cachedCategories
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join("");

}

function renderTable() {
  const body = $("#fin-body");
  if (!body) return;
  body.innerHTML = "";

  if (!cachedTransactions.length) {
    body.innerHTML = `<tr><td colspan="6">Sin movimientos</td></tr>`;
    return;
  }

  cachedTransactions.forEach(t => {
    const sign = t.direction === "expense" ? "-" : "+";
    body.innerHTML += `
      <tr>
        <td>${t.date}</td>
        <td>${t.direction}</td>
        <td>${t.expand?.category?.name || ""}</td>
        <td>${t.concept || ""}</td>
        <td>${sign}${(t.amount_cents / 100).toFixed(2)} ${t.currency}</td>
        <td class="row-actions">
          ${can("update", "finance_transactions") ? `<button data-edit="${t.id}">Editar</button>` : ""}
          ${can("delete", "finance_transactions") ? `<button class="danger-btn" data-del="${t.id}">Eliminar</button>` : ""}
        </td>
      </tr>
    `;
  });

  body.querySelectorAll("[data-edit]").forEach(b =>
    b.onclick = () => openModal(b.dataset.edit)
  );

  body.querySelectorAll("[data-del]").forEach(b =>
    b.onclick = () => deleteTx(b.dataset.del)
  );
}

function renderTotals() {
  const incEl = $("#fin-income");
  const expEl = $("#fin-expense");
  const balEl = $("#fin-balance");

  if (!incEl || !expEl || !balEl) return;

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
  const form = $("#fin-form");
  const modal = $("#fin-modal");
  const title = $("#fin-modal-title");

  if (!form || !modal || !title) return;

  editingTxId = id;
  form.reset();
  $("#fin-error").textContent = "";

  if (id) {
    const t = cachedTransactions.find(x => x.id === id);
    $("#fin-modal-title").textContent = "Editar transacción";
    $("#fin-date").value = t.date;
    $("#fin-cat").value = t.category;
    $("#fin-concept").value = t.concept || "";
    $("#fin-amount").value = (t.amount_cents / 100).toFixed(2);
    $("#fin-currency").value = t.currency;
  } else {
    $("#fin-modal-title").textContent = "Nueva transacción";
  }

  $("#fin-modal").style.display = "block";
}

function closeModal() {
  editingTxId = null;
  $("#fin-modal").style.display = "none";
}

async function saveTx(e) {
  e.preventDefault();

  const cat = cachedCategories.find(c => c.id === $("#fin-cat").value);
  const amount = Number($("#fin-amount").value);

  if (!cat || amount <= 0) {
    $("#fin-error").textContent = "Datos inválidos.";
    return;
  }

  const payload = {
    church: [currentChurchId],
    date: $("#fin-date").value,
    category: [cat.id],
    direction: cat.kind,
    concept: $("#fin-concept").value,
    amount_cents: Math.round(amount * 100),
    currency: $("#fin-currency").value
  };

  editingTxId
    ? await pb.collection("finance_transactions").update(editingTxId, payload)
    : await pb.collection("finance_transactions").create(payload);

  closeModal();
  await loadTransactions();
  renderTable();
  renderTotals();
}

async function deleteTx(id) {
  if (!confirm("¿Eliminar movimiento?")) return;
  await pb.collection("finance_transactions").delete(id);
  await loadTransactions();
  renderTable();
  renderTotals();
}

/* ========================================================= */
/* UTIL */
/* ========================================================= */

const $ = id => document.getElementById(id) || null;
