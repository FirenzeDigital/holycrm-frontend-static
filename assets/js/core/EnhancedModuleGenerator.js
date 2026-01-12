// assets/js/core/EnhancedModuleGenerator.js (COMPLETELY REWRITTEN)
export class EnhancedModuleGenerator {
  constructor() {
    this.fieldTypeMap = {
      'text': { type: 'text', component: 'input' },
      'email': { type: 'email', component: 'input' },
      'number': { type: 'number', component: 'input' },
      'bool': { type: 'checkbox', component: 'checkbox' },
      'select': { type: 'select', component: 'select' },
      'date': { type: 'date', component: 'input' },
      'relation': { type: 'select', component: 'relation' },
      'json': { type: 'textarea', component: 'textarea' }
    };
    
    // Map common relation collections to their display fields
    this.relationDisplayFields = {
      'members': 'first_name,last_name',
      'ministries': 'name',
      'locations': 'name',
      'service_roles': 'name',
      'finance_categories': 'name',
      'groups': 'name',
      'events': 'title'
    };
  }

  parseCollectionSchema(pbJson) {
    const schema = {
      collectionName: pbJson.name,
      collectionId: pbJson.id,
      fields: [],
      hasChurchField: false,
      isChurchSpecific: true
    };

    pbJson.fields.forEach(field => {
      // Skip system fields
      if (field.system || field.name === 'id' || field.name === 'created' || field.name === 'updated') {
        return;
      }

      // Check for church field
      if (field.name === 'church' && field.type === 'relation') {
        schema.hasChurchField = true;
        return; // Skip adding to form/table, we'll handle it automatically
      }

      const fieldInfo = {
        name: field.name,
        type: field.type,
        required: field.required || false,
        label: this.formatLabel(field.name),
        options: field.values || [],
        relation: field.collectionId || null,
        relationCollection: field.collectionId ? this.getCollectionNameById(field.collectionId) : null
      };

      // Handle special field types
      if (field.type === 'relation') {
        fieldInfo.componentType = 'relation';
        fieldInfo.inputType = 'select';
        fieldInfo.relationCollection = this.getCollectionNameById(field.collectionId);
      } else {
        const mapped = this.fieldTypeMap[field.type] || { type: 'text', component: 'input' };
        fieldInfo.componentType = mapped.component;
        fieldInfo.inputType = mapped.type;
      }

      // Special handling for JSON fields
      if (field.type === 'json') {
        fieldInfo.placeholder = 'Ej: ["tag1", "tag2"]';
      }

      schema.fields.push(fieldInfo);
    });

    // If no church field, mark as global
    if (!schema.hasChurchField) {
      schema.isChurchSpecific = false;
    }

    return schema;
  }

  getCollectionNameById(collectionId) {
    // In a real app, you'd have a map of collection IDs to names
    // For now, we'll return a placeholder
    return collectionId ? `collection_${collectionId}` : null;
  }

