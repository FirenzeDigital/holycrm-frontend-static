// assets/js/core/CrudTable.js
import { can } from '../permissions.js';

export class CrudTable {
  constructor(config) {
    this.container = config.container; // DOM element or selector
    this.columns = config.columns;     // Array of {key, label, format}
    this.canEdit = config.canEdit;
    this.canDelete = config.canDelete;
    this.onEdit = config.onEdit;
    this.onDelete = config.onDelete;
  }

  render(data) {
    const tableBody = typeof this.container === 'string' 
      ? document.querySelector(this.container) 
      : this.container;
    
    if (!tableBody) return;

    tableBody.innerHTML = data.length ? 
      data.map(item => this.renderRow(item)).join('') :
      `<tr><td colspan="${this.columns.length + 1}">Sin registros</td></tr>`;

    this.bindRowEvents(tableBody);
  }

  renderRow(item) {
    const cells = this.columns.map(col => {
      const value = col.key.includes('.') ? 
        col.key.split('.').reduce((obj, k) => obj?.[k], item) : 
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
}