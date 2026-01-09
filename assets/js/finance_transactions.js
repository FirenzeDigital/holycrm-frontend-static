// assets/js/finance_transactions.js (REFACTORED)
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let transactionsService, categoriesService;
let table, modal;

export async function initFinanceRecordsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // 1. Initialize services
  transactionsService = new DataService('finance_transactions');
  categoriesService = new DataService('finance_categories');

  // 2. Check permissions
  const section = document.querySelector('section[data-view="finance_transactions"]');
  if (!can("read", "finance_transactions")) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  // 3. Render basic layout once
  if (!section.querySelector("#fin-body")) {
    renderLayout(section);
  }

  // 4. Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  // Load categories for dropdown
  const categories = await categoriesService.getList(currentChurchId, '', 'name');
  
  // Configure and create table
  table = new CrudTable({
    container: '#fin-body',
    columns: [
      { key: 'date', label: 'Fecha', format: val => val.split('T')[0] },
      { key: 'direction', label: 'Tipo', format: val => val === 'income' ? 'Ingreso' : 'Egreso' },
      { key: 'expand.category.name', label: 'Categoría' },
      { key: 'concept', label: 'Concepto' },
      { key: 'amount_cents', label: 'Monto', format: (val, item) => 
        `${item.direction === 'expense' ? '-' : ''}${(val/100).toFixed(2)} ${item.currency}` }
    ],
    canEdit: can("update", "finance_transactions"),
    canDelete: can("delete", "finance_transactions"),
    onEdit: openTransactionModal,
    onDelete: deleteTransaction
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'fin-modal',
    title: 'Transacción',
    fields: [
      { name: 'date', label: 'Fecha', type: 'date', required: true },
      { name: 'category', label: 'Categoría', type: 'select', required: true,
        options: categories.map(c => ({ value: c.id, label: c.name })) },
      { name: 'concept', label: 'Concepto', type: 'text', required: true },
      { name: 'amount', label: 'Monto', type: 'number', step: '0.01', required: true },
      { name: 'currency', label: 'Moneda', type: 'select', required: true,
        options: [{value:'MXN',label:'MXN'}, {value:'USD',label:'USD'}] }
    ],
    onSubmit: saveTransaction
  });

  // Wire up the "New" button
  document.getElementById('fin-new')?.addEventListener('click', () => openTransactionModal());
}

async function refreshData() {
  const transactions = await transactionsService.getList(currentChurchId, 'category');
  table.render(transactions);
  renderTotals(transactions);
}

async function openTransactionModal(id = null) {
  if (id) {
    const transaction = await transactionsService.getOne(id, 'category');
    const data = {
      ...transaction,
      amount: transaction.amount_cents / 100,
      category: transaction.category
    };
    modal.open(data);
  } else {
    modal.open({ date: new Date().toISOString().split('T')[0], currency: 'MXN' });
  }
}

async function saveTransaction(data, id = null) {
  const payload = {
    ...data,
    church: currentChurchId,
    amount_cents: Math.round(data.amount * 100),
    direction: 'income' // This should come from category - you'd need to map it
  };

  if (id) {
    await transactionsService.update(id, payload);
  } else {
    await transactionsService.create(payload);
  }
  
  await refreshData();
}

async function deleteTransaction(id) {
  await transactionsService.delete(id);
  await refreshData();
}

function renderLayout(section) {
  section.innerHTML = `
    <h1>Movimientos</h1>
    <!-- Dashboard cards -->
    <div class="dashboard-grid">
      <div class="card dash-card"><h3>Ingresos</h3><div id="fin-income">0</div></div>
      <div class="card dash-card"><h3>Egresos</h3><div id="fin-expense">0</div></div>
      <div class="card dash-card"><h3>Balance</h3><div id="fin-balance">0</div></div>
    </div>
    
    <!-- Toolbar -->
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
    
    <!-- Table -->
    <div class="card">
      <table class="users-table">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th>Monto</th><th></th></tr></thead>
        <tbody id="fin-body"></tbody>
      </table>
    </div>
  `;
}

function renderTotals(transactions) {
  const totals = transactions.reduce((acc, t) => {
    acc[t.direction] += t.amount_cents;
    return acc;
  }, { income: 0, expense: 0 });
  
  document.getElementById('fin-income').textContent = (totals.income / 100).toFixed(2);
  document.getElementById('fin-expense').textContent = (totals.expense / 100).toFixed(2);
  document.getElementById('fin-balance').textContent = ((totals.income - totals.expense) / 100).toFixed(2);
}