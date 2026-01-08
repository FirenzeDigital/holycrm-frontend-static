// assets/js/permissions.js
import { pb } from "./auth.js";
import { MODULE_PERMISSION_MATRIX, MODULES } from "./modules.js";

const API_BASE = "https://pb-dev.holycrm.app/backend/";

// Convert module permissions matrix to the format expected by permissions.js
function getDefaultsFromMatrix() {
  const DEFAULTS = {
    admin: {},
    manager: {},
    volunteer: {},
    member: {}
  };
  
  // Populate defaults from the matrix
  for (const [moduleId, permissions] of Object.entries(MODULE_PERMISSION_MATRIX)) {
    for (const [role, perms] of Object.entries(permissions)) {
      if (!DEFAULTS[role]) DEFAULTS[role] = {};
      DEFAULTS[role][moduleId] = perms;
    }
  }
  
  // Add special cases for finance collections
  DEFAULTS.admin.finance_categories = { c: true, r: true, u: true, d: true };
  DEFAULTS.admin.finance_transactions = { c: true, r: true, u: true, d: true };
  DEFAULTS.manager.finance_categories = { c: true, r: true, u: true, d: true };
  DEFAULTS.manager.finance_transactions = { c: true, r: true, u: true, d: true };
  
  return DEFAULTS;
}

const DEFAULTS = getDefaultsFromMatrix();

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