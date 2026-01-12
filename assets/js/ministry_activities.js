// assets/js/ministry_activities.js (NEW FILE)
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let dataService;
let ministriesService;
let table, modal;

export async function initMinistryActivitiesView(church) {
  if (!church) return;
  currentChurchId = church.id;

  // Initialize services
  dataService = new DataService('ministry_activities');
  ministriesService = new DataService('ministries');

  // Check permissions
  const section = document.querySelector('section[data-view="ministry_activities"]');
  if (!can("read", "ministry_activities")) {
    section.innerHTML = '<h1>Sin permisos</h1>';
    return;
  }

  // Render layout once
  if (!section.querySelector("#activities-body")) {
    renderLayout(section);
  }

  // Initialize components
  await initComponents();
  await refreshData();
}

async function initComponents() {
  // Load ministries for dropdown
  const ministries = await ministriesService.getList(currentChurchId, '', 'name');
  
  // Configure and create table
  table = new CrudTable({
    container: '#activities-body',
    headerContainer: '#activities-headers',
    columns: [
      { key: 'title', label: 'Título', format: null },
      { key: 'weekday', label: 'Día', format: (val) => {
        const days = { sun: 'Dom', mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb' };
        return days[val] || val;
      }},
      { key: 'time', label: 'Hora', format: null },
      { key: 'expand.ministry.name', label: 'Ministerio' },
      { key: 'status', label: 'Estado', format: (val) => val === 'active' ? 'Activo' : 'Inactivo' }
    ],
    canEdit: can("update", "ministry_activities"),
    canDelete: can("delete", "ministry_activities"),
    onEdit: openRecordModal,
    onDelete: deleteRecord
  });

  // Configure and create modal form
  modal = new ModalForm({
    id: 'activities-modal',
    title: 'Actividad de Ministerio',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'weekday', label: 'Día', type: 'select', required: true, options: [
        { value: 'sun', label: 'Domingo' },
        { value: 'mon', label: 'Lunes' },
        { value: 'tue', label: 'Martes' },
        { value: 'wed', label: 'Miércoles' },
        { value: 'thu', label: 'Jueves' },
        { value: 'fri', label: 'Viernes' },
        { value: 'sat', label: 'Sábado' }
      ]},
      { name: 'time', label: 'Hora (HH:MM)', type: 'text', required: true, placeholder: '19:30' },
      { name: 'duration_minutes', label: 'Duración (minutos)', type: 'number', required: false },
      { name: 'ministry', label: 'Ministerio', type: 'select', required: true,
        options: ministries.map(m => ({ value: m.id, label: m.name })) },
      { name: 'location_text', label: 'Lugar', type: 'text', required: false },
      { name: 'status', label: 'Estado', type: 'select', required: true, options: [
        { value: 'active', label: 'Activo' },
        { value: 'inactive', label: 'Inactivo' }
      ]},
      { name: 'notes', label: 'Notas', type: 'text', required: false }
    ],
    onSubmit: saveRecord
  });

  // Wire up the "New" button
  document.getElementById('activities-new')?.addEventListener('click', () => openRecordModal());
}

async function refreshData() {
  const data = await dataService.getList(currentChurchId, 'ministry');
  table.render(data);
}

async function openRecordModal(id = null) {
  if (id) {
    const record = await dataService.getOne(id, 'ministry');
    modal.open(record);
  } else {
    modal.open({});
  }
}

async function saveRecord(data, id = null) {
  const payload = {
    ...data,
    church: currentChurchId,
    duration_minutes: data.duration_minutes || null
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
    <h1>Actividades de Ministerios</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input type="search" placeholder="Buscar..." id="activities-search">
        </div>
        <div class="members-actions">
          ${can("create", "ministry_activities") ? `<button id="activities-new">Nueva actividad</button>` : ""}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr id="activities-headers"></tr>
        </thead>
        <tbody id="activities-body"></tbody>
      </table>
    </div>
  `;
}

// Export the function that calendar.js needs
export async function openMinistryActivityModalById(activityId, ministryIdHint = "") {
  try {
    // If modal is not initialized, create a minimal one
    if (!modal) {
      // Create a simple modal for this specific case
      const modalHtml = `
        <div id="activity-quick-modal" class="modal" style="display:block">
          <div class="modal-backdrop" data-close="1"></div>
          <div class="modal-card">
            <div class="modal-header">
              <h3>Editar Actividad</h3>
              <button type="button" class="modal-close" data-close="1">×</button>
            </div>
            <div class="modal-body">
              <p>Redirigiendo al módulo de actividades...</p>
              <div class="modal-footer">
                <button type="button" data-close="1">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      // Close modal when backdrop or close button is clicked
      document.querySelectorAll('[data-close="1"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('activity-quick-modal').remove();
        });
      });
      
      // Navigate to ministry activities module
      setTimeout(() => {
        document.getElementById('activity-quick-modal').remove();
        const event = new CustomEvent('navigate-to', { detail: { view: 'ministry_activities' } });
        window.dispatchEvent(event);
      }, 1500);
    } else {
      // If modal is initialized, open it
      await openRecordModal(activityId);
    }
  } catch (error) {
    console.error('Error opening activity modal:', error);
    alert('Error al abrir la actividad: ' + error.message);
  }
}