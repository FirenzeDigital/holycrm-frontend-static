// assets/js/auth.js
// Simple PocketBase client wrapper shared by login and app.

export const pb = new PocketBase("https://pb-dev.holycrm.app/backend/");

// Try to restore auth from localStorage on load.
const saved = localStorage.getItem("pb_auth");
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    pb.authStore.save(parsed.token, parsed.model);
  } catch (e) {
    pb.authStore.clear();
  }
}

export function persistAuth() {
  if (pb.authStore.isValid) {
    localStorage.setItem(
      "pb_auth",
      JSON.stringify({
        token: pb.authStore.token,
        model: pb.authStore.model,
      })
    );
  } else {
    localStorage.removeItem("pb_auth");
  }
}

export function logout() {
  pb.authStore.clear();
  localStorage.removeItem("pb_auth");
  localStorage.removeItem("holycrm_church");
}
