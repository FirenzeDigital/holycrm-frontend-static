// Generated module for Locations
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { EnhancedCrudTable } from "./core/EnhancedCrudTable.js";
import { SmartModalForm } from "./core/SmartModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

let relationData = {};

export async function initLocationsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize main service
  dataService = new DataService('locations');
  

  // Check permissions
  const section = document.querySelector('section[data-view="locations"]');
  if (!can("read", "locations")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#locations-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  

  // Configure and create table
  table = new EnhancedCrudTable({
    container: '#locations-body',
    headerContainer: '#locations-headers',
    columns: [
  {
    "key": "name",
    "label": "Nombre",
    "format": null
  },
  {
    "key": "city",
    "label": "Ciudad",
    "format": null
  },
  {
    "key": "pastor_name",
    "label": "Nombre del Pastor",
    "format": null
  },
  {
    "key": "status",
    "label": "Estado",
    "format": null
  }
],
    canEdit: can("update", "locations"),
    canDelete: can("delete", "locations"),
    onEdit: openRecordModal,
    onDelete: deleteRecord,
    searchInput: '#locations-search',
    expand: ''
  });

  // Configure and create modal form
  modal = new SmartModalForm({
    id: 'locations-modal',
    title: 'Locations',
    fields: [
  {
    "name": "name",
    "label": "Nombre",
    "type": "text",
    "required": true
  },
  {
    "name": "city",
    "label": "Ciudad",
    "type": "text",
    "required": false
  },
  {
    "name": "pastor_name",
    "label": "Nombre del Pastor",
    "type": "text",
    "required": false
  },
  {
    "name": "inauguration_date",
    "label": "Fecha de Inauguración",
    "type": "date",
    "required": false
  },
  {
    "name": "status",
    "label": "Estado",
    "type": "select",
    "required": false,
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
  }
],
    onSubmit: saveRecord,
    onLoadRelations: () => []
  });

  // Wire up the "New" button
  document.getElementById('locations-new')?.addEventListener('click', () => openRecordModal());
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
  console.log('Saving record:', data);
  
  const payload = {
    ...data,
    church: currentChurchId
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
  section.innerHTML = `
    <h1>Locations</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="locations-search">
        </div>
        <div class="members-actions">
          ${can("create", "locations") ? `<button id="locations-new">Nuevo</button>` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="locations-headers"></tr>
        </thead>
        <tbody id="locations-body"></tbody>
      </table>
    </div>
  `;
}