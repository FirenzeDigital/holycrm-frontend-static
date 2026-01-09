// assets/js/groups.js (REFACTORED)
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let groupsService;
let table, modal;

export async function initGroupsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  const section = document.querySelector('section[data-view="groups"]');
  if (!can("read", "groups")) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  if (!section.querySelector("#groups-tbody")) {
    renderLayout(section);
  }

  await initComponents();
  await refreshData();
}

async function initComponents() {
  groupsService = new DataService('groups');
  
  table = new CrudTable({
    container: '#groups-tbody',
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'description', label: 'Descripción' },
      { key: 'day_of_week', label: 'Día' },
      { key: 'meeting_time', label: 'Hora' },
      { key: 'location', label: 'Ubicación' }
    ],
    canEdit: can("update", "groups"),
    canDelete: can("delete", "groups"),
    onEdit: openGroupModal,
    onDelete: deleteGroup
  });

  modal = new ModalForm({
    id: 'group-modal',
    title: 'Grupo',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'text' },
      { 
        name: 'day_of_week', 
        label: 'Día de reunión', 
        type: 'select',
        options: [
          { value: 'monday', label: 'Lunes' },
          { value: 'tuesday', label: 'Martes' },
          { value: 'wednesday', label: 'Miércoles' },
          { value: 'thursday', label: 'Jueves' },
          { value: 'friday', label: 'Viernes' },
          { value: 'saturday', label: 'Sábado' },
          { value: 'sunday', label: 'Domingo' }
        ]
      },
      { name: 'meeting_time', label: 'Hora', type: 'time' },
      { name: 'location', label: 'Ubicación', type: 'text' }
    ],
    onSubmit: saveGroup
  });

  document.getElementById('group-new')?.addEventListener('click', () => openGroupModal());
}

async function refreshData() {
  const groups = await groupsService.getList(currentChurchId);
  table.render(groups);
}

async function openGroupModal(id = null) {
  if (id) {
    const group = await groupsService.getOne(id);
    modal.open(group);
  } else {
    modal.open({ day_of_week: 'sunday' });
  }
}

async function saveGroup(data, id = null) {
  const payload = {
    ...data,
    church: currentChurchId
  };

  if (id) {
    await groupsService.update(id, payload);
  } else {
    await groupsService.create(payload);
  }
  
  await refreshData();
}

async function deleteGroup(id) {
  await groupsService.delete(id);
  await refreshData();
}

function renderLayout(section) {
  section.innerHTML = `
    <h1>Grupos</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input id="groups-search" type="text" placeholder="Buscar grupos..." />
        </div>
        <div class="members-actions">
          ${can("create", "groups") ? `<button id="group-new" type="button">Nuevo grupo</button>` : ''}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Día</th>
            <th>Hora</th>
            <th>Ubicación</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="groups-tbody"></tbody>
      </table>
    </div>
  `;
}