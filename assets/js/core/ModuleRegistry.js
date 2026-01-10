// assets/js/core/ModuleRegistry.js
export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.config = this.loadConfig();
  }
  
  loadConfig() {
    try {
      return JSON.parse(localStorage.getItem('holycrm_modules')) || {};
    } catch {
      return {};
    }
  }
  
  saveConfig() {
    localStorage.setItem('holycrm_modules', JSON.stringify(this.config));
  }
  
  async registerModule(moduleConfig) {
    const { name, label, icon, collection, file } = moduleConfig;
    
    // Store config
    this.config[name] = moduleConfig;
    this.saveConfig();
    
    // Dynamically import module if file exists
    if (file) {
      try {
        const module = await import(`../modules/generated/${file}`);
        this.modules.set(name, module);
        console.log(`Module ${name} registered successfully`);
      } catch (error) {
        console.warn(`Failed to load module ${name}:`, error);
      }
    }
    
    // Update app.js INIT_FUNCTIONS
    if (window.INIT_FUNCTIONS) {
      window.INIT_FUNCTIONS[name] = (church) => {
        const module = this.modules.get(name);
        if (module && module[`init${this.capitalize(name)}View`]) {
          return module[`init${this.capitalize(name)}View`](church);
        }
      };
    }
    
    // Update modules.js
    this.updateModulesConfig(moduleConfig);
  }
  
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  updateModulesConfig(moduleConfig) {
    if (window.MODULES) {
      window.MODULES[moduleConfig.name] = {
        id: moduleConfig.name,
        label: moduleConfig.label,
        icon: moduleConfig.icon,
        defaultPermission: `read:${moduleConfig.name}`,
        initFunction: `init${this.capitalize(moduleConfig.name)}View`
      };
    }
    
    // Add to finance category if collection includes 'finance'
    if (moduleConfig.collection.includes('finance') && window.MODULE_CATEGORIES) {
      const financeCat = window.MODULE_CATEGORIES.find(c => c.id === 'finance');
      if (financeCat && !financeCat.moduleIds.includes(moduleConfig.name)) {
        financeCat.moduleIds.push(moduleConfig.name);
      }
    }
  }
  
  async loadAllModules() {
    for (const [name, config] of Object.entries(this.config)) {
      await this.registerModule(config);
    }
  }
}

// Update app.js to use registry
// Add at top of app.js:
// import { ModuleRegistry } from "./core/ModuleRegistry.js";
// const moduleRegistry = new ModuleRegistry();
// await moduleRegistry.loadAllModules();