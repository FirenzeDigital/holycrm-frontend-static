// assets/js/members.js (REFACTORED)
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let membersService;
let table, modal;

export async function initMembersView(church) {
  if (!church) return;
  currentChurchId = church.id;

  const section = document.querySelector('section[data-view="members"]');
  if (!can("read", "members")) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  if (!section.querySelector("#members-tbody")) {
    renderLayout(section);
  }

  await initComponents();
  await refreshData();
}

async function initComponents() {
  membersService = new DataService('members');
  
  table = new CrudTable({
    container: '#members-tbody',
    columns: [
      { 
        key: 'first_name', 
        label: 'Nombre', 
        format: (val, item) => `${item.first_name || ''} ${item.last_name || ''}`.trim() 
      },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'status', label: 'Estado' }
    ],
    canEdit: can("update", "members"),
    canDelete: can("delete", "members"),
    onEdit: openMemberModal,
    onDelete: deleteMember
  });

  modal = new ModalForm({
    id: 'member-modal',
    title: 'Persona',
    fields: [
      { name: 'first_name', label: 'Nombre', type: 'text', required: true },
      { name: 'last_name', label: 'Apellido', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Teléfono', type: 'text' },
      { 
        name: 'status', 
        label: 'Estado', 
        type: 'select',
        options: [
          { value: 'active', label: 'Activo' },
          { value: 'inactive', label: 'Inactivo' }
        ]
      },
      { name: 'notes', label: 'Notas', type: 'text' },
      { name: 'tags', label: 'Tags (JSON)', type: 'text', placeholder: '["tag1","tag2"]' }
    ],
    onSubmit: saveMember
  });

  // Search functionality
  const searchInput = document.getElementById('members-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      filterTable(term);
    });
  }

  document.getElementById('members-new')?.addEventListener('click', () => openMemberModal());
  document.getElementById('members-reload')?.addEventListener('click', async () => {
    await refreshData();
  });
}

async function refreshData() {
  const members = await membersService.getList(currentChurchId);
  window.membersData = members; // Store for filtering
  table.render(members);
}

function filterTable(term) {
  if (!window.membersData) return;
  
  const filtered = window.membersData.filter(m => {
    const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
    return fullName.includes(term) ||
           (m.email || '').toLowerCase().includes(term) ||
           (m.phone || '').toLowerCase().includes(term);
  });
  
  table.render(filtered);
}

async function openMemberModal(id = null) {
  if (id) {
    const member = await membersService.getOne(id);
    modal.open(member);
  } else {
    modal.open({ status: 'active' });
  }
}

async function saveMember(data, id = null) {
  const payload = {
    ...data,
    church: currentChurchId,
    tags: data.tags ? JSON.parse(data.tags) : null
  };

  if (id) {
    await membersService.update(id, payload);
  } else {
    await membersService.create(payload);
  }
  
  await refreshData();
}

async function deleteMember(id) {
  await membersService.delete(id);
  await refreshData();
}

function renderLayout(section) {
  section.innerHTML = `
    <h1>Personas</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input id="members-search" type="text" placeholder="Buscar (nombre, email, teléfono)..." />
        </div>
        <div class="members-actions">
          <button id="members-reload" type="button">Recargar</button>
          ${can("create", "members") ? `<button id="members-new" type="button">Nueva persona</button>` : ''}
        </div>
      </div>
      
      <div id="members-error" class="error"></div>
      <div id="members-success" class="success"></div>
    </div>
    
    <div class="card">
      <div class="table-wrap">
        <table class="users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="members-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
}