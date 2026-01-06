// assets/js/finance.js
import { pb } from "./auth.js";
import { can } from "./permissions.js";

let initialized = false;
let currentChurchId = null;

let cachedCategories = [];
let cachedTx = [];

export async function initFinanceView(church) {
  if (!church) return;

  const section = document.querySelector('section[data-view="finance"]');
  if (!section) return;

  if (!can("read", "finance_transactions")) {
    section.innerHTML = `<h1>Sin permisos</h1><p>No tenés acceso a Finanzas.</p>`;
    return;
  }

  currentChurchId = church.id;

  const canCreate = can("create", "finance_transactions");
  const canUpdate = can("update", "finance_transactions");
  const canDelete = can("delete", "finance_transactions");

  if (!initialized) {
    initialized = true;

    section.innerHTML = `
      <h1>Finanzas</h1>

      <div class="dashboard-grid" style="margin-bottom:12px">
        <div class="card dash-card">
          <h3>Ingresos (período)</h3>
          <div class="dash-metric" id="fin-income">—</div>
        </div>
        <div class="card dash-card">
          <h3>Gastos (período)</h3>
          <div class="dash-metric" id="fin-expense">—</div>
        </div>
        <div class="card dash-card">
          <h3>Balance (período)</h3>
          <div class="dash-metric" id="fin-balance">—</div>
        </div>
      </div>

      <div class="card">
        <div class="members-toolbar">
          <div class="members-search" style="gap:8px;display:flex;flex-wrap:wrap">
            <select id="fin-period">
              <option value="this_month">Este mes</option>
              <option value="last_month">Mes anterior</option>
              <option value="this_year">Este año</option>
              <option value="all">Todo</option>
            </select>

            <select id="fin-kind">
              <option value="">(Ingresos + Gastos)</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>

            <select id="fin-category">
              <option value="">(Todas las categorías)</option>
            </select>

            <input id="fin-search" type="text" placeholder="Buscar (nota, ref, categoría)..." />
          </div>

          <div class="members-actions">
            <button id="fin-reload" type="button">Recargar</button>
            ${canCreate ? `<button id="fin-new" type="button">Nuevo movimiento</button>` : ""}
          </div>
        </div>

        <div id="fin-error" class="error"></div>
        <div id="fin-success" class="success"></div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Monto</th>
                <th>Ref</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="fin-tbody">
              <tr><td colspan="7">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal -->
      <div id="fin-modal" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="fin-modal-title">Movimiento</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>

          <form id="fin-form" class="modal-body">
            <input type="hidden" id="fin-id" />

            <div class="field">
              <span>Fecha</span>
              <input type="date" id="fin-date" required />
            </div>

            <div class="field">
              <span>Tipo</span>
              <select id="fin-kind-edit" required>
                <option value="income">income</option>
                <option value="expense">expense</option>
              </select>
            </div>

            <div class="field">
              <span>Categoría</span>
              <select id="fin-category-edit">
                <option value="">(sin categoría)</option>
              </select>
            </div>

            <div class="field">
              <span>Monto</span>
              <input type="number" id="fin-amount" step="0.01" placeholder="Ej: 1250.50" required />
              <div class="muted">Se guarda como centavos (amount_cents).</div>
            </div>

            <div class="field">
              <span>Moneda</span>
              <input type="text" id="fin-currency" placeholder="GBP / USD / ARS" value="GBP" required />
            </div>

            <div class="field">
              <span>Referencia</span>
              <input type="text" id="fin-reference" />
            </div>

            <div class="field">
              <span>Notas</span>
              <input type="text" id="fin-notes" />
            </div>

            <div id="fin-form-error" class="error"></div>

            <div class="modal-footer">
              <button type="button" data-close="1" class="btn-secondary">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    section.dataset.finCanUpdate = canUpdate ? "1" : "0";
    section.dataset.finCanDelete = canDelete ? "1" : "0";
    section.dataset.finCanCreate = canCreate ? "1" : "0";

    section.querySelector("#fin-reload").addEventListener("click", async () => {
      await loadFinanceData(currentChurchId);
      renderFinance();
    });

    section.querySelector("#fin-period").addEventListener("change", () => renderFinance());
    section.querySelector("#fin-kind").addEventListener("change", () => renderFinance());
    section.querySelector("#fin-category").addEventListener("change", () => renderFinance());
    section.querySelector("#fin-search").addEventListener("input", () => renderFinance());

    if (canCreate) {
      section.querySelector("#fin-new").addEventListener("click", () => openFinModal({ mode: "create" }));
    }

    section.querySelector("#fin-modal").addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeFinModal();
    });

    section.querySelector("#fin-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveFin();
    });
  }

  await loadFinanceData(church.id);
  fillCategorySelects();
  renderFinance();
}

/* ---------------- Data ---------------- */

async function loadFinanceData(churchId) {
  setText("fin-error", "");
  setText("fin-success", "");
  setTableLoading("fin-tbody", 7);

  try {
    cachedCategories = await pb.collection("finance_categories").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "sort,name",
    });
  } catch {
    cachedCategories = [];
  }

  try {
    cachedTx = await pb.collection("finance_transactions").getFullList({
      filter: `church.id = "${churchId}"`,
      sort: "-date, -created",
    });
  } catch (err) {
    console.error("Error cargando fin tx:", err);
    cachedTx = [];
    setText("fin-error", humanizePbError(err) || "Error cargando finanzas.");
  }
}

function fillCategorySelects() {
  const selFilter = document.getElementById("fin-category");
  const selEdit = document.getElementById("fin-category-edit");

  const opts =
    `<option value="">(Todas las categorías)</option>` +
    cachedCategories
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`)
      .join("");

  if (selFilter) {
    const cur = selFilter.value || "";
    selFilter.innerHTML = opts;
    selFilter.value = cur;
  }

  if (selEdit) {
    const cur = selEdit.value || "";
    selEdit.innerHTML =
      `<option value="">(sin categoría)</option>` +
      cachedCategories
        .map((c) => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`)
        .join("");
    selEdit.value = cur;
  }
}

function renderFinance() {
  renderFinanceSummary();
  renderFinanceTable();
}

function renderFinanceSummary() {
  const { from, to } = getDateRange(document.getElementById("fin-period")?.value || "this_month");
  const kindFilter = document.getElementById("fin-kind")?.value || "";
  const catFilter = document.getElementById("fin-category")?.value || "";
  const q = (document.getElementById("fin-search")?.value || "").trim().toLowerCase();

  const tx = cachedTx.filter((t) => {
    const dt = t.date ? new Date(t.date) : null;
    if (from && dt && dt < from) return false;
    if (to && dt && dt > to) return false;
    if (kindFilter && t.kind !== kindFilter) return false;
    if (catFilter && String(t.category || "") !== String(catFilter)) return false;

    if (q) {
      const catName = categoryName(t.category);
      const ref = String(t.reference || "").toLowerCase();
      const notes = String(t.notes || "").toLowerCase();
      return catName.includes(q) || ref.includes(q) || notes.includes(q);
    }
    return true;
  });

  const byCurrency = new Map(); // currency -> {income, expense}
  for (const t of tx) {
    const cur = String(t.currency || "XXX");
    const amount = Number(t.amount_cents || 0);
    if (!byCurrency.has(cur)) byCurrency.set(cur, { income: 0, expense: 0 });
    const agg = byCurrency.get(cur);
    if (t.kind === "income") agg.income += amount;
    if (t.kind === "expense") agg.expense += amount;
  }

  // Si hay varias monedas, mostramos la primera + aviso simple
  const first = byCurrency.entries().next().value;
  if (!first) {
    setText("fin-income", "—");
    setText("fin-expense", "—");
    setText("fin-balance", "—");
    return;
  }

  const [cur, agg] = first;
  const income = agg.income;
  const expense = agg.expense;
  const balance = income - expense;

  setText("fin-income", fmtMoneyCents(income, cur));
  setText("fin-expense", fmtMoneyCents(expense, cur));
  setText("fin-balance", fmtMoneyCents(balance, cur));
}

function renderFinanceTable() {
  const tbody = document.getElementById("fin-tbody");
  const section = document.querySelector('section[data-view="finance"]');
  if (!tbody || !section) return;

  const canUpdate = section.dataset.finCanUpdate === "1";
  const canDelete = section.dataset.finCanDelete === "1";

  const { from, to } = getDateRange(document.getElementById("fin-period")?.value || "this_month");
  const kindFilter = document.getElementById("fin-kind")?.value || "";
  const catFilter = document.getElementById("fin-category")?.value || "";
  const q = (document.getElementById("fin-search")?.value || "").trim().toLowerCase();

  const filtered = cachedTx.filter((t) => {
    const dt = t.date ? new Date(t.date) : null;
    if (from && dt && dt < from) return false;
    if (to && dt && dt > to) return false;
    if (kindFilter && t.kind !== kindFilter) return false;
    if (catFilter && String(t.category || "") !== String(catFilter)) return false;

    if (q) {
      const catName = categoryName(t.category);
      const ref = String(t.reference || "").toLowerCase();
      const notes = String(t.notes || "").toLowerCase();
      return catName.includes(q) || ref.includes(q) || notes.includes(q);
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">No hay movimientos.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  for (const t of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Fecha">${escapeHtml(fmtDate(t.date))}</td>
      <td data-label="Tipo">${escapeHtml(t.kind || "")}</td>
      <td data-label="Categoría">${escapeHtml(categoryName(t.category))}</td>
      <td data-label="Monto">${escapeHtml(fmtMoneyCents(Number(t.amount_cents || 0), t.currency || ""))}</td>
      <td data-label="Ref">${escapeHtml(t.reference || "")}</td>
      <td data-label="Notas">${escapeHtml(t.notes || "")}</td>
      <td data-label="" class="row-actions"></td>
    `;

    const actionsTd = tr.querySelector(".row-actions");

    if (canUpdate) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Editar";
      b.addEventListener("click", () => openFinModal({ mode: "edit", record: t }));
      actionsTd.appendChild(b);
    }

    if (canDelete) {
      const d = document.createElement("button");
      d.type = "button";
      d.textContent = "Eliminar";
      d.className = "danger-btn";
      d.addEventListener("click", async () => {
        const ok = confirm("¿Eliminar movimiento?");
        if (!ok) return;
        await deleteFin(t.id);
      });
      actionsTd.appendChild(d);
    }

    tbody.appendChild(tr);
  }
}

