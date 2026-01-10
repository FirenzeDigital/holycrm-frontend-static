// assets/js/core/ModalForm.js
export class ModalForm {
  constructor(config) {
    this.id = config.id || 'crud-modal';
    this.title = config.title || 'Formulario';
    this.fields = config.fields; // Array of field definitions
    this.onSubmit = config.onSubmit;
  }

  open(data = {}) {
    this.currentData = data;
    this.renderModal();
    this.populateForm(data);
    document.getElementById(this.id).style.display = 'block';
  }

  close() {
    document.getElementById(this.id).style.display = 'none';
    this.currentData = null;
  }

  renderModal() {
    if (document.getElementById(this.id)) return;

    const fieldHTML = this.fields.map(field => `
      <div class="field">
        <span>${field.label}</span>
        ${this.renderFieldInput(field)}
      </div>
    `).join('');

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

  renderFieldInput(field) {
    switch (field.componentType || field.type) { // Support both componentType and type
      case 'select':
        // FIX: Check if options exists and is an array
        let options = '';
        if (field.options && Array.isArray(field.options) && field.options.length > 0) {
          options = field.options.map(opt => 
            `<option value="${opt.value}">${opt.label}</option>`
          ).join('');
        } else {
          // Empty select for dynamic options (like relations)
          options = '<option value="">-- Seleccionar --</option>';
        }
        return `<select id="${field.name}" ${field.required ? 'required' : ''}>${options}</select>`;
      
      case 'checkbox':
        return `<input type="checkbox" id="${field.name}" ${field.checked ? 'checked' : ''}>`;
      
      case 'textarea':
        return `<textarea id="${field.name}" ${field.required ? 'required' : ''}></textarea>`;
      
      default:
        return `<input type="${field.type || 'text'}" id="${field.name}" ${field.required ? 'required' : ''}>`;
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
      await this.onSubmit(formData, this.currentData?.id);
      this.close();
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
          data[field.name] = parseFloat(element.value) || 0;
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

  populateForm(data) {
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
  }
}