// assets/js/core/EnhancedCrudTable.js
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
    this.expand = config.expand || '';
    this.originalData = [];
    this.filteredData = [];
    this.currentFilter = '';
    
    if (this.searchInput) {
      this.setupSearch();
    }
  }
  
  setupSearch() {
    const input = typeof this.searchInput === 'string' 
      ? document.querySelector(this.searchInput) 
      : this.searchInput;
    
    if (input) {
      // Clear any existing listeners
      const newInput = input.cloneNode(true);
      input.parentNode.replaceChild(newInput, input);
      
      let timeout;
      newInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.filterData(e.target.value);
        }, 300);
      });
      
      // Add clear button functionality
      newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          newInput.value = '';
          this.filterData('');
        }
      });
    }
  }
  
  filterData(searchTerm) {
    this.currentFilter = searchTerm;
    
    if (!searchTerm || searchTerm.trim() === '') {
      // Reset to original data
      this.filteredData = [...this.originalData];
      this.renderTable();
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    this.filteredData = this.originalData.filter(item => {
      // Search across all displayed columns
      return this.columns.some(col => {
        const value = this.getCellValue(item, col.key);
        return String(value).toLowerCase().includes(term);
      });
    });
    
    this.renderTable();
  }

  getCellValue(item, key) {
    if (key.includes('.')) {
      // Handle nested properties (expand.relation.field)
      const parts = key.split('.');
      let value = item;
      
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return '';
        }
      }
      
      // For relations, try to get a display value
      if (value && typeof value === 'object') {
        return value.name || value.title || 
               (value.first_name && value.last_name ? value.first_name + ' ' + value.last_name : '') ||
               value.id || '';
      }
      
      return value || '';
    }
    
    // Handle direct fields
    return item[key] || '';
  }

  render(data) {
    this.originalData = [...data];
    this.filteredData = [...data];
    
    // If there's an active filter, reapply it
    if (this.currentFilter) {
      this.filterData(this.currentFilter);
    } else {
      this.renderTable();
    }
  }

  renderTable() {
    const tableBody = this.getElement(this.container);
    if (!tableBody) return;

    this.renderHeaders();

    tableBody.innerHTML = this.filteredData.length ? 
      this.filteredData.map(item => this.renderRow(item)).join('') :
      `<tr><td colspan="${this.columns.length + 1}">No hay registros que coincidan con la búsqueda</td></tr>`;

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
      return `<td>${col.format ? col.format(value, item) : this.escapeHtml(String(value))}</td>`;
    });

    const actions = [];
    if (this.canEdit && this.onEdit) {
      actions.push(`<button class="edit-btn" data-action="edit" data-id="${item.id}">Editar</button>`);
    }
    if (this.canDelete && this.onDelete) {
      actions.push(`<button class="danger-btn delete-btn" data-action="delete" data-id="${item.id}">Eliminar</button>`);
    }

    return `<tr>${cells.join('')}<td class="row-actions">${actions.join('')}</td></tr>`;
  }

  bindRowEvents(container) {
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => this.onEdit(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('¿Está seguro de eliminar este registro?')) this.onDelete(btn.dataset.id);
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