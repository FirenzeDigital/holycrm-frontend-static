// Generated module for Members
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { EnhancedCrudTable } from "./core/EnhancedCrudTable.js";
import { SmartModalForm } from "./core/SmartModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

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
  

  // Configure and create table
  table = new EnhancedCrudTable({
    container: '#members-body',
    headerContainer: '#members-headers',
    columns: [
  {
    "key": "first_name",
    "label": "Nombre",
    "format": null
  },
  {
    "key": "last_name",
    "label": "Apellido",
    "format": null
  },
  {
    "key": "email",
    "label": "Email",
    "format": null
  },
  {
    "key": "phone",
    "label": "Teléfono",
    "format": null
  },
  {
    "key": "status",
    "label": "Estado",
    "format": null
  }
],
    canEdit: can("update", "members"),
    canDelete: can("delete", "members"),
    onEdit: openRecordModal,
    onDelete: deleteRecord,
    searchInput: '#members-search',
    expand: ''
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
    "required": true
  },
  {
    "name": "last_name",
    "label": "Apellido",
    "type": "text",
    "required": true
  },
  {
    "name": "email",
    "label": "Email",
    "type": "email",
    "required": false
  },
  {
    "name": "phone",
    "label": "Teléfono",
    "type": "text",
    "required": false
  },
  {
    "name": "status",
    "label": "Estado",
    "type": "select",
    "required": true,
    "options": [
      {
        "value": "active",
        "label": "Active"
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
    "required": false
  },
  {
    "name": "tags",
    "label": "Etiquetas",
    "type": "textarea",
    "required": false,
    "placeholder": "Ej: [\"tag1\", \"tag2\"]"
  },
  {
    "name": "location",
    "label": "Ubicación",
    "type": "select",
    "required": false,
    "componentType": "relation",
    "relationCollection": "pbc_1942858786"
  }
],
    onSubmit: saveRecord,
    onLoadRelations: () => []
  });

  // Wire up the "New" button
  document.getElementById('members-new')?.addEventListener('click', () => openRecordModal());
}



async function refreshData() {
  console.log('Refreshing data for church:', currentChurchId);
  
  // Build expand parameter for relations
  let expand = '';
  
  
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
  if (!confirm('¿Eliminar registro?')) return;
  
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