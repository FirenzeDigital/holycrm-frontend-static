// Generated module for Members
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

export async function initMembersView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize service
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
  table = new CrudTable({
    container: '#members-body',
    columns: [
  {
    "key": "first_name",
    "label": "First Name",
    "format": null
  },
  {
    "key": "last_name",
    "label": "Last Name",
    "format": null
  },
  {
    "key": "email",
    "label": "Email",
    "format": null
  },
  {
    "key": "phone",
    "label": "Phone",
    "format": null
  }
],
    canEdit: can("update", "members"),
    canDelete: can("delete", "members"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'members-modal',
    title: 'Members',
    fields: [
  {
    "name": "first_name",
    "label": "First Name",
    "type": "text",
    "required": true
  },
  {
    "name": "last_name",
    "label": "Last Name",
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
    "label": "Phone",
    "type": "text",
    "required": false
  },
  {
    "name": "church",
    "label": "Church",
    "type": "select",
    "required": true
  },
  {
    "name": "status",
    "label": "Status",
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
    "label": "Notes",
    "type": "text",
    "required": false
  },
  {
    "name": "tags",
    "label": "Tags",
    "type": "text",
    "required": false
  },
  {
    "name": "location",
    "label": "Location",
    "type": "select",
    "required": false
  }
],
    onSubmit: saveRecord
  });

  // Wire up the "New" button
  document.getElementById('members-new')?.addEventListener('click', () => openRecordModal());
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