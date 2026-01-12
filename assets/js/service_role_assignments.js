// Generated module for Service Role Assignments
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

export async function initService_role_assignmentsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize service
  dataService = new DataService('service_role_assignments');

  // Check permissions
  const section = document.querySelector('section[data-view="service_role_assignments"]');
  if (!can("read", "service_role_assignments")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#service_role_assignments-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  // Configure and create table
  table = new CrudTable({
    container: '#service_role_assignments-body',
    headerContainer: '#service_role_assignments-headers',
    columns: [
  {
    "key": "service_role",
    "label": "Service Role",
    "format": null
  },
  {
    "key": "date",
    "label": "Date",
    "format": "val => val?.split('T')[0]"
  },
  {
    "key": "assigned_member",
    "label": "Assigned Member",
    "format": null
  }
],
    canEdit: can("update", "service_role_assignments"),
    canDelete: can("delete", "service_role_assignments"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'service_role_assignments-modal',
    title: 'Service Role Assignments',
    fields: [
  {
    "name": "service_role",
    "label": "Service Role",
    "type": "select",
    "required": true
  },
  {
    "name": "date",
    "label": "Date",
    "type": "date",
    "required": true
  },
  {
    "name": "assigned_member",
    "label": "Assigned Member",
    "type": "select",
    "required": false
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
  document.getElementById('service_role_assignments-new')?.addEventListener('click', () => openRecordModal());
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
    <h1>Service Role Assignments</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="service_role_assignments-search">
        </div>
        <div class="members-actions">
          ${can("create", "service_role_assignments") ? `<button id="service_role_assignments-new">Nuevo</button>` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="service_role_assignments-headers"></tr>
        </thead>
        <tbody id="service_role_assignments-body"></tbody>
      </table>
    </div>
  `;
}