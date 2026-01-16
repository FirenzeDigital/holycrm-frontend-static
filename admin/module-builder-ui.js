// admin/module-builder-ui.js  (NO imports; works with your current HTML)
(function () {
  function titleize(s) {
    return String(s || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function extractCollections(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.collections)) return raw.collections;
    return null;
  }

  function extractFields(c) {
    if (Array.isArray(c?.fields)) return c.fields;     // your export
    if (Array.isArray(c?.schema)) return c.schema;     // older export
    if (Array.isArray(c?.schema?.fields)) return c.schema.fields;
    return [];
  }

  function relationTargetName(field, collections) {
    // PocketBase exports can differ:
    // - newer: field.options.collectionId / field.options.collectionName
    // - your export: field.collectionId
    const nameFromOptions = field?.options?.collectionName;
    if (nameFromOptions) return nameFromOptions;

    const cid =
      field?.options?.collectionId ||
      field?.collectionId ||
      field?.collectionRef; // safety fallback

    if (!cid) return "";
    const target = collections.find((x) => x.id === cid);
    return target?.name || "";
  }

  function guessLabelFieldForCollection(name, collections) {
    const c = collections.find((x) => x.name === name);
    if (!c) return "name";
    const fields = extractFields(c).filter((f) => !f?.system);
    for (const k of ["name", "title", "label"]) if (fields.find((f) => f.name === k)) return k;
    const text = fields.find((f) => ["text", "email"].includes(f.type));
    return text?.name || "name";
  }

  function detectTenantField(collection, collections) {
    const fields = extractFields(collection).filter((f) => !f?.system);
    const rel = fields.find((f) => {
      if (f.type !== "relation") return false;
      const target = String(relationTargetName(f, collections) || "").toLowerCase();
      return String(f.name).toLowerCase() === "church" || target === "churches" || target === "church";
    });
    if (rel) return rel.name;

    const direct = fields.find((f) => String(f.name).toLowerCase() === "church");
    return direct ? direct.name : "church";
  }

  function mapType(pbType) {
    switch (pbType) {
      case "email": return "email";
      case "number": return "number";
      case "date": return "date";
      case "bool": return "bool";
      case "select": return "select";
      case "relation": return "relation";
      case "json": return "text";       // keep simple (SmartModalForm treats as input)
      case "autodate": return "date";   // usually system, but if not, treat as date
      default: return "text";
    }
  }

  const state = {
    raw: null,
    collections: [],
    current: null,
    tenantField: "church",
    listFields: new Map(),  // fieldName -> config
    formFields: new Map(),
  };

  function $(id) { return document.getElementById(id); }

  function setActiveTab(tabKey) {
    document.querySelectorAll(".tab-button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabKey);
    });
    document.querySelectorAll(".tab-content").forEach((c) => {
      c.classList.toggle("active", c.id === `tab-${tabKey}`);
    });
  }

  function wireTabs() {
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });
  }

  function renderCollectionsList() {
    const wrap = $("collections-list");
    if (!wrap) return;

    wrap.innerHTML = "";

    state.collections
      .filter((c) => c && c.name && !c.system && !String(c.name).startsWith("_") && c.type !== "auth")
      .forEach((c) => {
        const fields = extractFields(c).filter((f) => !f?.system);
        const rels = fields.filter((f) => f.type === "relation").length;

        const div = document.createElement("div");
        div.className = "collection-item";
        div.dataset.id = c.id;
        div.innerHTML = `
          <div style="font-weight:600;">${c.name}</div>
          <small>${fields.length} fields · ${rels} relations</small>
        `;

        div.addEventListener("click", () => selectCollection(c.id));
        wrap.appendChild(div);
      });
  }

  function selectCollection(id) {
    const c = state.collections.find((x) => x.id === id);
    if (!c) return;

    state.current = c;
    state.tenantField = detectTenantField(c, state.collections);

    // activate UI
    document.querySelectorAll(".collection-item").forEach((el) => el.classList.toggle("active", el.dataset.id === id));
    $("welcome-message").style.display = "none";
    $("config-area").style.display = "block";
    $("selected-collection-name").textContent = c.name;

    // defaults
    $("module-key").value = c.name;
    $("module-name").value = titleize(c.name);

    // Build field configs
    buildDefaultConfigs();
    renderListConfigs();
    renderFormConfigs();

    setActiveTab("general");
  }

  function buildDefaultConfigs() {
    state.listFields.clear();
    state.formFields.clear();

    const fields = extractFields(state.current).filter((f) => !f?.system);

    // exclude tenant field
    const usable = fields.filter((f) => f.name !== state.tenantField);

    // default list: first 6 reasonable fields
    const listPick = usable
      .filter((f) => ["text", "email", "number", "date", "bool", "select", "relation"].includes(f.type))
      .slice(0, 6);

    // default form: all (except created/updated if they exist)
    const formPick = usable.filter((f) => !["created", "updated"].includes(f.name));

    for (const f of usable) {
      state.listFields.set(f.name, {
        include: listPick.some((x) => x.name === f.name),
        label: titleize(f.name),
        type: mapType(f.type),
      });

      const base = {
        include: formPick.some((x) => x.name === f.name),
        label: titleize(f.name),
        type: mapType(f.type),
        required: !!f.required,
        placeholder: "",
      };
     
      if (f.type === "select") {
        const vals =
          (Array.isArray(f?.values) && f.values) ||
          (Array.isArray(f?.options?.values) && f.options.values) ||
          [];
        base.options = vals.slice();
      }

      if (f.type === "relation") {
        const target = relationTargetName(f, state.collections);
        base.collection = target;
        base.labelField = guessLabelFieldForCollection(target, state.collections);
        base.valueField = "id";
        base.filterByTenant = true;
        base.display = base.labelField; // for table
      }

      state.formFields.set(f.name, base);
    }
  }

  function renderListConfigs() {
    const wrap = $("columns-list-container");
    if (!wrap) return;
    wrap.innerHTML = "";

    const tpl = document.querySelector("#field-config-template");
    if (!tpl) return;

    // show each field as a “column config”
    for (const [fieldName, cfg] of state.listFields.entries()) {
      const node = tpl.content.cloneNode(true);
      const root = node.querySelector(".field-config");
      root.dataset.fieldName = fieldName;

      root.querySelector(".field-name").textContent = fieldName;
      const include = root.querySelector(".field-include");
      include.checked = !!cfg.include;

      const opts = root.querySelector(".field-options");
      opts.style.display = include.checked ? "block" : "none";

      const label = root.querySelector(".field-label");
      label.value = cfg.label;

      const type = root.querySelector(".field-type");
      type.value = cfg.type === "relation" ? "text" : cfg.type; // list columns are display-only

      include.addEventListener("change", () => {
        cfg.include = include.checked;
        opts.style.display = include.checked ? "block" : "none";
      });

      label.addEventListener("input", () => (cfg.label = label.value));

      wrap.appendChild(node);
    }
  }

  function renderFormConfigs() {
    const wrap = $("fields-list-container");
    if (!wrap) return;
    wrap.innerHTML = "";

    const tpl = document.querySelector("#field-config-template");
    if (!tpl) return;

    for (const [fieldName, cfg] of state.formFields.entries()) {
      const node = tpl.content.cloneNode(true);
      const root = node.querySelector(".field-config");
      root.dataset.fieldName = fieldName;

      root.querySelector(".field-name").textContent = fieldName;

      const include = root.querySelector(".field-include");
      include.checked = !!cfg.include;

      const opts = root.querySelector(".field-options");
      opts.style.display = include.checked ? "block" : "none";

      const label = root.querySelector(".field-label");
      label.value = cfg.label;

      const type = root.querySelector(".field-type");
      type.value = cfg.type === "relation" ? "select" : (cfg.type || "text");

      const placeholder = root.querySelector(".field-placeholder");
      placeholder.value = cfg.placeholder || "";

      const required = root.querySelector(".field-required");
      required.checked = !!cfg.required;

      // Select options handling
      const selectBox = root.querySelector(".select-options-container");
      const selectText = root.querySelector(".select-options");
      if (cfg.type === "select") {
        selectBox.style.display = "block";
        selectText.value = (cfg.options || []).join("\n");
      } else {
        selectBox.style.display = "none";
      }

      include.addEventListener("change", () => {
        cfg.include = include.checked;
        opts.style.display = include.checked ? "block" : "none";
      });

      label.addEventListener("input", () => (cfg.label = label.value));
      placeholder.addEventListener("input", () => (cfg.placeholder = placeholder.value));
      required.addEventListener("change", () => (cfg.required = required.checked));

      type.addEventListener("change", () => {
        cfg.type = type.value;
        if (cfg.type === "select") {
          selectBox.style.display = "block";
        } else {
          selectBox.style.display = "none";
        }
      });

      selectText?.addEventListener("input", () => {
        cfg.options = String(selectText.value || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
      });

      wrap.appendChild(node);
    }
  }

  function buildModuleJson() {
    const moduleId = String($("module-key").value || "").trim();
    const label = String($("module-name").value || "").trim() || titleize(moduleId);

    const dsType = "pb_collection"; // for now, works immediately with your PB rules/hook setup
    const collectionName = state.current.name;

    const tableColumns = [];
    for (const [fieldName, cfg] of state.listFields.entries()) {
      if (!cfg.include) continue;

      const formCfg = state.formFields.get(fieldName);
      if (formCfg?.type === "relation") {
        tableColumns.push({
          field: fieldName,
          label: cfg.label,
          type: "relation",
          display: formCfg.labelField || "name",
        });
      } else {
        tableColumns.push({
          field: fieldName,
          label: cfg.label,
          type: cfg.type || "text",
        });
      }
    }

    const formFields = [];
    for (const [fieldName, cfg] of state.formFields.entries()) {
      if (!cfg.include) continue;

      if (cfg.type === "relation") {
        formFields.push({
          field: fieldName,
          label: cfg.label,
          type: "relation",
          collection: cfg.collection,
          valueField: "id",
          labelField: cfg.labelField || "name",
          filterByTenant: cfg.filterByTenant !== false,
          required: !!cfg.required,
        });
      } else if (cfg.type === "select") {
        formFields.push({
          field: fieldName,
          label: cfg.label,
          type: "select",
          options: cfg.options || [],
          required: !!cfg.required,
          placeholder: cfg.placeholder || "",
        });
      } else {
        formFields.push({
          field: fieldName,
          label: cfg.label,
          type: cfg.type || "text",
          required: !!cfg.required,
          placeholder: cfg.placeholder || "",
        });
      }
    }

    return {
      id: moduleId,
      label,
      resource: moduleId,
      datasource: {
        type: dsType,
        collection: collectionName,
        tenant: { field: state.tenantField },
      },
      table: {
        defaultSort: String($("default-sort")?.value || "-created"),
        columns: tableColumns,
      },
      form: {
        fields: formFields,
      },
    };
  }

  function renderPreview() {
    const json = buildModuleJson();
    const pretty = JSON.stringify(json, null, 2);

    $("json-preview").textContent =
      `// Save as: frontend/modules/${json.id}.json\n\n` +
      pretty +
      `\n\n// Also add an entry to: frontend/config/modules.json\n` +
      JSON.stringify(
        {
          id: json.id,
          label: json.label,
          icon: "👥",        // adjust in UI later if you want
          category: "main",  // adjust in UI later if you want
          resource: json.resource,
        },
        null,
        2
      );
  }

  function copyPreview() {
    const t = $("json-preview")?.textContent || "";
    navigator.clipboard?.writeText(t);
  }

  function downloadPreview() {
    const json = buildModuleJson();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${json.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function parseSchema() {
    const text = String($("pb-schema-input")?.value || "").trim();
    if (!text) return alert("Paste pb_schema.json first.");

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return alert("Invalid JSON.");
    }

    const collections = extractCollections(raw);
    if (!collections) return alert("Expected an array of collections or { collections: [...] }");

    state.raw = raw;
    state.collections = collections;

    renderCollectionsList();
  }

  // Wire buttons
  document.addEventListener("DOMContentLoaded", () => {
    wireTabs();

    $("parse-schema-btn")?.addEventListener("click", parseSchema);

    // Your “Auto-configure” button in List tab
    $("auto-configure-btn")?.addEventListener("click", () => {
      if (!state.current) return;
      buildDefaultConfigs();
      renderListConfigs();
      renderFormConfigs();
      renderPreview();
    });

    $("generate-module-btn")?.addEventListener("click", renderPreview);
    $("preview-ui-btn")?.addEventListener("click", renderPreview);

    $("copy-json-btn")?.addEventListener("click", copyPreview);
    $("download-json-btn")?.addEventListener("click", downloadPreview);

    // Default tab
    setActiveTab("general");
  });
})();

