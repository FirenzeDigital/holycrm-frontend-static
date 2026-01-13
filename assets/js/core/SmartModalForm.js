// assets/js/core/SmartModalForm.js
export class SmartModalForm {
  constructor(config) {
    this.id = config.id || 'smart-modal';
    this.title = config.title || 'Formulario';
    this.fields = config.fields;
    this.onSubmit = config.onSubmit;
    this.onLoadRelations = config.onLoadRelations || (() => []);
    this.currentData = null;
    this.relationCache = new Map();
  }

  async open(data = {}) {
    this.currentData = data;
    await this.renderModal();
    await this.populateForm(data);
    this.show();
  }

  async renderModal() {
    if (document.getElementById(this.id)) {
      // Modal exists, just update it
      await this.updateRelationOptions();
      return;
    }

    const fieldHTML = await Promise.all(
      this.fields.map(async field => `
        <div class="field">
          <label for="${this.getFieldId(field)}">${field.label}${field.required ? ' *' : ''}</label>
          ${await this.renderFieldInput(field)}
        </div>
      `)
    ).then(html => html.join(''));

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

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.bindEvents();
    await this.updateRelationOptions();
  }

  getFieldId(field) {
    return `${this.id}-${field.name}`;
  }

  async renderFieldInput(field) {
    const fieldId = this.getFieldId(field);
    
    switch (field.componentType || field.type) {
      case 'select':
        const staticOptions = field.options || [];
        const staticOptionsHTML = staticOptions.map(opt => 
          `<option value="${opt.value || opt}">${opt.label || opt}</option>`
        ).join('');
        return `<select id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''}>
          <option value="">-- Seleccionar --</option>
          ${staticOptionsHTML}
        </select>`;
      
      case 'relation':
        // For relation fields, we'll load options dynamically
        const options = await this.loadRelationOptions(field);
        const optionsHTML = options.map(opt => 
          `<option value="${opt.id}">${opt.label}</option>`
        ).join('');
        return `<select id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''}>
          <option value="">-- Seleccionar --</option>
          ${optionsHTML}
        </select>`;
      
      case 'checkbox':
        return `<input type="checkbox" id="${fieldId}" name="${field.name}">`;
      
      case 'textarea':
        return `<textarea id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''} rows="4"></textarea>`;
      
      case 'date':
        return `<input type="date" id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''}>`;
      
      case 'number':
        return `<input type="number" id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''} 
                step="${field.step || '1'}" ${field.min ? `min="${field.min}"` : ''} ${field.max ? `max="${field.max}"` : ''}>`;
      
      default:
        return `<input type="${field.type || 'text'}" id="${fieldId}" name="${field.name}" 
                ${field.required ? 'required' : ''} 
                ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}>`;
    }
  }

  async loadRelationOptions(field) {
    // Check cache first
    const cacheKey = field.name;
    if (this.relationCache.has(cacheKey)) {
      return this.relationCache.get(cacheKey);
    }
    
    // Load via callback
    if (this.onLoadRelations) {
      try {
        const options = await this.onLoadRelations(field);
        this.relationCache.set(cacheKey, options);
        return options;
      } catch (error) {
        console.error(`Error loading relation options for ${field.name}:`, error);
        return [];
      }
    }
    
    return [];
  }

  async updateRelationOptions() {
    // Update all relation select elements with fresh data
    const relationFields = this.fields.filter(f => 
      f.type === 'relation' || f.componentType === 'relation'
    );
    
    for (const field of relationFields) {
      const element = document.getElementById(this.getFieldId(field));
      if (element) {
        const options = await this.loadRelationOptions(field);
        const optionsHTML = options.map(opt => 
          `<option value="${opt.id}">${opt.label}</option>`
        ).join('');
        element.innerHTML = `<option value="">-- Seleccionar --</option>${optionsHTML}`;
      }
    }
  }

  bindEvents() {
    const modal = document.getElementById(this.id);
    const form = document.getElementById(`${this.id}-form`);

    // Clear any existing event listeners by cloning
    if (modal) {
      const newModal = modal.cloneNode(true);
      modal.parentNode.replaceChild(newModal, modal);
      
      const newForm = newModal.querySelector(`#${this.id}-form`);
      
      // Rebind close events
      newModal.querySelectorAll('[data-close="1"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
        });
      });

      // Rebind form submit
      if (newForm) {
        newForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = this.getFormData();
          try {
            await this.onSubmit(formData, this.currentData?.id);
            this.close();
          } catch (error) {
            this.showError(error.message || 'Error al guardar');
          }
        });
      }
    }
  }

  getFormData() {
    const data = {};
    
    this.fields.forEach(field => {
      const element = document.getElementById(this.getFieldId(field));
      if (!element) return;
      
      if (field.componentType === 'checkbox') {
        data[field.name] = element.checked;
      } else if (field.type === 'number') {
        data[field.name] = element.value ? parseFloat(element.value) : null;
      } else if (field.type === 'date' && element.value) {
        // Format date for PocketBase
        const date = new Date(element.value);
        data[field.name] = date.toISOString();
      } else {
        data[field.name] = element.value || null;
      }
    });
    
    return data;
  }

  async populateForm(data) {
    // First update relation options to ensure they're loaded
    await this.updateRelationOptions();
    
    // Then set values for all fields
    setTimeout(() => {
      this.fields.forEach(field => {
        const element = document.getElementById(this.getFieldId(field));
        if (!element) return;
        
        const value = data[field.name];
        
        // Clear field first
        if (field.componentType === 'checkbox') {
          element.checked = false;
        } else {
          element.value = '';
        }
        
        // Set value if exists
        if (value !== undefined && value !== null) {
          if (field.componentType === 'checkbox') {
            element.checked = Boolean(value);
          } else if (field.type === 'date') {
            // Convert ISO date to YYYY-MM-DD for input[type="date"]
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              element.value = date.toISOString().split('T')[0];
            }
          } else if (field.type === 'select' || field.componentType === 'relation' || field.type === 'relation') {
            // For select and relation fields, set the value
            element.value = value;
          } else {
            element.value = value;
          }
        }
      });
    }, 100); // Small delay to ensure options are loaded
  }

  show() {
    const modal = document.getElementById(this.id);
    if (modal) {
      modal.style.display = 'block';
    }
  }

  close() {
    const modal = document.getElementById(this.id);
    if (modal) {
      modal.style.display = 'none';
    }
    this.clearForm();
    this.currentData = null;
  }

  clearForm() {
    this.fields.forEach(field => {
      const element = document.getElementById(this.getFieldId(field));
      if (!element) return;
      
      if (field.componentType === 'checkbox') {
        element.checked = false;
      } else if (field.type === 'select' || field.componentType === 'relation' || field.type === 'relation') {
        element.value = '';
      } else {
        element.value = '';
      }
    });
  }

  showError(message) {
    const errorEl = document.getElementById(`${this.id}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      setTimeout(() => errorEl.textContent = '', 5000);
    }
  }
}