export class OpenAPIModuleGenerator {
  constructor() {
    this.fieldTypeMap = {
      'string': { 
        text: { type: 'text', component: 'input' },
        email: { type: 'email', component: 'input' },
        password: { type: 'password', component: 'input' },
        default: { type: 'text', component: 'input' }
      },
      'number': { type: 'number', component: 'input' },
      'integer': { type: 'number', component: 'input' },
      'boolean': { type: 'checkbox', component: 'checkbox' },
      'object': { type: 'json', component: 'textarea' },
      'array': { type: 'json', component: 'textarea' }
    };
  }

  parseOpenAPISpec(openapiSpec, collectionName) {
    const schema = {
      collectionName: collectionName,
      fields: [],
      hasChurchField: false,
      isChurchSpecific: false,
      relationFields: []
    };

    // Find the record schema for this collection
    const recordSchema = openapiSpec.components.schemas[`${collectionName}Record`];
    if (!recordSchema) {
      throw new Error(`Schema not found for ${collectionName}`);
    }

    // Parse fields from the schema
    Object.entries(recordSchema.properties || {}).forEach(([fieldName, fieldDef]) => {
      // Skip ID field (handled automatically)
      if (fieldName === 'id') return;
      
      // Check if this is a relation field
      const isRelation = fieldDef.description && fieldDef.description.includes('Relation field');
      
      const fieldInfo = {
        name: fieldName,
        type: fieldDef.type || 'string',
        required: (recordSchema.required || []).includes(fieldName),
        label: this.formatLabel(fieldName),
        description: fieldDef.description || '',
        enum: fieldDef.enum || [],
        format: fieldDef.format,
        isRelation: isRelation,
        relationTo: isRelation ? this.guessRelationCollection(fieldName, collectionName, openapiSpec) : null
      };

      // Map field type to component
      if (isRelation) {
        fieldInfo.componentType = 'relation';
        fieldInfo.inputType = 'select';
        schema.relationFields.push(fieldInfo);
      } else if (fieldDef.type === 'boolean') {
        fieldInfo.componentType = 'checkbox';
        fieldInfo.inputType = 'checkbox';
      } else if (fieldDef.enum && fieldDef.enum.length > 0) {
        fieldInfo.componentType = 'select';
        fieldInfo.inputType = 'select';
        fieldInfo.options = fieldDef.enum.map(value => ({
          value: value,
          label: this.formatLabel(value)
        }));
      } else if (fieldDef.format === 'date-time') {
        fieldInfo.componentType = 'date';
        fieldInfo.inputType = 'date';
      } else {
        const typeMap = this.fieldTypeMap[fieldDef.type] || this.fieldTypeMap.string;
        const specificMap = typeMap[fieldDef.format] || typeMap.default || typeMap;
        fieldInfo.componentType = specificMap.component;
        fieldInfo.inputType = specificMap.type;
      }

      // Check for church field
      if (fieldName === 'church' && isRelation) {
        schema.hasChurchField = true;
        schema.isChurchSpecific = true;
        return; // Skip adding church field to form
      }

      schema.fields.push(fieldInfo);
    });

    return schema;
  }

  guessRelationCollection(fieldName, currentCollection, openapiSpec) {
    // Try to find the related collection based on common patterns
    const possibleCollections = Object.keys(openapiSpec.components.schemas)
      .filter(name => name.endsWith('Record'))
      .map(name => name.replace('Record', '').toLowerCase());
    
    // Common patterns
    if (fieldName === 'church' || fieldName === 'churches') return 'churches';
    if (fieldName === 'location' || fieldName === 'locations') return 'locations';
    if (fieldName === 'member' || fieldName === 'members') return 'members';
    if (fieldName === 'ministry' || fieldName === 'ministries') return 'ministries';
    if (fieldName === 'category' || fieldName === 'categories') return 'finance_categories';
    if (fieldName === 'event' || fieldName === 'events') return 'events';
    if (fieldName === 'group' || fieldName === 'groups') return 'groups';
    if (fieldName === 'service_role') return 'service_roles';
    
    // Try singular/plural matching
    const singular = this.singularize(fieldName);
    if (possibleCollections.includes(singular)) return singular;
    
    const plural = this.pluralize(fieldName);
    if (possibleCollections.includes(plural)) return plural;
    
    // Default: use field name
    return fieldName;
  }

  singularize(word) {
    if (word.endsWith('ies')) return word.replace(/ies$/, 'y');
    if (word.endsWith('es')) return word.replace(/es$/, '');
    if (word.endsWith('s')) return word.replace(/s$/, '');
    return word;
  }