/* ---------------- Modal + CRUD ---------------- */

function openFinModal({ mode, record }) {
  const section = document.querySelector('section[data-view="finance"]');
  if (!section) return;

  const canCreate = section.dataset.finCanCreate === "1";
  const canUpdate = section.dataset.finCanUpdate === "1";
  if (mode === "create" && !canCreate) return;
  if (mode === "edit" && !canUpdate) return;

  fillCategorySelects();
  setText("fin-form-error", "");

  document.getElementById("fin-id").value = record?.id || "";
  document.getElementById("fin-date").value = record?.date ? String(record.date).slice(0, 10) : todayISODate();
  document.getElementById("fin-kind-edit").value = record?.kind || "income";
  document.getElementById("fin-category-edit").value = record?.category || "";
  document.getElementById("fin-reference").value = record?.reference || "";
  document.getElementById("fin-notes").value = record?.notes || "";
  document.getElementById("fin-currency").value = record?.currency || "GBP";

  // cents -> decimal
  const cents = Number(record?.amount_cents || 0);
  document.getElementById("fin-amount").value = (cents / 100).toFixed(2);

  document.getElementById("fin-modal-title").textContent = mode === "create" ? "Nuevo movimiento" : "Editar movimiento";
  document.getElementById("fin-modal").style.display = "block";
}

