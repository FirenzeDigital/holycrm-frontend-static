// assets/js/permissions.js
import { pb } from "./auth.js";

const API_BASE = "https://app.holycrm.app/backend/";

// Modules known to the frontend (source of truth for now)
export const MODULES = [
  { key: "members", name: "Personas" },
  { key: "users", name: "Usuarios" },
  { key: "permissions", name: "Permisos" },
  { key: "events", name: "Eventos" },
  { key: "event_attendance", name: "event_attendance" },
  { key: "groups", name: "groups" },
  { key: "group_memberships", name: "group_memberships" },
  { key: "locations", name: "locations" },
  { key: "ministries", name: "ministries" },
  { key: "ministry_memberships", name: "ministry_memberships" },
  { key: "ministry_activities", name: "ministry_activities" },
];

// Default permissions (Option C baseline)
const DEFAULTS = {
  admin: {
    members:      { c: true,  r: true,  u: true,  d: true  },
    users:        { c: true,  r: true,  u: true,  d: true  },
    permissions:  { c: true,  r: true,  u: true,  d: true  }, // admin can manage ACL
    events:          { c: true,  r: true,  u: true,  d: true  },
    event_attendance:{ c: true,  r: true,  u: true,  d: true  },
    groups:{ c: true,  r: true,  u: true,  d: true  },
    group_memberships:{ c: true,  r: true,  u: true,  d: true  },
    locations:{ c: true,  r: true,  u: true,  d: true  },
    ministries:{ c: true,  r: true,  u: true,  d: true  },
    ministry_memberships:{ c: true,  r: true,  u: true,  d: true  },
    ministry_activities:{ c: true,  r: true,  u: true,  d: true  },
  },
  manager: {
    members:      { c: true,  r: true,  u: true,  d: true  },
    users:        { c: false, r: false, u: false, d: false },
    permissions:  { c: false, r: false, u: false, d: false }, // admin-only by default
  },
  volunteer: {
    members:      { c: true,  r: true,  u: true,  d: false },
    users:        { c: false, r: false, u: false, d: false },
    permissions:  { c: false, r: false, u: false, d: false },
  },
  member: {
    members:      { c: false, r: true,  u: false, d: false },
    users:        { c: false, r: false, u: false, d: false },
    permissions:  { c: false, r: false, u: false, d: false },
    events:          { c: false, r: false, u: false, d: false },
    event_attendance:{ c: false, r: false, u: false, d: false },
  },
};

let effective = null;
let effectiveRole = null;

export async function loadPermissionsForChurch(churchId) {
  effective = null;
  effectiveRole = null;

  const token = pb.authStore.token;

  const res = await fetch(`${API_BASE}/api/acl/current`, {
    method: "GET",
    headers: {
      "x-church-id": churchId,
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ACL fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const role = String(data.role || "").trim();
  effectiveRole = role;

  const base = structuredClone(DEFAULTS[role] || {});

  const overrides = Array.isArray(data.overrides) ? data.overrides : [];
  if (overrides.length > 0) {
    for (const o of overrides) {
      const key = String(o.module_key || "").trim();
      if (!key) continue;
      base[key] = {
        c: !!o.can_create,
        r: !!o.can_read,
        u: !!o.can_update,
        d: !!o.can_delete,
      };
    }
  }

  effective = base;

  localStorage.setItem("holycrm_acl_role", role);
  localStorage.setItem("holycrm_acl_effective", JSON.stringify(effective));

  return { role, effective };
}

export function can(action, moduleKey) {
  if (!effective) return false;
  const m = effective[moduleKey];
  if (!m) return false;

  if (action === "create") return !!m.c;
  if (action === "read") return !!m.r;
  if (action === "update") return !!m.u;
  if (action === "delete") return !!m.d;

  return false;
}

export function getRole() {
  return effectiveRole;
}

export function getEffectivePermissions() {
  return effective;
}
