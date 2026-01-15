// Generated module for Members from OpenAPI
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { EnhancedCrudTable } from "./core/EnhancedCrudTable.js";
import { SmartModalForm } from "./core/SmartModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;
let churchesService;
  let locationsService;
let relationData = {};

export async function initMembersView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize main service
  dataService = new DataService('members');
  

  // Check permissions
  const section = document.querySelector('section[data-view="members"]');
  if (!can("read", "members")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#members-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  
  // Load relation data first
  relationData = await loadRelationData();
  

  // Configure and create table
  table = new EnhancedCrudTable({
    container: '#members-body',
    headerContainer: '#members-headers',
    columns: [
  {
    "key": "first_name",
    "label": "Nombre"
  },
  {
    "key": "last_name",
    "label": "Apellido"
  },
  {
    "key": "email",
    "label": "Email"
  },
  {
    "key": "phone",
    "label": "Teléfono"
  },
  {
    "key": "status",
    "label": "Estado"
  },
  {
    "key": "notes",
    "label": "Notas"
  },
  {
    "key": "location.name",
    "label": "Location"
  }
],
    canEdit: can("update", "members"),
    canDelete: can("delete", "members"),
    onEdit: openRecordModal,
    onDelete: deleteRecord,
    searchInput: '#members-search',
    expand: 'church,location'
  });

  // Configure and create modal form
  modal = new SmartModalForm({
    id: 'members-modal',
    title: 'Members',
    fields: [
  {
    "name": "first_name",
    "label": "Nombre",
    "type": "text",
    "componentType": "input",
    "required": true,
    "options": []
  },
  {
    "name": "last_name",
    "label": "Apellido",
    "type": "text",
    "componentType": "input",
    "required": true,
    "options": []
  },
  {
    "name": "email",
    "label": "Email",
    "type": "email",
    "componentType": "input",
    "required": false,
    "options": []
  },
  {
    "name": "phone",
    "label": "Teléfono",
    "type": "text",
    "componentType": "input",
    "required": false,
    "options": []
  },
  {
    "name": "status",
    "label": "Estado",
    "type": "select",
    "componentType": "select",
    "required": true,
    "options": [
      {
        "value": "active",
        "label": "Activo"
      },
      {
        "value": "inactive",
        "label": "Inactive"
      }
    ]
  },
  {
    "name": "notes",
    "label": "Notas",
    "type": "text",
    "componentType": "input",
    "required": false,
    "options": []
  },
  {
    "name": "tags",
    "label": "Tags",
    "type": "json",
    "componentType": "textarea",
    "required": false,
    "options": [],
    "placeholder": "Ej: {\"clave\": \"valor\"} o [\"item1\", \"item2\"]"
  },
  {
    "name": "location",
    "label": "Location",
    "type": "select",
    "componentType": "relation",
    "required": false,
    "options": [],
    "relationTo": "locations"
  },
  {
    "name": "created",
    "label": "Creado",
    "type": "date",
    "componentType": "date",
    "required": false,
    "options": []
  },
  {
    "name": "updated",
    "label": "Actualizado",
    "type": "date",
    "componentType": "date",
    "required": false,
    "options": []
  }
],
    onSubmit: saveRecord,
    onLoadRelations: loadRelationOptions
  });

  // Wire up the "New" button
  document.getElementById('members-new')?.addEventListener('click', () => openRecordModal());
}


  // Load relation data
  async function loadRelationData() {
    
    churchesService = new DataService('churches');
    const churchesData = await churchesService.getList(currentChurchId);
    console.log('Loaded churches:', churchesData.length);
    locationsService = new DataService('locations');
    const locationsData = await locationsService.getList(currentChurchId);
    console.log('Loaded locations:', locationsData.length);
    
    return {
      'churches': churchesData,
      'locations': locationsData
    };
  }
      

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
      

async function refreshData() {
  console.log('Refreshing data for church:', currentChurchId);
  
  // Build expand parameter for relations
  let expand = '';
  
  const expandFields = ["church","location"];
  expand = expandFields.join(',');
  
  
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
    ...data,
    church: currentChurchId
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
  section.innerHTML = `
    <h1>Members</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="members-search">
        </div>
        <div class="members-actions">
          ${can("create", "members") ? `<button id="members-new">Nuevo</button>` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="members-headers"></tr>
        </thead>
        <tbody id="members-body"></tbody>
      </table>
    </div>
  `;
}