function closeFinModal() {
  const modal = document.getElementById("fin-modal");
  if (modal) modal.style.display = "none";
}

async function saveFin() {
  setText("fin-form-error", "");
  setText("fin-error", "");
  setText("fin-success", "");

  const id = document.getElementById("fin-id").value.trim();
  const date = document.getElementById("fin-date").value;
  const kind = document.getElementById("fin-kind-edit").value;
  const category = document.getElementById("fin-category-edit").value || null;

  const amountStr = document.getElementById("fin-amount").value.trim();
  const currency = document.getElementById("fin-currency").value.trim().toUpperCase();
  const reference = document.getElementById("fin-reference").value.trim();
  const notes = document.getElementById("fin-notes").value.trim();

  if (!date) return setText("fin-form-error", "Fecha es obligatoria.");
  if (!kind) return setText("fin-form-error", "Tipo es obligatorio.");
  if (!currency) return setText("fin-form-error", "Moneda es obligatoria.");

  const amount = Number(amountStr);
  if (!Number.isFinite(amount)) return setText("fin-form-error", "Monto inválido.");
  const amount_cents = Math.round(amount * 100);

  const payload = {
    date,
    kind,
    category,
    amount_cents,
    currency,
    reference,
    notes,
  };

  try {
    if (!id) {
      await pb.collection("finance_transactions").create({
        church: currentChurchId,
        ...payload,
      });
      setText("fin-success", "Movimiento creado.");
    } else {
      await pb.collection("finance_transactions").update(id, payload);
      setText("fin-success", "Movimiento actualizado.");
    }

    closeFinModal();
    await loadFinanceData(currentChurchId);
    fillCategorySelects();
    renderFinance();
  } catch (err) {
    console.error("Error guardando fin:", err);
    setText("fin-form-error", humanizePbError(err) || "Error guardando movimiento.");
  }
}

async function deleteFin(id) {
  setText("fin-error", "");
  setText("fin-success", "");

  try {
    await pb.collection("finance_transactions").delete(id);
    setText("fin-success", "Movimiento eliminado.");
    await loadFinanceData(currentChurchId);
    renderFinance();
  } catch (err) {
    console.error("Error eliminando fin:", err);
    setText("fin-error", humanizePbError(err) || "Error eliminando movimiento.");
  }
}

/* ---------------- Helpers ---------------- */

function categoryName(categoryId) {
  if (!categoryId) return "";
  const c = cachedCategories.find((x) => String(x.id) === String(categoryId));
  return String(c?.name || "");
}

function getDateRange(period) {
  const now = new Date();
  const startOfMonth = (y, m) => new Date(y, m, 1);
  const endOfMonth = (y, m) => new Date(y, m + 1, 0, 23, 59, 59, 999);

  if (period === "this_month") {
    const from = startOfMonth(now.getFullYear(), now.getMonth());
    const to = endOfMonth(now.getFullYear(), now.getMonth());
    return { from, to };
  }
  if (period === "last_month") {
    const m = now.getMonth() - 1;
    const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const mm = (m + 12) % 12;
    const from = startOfMonth(y, mm);
    const to = endOfMonth(y, mm);
    return { from, to };
  }
  if (period === "this_year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { from, to };
  }
  return { from: null, to: null };
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return String(iso);
  }
}

function fmtMoneyCents(cents, currency) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Number(cents || 0));
  const val = (abs / 100).toFixed(2);
  return `${sign}${currency ? currency + " " : ""}${val}`;
}

function todayISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
