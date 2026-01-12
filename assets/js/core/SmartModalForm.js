// assets/js/core/SmartModalForm.js (NEW - REPLACES ModalForm.js)
export class SmartModalForm {
  constructor(config) {
    this.id = config.id || 'smart-modal';
    this.title = config.title || 'Formulario';
    this.fields = config.fields; // Now includes relationConfig
    this.onSubmit = config.onSubmit;
    this.onLoadRelations = config.onLoadRelations; // Callback to load relation data
    this.relationCache = new Map(); // Cache for relation data
  }

  async open(data = {}) {
    this.currentData = data;
    await this.renderModal();
    await this.populateForm(data);
    document.getElementById(this.id).style.display = 'block';
  }

  async renderModal() {
    if (document.getElementById(this.id)) {
      // Modal already exists, just update options if needed
      await this.updateRelationOptions();
      return;
    }

    const fieldHTML = await Promise.all(
      this.fields.map(async field => `
        <div class="field">
          <span>${field.label}</span>
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
              <button type="button" data-close="1">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.bindEvents();
    
    // Load relation data after modal is rendered
    await this.updateRelationOptions();
  }

  async renderFieldInput(field) {
    switch (field.componentType || field.type) {
      case 'select':
      case 'relation':
        // For relations, we'll load options dynamically
        const options = await this.getFieldOptions(field);
        return `<select id="${field.name}" ${field.required ? 'required' : ''}>
          <option value="">-- Seleccionar --</option>
          ${options}
        </select>`;
      
      case 'checkbox':
        return `<input type="checkbox" id="${field.name}" ${field.checked ? 'checked' : ''}>`;
      
      case 'textarea':
        return `<textarea id="${field.name}" ${field.required ? 'required' : ''} rows="4"></textarea>`;
      
      case 'date':
        return `<input type="date" id="${field.name}" ${field.required ? 'required' : ''}>`;
      
      case 'number':
        return `<input type="number" id="${field.name}" ${field.required ? 'required' : ''} 
                step="${field.step || '0.01'}" ${field.min ? `min="${field.min}"` : ''}>`;
      
      default:
        return `<input type="${field.type || 'text'}" id="${field.name}" 
                ${field.required ? 'required' : ''} 
                ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}>`;
    }
  }

  async getFieldOptions(field) {
    // If field has static options, use them
    if (field.options && Array.isArray(field.options)) {
      return field.options.map(opt => 
        `<option value="${opt.value}">${opt.label}</option>`
      ).join('');
    }
    
    // If field is a relation, load options from cache or server
    if (field.type === 'relation' || field.componentType === 'relation') {
      const options = await this.loadRelationOptions(field);
      return options.map(opt => 
        `<option value="${opt.id}">${opt.label}</option>`
      ).join('');
    }
    
    return '';
  }

  async loadRelationOptions(field) {
    const cacheKey = field.relationCollection || field.name;
    
    // Check cache first
    if (this.relationCache.has(cacheKey)) {
      return this.relationCache.get(cacheKey);
    }
    
    // Load via callback if provided
    if (this.onLoadRelations) {
      const options = await this.onLoadRelations(field);
      this.relationCache.set(cacheKey, options);
      return options;
    }
    
    // Default empty
    return [];
  }

  async updateRelationOptions() {
    // Update all relation select elements with fresh data
    for (const field of this.fields) {
      if (field.type === 'relation' || field.componentType === 'relation') {
        const element = document.getElementById(field.name);
        if (element) {
          const options = await this.getFieldOptions(field);
          element.innerHTML = `<option value="">-- Seleccionar --</option>${options}`;
        }
      }
    }
  }

  bindEvents() {
    const modal = document.getElementById(this.id);
    const form = document.getElementById(`${this.id}-form`);

    modal.querySelectorAll('[data-close="1"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = this.getFormData();
      try {
        await this.onSubmit(formData, this.currentData?.id);
        this.close();
      } catch (error) {
        const errorEl = document.getElementById(`${this.id}-error`);
        if (errorEl) {
          errorEl.textContent = error.message || 'Error al guardar';
        }
      }
    });
  }

  getFormData() {
    const data = {};
    this.fields.forEach(field => {
      const element = document.getElementById(field.name);
      if (element) {
        if (field.componentType === 'checkbox') {
          data[field.name] = element.checked;
        } else if (field.type === 'number') {
          data[field.name] = element.value ? parseFloat(element.value) : null;
        } else if (field.type === 'json') {
          try {
            data[field.name] = JSON.parse(element.value);
          } catch {
            data[field.name] = element.value;
          }
        } else {
          data[field.name] = element.value;
        }
      }
    });
    return data;
  }

  async populateForm(data) {
    this.fields.forEach(field => {
      const element = document.getElementById(field.name);
      if (element && data[field.name] !== undefined) {
        if (field.componentType === 'checkbox') {
          element.checked = Boolean(data[field.name]);
        } else {
          element.value = data[field.name];
        }
      }
    });
    
    // Force update of relation fields to set correct selected option
    setTimeout(() => {
      this.fields.forEach(field => {
        const element = document.getElementById(field.name);
        if (element && data[field.name] !== undefined && 
            (field.type === 'relation' || field.componentType === 'relation')) {
          element.value = data[field.name];
        }
      });
    }, 100);
  }

  close() {
    const modal = document.getElementById(this.id);
    if (modal) {
      modal.style.display = 'none';
    }
    this.currentData = null;
  }
}