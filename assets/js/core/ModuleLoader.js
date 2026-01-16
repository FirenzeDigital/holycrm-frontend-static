// assets/js/core/ModuleLoader.js
import { GenericModuleRenderer } from "./GenericModuleRenderer.js";

function toUrl(path) {
  // path can be "modules/x.json" or "/modules/x.json"
  const p = String(path || "").replace(/^\/+/, "");
  // base = directory of current page
  const base = new URL(".", window.location.href);
  return new URL(p, base).toString();
}

class ModuleLoader {
  constructor() {
    this.cache = new Map();
    this.renderers = new Map();
  }

  async resolvePath(moduleKey) {
    // Try to read optional per-module path from config/modules.json
    try {
      const idxUrl = toUrl(`config/modules.json?ts=${Date.now()}`);
      const idxRes = await fetch(idxUrl, { cache: "no-store" });
      if (idxRes.ok) {
        const idx = await idxRes.json();
        const entry = (idx?.modules || []).find((m) => m?.id === moduleKey);
        if (entry?.path) return toUrl(`${String(entry.path).replace(/^\/+/, "")}?ts=${Date.now()}`);
      }
    } catch {}

    return toUrl(`modules/${moduleKey}.json?ts=${Date.now()}`);
  }

  async loadModuleConfig(moduleKey) {
    if (this.cache.has(moduleKey)) return this.cache.get(moduleKey);

    const url = await this.resolvePath(moduleKey);
    console.log("[ModuleLoader] loading:", moduleKey, url);

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    console.log("[ModuleLoader] status:", res.status, "content-type:", res.headers.get("content-type"));
    console.log("[ModuleLoader] first 120 chars:", text.slice(0, 120));

    if (!res.ok) throw new Error(`Failed to load module config (${res.status}) from ${url}`);

    // Guard against “index.html fallback”
    if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
      throw new Error(`Expected JSON but got HTML from ${url}. (Likely SW/cache or rewrite fallback)`);
    }

    let cfg;
    try {
      cfg = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON from ${url}: ${e.message}`);
    }

    this.cache.set(moduleKey, cfg);
    return cfg;
  }

  async renderModule({ moduleKey, container, churchId }) {
    const cfg = await this.loadModuleConfig(moduleKey);

    let renderer = this.renderers.get(moduleKey);
    if (!renderer) {
      renderer = new GenericModuleRenderer({ moduleKey, config: cfg });
      this.renderers.set(moduleKey, renderer);
    } else {
      renderer.config = cfg;
    }

    await renderer.render({ container, churchId });
  }
}

export const moduleLoader = new ModuleLoader();

