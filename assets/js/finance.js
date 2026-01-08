// js/finance.js

import { pb } from "./auth.js";

let currentChurchId = null;

export async function loadFinance(churchId) {
  currentChurchId = churchId;

  const container = document.getElementById("app");
  container.innerHTML = `
    <h2>Finance</h2>

    <div id="finance-summary" style="margin-bottom:20px;"></div>

    <div style="margin-bottom:20px;">
      <button id="add-income">Add Income</button>
      <button id="add-expense">Add Expense</button>
    </div>

    <table border="1" width="100%" cellpadding="6">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Concept</th>
          <th>Amount</th>
          <th>Currency</th>
        </tr>
      </thead>
      <tbody id="finance-list"></tbody>
    </table>
  `;

  document.getElementById("add-income").onclick = () =>
    openTransactionForm("income");
  document.getElementById("add-expense").onclick = () =>
    openTransactionForm("expense");

  await refreshFinance();
}

async function refreshFinance() {
  const transactions = await pb.collection("finance_transactions").getFullList({
    filter: `church = "${currentChurchId}"`,
    sort: "-date",
    expand: "category"
  });

  renderSummary(transactions);
  renderList(transactions);
}

function renderSummary(transactions) {
  let income = 0;
  let expense = 0;

  transactions.forEach(t => {
    if (t.direction === "income") income += t.amount;
    if (t.direction === "expense") expense += t.amount;
  });

  const balance = income - expense;

  document.getElementById("finance-summary").innerHTML = `
    <strong>Income:</strong> ${income.toFixed(2)}<br>
    <strong>Expense:</strong> ${expense.toFixed(2)}<br>
    <strong>Balance:</strong> ${balance.toFixed(2)}
  `;
}

function renderList(transactions) {
  const tbody = document.getElementById("finance-list");
  tbody.innerHTML = "";

  transactions.forEach(t => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.direction}</td>
      <td>${t.expand?.category?.name || "-"}</td>
      <td>${t.concept || ""}</td>
      <td>${t.amount.toFixed(2)}</td>
      <td>${t.currency}</td>
    `;

    tbody.appendChild(tr);
  });
}

async function openTransactionForm(direction) {
  const categories = await pb.collection("finance_categories").getFullList({
    filter: `church = "${currentChurchId}" && direction = "${direction}" && active = true`,
    sort: "order"
  });

  const categoryOptions = categories
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  const formHtml = `
    <div id="finance-modal" style="padding:20px;border:1px solid #333;background:#fff;">
      <h3>Add ${direction}</h3>

      <label>Date</label><br>
      <input type="date" id="f-date"><br><br>

      <label>Category</label><br>
      <select id="f-category">${categoryOptions}</select><br><br>

      <label>Amount</label><br>
      <input type="number" id="f-amount" step="0.01"><br><br>

      <label>Currency</label><br>
      <select id="f-currency">
        <option value="MXN">MXN</option>
        <option value="USD">USD</option>
      </select><br><br>

      <label>Concept</label><br>
      <input type="text" id="f-concept"><br><br>

      <button id="f-save">Save</button>
      <button id="f-cancel">Cancel</button>
    </div>
  `;

  const modal = document.createElement("div");
  modal.innerHTML = formHtml;
  document.body.appendChild(modal);

  document.getElementById("f-cancel").onclick = () => modal.remove();
  document.getElementById("f-save").onclick = async () => {
    await pb.collection("finance_transactions").create({
      church: currentChurchId,
      date: document.getElementById("f-date").value,
      category: document.getElementById("f-category").value,
      amount: parseFloat(document.getElementById("f-amount").value),
      currency: document.getElementById("f-currency").value,
      concept: document.getElementById("f-concept").value,
      direction: direction
    });

    modal.remove();
    await refreshFinance();
  };
}
