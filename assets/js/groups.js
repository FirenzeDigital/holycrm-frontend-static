// Generated module for Groups
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { EnhancedCrudTable } from "./core/EnhancedCrudTable.js";
import { SmartModalForm } from "./core/SmartModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

let relationData = {};

export async function initGroupsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize main service
  dataService = new DataService('groups');
  

  // Check permissions
  const section = document.querySelector('section[data-view="groups"]');
  if (!can("read", "groups")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#groups-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  

  // Configure and create table
  table = new EnhancedCrudTable({
    container: '#groups-body',
    headerContainer: '#groups-headers',
    columns: [
  {
    "key": "name",
    "label": "Nombre",
    "format": null
  },
  {
    "key": "type",
    "label": "Type",
    "format": null
  },
  {
    "key": "meeting_day",
    "label": "Meeting Day",
    "format": null
  },
  {
    "key": "meeting_time",
    "label": "Meeting Time",
    "format": null
  },
  {
    "key": "location",
    "label": "Ubicación",
    "format": null
  },
  {
    "key": "status",
    "label": "Estado",
    "format": null
  }
],
    canEdit: can("update", "groups"),
    canDelete: can("delete", "groups"),
    onEdit: openRecordModal,
    onDelete: deleteRecord,
    searchInput: '#groups-search',
    expand: ''
  });

  // Configure and create modal form
  modal = new SmartModalForm({
    id: 'groups-modal',
    title: 'Groups',
    fields: [
  {
    "name": "name",
    "label": "Nombre",
    "type": "text",
    "required": true
  },
  {
    "name": "type",
    "label": "Type",
    "type": "select",
    "required": false,
    "options": [
      {
        "value": "small_group",
        "label": "Small Group"
      },
      {
        "value": "ministry",
        "label": "Ministerio"
      },
      {
        "value": "team",
        "label": "Team"
      },
      {
        "value": "class",
        "label": "Class"
      }
    ]
  },
  {
    "name": "description",
    "label": "Descripción",
    "type": "text",
    "required": false
  },
  {
    "name": "meeting_day",
    "label": "Meeting Day",
    "type": "select",
    "required": false,
    "options": [
      {
        "value": "mon",
        "label": "Mon"
      },
      {
        "value": "tue",
        "label": "Tue"
      },
      {
        "value": "wed",
        "label": "Wed"
      },
      {
        "value": "thu",
        "label": "Thu"
      },
      {
        "value": "fri",
        "label": "Fri"
      },
      {
        "value": "sat",
        "label": "Sat"
      },
      {
        "value": "sun",
        "label": "Sun"
      }
    ]
  },
  {
    "name": "meeting_time",
    "label": "Meeting Time",
    "type": "text",
    "required": false
  },
  {
    "name": "location",
    "label": "Ubicación",
    "type": "text",
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
    "name": "tags",
    "label": "Etiquetas",
    "type": "textarea",
    "required": false,
    "placeholder": "Ej: [\"tag1\", \"tag2\"]"
  }
],
    onSubmit: saveRecord,
    onLoadRelations: () => []
  });

  // Wire up the "New" button
  document.getElementById('groups-new')?.addEventListener('click', () => openRecordModal());
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
    <h1>Groups</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="groups-search">
        </div>
        <div class="members-actions">
          ${can("create", "groups") ? `<button id="groups-new">Nuevo</button>` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="groups-headers"></tr>
        </thead>
        <tbody id="groups-body"></tbody>
      </table>
    </div>
  `;
}