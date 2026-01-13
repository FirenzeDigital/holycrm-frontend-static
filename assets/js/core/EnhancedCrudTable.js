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
    this.visibleColumns = this.getVisibleColumnsFromStorage() || 
      this.columns.map(col => col.key); // Default: all columns visible
    
    if (this.searchInput) {
      this.setupSearch();
    }
  }
  
  getVisibleColumnsFromStorage() {
    const moduleName = this.container.replace('#', '').replace('-body', '');
    const stored = localStorage.getItem(`tableColumns_${moduleName}`);
    return stored ? JSON.parse(stored) : null;
  }
  
  saveVisibleColumnsToStorage() {
    const moduleName = this.container.replace('#', '').replace('-body', '');
    localStorage.setItem(`tableColumns_${moduleName}`, JSON.stringify(this.visibleColumns));
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
      // Search across all displayed columns (including hidden ones for search)
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
        // Only show visible columns
        const visibleColumnHeaders = this.columns
          .filter(col => this.visibleColumns.includes(col.key))
          .map(col => `<th>${col.label}</th>`)
          .join('');
        
        headerRow.innerHTML = visibleColumnHeaders + '<th><div class="column-toggle-container"></div></th>';
        
        // Add column toggle button
        this.addColumnToggle(headerRow.querySelector('.column-toggle-container'));
      }
    } else {
      const tableBody = this.getElement(this.container);
      if (tableBody) {
        const table = tableBody.closest('table');
        if (table) {
          const thead = table.querySelector('thead');
          if (thead) {
            const visibleColumnHeaders = this.columns
              .filter(col => this.visibleColumns.includes(col.key))
              .map(col => `<th>${col.label}</th>`)
              .join('');
            
            thead.innerHTML = `
              <tr>
                ${visibleColumnHeaders}
                <th><div class="column-toggle-container"></div></th>
              </tr>
            `;
            
            // Add column toggle button
            this.addColumnToggle(thead.querySelector('.column-toggle-container'));
          }
        }
      }
    }
  }
  
  addColumnToggle(container) {
    if (!container) return;
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'column-toggle-btn';
    toggleButton.innerHTML = '☰';
    toggleButton.title = 'Mostrar/Ocultar columnas';
    toggleButton.style.cssText = `
      background: none;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 8px;
      margin-left: 5px;
    `;
    
    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleColumnSelector(e.target);
    });
    
    container.appendChild(toggleButton);
  }
  
  toggleColumnSelector(button) {
    // Remove any existing selector
    const existingSelector = document.querySelector('.column-selector');
    if (existingSelector) {
      existingSelector.remove();
      return;
    }
    
    // Create column selector
    const selector = document.createElement('div');
    selector.className = 'column-selector';
    selector.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      min-width: 150px;
    `;
    
    // Position near the button
    const rect = button.getBoundingClientRect();
    selector.style.top = `${rect.bottom + 5}px`;
    selector.style.right = `${window.innerWidth - rect.right}px`;
    
    // Add column checkboxes
    selector.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 500; font-size: 14px;">Columnas:</div>
      ${this.columns.map(col => `
        <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
          <input type="checkbox" ${this.visibleColumns.includes(col.key) ? 'checked' : ''} 
                 data-column="${col.key}">
          <span>${col.label}</span>
        </label>
      `).join('')}
      <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px;">
        <button class="select-all" style="font-size: 12px; padding: 4px 8px; margin-right: 5px;">Todo</button>
        <button class="deselect-all" style="font-size: 12px; padding: 4px 8px;">Ninguno</button>
      </div>
    `;
    
    // Add event listeners
    selector.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const columnKey = e.target.dataset.column;
        if (e.target.checked) {
          if (!this.visibleColumns.includes(columnKey)) {
            this.visibleColumns.push(columnKey);
          }
        } else {
          this.visibleColumns = this.visibleColumns.filter(key => key !== columnKey);
        }
        this.saveVisibleColumnsToStorage();
        this.renderTable();
      });
    });
    
    selector.querySelector('.select-all').addEventListener('click', () => {
      this.visibleColumns = this.columns.map(col => col.key);
      this.saveVisibleColumnsToStorage();
      this.renderTable();
      selector.remove();
    });
    
    selector.querySelector('.deselect-all').addEventListener('click', () => {
      this.visibleColumns = [];
      this.saveVisibleColumnsToStorage();
      this.renderTable();
      selector.remove();
    });
    
    // Close when clicking outside
    document.addEventListener('click', function closeSelector(e) {
      if (!selector.contains(e.target) && e.target !== button) {
        selector.remove();
        document.removeEventListener('click', closeSelector);
      }
    });
    
    document.body.appendChild(selector);
  }

  renderRow(item) {
    // Only show visible columns
    const cells = this.columns
      .filter(col => this.visibleColumns.includes(col.key))
      .map(col => {
        const value = this.getCellValue(item, col.key);
        return `<td data-label="${col.label}">${col.format ? col.format(value, item) : this.escapeHtml(String(value))}</td>`;
      });

    const actions = [];
    if (this.canEdit && this.onEdit) {
      actions.push(`<button class="edit-btn" data-action="edit" data-id="${item.id}">Editar</button>`);
    }
    if (this.canDelete && this.onDelete) {
      actions.push(`<button class="danger-btn delete-btn" data-action="delete" data-id="${item.id}">Eliminar</button>`);
    }

    return `<tr>${cells.join('')}<td class="row-actions" data-label="Acciones">${actions.join('')}</td></tr>`;
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