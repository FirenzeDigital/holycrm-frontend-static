// Generated module for Groups
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let table, modal;

export async function initGroupsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize service
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
  table = new CrudTable({
    container: '#groups-body',
    headerContainer: '#groups-headers',
    columns: [
  {
    "key": "name",
    "label": "Name",
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
    "key": "status",
    "label": "Status",
    "format": null
  }
],
    canEdit: can("update", "groups"),
    canDelete: can("delete", "groups"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'groups-modal',
    title: 'Groups',
    fields: [
  {
    "name": "name",
    "label": "Name",
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
        "label": "Ministry"
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
    "label": "Description",
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
    "label": "Location",
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
  },
  {
    "name": "tags",
    "label": "Tags",
    "type": "text",
    "required": false
  }
],
    onSubmit: saveRecord
  });

  // Wire up the "New" button
  document.getElementById('groups-new')?.addEventListener('click', () => openRecordModal());
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