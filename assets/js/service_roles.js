// Generated module for Service Roles
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

export async function initService_rolesView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize service
  dataService = new DataService('service_roles');

  // Check permissions
  const section = document.querySelector('section[data-view="service_roles"]');
  if (!can("read", "service_roles")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#service_roles-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  // Configure and create table
  table = new CrudTable({
    container: '#service_roles-body',
    headerContainer: '#service_roles-headers',
    columns: [
  {
    "key": "name",
    "label": "Name",
    "format": null
  },
  {
    "key": "description",
    "label": "Description",
    "format": null
  },
  {
    "key": "status",
    "label": "Status",
    "format": null
  }
],
    canEdit: can("update", "service_roles"),
    canDelete: can("delete", "service_roles"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'service_roles-modal',
    title: 'Service Roles',
    fields: [
  {
    "name": "name",
    "label": "Name",
    "type": "text",
    "required": true
  },
  {
    "name": "description",
    "label": "Description",
    "type": "text",
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
  }
],
    onSubmit: saveRecord
  });

  // Wire up the "New" button
  document.getElementById('service_roles-new')?.addEventListener('click', () => openRecordModal());
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
    <h1>Service Roles</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="service_roles-search">
        </div>
        <div class="members-actions">
          ${can("create", "service_roles") ? `<button id="service_roles-new">Nuevo</button>` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="service_roles-headers"></tr>
        </thead>
        <tbody id="service_roles-body"></tbody>
      </table>
    </div>
  `;
}