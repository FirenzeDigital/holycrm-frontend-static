// assets/js/modules.js
// Import the actual can function from permissions.js
import { can as checkPermission } from './permissions.js';

// Define default permissions matrix directly in modules.js
export const MODULE_PERMISSION_MATRIX = {
  dashboard: {
    admin: { c: false, r: true, u: false, d: false }, // Always visible, no CRUD
    manager: { c: false, r: true, u: false, d: false },
    volunteer: { c: false, r: true, u: false, d: false },
    member: { c: false, r: true, u: false, d: false }
  },
  members: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: true, r: true, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  groups: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: true, r: true, u: true, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  events: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: true, r: true, u: true, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  locations: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: true, r: true, u: true, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  ministries: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: true, r: true, u: true, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  ministry_activities: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: true, r: true, u: true, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  rotas: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: false, r: false, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  calendar: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: false, r: false, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  finance_transactions: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: false, r: false, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  finance_categories: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: true, r: true, u: true, d: true },
    volunteer: { c: false, r: false, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  users: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: false, r: false, u: false, d: false },
    volunteer: { c: false, r: false, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  },
  permissions: {
    admin: { c: true, r: true, u: true, d: true },
    manager: { c: false, r: false, u: false, d: false },
    volunteer: { c: false, r: false, u: false, d: false },
    member: { c: false, r: false, u: false, d: false }
  }
};

export const MODULES = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    defaultPermission: 'always_visible',
    initFunction: null
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
  ministry_activities: {
    id: 'ministry_activities',
    label: 'Actividades de Ministerios',
    icon: '⏰',
    defaultPermission: 'read:ministry_activities',
    initFunction: 'initMinistryActivitiesView'
  },
  rotas: {
    id: 'rotas',
    label: 'Roles mensuales',
    icon: '🔄',
    defaultPermission: 'read:service_roles',
    initFunction: 'initRotasView'
  },
  calendar: {
    id: 'calendar',
    label: 'Calendario',
    icon: '📆',
    defaultPermission: 'read:calendar',
    initFunction: 'initCalendarView'
  },
  finance_transactions: {
    id: 'finance_transactions',
    label: 'Movimientos',
    icon: '💳',
    defaultPermission: 'read:finance_transactions',
    initFunction: 'initFinanceRecordsView'
  },
  finance_categories: {
    id: 'finance_categories',
    label: 'Categorías',
    icon: '🗂️',
    defaultPermission: 'read:finance_categories',
    initFunction: 'initFinanceCategoriesView'
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
    moduleIds: ['dashboard', 'members', 'groups', 'events', 'locations', 'ministries', 'ministry_activities', 'rotas', 'calendar', 'finance']
  },
  {
    id: 'finance',
    label: 'Finanzas',
    moduleIds: ['finance_transactions', 'finance_categories']
  },
  {
    id: 'admin',
    label: 'Administration',
    moduleIds: ['users', 'permissions']
  }
];

// Helper function to get default permissions for a module+role
export function getModuleDefaultPermissions(moduleId, role) {
  return MODULE_PERMISSION_MATRIX[moduleId]?.[role] || { c: false, r: false, u: false, d: false };
}

// Helper function to check if a module should be visible
export function shouldShowModule(moduleId) {
  const module = MODULES[moduleId];
  
  if (!module) return false;
  if (module.defaultPermission === 'always_visible') return true;
  
  // Special case handling for rotas
  if (moduleId === 'rotas') {
    return checkPermission('read', 'service_role_assignments') || checkPermission('read', 'service_roles');
  }
    
  // Generic permission check - convert "read:members" to "read", "members"
  const [action, resource] = module.defaultPermission.split(':');
  return checkPermission(action, resource);
}