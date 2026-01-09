// assets/js/finance_records.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedCategories = [];
let cachedTransactions = [];
let cachedMembers = [];
let cachedMinistries = [];
let cachedEvents = [];

let editingTxId = null;

/* ========================================================= */
/* ENTRY POINT */
/* ========================================================= */

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

  await Promise.all([
    loadCategories(),
    loadMembers(),
    loadMinistries(),
    loadEvents(),
    loadTransactions()
  ]);

  renderCategorySelects();
  renderAuxSelects();
  renderTable();
  renderTotals();
}

/* ========================================================= */
/* DATA LOADERS */
/* ========================================================= */

async function loadCategories() {
  cachedCategories = await pb.collection("finance_categories").getFullList({
    filter: `church.id="${currentChurchId}" && active=true`,
    sort: "sort,name"
  });
}

async function loadMembers() {
  cachedMembers = await pb.collection("members").getFullList({
    filter: `church.id="${currentChurchId}"`,
    sort: "last_name,first_name"
  }).catch(() => []);
}

async function loadMinistries() {
  cachedMinistries = await pb.collection("ministries").getFullList({
    filter: `church.id="${currentChurchId}"`,
    sort: "name"
  }).catch(() => []);
}

async function loadEvents() {
  cachedEvents = await pb.collection("events").getFullList({
    filter: `church.id="${currentChurchId}"`,
    sort: "-date"
  }).catch(() => []);
}

async function loadTransactions() {
  cachedTransactions = await pb.collection("finance_transactions").getFullList({
    filter: `church.id="${currentChurchId}"`,
    expand: "category,member,ministry,event",
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
      <div class="modal-card wide">
        <form id="fin-form" class="modal-body">
          <h3 id="fin-modal-title">Transacción</h3>

          <input type="date" id="fin-date" required>
          <select id="fin-cat" required></select>
          <input type="text" id="fin-concept" placeholder="Concepto" required>
          <input type="number" id="fin-amount" min="0.01" step="0.01" required>

          <select id="fin-currency">
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>

          <select id="fin-method">
            <option value="">Método</option>
            <option value="cash">Efectivo</option>
            <option value="bank">Banco</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="other">Otro</option>
          </select>

          <select id="fin-member"><option value="">Miembro</option></select>
          <select id="fin-ministry"><option value="">Ministerio</option></select>
          <select id="fin-event"><option value="">Evento</option></select>

          <input type="text" id="fin-reference" placeholder="Referencia">
          <textarea id="fin-notes" placeholder="Notas"></textarea>

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
/* SELECT POPULATION */
/* ========================================================= */

function renderCategorySelects() {
  const opts = `<option value="">Todas</option>` +
    cachedCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  fin("fin-cat-filter").innerHTML = opts;
  fin("fin-cat").innerHTML = cachedCategories
    .map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderAuxSelects() {
  fin("fin-member").innerHTML += cachedMembers
    .map(m => `<option value="${m.id}">${m.last_name} ${m.first_name}</option>`).join("");

  fin("fin-ministry").innerHTML += cachedMinistries
    .map(m => `<option value="${m.id}">${m.name}</option>`).join("");

  fin("fin-event").innerHTML += cachedEvents
    .map(e => `<option value="${e.id}">${e.title}</option>`).join("");
}

/* ========================================================= */
/* TABLE & TOTALS (unchanged logic) */
/* ========================================================= */

function renderTable() {
  const body = fin("fin-body");
  body.innerHTML = "";

  if (!cachedTransactions.length) {
    body.innerHTML = `<tr><td colspan="6">Sin movimientos</td></tr>`;
    return;
  }

  cachedTransactions.forEach(r => {
    const sign = r.direction === "expense" ? "-" : "+";
    body.innerHTML += `
      <tr>
        <td>${r.date}</td>
        <td>${r.direction}</td>
        <td>${r.expand?.category?.name || ""}</td>
        <td>${r.concept || ""}</td>
        <td>${sign}${(r.amount_cents / 100).toFixed(2)} ${r.currency}</td>
        <td>
          ${can("update", "finance_transactions") ? `<button data-edit="${r.id}">Editar</button>` : ""}
          ${can("delete", "finance_transactions") ? `<button class="danger-btn" data-del="${r.id}">Eliminar</button>` : ""}
        </td>
      </tr>`;
  });

  body.querySelectorAll("[data-edit]").forEach(b =>
    b.onclick = () => openModal(b.dataset.edit)
  );

  body.querySelectorAll("[data-del]").forEach(b =>
    b.onclick = () => deleteTx(b.dataset.del)
  );
}

function renderTotals() {
  let inc = 0, exp = 0;
  cachedTransactions.forEach(t => {
    if (t.direction === "income") inc += t.amount_cents;
    else exp += t.amount_cents;
  });

  fin("fin-income").textContent = (inc / 100).toFixed(2);
  fin("fin-expense").textContent = (exp / 100).toFixed(2);
  fin("fin-balance").textContent = ((inc - exp) / 100).toFixed(2);
}

/* ========================================================= */
/* CRUD */
/* ========================================================= */

function openModal(id = null) {
  editingTxId = id;
  fin("fin-form").reset();

  if (id) {
    const t = cachedTransactions.find(x => x.id === id);
    fin("fin-date").value = t.date;
    fin("fin-cat").value = t.category;
    fin("fin-concept").value = t.concept || "";
    fin("fin-amount").value = (t.amount_cents / 100).toFixed(2);
    fin("fin-currency").value = t.currency;
    fin("fin-method").value = t.method || "";
    fin("fin-reference").value = t.reference || "";
    fin("fin-notes").value = t.notes || "";
    fin("fin-member").value = t.member || "";
    fin("fin-ministry").value = t.ministry || "";
    fin("fin-event").value = t.event || "";
  }

  fin("fin-modal").style.display = "block";
}

function closeModal() {
  editingTxId = null;
  fin("fin-modal").style.display = "none";
}

async function saveTx(e) {
  e.preventDefault();

  const cat = cachedCategories.find(c => c.id === fin("fin-cat").value);
  const amount = Number(fin("fin-amount").value);

  if (!cat || amount <= 0) return;

  const payload = {
    church: [currentChurchId],
    date: fin("fin-date").value,
    category: [cat.id],
    direction: cat.kind,
    concept: fin("fin-concept").value,
    amount_cents: Math.round(amount * 100),
    currency: fin("fin-currency").value,
    method: fin("fin-method").value || null,
    reference: fin("fin-reference").value || null,
    notes: fin("fin-notes").value || null,
    member: fin("fin-member").value ? [fin("fin-member").value] : null,
    ministry: fin("fin-ministry").value ? [fin("fin-ministry").value] : null,
    event: fin("fin-event").value ? [fin("fin-event").value] : null
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

const fin = id => document.getElementById(id);
