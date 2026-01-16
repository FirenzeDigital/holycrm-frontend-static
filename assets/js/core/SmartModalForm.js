// assets/js/core/SmartModalForm.js
export class SmartModalForm {
  constructor(config) {
    this.id = config.id || "smart-modal";
    this.title = config.title || "Formulario";
    this.fields = Array.isArray(config.fields) ? config.fields : [];
    this.onSubmit = config.onSubmit;
    this.onLoadRelations = config.onLoadRelations || (async () => []);

    this.currentData = null;     // record being edited
    this.editingId = null;       // record id (null => create)
    this.relationCache = new Map();
    this._eventsBound = false;
  }

  getFieldId(field) {
    return `${this.id}-${field.name}`;
  }

  // Accept both {id,label} and {value,label}
  normalizeOptions(list) {
    const arr = Array.isArray(list) ? list : [];
    return arr
      .map((o) => {
        if (o == null) return null;
        if (typeof o === "string") return { id: o, label: o };
        const id = o.id ?? o.value ?? o.key ?? o._id;
        const label = o.label ?? o.name ?? o.title ?? String(id ?? "");
        if (!id) return null;
        return { id: String(id), label: String(label) };
      })
      .filter(Boolean);
  }

  async preloadRelationOptions() {
    for (const f of this.fields) {
      if (f?.componentType !== "relation") continue;

      try {
        const raw = await this.onLoadRelations(f);
        const opts = this.normalizeOptions(raw);
        f.options = opts;
        this.relationCache.set(f.name, opts);
      } catch (e) {
        console.error("[SmartModalForm] relation options failed", f?.name, e);
        f.options = [];
        this.relationCache.set(f.name, []);
      }
    }
  }

  async open(record = {}) {
    this.currentData = record || {};
    this.editingId = record?.id || null;

    await this.preloadRelationOptions();
    await this.renderModal();
    await this.populateForm(this.currentData);
    this.show();
  }

