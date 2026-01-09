// assets/js/events.js (REFACTORED)
import { can } from "./permissions.js";
import { DataService } from "./core/DataService.js";
import { CrudTable } from "./core/CrudTable.js";
import { ModalForm } from "./core/ModalForm.js";

let currentChurchId = null;
let eventsService;
let table, modal;

export async function initEventsView(church) {
  if (!church) return;
  currentChurchId = church.id;

  const section = document.querySelector('section[data-view="events"]');
  if (!can("read", "events")) {
    section.innerHTML = `<h1>Sin permisos</h1>`;
    return;
  }

  if (!section.querySelector("#events-tbody")) {
    renderLayout(section);
  }

  await initComponents();
  await refreshData();
}

async function initComponents() {
  eventsService = new DataService('events');
  
  table = new CrudTable({
    container: '#events-tbody',
    columns: [
      { key: 'title', label: 'Título' },
      { key: 'description', label: 'Descripción' },
      { 
        key: 'start_time', 
        label: 'Inicio', 
        format: (val) => val ? new Date(val).toLocaleString() : '' 
      },
      { 
        key: 'end_time', 
        label: 'Fin', 
        format: (val) => val ? new Date(val).toLocaleString() : '' 
      },
      { key: 'category', label: 'Categoría' }
    ],
    canEdit: can("update", "events"),
    canDelete: can("delete", "events"),
    onEdit: openEventModal,
    onDelete: deleteEvent
  });

  modal = new ModalForm({
    id: 'event-modal',
    title: 'Evento',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'text' },
      { name: 'start_time', label: 'Inicio', type: 'datetime-local', required: true },
      { name: 'end_time', label: 'Fin', type: 'datetime-local' },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'location', label: 'Ubicación', type: 'text' }
    ],
    onSubmit: saveEvent
  });

  document.getElementById('event-new')?.addEventListener('click', () => openEventModal());
}

async function refreshData() {
  const events = await eventsService.getList(currentChurchId, '', '-start_time');
  table.render(events);
}

async function openEventModal(id = null) {
  if (id) {
    const event = await eventsService.getOne(id);
    // Convert datetime for HTML input
    const data = {
      ...event,
      start_time: event.start_time ? event.start_time.slice(0, 16) : '',
      end_time: event.end_time ? event.end_time.slice(0, 16) : ''
    };
    modal.open(data);
  } else {
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    modal.open({ 
      start_time: defaultStart.toISOString().slice(0, 16),
      category: 'general' 
    });
  }
}

async function saveEvent(data, id = null) {
  const payload = {
    ...data,
    church: currentChurchId
  };

  if (id) {
    await eventsService.update(id, payload);
  } else {
    await eventsService.create(payload);
  }
  
  await refreshData();
}

async function deleteEvent(id) {
  await eventsService.delete(id);
  await refreshData();
}

function renderLayout(section) {
  section.innerHTML = `
    <h1>Eventos</h1>
    
    <div class="card">
      <div class="members-toolbar">
        <div class="members-search">
          <input id="events-search" type="text" placeholder="Buscar eventos..." />
        </div>
        <div class="members-actions">
          ${can("create", "events") ? `<button id="event-new" type="button">Nuevo evento</button>` : ''}
        </div>
      </div>
    </div>
    
    <div class="card">
      <table class="users-table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Descripción</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Categoría</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="events-tbody"></tbody>
      </table>
    </div>
  `;
}