  pluralize(word) {
    if (word.endsWith('y')) return word.replace(/y$/, 'ies');
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') || 
        word.endsWith('ch') || word.endsWith('sh')) return word + 'es';
    return word + 's';
  }

  formatLabel(fieldName) {
    const labelMap = {
      'first_name': 'Nombre',
      'last_name': 'Apellido',
      'email': 'Email',
      'phone': 'Teléfono',
      'name': 'Nombre',
      'title': 'Título',
      'description': 'Descripción',
      'notes': 'Notas',
      'status': 'Estado',
      'created': 'Creado',
      'updated': 'Actualizado',
      'date': 'Fecha',
      'starts_at': 'Comienza',
      'ends_at': 'Termina',
      'amount_cents': 'Monto (centavos)',
      'currency': 'Moneda',
      'city': 'Ciudad',
      'pastor_name': 'Nombre del Pastor',
      'inauguration_date': 'Fecha de Inauguración',
      'location_place': 'Lugar',
      'location_point': 'Punto en Mapa',
      'location_text': 'Texto de Ubicación',
      'weekday': 'Día de la Semana',
      'time': 'Hora',
      'duration_minutes': 'Duración (minutos)',
      'method': 'Método',
      'reference': 'Referencia',
      'concept': 'Concepto',
      'kind': 'Tipo',
      'active': 'Activo',
      'sort': 'Orden',
      'role': 'Rol',
      'verified': 'Verificado',
      'avatar': 'Avatar',
      'logo': 'Logo',
      'slug': 'Slug',
      'subdomain': 'Subdominio',
      'vanity_domain': 'Dominio Personalizado',
      'theme_color': 'Color del Tema',
      'meeting_day': 'Día de Reunión',
      'meeting_time': 'Hora de Reunión',
      'type': 'Tipo'
    };
    
    return labelMap[fieldName] || 
      fieldName.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }

  generateTableColumns(schema, includeRelations = false) {
    const columns = [];
    
    schema.fields.forEach(field => {
      // Skip system fields and JSON fields for table
      if (field.name === 'created' || field.name === 'updated' || 
          field.type === 'object' || field.type === 'array') {
        return;
      }
      
      // Skip relation fields unless specified
      if (field.isRelation && !includeRelations) {
        return;
      }
      
      const column = {
        key: field.isRelation ? field.name + '.name' : field.name,
        label: field.label,
        format: field.type === 'boolean' ? (value) => value ? 'Sí' : 'No' : undefined
      };
      
      columns.push(column);
    });
    
    return columns;
  }

  generateFormFields(schema) {
    const formFields = [];
    
    schema.fields.forEach(field => {
      const formField = {
        name: field.name,
        label: field.label,
        type: field.inputType || field.type,
        componentType: field.componentType,
        required: field.required || false,
        options: field.options || []
      };
      
      // Add relation info if needed
      if (field.isRelation && field.relationTo) {
        formField.relationTo = field.relationTo;
      }
      
      // Add placeholder for JSON fields
      if (field.type === 'object' || field.type === 'array') {
        formField.placeholder = 'Ej: {"clave": "valor"} o ["item1", "item2"]';
      }
      
      formFields.push(formField);
    });
    
    return formFields;
  }

  generateModule(config) {
    const { schema, openapiSpec, moduleName, moduleLabel, icon } = config;
    
    const capitalizedModuleName = this.toPascalCase(moduleName);
    const hasRelations = schema.relationFields.length > 0;
    
    // Generate table columns
    const tableColumns = this.generateTableColumns(schema, true);
    
    // Generate form fields
    const formFields = this.generateFormFields(schema);
    
    // Build relation services code
    let relationServicesCode = '';
    let relationLoadingCode = '';
    let loadRelationFunction = '';
    
    if (hasRelations) {
      const uniqueRelations = [...new Set(schema.relationFields.map(f => f.relationTo).filter(Boolean))];
      
      relationServicesCode = uniqueRelations.map(col => {
        const varName = this.toCamelCase(col) + 'Service';
        return `let ${varName};`;
      }).join('\n  ');
      
      relationLoadingCode = `
  // Load relation data
  async function loadRelationData() {
    ${uniqueRelations.map(col => {
      const serviceName = this.toCamelCase(col) + 'Service';
      const varName = this.toCamelCase(col) + 'Data';
      return `
    ${serviceName} = new DataService('${col}');
    const ${varName} = await ${serviceName}.getList(currentChurchId);
    console.log('Loaded ${col}:', ${varName}.length);`;
    }).join('')}
    
    return {
      ${uniqueRelations.map(col => {
        const varName = this.toCamelCase(col) + 'Data';
        return `'${col}': ${varName}`;
      }).join(',\n      ')}
    };
  }
      `;
      
      loadRelationFunction = `
  async function loadRelationOptions(field) {
    if (!field.relationTo) return [];
    
    const data = relationData[field.relationTo] || [];
    return data.map(item => ({
      id: item.id,
      label: getDisplayLabel(item)
    }));
  }
  
  function getDisplayLabel(item) {
    // Try common display fields in order
    if (item.name) return item.name;
    if (item.title) return item.title;
    if (item.first_name && item.last_name) return item.first_name + ' ' + item.last_name;
    if (item.email) return item.email;
    return item.id;
  }
      `;
    }

    // Build the module template
    const template = `// Generated module for ${moduleLabel} from OpenAPI
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
  dataService = new DataService('${schema.collectionName}'${schema.isChurchSpecific ? '' : ', null'});
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
    expand: ${hasRelations ? "'" + schema.relationFields.map(f => f.name).join(',') + "'" : "''"}
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
${loadRelationFunction || ''}

async function refreshData() {
  console.log('Refreshing data for church:', currentChurchId);
  
  // Build expand parameter for relations
  let expand = '';
  ${hasRelations ? `
  const expandFields = ${JSON.stringify(schema.relationFields.map(f => f.name))};
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
  if (!confirm('¿Está seguro de eliminar este registro?')) return;
  
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

  toPascalCase(str) {
    return str.replace(/(^\w|_\w)/g, match => 
      match.replace('_', '').toUpperCase()
    );
  }

  toCamelCase(str) {
    return str.replace(/[_-](\w)/g, (_, letter) => letter.toUpperCase());
  }
}