  async renderModal() {
    const existing = document.getElementById(this.id);
    if (existing) {
      await this.updateRelationOptions();
      if (!this._eventsBound) this.bindEvents();
      return;
    }

    const fieldHTML = await Promise.all(
      this.fields.map(async (field) => {
        return `
          <div class="field">
            <label for="${this.getFieldId(field)}">
              ${field.label}${field.required ? " *" : ""}
            </label>
            ${await this.renderFieldInput(field)}
          </div>
        `;
      })
    ).then((html) => html.join(""));

    const modalHTML = `
      <div id="${this.id}" class="modal" style="display:none">
        <div class="modal-backdrop" data-close="1"></div>
        <div class="modal-card">
          <div class="modal-header">
            <h3>${this.title}</h3>
            <button type="button" class="modal-close" data-close="1">×</button>
          </div>
          <form id="${this.id}-form" class="modal-body">
            ${fieldHTML}
            <div id="${this.id}-error" class="error"></div>
            <div class="modal-footer">
              <button type="button" class="cancel-btn" data-close="1">Cancelar</button>
              <button type="submit" class="submit-btn">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    this.bindEvents();
    await this.updateRelationOptions();
  }

  async renderFieldInput(field) {
    const fieldId = this.getFieldId(field);
    const required = field.required ? "required" : "";

    switch (field.componentType || field.type) {
      case "select": {
        const opts = this.normalizeOptions(field.options || []);
        const html = opts
          .map((opt) => `<option value="${opt.id}">${opt.label}</option>`)
          .join("");
        return `<select id="${fieldId}" name="${field.name}" ${required}>
          <option value="">-- Seleccionar --</option>
          ${html}
        </select>`;
      }

      case "relation": {
        const opts = this.normalizeOptions(field.options || []);
        const html = opts
          .map((opt) => `<option value="${opt.id}">${opt.label}</option>`)
          .join("");
        return `<select id="${fieldId}" name="${field.name}" ${required}>
          <option value="">-- Seleccionar --</option>
          ${html}
        </select>`;
      }

      case "checkbox":
        return `<input type="checkbox" id="${fieldId}" name="${field.name}">`;

      case "textarea":
        return `<textarea id="${fieldId}" name="${field.name}" ${required} rows="4"></textarea>`;

      case "date":
        return `<input type="date" id="${fieldId}" name="${field.name}" ${required}>`;

      case "number":
        return `<input type="number" id="${fieldId}" name="${field.name}" ${required}
          step="${field.step || "1"}"
          ${field.min != null ? `min="${field.min}"` : ""}
          ${field.max != null ? `max="${field.max}"` : ""}
        >`;

      default:
        return `<input type="${field.type || "text"}" id="${fieldId}" name="${field.name}"
          ${required}
          ${field.placeholder ? `placeholder="${field.placeholder}"` : ""}
        >`;
    }
  }

  async updateRelationOptions() {
    const relationFields = this.fields.filter(
      (f) => f?.componentType === "relation"
    );

    for (const field of relationFields) {
      const el = document.getElementById(this.getFieldId(field));
      if (!el) continue;

      const raw = this.relationCache.has(field.name)
        ? this.relationCache.get(field.name)
        : await this.onLoadRelations(field);

      const opts = this.normalizeOptions(raw);
      this.relationCache.set(field.name, opts);

      el.innerHTML =
        `<option value="">-- Seleccionar --</option>` +
        opts.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
    }
  }

  bindEvents() {
    const modal = document.getElementById(this.id);
    const form = document.getElementById(`${this.id}-form`);
    if (!modal || !form) return;

    if (this._eventsBound) return;
    this._eventsBound = true;

    modal.querySelectorAll('[data-close="1"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.close();
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = this.getFormData();

      try {
        await this.onSubmit(formData, this.editingId);
        this.close();
      } catch (err) {
        console.error("[SmartModalForm] submit failed", err);
        this.showError(err?.message || "Error al guardar");
      }
    });
  }

  getFormData() {
    const data = {};

    for (const field of this.fields) {
      const el = document.getElementById(this.getFieldId(field));
      if (!el) continue;

      const t = field.componentType || field.type;

      if (t === "checkbox") {
        data[field.name] = !!el.checked;
        continue;
      }

      const v = el.value;

      // IMPORTANT: relation/select must send record id (string) or null
      if (t === "relation" || t === "select") {
        data[field.name] = v ? String(v) : null;
        continue;
      }

      if (t === "number") {
        data[field.name] = v === "" ? null : Number(v);
        continue;
      }

      if (t === "date") {
        // PocketBase accepts "YYYY-MM-DD" for date fields
        data[field.name] = v ? String(v) : null;
        continue;
      }

      // Optional: if you later map PB json -> field.type="json"
      if (field.type === "json") {
        if (!v) data[field.name] = null;
        else {
          try { data[field.name] = JSON.parse(v); }
          catch { data[field.name] = null; }
        }
        continue;
      }

      data[field.name] = v ? String(v) : null;
    }

    return data;
  }

  async populateForm(record) {
    await this.updateRelationOptions();

    for (const field of this.fields) {
      const el = document.getElementById(this.getFieldId(field));
      if (!el) continue;

      const t = field.componentType || field.type;
      const value = record?.[field.name];

      if (t === "checkbox") {
        el.checked = !!value;
      } else if (t === "date") {
        // record might be ISO; input expects YYYY-MM-DD
        if (value) {
          const d = new Date(value);
          el.value = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
        } else el.value = "";
      } else {
        el.value = value == null ? "" : String(value);
      }
    }
  }

  show() {
    const modal = document.getElementById(this.id);
    if (modal) modal.style.display = "block";
  }

  close() {
    const modal = document.getElementById(this.id);
    if (modal) modal.style.display = "none";
    this.clearForm();
    this.currentData = null;
    this.editingId = null;
  }

  clearForm() {
    for (const field of this.fields) {
      const el = document.getElementById(this.getFieldId(field));
      if (!el) continue;

      const t = field.componentType || field.type;
      if (t === "checkbox") el.checked = false;
      else el.value = "";
    }
  }

  showError(message) {
    const el = document.getElementById(`${this.id}-error`);
    if (!el) return;
    el.textContent = String(message || "");
    setTimeout(() => (el.textContent = ""), 5000);
  }
}

