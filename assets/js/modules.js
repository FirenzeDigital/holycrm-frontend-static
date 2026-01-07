// assets/js/modules.js
export const MODULES = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    defaultPermission: 'always_visible', // Special case - always shows
    initFunction: null // No initialization needed
  },
  members: {
    id: 'members',
    label: 'Personas',
    icon: '👥',
    defaultPermission: 'read:members',
    initFunction: 'initMembersView'
  },
  groups: {
    id: 'groups',
    label: 'Grupos',
    icon: '👪',
    defaultPermission: 'read:groups',
    initFunction: 'initGroupsView'
  },
  events: {
    id: 'events',
    label: 'Eventos',
    icon: '📅',
    defaultPermission: 'read:events',
    initFunction: 'initEventsView'
  },
  locations: {
    id: 'locations',
    label: 'Misiones',
    icon: '📍',
    defaultPermission: 'read:locations',
    initFunction: 'initLocationsView'
  },
  ministries: {
    id: 'ministries',
    label: 'Ministerios',
    icon: '🙏',
    defaultPermission: 'read:ministries',
    initFunction: 'initMinistriesView'
  },
  rotas: {
    id: 'rotas',
    label: 'Roles mensuales',
    icon: '🔄',
    defaultPermission: 'read:service_roles', // Simplified
    initFunction: 'initRotasView'
  },
  calendar: {
    id: 'calendar',
    label: 'Calendario',
    icon: '📆',
    defaultPermission: 'read:calendar',
    initFunction: 'initCalendarView'
  },
  finance: {
    id: 'finance',
    label: 'Finanzas',
    icon: '💰',
    defaultPermission: 'read:finance', // Use your backend collection name
    initFunction: 'initFinanceView'
  },
  users: {
    id: 'users',
    label: 'Usuarios',
    icon: '👤',
    defaultPermission: 'read:users',
    initFunction: 'initUsersView'
  },
  permissions: {
    id: 'permissions',
    label: 'Permisos',
    icon: '🔐',
    defaultPermission: 'read:permissions',
    initFunction: 'initPermissionsView'
  }
};

// Module categories for visual grouping
export const MODULE_CATEGORIES = [
  {
    id: 'main',
    label: 'Main Modules',
    moduleIds: ['dashboard', 'members', 'groups', 'events', 'locations', 'ministries', 'rotas', 'calendar', 'finance']
  },
  {
    id: 'admin',
    label: 'Administration',
    moduleIds: ['users', 'permissions']
  }
];

// Helper function to check if a module should be visible
export function shouldShowModule(moduleId) {
  const module = MODULES[moduleId];
  
  if (!module) return false;
  if (module.defaultPermission === 'always_visible') return true;
  
  // Special case handling for rotas
  if (moduleId === 'rotas') {
    return can('read', 'service_role_assignments') || can('read', 'service_roles');
  }
  
  // Special case handling for finance - use your actual backend collection name
  if (moduleId === 'finance') {
    return can('read', 'finance') || can('read', 'finance_categories') || can('read', 'finance_transactions');
  }
  
  // Generic permission check - convert "read:members" to "read", "members"
  const [action, resource] = module.defaultPermission.split(':');
  return can(action, resource);
}

// Simple helper to check permissions (you already have this in permissions.js)
function can(action, resource) {
  // This delegates to your existing permissions system
  return window.can ? window.can(action, resource) : false;
}