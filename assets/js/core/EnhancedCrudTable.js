// assets/js/core/EnhancedCrudTable.js (NOW THE DEFAULT)
import { can } from '../permissions.js';

export class EnhancedCrudTable {
  constructor(config) {
    this.container = config.container;
    this.columns = config.columns;
    this.canEdit = config.canEdit;
    this.canDelete = config.canDelete;
    this.onEdit = config.onEdit;
    this.onDelete = config.onDelete;
    this.headerContainer = config.headerContainer;
    this.searchInput = config.searchInput;
    this.expand = config.expand || ''; // For relation fields
    this.originalData = [];
    
    if (this.searchInput) {
      this.setupSearch();
    }
  }
  
  setupSearch() {
    const input = typeof this.searchInput === 'string' 
      ? document.querySelector(this.searchInput) 
      : this.searchInput;
    
    if (input) {
      // Add debouncing for better performance
      let timeout;
      input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.filterData(e.target.value);
        }, 300);
      });
    }
  }
  
  filterData(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      this.render(this.originalData);
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = this.originalData.filter(item => {
      // Search across all displayed columns
      return this.columns.some(col => {
        const value = this.getCellValue(item, col.key);
        return String(value).toLowerCase().includes(term);
      });
    });
    
    this.render(filtered);
  }
  
  getCellValue(item, key) {
    if (key.includes('.')) {
      // Handle nested properties (expand.relation.field)
      return key.split('.').reduce((obj, k) => obj?.[k], item) || '';
    }
    return item[key] || '';
  }

  render(data) {
    this.currentData = data;
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
    if (this.headerContainer) {
      const headerRow = this.getElement(this.headerContainer);
      if (headerRow) {
        headerRow.innerHTML = this.columns.map(col => 
          `<th>${col.label}</th>`
        ).join('') + '<th></th>';
      }
    } else {
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
      const value = this.getCellValue(item, col.key);
      return `<td>${col.format ? col.format(value, item) : this.escapeHtml(value)}</td>`;
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

  getElement(selector) {
    return typeof selector === 'string' ? 
      document.querySelector(selector) : selector;
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}