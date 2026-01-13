// assets/js/core/EnhancedModuleGenerator.js
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
        return;
      }

      const fieldInfo = {
        name: field.name,
        type: field.type,
        required: field.required || false,
        label: this.formatLabel(field.name),
        options: field.values || []
      };

      // Handle special field types
      if (field.type === 'relation') {
        fieldInfo.componentType = 'relation';
        fieldInfo.inputType = 'select';
        fieldInfo.relationCollection = field.collectionId;
        fieldInfo.maxSelect = field.maxSelect || 1;
      } else {
        const mapped = this.fieldTypeMap[field.type] || { type: 'text', component: 'input' };
        fieldInfo.componentType = mapped.component;
        fieldInfo.inputType = mapped.type;
      }

      schema.fields.push(fieldInfo);
    });

    return schema;
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
      'amount': 'Monto',
      'currency': 'Moneda',
      'concept': 'Concepto',
      'leader_member': 'Líder',
      'location': 'Ubicación',
      'category': 'Categoría',
      'ministry': 'Ministerio',
      'event': 'Evento',
      'member': 'Miembro',
      'city': 'Ciudad',
      'pastor_name': 'Nombre del Pastor',
      'inauguration_date': 'Fecha de Inauguración'
    };
    
    return labelMap[fieldName] || 
      fieldName.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }

  generateModule(config) {
    const { schema, tableColumns, formFields, moduleName, moduleLabel, icon } = config;
    
    const capitalizedModuleName = this.toPascalCase(moduleName);
    const relationFields = formFields.filter(f => f.type === 'relation');
    const hasRelations = relationFields.length > 0;
    
    let relationLoadingCode = '';
    let relationServicesCode = '';
    
    if (hasRelations) {
      const uniqueCollections = [...new Set(
        relationFields
          .map(f => this.getCollectionNameFromId(f.relationCollection))
          .filter(Boolean)
      )];
      
      relationServicesCode = uniqueCollections.map(col => {
        const varName = this.toCamelCase(col) + 'Service';
        return `let ${varName};`;
      }).join('\n  ');
      
      relationLoadingCode = `
  // Load relation data
  async function loadRelationData() {
    ${uniqueCollections.map(col => {
      const serviceName = this.toCamelCase(col) + 'Service';
      const varName = this.toCamelCase(col) + 'Data';
      return `
    ${serviceName} = new DataService('${col}');
    const ${varName} = await ${serviceName}.getList(currentChurchId);
    console.log('Loaded ${col}:', ${varName}.length);`;
    }).join('')}
    
    return {
      ${uniqueCollections.map(col => {
        const varName = this.toCamelCase(col) + 'Data';
        return `'${col}': ${varName}`;
      }).join(',\n      ')}
    };
  }
  
  async function loadRelationOptions(field) {
    if (field.type !== 'relation') return [];
    
    const collectionName = getCollectionNameFromId(field.relationCollection);
    const data = relationData[collectionName] || [];
    
    return data.map(item => ({
      id: item.id,
      label: getDisplayLabel(item)
    }));
  }
  
  function getCollectionNameFromId(collectionId) {
    // Map collection IDs to names
    const idMap = {
      ${relationFields.map(f => `'${f.relationCollection}': '${this.getCollectionNameFromId(f.relationCollection)}'`).join(',\n      ')}
    };
    return idMap[collectionId] || collectionId;
  }
  
  function getDisplayLabel(item) {
    if (item.name) return item.name;
    if (item.title) return item.title;
    if (item.first_name && item.last_name) return item.first_name + ' ' + item.last_name;
    return item.id;
  }
      `;
    }

    const template = `
// Generated module for ${moduleLabel}
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { EnhancedCrudTable } from "./core/EnhancedCrudTable.js";
import { SmartModalForm } from "./core/SmartModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;
${relationServicesCode}
let relationData = {};

export async function init${capitalizedModuleName}View(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize main service
  dataService = new DataService('${schema.collectionName}');
  ${!schema.isChurchSpecific ? 'dataService.markAsGlobal();' : ''}

  // Check permissions
  const section = document.querySelector('section[data-view="${moduleName}"]');
  if (!can("read", "${moduleName}")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#${moduleName}-body")) {
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
    container: '#${moduleName}-body',
    headerContainer: '#${moduleName}-headers',
    columns: ${JSON.stringify(tableColumns, null, 2)},
    canEdit: can("update", "${moduleName}"),
    canDelete: can("delete", "${moduleName}"),
    onEdit: openRecordModal,
    onDelete: deleteRecord,
    searchInput: '#${moduleName}-search',
    expand: ${hasRelations ? "'" + relationFields.map(f => f.name).join(',') + "'" : "''"}
  });

  // Configure and create modal form
  modal = new SmartModalForm({
    id: '${moduleName}-modal',
    title: '${moduleLabel}',
    fields: ${JSON.stringify(formFields, null, 2)},
    onSubmit: saveRecord,
    onLoadRelations: ${hasRelations ? 'loadRelationOptions' : '() => []'}
  });

  // Wire up the "New" button
  document.getElementById('${moduleName}-new')?.addEventListener('click', () => openRecordModal());
}

${relationLoadingCode || ''}

async function refreshData() {
  console.log('Refreshing data for church:', currentChurchId);
  
  // Build expand parameter for relations
  let expand = '';
  ${hasRelations ? `
  const expandFields = ${JSON.stringify(relationFields.map(f => f.name))};
  expand = expandFields.join(',');
  ` : ''}
  
  const data = await dataService.getList(currentChurchId, expand);
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
  console.log('Saving record. ID:', id, 'Data:', data);
  
  const payload = {
    ...data${schema.isChurchSpecific ? ',\n    church: currentChurchId' : ''}
  };

  try {
    if (id) {
      console.log('Updating existing record:', id);
      await dataService.update(id, payload);
    } else {
      console.log('Creating new record');
      await dataService.create(payload);
    }
    
    await refreshData();
  } catch (error) {
    console.error('Error saving record:', error);
    alert('Error al guardar: ' + error.message);
    throw error;
  }
}

async function deleteRecord(id) {
  if (!confirm('¿Eliminar registro?')) return;
  
  await dataService.delete(id);
  await refreshData();
}

function renderLayout(section) {
  section.innerHTML = \`
    <h1>${moduleLabel}</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="${moduleName}-search">
        </div>
        <div class="members-actions">
          \${can("create", "${moduleName}") ? \`<button id="${moduleName}-new">Nuevo</button>\` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="${moduleName}-headers"></tr>
        </thead>
        <tbody id="${moduleName}-body"></tbody>
      </table>
    </div>
  \`;
}`;

    return template;
  }

  getCollectionNameFromId(collectionId) {
    // This should map to your actual collection names
    // For now, return a placeholder - you'll need to implement this
    return `collection_${collectionId}`;
  }

  toPascalCase(str) {
    return str.replace(/(^\w|_\w)/g, match => 
      match.replace('_', '').toUpperCase()
    );
  }

  toCamelCase(str) {
    return str.replace(/[_-](\w)/g, (_, letter) => letter.toUpperCase());
  }
}