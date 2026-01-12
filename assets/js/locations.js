// Generated module for Locations
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

export async function initLocationsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize service
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
  table = new CrudTable({
    container: '#locations-body',
    headerContainer: '#locations-headers',
    columns: [
  {
    "key": "name",
    "label": "Name",
    "format": null
  },
  {
    "key": "city",
    "label": "City",
    "format": null
  },
  {
    "key": "pastor_name",
    "label": "Pastor Name",
    "format": null
  },
  {
    "key": "status",
    "label": "Status",
    "format": null
  }
],
    canEdit: can("update", "locations"),
    canDelete: can("delete", "locations"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'locations-modal',
    title: 'Locations',
    fields: [
  {
    "name": "name",
    "label": "Name",
    "type": "text",
    "required": true
  },
  {
    "name": "city",
    "label": "City",
    "type": "text",
    "required": false
  },
  {
    "name": "pastor_name",
    "label": "Pastor Name",
    "type": "text",
    "required": false
  },
  {
    "name": "inauguration_date",
    "label": "Inauguration Date",
    "type": "date",
    "required": false
  },
  {
    "name": "status",
    "label": "Status",
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
    "label": "Notes",
    "type": "text",
    "required": false
  }
],
    onSubmit: saveRecord
  });

  // Wire up the "New" button
  document.getElementById('locations-new')?.addEventListener('click', () => openRecordModal());
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