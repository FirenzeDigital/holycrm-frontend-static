// assets/js/core/CrudTable.js (UPDATED with headers)
import { can } from '../permissions.js';

export class CrudTable {
  constructor(config) {
    this.container = config.container; // DOM element or selector for tbody
    this.columns = config.columns;     // Array of {key, label, format}
    this.canEdit = config.canEdit;
    this.canDelete = config.canDelete;
    this.onEdit = config.onEdit;
    this.onDelete = config.onDelete;
    this.headerContainer = config.headerContainer; // Optional: container for thead
  }

  render(data) {
    const tableBody = this.getElement(this.container);
    if (!tableBody) return;

    // Render headers if needed
    this.renderHeaders();

    tableBody.innerHTML = data.length ? 
      data.map(item => this.renderRow(item)).join('') :
      `<tr><td colspan="${this.columns.length + 1}">Sin registros</td></tr>`;

    this.bindRowEvents(tableBody);
  }

  renderHeaders() {
    // If headerContainer is provided, render headers there
    if (this.headerContainer) {
      const headerRow = this.getElement(this.headerContainer);
      if (headerRow) {
        headerRow.innerHTML = this.columns.map(col => 
          `<th>${col.label}</th>`
        ).join('') + '<th></th>'; // Empty header for actions column
      }
    } else {
      // Try to find the nearest thead relative to the tbody
      const tableBody = this.getElement(this.container);
      if (tableBody) {
        const table = tableBody.closest('table');
        if (table) {
          const thead = table.querySelector('thead');
          if (thead) {
            thead.innerHTML = `
              <tr>
                ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
                <th></th>
              </tr>
            `;
          }
        }
      }
    }
  }

  renderRow(item) {
    const cells = this.columns.map(col => {
      const value = col.key.includes('.') ? 
        this.getNestedValue(item, col.key) : 
        item[col.key];
      return `<td>${col.format ? col.format(value, item) : (value || '')}</td>`;
    });

    const actions = [];
    if (this.canEdit && this.onEdit) {
      actions.push(`<button data-action="edit" data-id="${item.id}">Editar</button>`);
    }
    if (this.canDelete && this.onDelete) {
      actions.push(`<button class="danger-btn" data-action="delete" data-id="${item.id}">Eliminar</button>`);
    }

    return `<tr>${cells.join('')}<td class="row-actions">${actions.join('')}</td></tr>`;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  bindRowEvents(container) {
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => this.onEdit(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('¿Eliminar registro?')) this.onDelete(btn.dataset.id);
      });
    });
  }

  getElement(selector) {
    return typeof selector === 'string' ? 
      document.querySelector(selector) : selector;
  }
}