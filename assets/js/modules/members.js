// assets/js/modules/members.js - UPDATED
class MembersModule {
    constructor() {
        this.moduleKey = "members";
        this.name = "Members";
        this.collection = "members";
        this.icon = "👥";
        console.log(`📦 Created MembersModule instance`);
    }
    
    async initialize(pb, churchId) {
        console.log(`✅ Initializing ${this.name} module`);
        this.pb = pb;
        this.churchId = churchId;
        return this;
    }
    
    async fetchData() {
        try {
            if (!this.pb || !this.churchId) {
                throw new Error('Module not initialized with pb or churchId');
            }
            console.log(`📊 Fetching ${this.collection} data for church ${this.churchId}`);
            const result = await this.pb.collection(this.collection).getList(1, 50, {
                filter: `church = "${this.churchId}"`
            });
            console.log(`📈 Found ${result.items.length} records`);
            return result;
        } catch (error) {
            console.error('❌ Error fetching data:', error);
            return { items: [], totalPages: 0, page: 1, perPage: 50, totalItems: 0 };
        }
    }
    
    render(container) {
        console.log(`🎨 Rendering ${this.name} module`);
        container.innerHTML = `
            <div class="generated-module">
                <h2>${this.name} (Generated)</h2>
                <p>Collection: ${this.collection}</p>
                <div class="btn-group">
                    <button class="btn btn-primary" id="load-data-btn">Load Data</button>
                    <button class="btn btn-outline" id="add-record-btn">Add Record</button>
                </div>
                <div id="module-content" class="mt-3"></div>
            </div>
        `;
        
        // Event listeners
        container.querySelector('#load-data-btn').addEventListener('click', async () => {
            await this.loadAndDisplayData();
        });
    }
    
    async loadAndDisplayData() {
        const content = document.getElementById('module-content');
        if (!content) return;
        
        content.innerHTML = '<p>Loading data...</p>';
        
        try {
            const data = await this.fetchData();
            if (data.items.length === 0) {
                content.innerHTML = '<p>No records found.</p>';
                return;
            }
            
            // Simple table display
            let html = `
                <h4>Records (${data.items.length})</h4>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table class="simple-table">
                        <thead>
                            <tr>
                                ${Object.keys(data.items[0]).map(key => 
                                    `<th>${key}</th>`
                                ).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.items.forEach(item => {
                html += `<tr>${Object.values(item).map(val => 
                    `<td>${typeof val === 'object' ? JSON.stringify(val) : val}</td>`
                ).join('')}</tr>`;
            });
            
            html += `</tbody></table></div>`;
            content.innerHTML = html;
            
        } catch (error) {
            content.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        }
    }
}

// Register with global registry
console.log('🚀 members.js loaded, attempting to register...');

// Check if registry exists, if not create a simple one
if (!window.moduleRegistry) {
    console.log('⚠️ Creating fallback registry');
    window.moduleRegistry = {
        modules: [],
        registerModule: function(module) {
            this.modules.push(module);
            console.log('📝 Registered in fallback:', module.moduleKey);
        },
        getModules: function() { return this.modules; },
        getModule: function(key) { return this.modules.find(m => m.moduleKey === key); }
    };
}

// Register our module
const moduleInstance = new MembersModule();
window.moduleRegistry.registerModule(moduleInstance);
console.log('✅ Members module registered successfully');