  formatLabel(fieldName) {
    const labelMap = {
      'first_name': 'Nombre',
      'last_name': 'Apellido',
      'email': 'Email',
      'phone': 'Teléfono',
      'name': 'Nombre',
      'description': 'Descripción',
      'status': 'Estado',
      'notes': 'Notas',
      'tags': 'Etiquetas',
      'date': 'Fecha',
      'amount_cents': 'Monto (centavos)',
      'currency': 'Moneda',
      'concept': 'Concepto',
      'leader_member': 'Líder/Miembro',
      'location': 'Ubicación',
      'category': 'Categoría',
      'ministry': 'Ministerio',
      'event': 'Evento',
      'member': 'Miembro'
    };
    
    if (labelMap[fieldName]) {
      return labelMap[fieldName];
    }
    
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  generateModule(config) {
    const { schema, tableColumns, formFields, moduleName, moduleLabel, icon } = config;
    
    const capitalizedModuleName = this.toPascalCase(moduleName);
    
    // Determine if we need relation loading logic
    const hasRelations = formFields.some(f => f.type === 'relation');
    const relationCollections = [...new Set(
      formFields
        .filter(f => f.type === 'relation' && f.relationCollection)
        .map(f => f.relationCollection)
    )];
    
    const template = this.getModuleTemplate(hasRelations, relationCollections, schema.isChurchSpecific);
    
    let code = template
      .replace(/{{MODULE_NAME}}/g, moduleName)
      .replace(/{{CAPITALIZED_MODULE_NAME}}/g, capitalizedModuleName)
      .replace(/{{MODULE_LABEL}}/g, moduleLabel)
      .replace(/{{COLLECTION_NAME}}/g, schema.collectionName)
      .replace(/{{ICON}}/g, icon)
      .replace(/{{TABLE_COLUMNS}}/g, JSON.stringify(tableColumns, null, 2))
      .replace(/{{FORM_FIELDS}}/g, JSON.stringify(formFields, null, 2))
      .replace(/{{PERMISSION_KEY}}/g, moduleName)
      .replace(/{{IS_CHURCH_SPECIFIC}}/g, schema.isChurchSpecific ? 'true' : 'false')
      .replace(/{{RELATION_COLLECTIONS}}/g, JSON.stringify(relationCollections, null, 2));
    
    return code;
  }

  toPascalCase(str) {
    return str.replace(/(^\w|_\w)/g, match => 
      match.replace('_', '').toUpperCase()
    );
  }

  getModuleTemplate(hasRelations, relationCollections, isChurchSpecific) {
    let relationLoadingCode = '';
    let relationServicesCode = '';
    let loadRelationsFunction = '';
    
    if (hasRelations && relationCollections.length > 0) {
      relationServicesCode = `
  // Services for relation data
  ${relationCollections.map(col => {
    const serviceName = this.toCamelCase(col) + 'Service';
    return `let ${serviceName};`;
  }).join('\n  ')}
      `;
      
      relationLoadingCode = `
  // Load relation data for dropdowns
  async function loadRelationData() {
    ${relationCollections.map(col => {
      const serviceName = this.toCamelCase(col) + 'Service';
      const varName = col + 'Data';
      return `
    const ${varName} = await ${serviceName}.getList(currentChurchId);
    console.log('Loaded ${col}:', ${varName}.length);
    return { '${col}': ${varName} };`;
    }).join('\n    ')}
    
    return Object.assign({}, ${relationCollections.map(col => `'${col}': ${col}Data`).join(', ')});
  }
      `;
      
      loadRelationsFunction = `
  async function loadRelationOptions(field) {
    if (field.type !== 'relation') return [];
    
    const data = relationData[field.relationCollection] || [];
    return data.map(item => ({
      id: item.id,
      label: ${this.getRelationLabelLogic()}
    }));
  }
      `;
    }
    
    return `// Generated module for {{MODULE_LABEL}}
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { EnhancedCrudTable } from "./core/EnhancedCrudTable.js";
import { SmartModalForm } from "./core/SmartModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;
${relationServicesCode}
let relationData = {};

export async function init{{CAPITALIZED_MODULE_NAME}}View(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize main service
  dataService = new DataService('{{COLLECTION_NAME}}'${isChurchSpecific ? '' : ', null'});
  ${!isChurchSpecific ? 'dataService.markAsGlobal();' : ''}

  // Initialize relation services
  ${hasRelations ? relationCollections.map(col => {
    const serviceName = this.toCamelCase(col) + 'Service';
    return `
  ${serviceName} = new DataService('${col}');`;
  }).join('\n  ') : ''}

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
  ${hasRelations ? `
  // Load relation data first
  relationData = await loadRelationData();
  ` : ''}

  // Configure and create table
  table = new EnhancedCrudTable({
    container: '#{{MODULE_NAME}}-body',
    headerContainer: '#{{MODULE_NAME}}-headers',
    columns: {{TABLE_COLUMNS}},
    canEdit: can("update", "{{PERMISSION_KEY}}"),
    canDelete: can("delete", "{{PERMISSION_KEY}}"),
    onEdit: openRecordModal,
    onDelete: deleteRecord,
    searchInput: '#{{MODULE_NAME}}-search'
  });

  // Configure and create modal form
  modal = new SmartModalForm({
    id: '{{MODULE_NAME}}-modal',
    title: '{{MODULE_LABEL}}',
    fields: {{FORM_FIELDS}},
    onSubmit: saveRecord,
    onLoadRelations: loadRelationOptions
  });

  // Wire up the "New" button
  document.getElementById('{{MODULE_NAME}}-new')?.addEventListener('click', () => openRecordModal());
}

${relationLoadingCode || ''}
${loadRelationsFunction || ''}

async function refreshData() {
  console.log('Refreshing data for church:', currentChurchId);
  const data = await dataService.getList(currentChurchId);
  console.log('Got data:', data.length, 'records');
  table.render(data);
}

async function openRecordModal(id = null) {
  if (id) {
    const record = await dataService.getOne(id);
    console.log('Opening record:', record);
    await modal.open(record);
  } else {
    await modal.open({});
  }
}

async function saveRecord(data, id = null) {
  console.log('Saving record:', data);
  
  const payload = {
    ...data${isChurchSpecific ? ',\n    church: currentChurchId' : ''}
  };

  if (id) {
    await dataService.update(id, payload);
  } else {
    await dataService.create(payload);
  }
  
  await refreshData();
}

async function deleteRecord(id) {
  if (!confirm('¿Eliminar registro?')) return;
  
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

  toCamelCase(str) {
    return str.replace(/[_-](\w)/g, (_, letter) => letter.toUpperCase());
  }

  getRelationLabelLogic() {
    // This would generate logic based on the relationDisplayFields map
    return `item.name || item.title || item.first_name + ' ' + item.last_name || item.id`;
  }
}