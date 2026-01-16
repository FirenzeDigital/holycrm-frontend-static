// assets/js/core/GenericModuleRenderer.js
import { can } from "../permissions.js";
import { DataService } from "./DataService.js";
import { EnhancedCrudTable } from "./EnhancedCrudTable.js";
import { SmartModalForm } from "./SmartModalForm.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


export class GenericModuleRenderer {
  constructor({ moduleKey, config }) {
    this.moduleKey = moduleKey;
    this.config = config;

    this.service = null;
    this.table = null;
    this.modal = null;

    this.currentChurchId = null;
    this._expand = "";
    this._columns = [];
  }

  async render({ container, churchId }) {
    if (!this.config) {
      container.innerHTML = `
        <h1>${escapeHtml(this.moduleKey)}</h1>
        <div style="padding:12px;border:1px solid #fca5a5;background:#fef2f2;border-radius:10px;">
          Module renderer received no config. Check ModuleLoader path and module JSON.
        </div>
      `;
      return;
    }

    this.currentChurchId = churchId;

    const key = this.moduleKey;

    // Render a stable DOM with IDs (EnhancedCrudTable expects selector strings)
    container.innerHTML = `
      <h1>${escapeHtml(this.config.label || key)}</h1>

      <div class="card">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
          ${can("create", this.config.resource || key) ? `<button id="${key}-new" class="btn-secondary" type="button">Nuevo</button>` : ""}
          <input id="${key}-search" class="search-input" placeholder="Buscar..." />
        </div>

        <div class="table-container">
          <table class="crud-table">
            <thead><tr id="${key}-headers"></tr></thead>
            <tbody id="${key}-body"></tbody>
          </table>
        </div>
      </div>
    `;

    this.service = DataService.fromModuleConfig(this.config);

    this._columns = (this.config.table?.columns || []).map((c) => {
      // we’ll flatten values into a plain row object using this key
      const colKey = c.type === "relation" && c.display ? `${c.field}__${c.display}` : c.field;
      return {
        key: colKey,
        label: c.label || c.field,
        _raw: c, // keep original for mapping
      };
    });

    this._expand = (this.config.table?.columns || [])
      .filter((c) => c.type === "relation")
      .map((c) => c.field)
      .join(",");

    // IMPORTANT: pass selector strings, not DOM elements
    this.table = new EnhancedCrudTable({
      container: `#${key}-body`,
      headerContainer: `#${key}-headers`,
      columns: this._columns.map((c) => ({ key: c.key, label: c.label })),
      searchInput: `#${key}-search`,
      canEdit: can("update", this.config.resource || key),
      canDelete: can("delete", this.config.resource || key),
      onEdit: (id) => this.openModal(id),
      onDelete: (id) => this.deleteRecord(id),
    });

    this.modal = new SmartModalForm({
      id: `${key}-modal`,
      title: this.config.label || key,
      fields: this.toSmartModalFields(this.config.form?.fields || []),
      onSubmit: (data, id) => this.saveRecord(data, id),
      onLoadRelations: (field) => this.loadRelationOptions(field),
    });

    document.getElementById(`${key}-new`)?.addEventListener("click", () => this.openModal(null));

    await this.refresh();
  }

  async refresh() {
    const rows = await this.service.getList(this.currentChurchId, this._expand, this.config.table?.defaultSort || "-created");

    // Flatten PocketBase records into plain objects for EnhancedCrudTable
    const flat = rows.map((r) => this.flattenRecord(r));
    this.table.render(flat);
  }

  flattenRecord(record) {
    const row = { id: record.id };

    for (const c of this._columns) {
      const raw = c._raw;
      if (raw.type === "relation" && raw.display) {
        const relField = raw.field;
        const dispField = raw.display;

        // PB expand format: record.expand[relField] is record or array
        const expanded = record.expand?.[relField];
        let val = "";

        if (Array.isArray(expanded)) {
          val = expanded.map((x) => x?.[dispField] ?? x?.name ?? x?.title ?? x?.id).filter(Boolean).join(", ");
        } else if (expanded) {
          val = expanded?.[dispField] ?? expanded?.name ?? expanded?.title ?? expanded?.id ?? "";
        } else {
          // fallback show raw id(s)
          const rawVal = record[relField];
          val = Array.isArray(rawVal) ? rawVal.join(", ") : (rawVal ?? "");
        }

        row[c.key] = val;
      } else {
        row[c.key] = record[raw.field] ?? "";
      }
    }

    return row;
  }

  async openModal(id) {
    if (id) {
      const record = await this.service.getOne(id, this._expand);
      await this.modal.open(record);
    } else {
      await this.modal.open({});
    }
  }

  async saveRecord(data, id) {
    const payload = { ...data };

    // Ensure tenant field set for PB datasource
    const tenantField = this.config.datasource?.tenant?.field || "church";
    payload[tenantField] = this.currentChurchId;

    if (id) await this.service.update(id, payload);
    else await this.service.create(payload);

    await this.refresh();
  }

  async deleteRecord(id) {
    if (!confirm("¿Eliminar registro?")) return;
    await this.service.delete(id);
    await this.refresh();
  }

  toSmartModalFields(fields) {
    return fields.map((f) => {
      if (f.type === "relation") {
        return {
          name: f.field,
          label: f.label || f.field,
          type: "select",
          componentType: "relation",
          required: !!f.required,
          relationTo: f.collection,
          labelField: f.labelField || "name",
          filterByTenant: f.filterByTenant !== false,
        };
      }

      if (f.type === "select") {
        const opts = (f.options || []).map((v) => ({ value: v, label: String(v) }));
        return {
          name: f.field,
          label: f.label || f.field,
          type: "select",
          componentType: "select",
          required: !!f.required,
          options: opts,
        };
      }

      if (f.type === "bool" || f.type === "boolean") {
        return {
          name: f.field,
          label: f.label || f.field,
          type: "boolean",
          componentType: "checkbox",
          required: !!f.required,
          options: [],
        };
      }

      return {
        name: f.field,
        label: f.label || f.field,
        type: "text",
        componentType: "input",
        required: !!f.required,
        options: [],
      };
    });
  }
  
  async loadRelationOptions(field) {
    // field can be the field object OR a string name depending on SmartModalForm
    const f =
      typeof field === "string"
        ? (this.modal?.fields || []).find((x) => x?.name === field)
        : field;

    const relCollection = f?.relationTo;
    if (!relCollection) return [];

    const svc = new DataService(relCollection);

    const list = f.filterByTenant
      ? await svc.getList(this.currentChurchId)
      : await svc.markAsGlobal().getList(null);

    const labelField = f.labelField || "name";

    return list.map((r) => ({
      id: r.id,
      label: r[labelField] || r.name || r.title || r.id,
    }));
  }
  
}

