// assets/js/core/SmartModalForm.js
export class SmartModalForm {
  constructor(config) {
    this.id = config.id || 'smart-modal';
    this.title = config.title || 'Formulario';
    this.fields = config.fields;
    this.onSubmit = config.onSubmit;
    this.onLoadRelations = config.onLoadRelations || (() => []);
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
      return; // Modal already exists
    }

    const fieldHTML = await Promise.all(
      this.fields.map(async field => `
        <div class="field">
          <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
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
  }

  async renderFieldInput(field) {
    const fieldId = `${this.id}-${field.name}`;
    
    switch (field.componentType || field.type) {
      case 'select':
        const staticOptions = field.options || [];
        const optionsHTML = staticOptions.map(opt => 
          `<option value="${opt.value || opt}">${opt.label || opt}</option>`
        ).join('');
        return `<select id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''}>
          <option value="">-- Seleccionar --</option>
          ${optionsHTML}
        </select>`;
      
      case 'relation':
        const relationOptions = await this.onLoadRelations(field);
        const relationHTML = relationOptions.map(opt => 
          `<option value="${opt.id}">${opt.label}</option>`
        ).join('');
        return `<select id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''}>
          <option value="">-- Seleccionar --</option>
          ${relationHTML}
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
        this.showError(error.message || 'Error al guardar');
      }
    });
  }

  getFormData() {
    const data = {};
    const form = document.getElementById(`${this.id}-form`);
    if (!form) return data;
    
    const formData = new FormData(form);
    
    this.fields.forEach(field => {
      const element = document.getElementById(`${this.id}-${field.name}`);
      if (element) {
        if (field.componentType === 'checkbox') {
          data[field.name] = element.checked;
        } else if (field.type === 'number') {
          data[field.name] = element.value ? parseFloat(element.value) : null;
        } else {
          data[field.name] = formData.get(field.name);
        }
      }
    });
    
    return data;
  }

  async populateForm(data) {
    this.fields.forEach(field => {
      const element = document.getElementById(`${this.id}-${field.name}`);
      if (element && data[field.name] !== undefined && data[field.name] !== null) {
        if (field.componentType === 'checkbox') {
          element.checked = Boolean(data[field.name]);
        } else if (field.type === 'select' || field.componentType === 'relation') {
          // Set select value
          element.value = data[field.name];
        } else {
          element.value = data[field.name];
        }
      }
    });
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
    this.currentData = null;
  }

  showError(message) {
    const errorEl = document.getElementById(`${this.id}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      setTimeout(() => errorEl.textContent = '', 5000);
    }
  }
}