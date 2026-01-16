// assets/js/core/ModuleRegistry.js - UPDATE THIS FILE
class ModuleRegistry {
    constructor() {
        this.modules = [];
        console.log('🔄 ModuleRegistry created');
    }
    
    registerModule(module) {
        console.log(`📝 Registering module: ${module.moduleKey || module.name}`);
        this.modules.push(module);
        return this;
    }
    
    getModule(key) {
        return this.modules.find(m => m.moduleKey === key);
    }
    
    getModules() {
        return this.modules;
    }
    
    // Simple initialize - just marks modules as ready
    async initializeAll() {
        console.log(`🔄 Initializing ${this.modules.length} modules`);
        for (const module of this.modules) {
            if (module.initialize && typeof module.initialize === 'function') {
                await module.initialize();
            }
        }
        console.log('✅ All modules initialized');
        return this;
    }
    
    // Alternative: initialize module with context
    async initializeModule(module, pb, churchId) {
        if (module.initialize && typeof module.initialize === 'function') {
            await module.initialize(pb, churchId);
        }
        return module;
    }
}

// Export for ES modules
export { ModuleRegistry };
