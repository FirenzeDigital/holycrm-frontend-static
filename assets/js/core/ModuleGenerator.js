// assets/js/core/ModuleGenerator.js (FIXED)
export class ModuleGenerator {
  constructor() {
    this.fieldTypeMap = {
      'text': { type: 'text', component: 'input' },
      'email': { type: 'email', component: 'input' },
      'number': { type: 'number', component: 'input' },
      'bool': { type: 'checkbox', component: 'checkbox' },
      'select': { type: 'select', component: 'select' },
      'date': { type: 'date', component: 'input' },
      'relation': { type: 'select', component: 'relation' },
      'json': { type: 'text', component: 'textarea' }
    };
  }

  // Parse PocketBase collection JSON
  parseCollectionSchema(pbJson) {
    const schema = {
      collectionName: pbJson.name,
      collectionId: pbJson.id,
      fields: []
    };

    pbJson.fields.forEach(field => {
      // Skip system fields
      if (field.system || field.name === 'id' || field.name === 'created' || field.name === 'updated') {
        return;
      }

      const fieldInfo = {
        name: field.name,
        type: field.type,
        required: field.required || false,
        label: this.formatLabel(field.name),
        options: field.values || [],
        relation: field.collectionId || null
      };

      // Handle relation fields specially
      if (field.type === 'relation') {
        fieldInfo.componentType = 'relation';
        fieldInfo.inputType = 'select';
        // For church field, we should skip it (auto-filled)
        if (field.name === 'church') {
          return; // Skip adding this field entirely
        }
      } else {
        // Map other field types
        const mapped = this.fieldTypeMap[field.type] || { type: 'text', component: 'input' };
        fieldInfo.componentType = mapped.component;
        fieldInfo.inputType = mapped.type;
      }

      schema.fields.push(fieldInfo);
    });

    return schema;
  }

  formatLabel(fieldName) {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Generate module code from schema and configuration
  generateModule(config) {
    const { schema, tableColumns, formFields, moduleName, moduleLabel, icon } = config;
    
    // Capitalize the first letter for the function name
    const capitalizedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
    
    const template = this.getModuleTemplate();
    
    // Replace placeholders
    let code = template
      .replace(/{{MODULE_NAME}}/g, moduleName)
      .replace(/{{CAPITALIZED_MODULE_NAME}}/g, capitalizedModuleName)
      .replace(/{{MODULE_LABEL}}/g, moduleLabel)
      .replace(/{{COLLECTION_NAME}}/g, schema.collectionName)
      .replace(/{{ICON}}/g, icon)
      .replace(/{{TABLE_COLUMNS}}/g, JSON.stringify(tableColumns, null, 2))
      .replace(/{{FORM_FIELDS}}/g, JSON.stringify(formFields, null, 2))
      .replace(/{{PERMISSION_KEY}}/g, moduleName);

    return code;
  }

  getModuleTemplate() {
    return `// Generated module for {{MODULE_LABEL}}
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

export async function init{{CAPITALIZED_MODULE_NAME}}View(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize service
  dataService = new DataService('{{COLLECTION_NAME}}');

  // Check permissions
  const section = document.querySelector('section[data-view="{{MODULE_NAME}}"]');
  if (!can("read", "{{PERMISSION_KEY}}")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#{{MODULE_NAME}}-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  // Configure and create table
  table = new CrudTable({
    container: '#{{MODULE_NAME}}-body',
    headerContainer: '#{{MODULE_NAME}}-headers',
    columns: {{TABLE_COLUMNS}},
    canEdit: can("update", "{{PERMISSION_KEY}}"),
    canDelete: can("delete", "{{PERMISSION_KEY}}"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: '{{MODULE_NAME}}-modal',
    title: '{{MODULE_LABEL}}',
    fields: {{FORM_FIELDS}},
    onSubmit: saveRecord
  });

  // Wire up the "New" button
  document.getElementById('{{MODULE_NAME}}-new')?.addEventListener('click', () => openRecordModal());
}

async function refreshData() {
  const data = await dataService.getList(currentChurchId);
  table.render(data);
}

async function openRecordModal(id = null) {
  if (id) {
    const record = await dataService.getOne(id);
    modal.open(record);
  } else {
    modal.open({});
  }
}

async function saveRecord(data, id = null) {
  const payload = {
    ...data,
    church: currentChurchId  // Auto-fill church ID for multi-tenancy
  };

  if (id) {
    await dataService.update(id, payload);
  } else {
    await dataService.create(payload);
  }
  
  await refreshData();
}

async function deleteRecord(id) {
  await dataService.delete(id);
  await refreshData();
}

function renderLayout(section) {
  section.innerHTML = \`
    <h1>{{MODULE_LABEL}}</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="{{MODULE_NAME}}-search">
        </div>
        <div class="members-actions">
          \${can("create", "{{PERMISSION_KEY}}") ? \`<button id="{{MODULE_NAME}}-new">Nuevo</button>\` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="{{MODULE_NAME}}-headers"></tr>
        </thead>
        <tbody id="{{MODULE_NAME}}-body"></tbody>
      </table>
    </div>
  \`;
}`;
  }
}