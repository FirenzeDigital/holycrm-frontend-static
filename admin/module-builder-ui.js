// admin/module-builder-ui.js - NEW FILE
class ModuleBuilderUI {
    constructor() {
        this.parsedSchema = null;
        this.currentCollection = null;
        this.config = {
            moduleKey: '',
            moduleName: '',
            collectionId: '',
            icon: 'people',
            listView: { columns: [], defaultSort: '', itemsPerPage: 25 },
            formView: { fields: [], layout: 'single' }
        };
        
        this.init();
    }
    
    init() {
        // Parse button
        document.getElementById('parse-schema-btn').addEventListener('click', () => this.parseSchema());
        document.getElementById('load-example-btn').addEventListener('click', () => this.loadExample());
        
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Generate button
        document.getElementById('generate-module-btn').addEventListener('click', () => this.generateModule());
    }
    
    parseSchema() {
        const schemaInput = document.getElementById('pb-schema-input').value;
        
        if (!schemaInput.trim()) {
            alert('Please paste your PocketBase schema JSON');
            return;
        }
        
        try {
            this.parsedSchema = JSON.parse(schemaInput);
            
            if (!Array.isArray(this.parsedSchema)) {
                throw new Error('Schema should be a JSON array');
            }
            
            // Filter out system collections
            this.collections = this.parsedSchema.filter(c => 
                c.name && !c.name.startsWith('_') && c.type !== 'auth'
            );
            
            this.renderCollections();
            alert(`Found ${this.collections.length} collections`);
            
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }
    
    loadExample() {
        const example = `[
  {
    "id": "members123",
    "name": "members",
    "type": "base",
    "schema": [
      {"name": "first_name", "type": "text", "required": true},
      {"name": "last_name", "type": "text", "required": true},
      {"name": "email", "type": "email"},
      {"name": "status", "type": "select", "options": {"values": ["active", "inactive"]}}
    ]
  }
]`;
        
        document.getElementById('pb-schema-input').value = example;
    }
    
    renderCollections() {
        const container = document.getElementById('collections-list');
        container.innerHTML = '';
        
        this.collections.forEach(collection => {
            const div = document.createElement('div');
            div.className = 'collection-item';
            div.textContent = collection.name;
            div.dataset.id = collection.id;
            
            div.addEventListener('click', () => this.selectCollection(collection));
            container.appendChild(div);
        });
    }
    
    selectCollection(collection) {
        this.currentCollection = collection;
        
        // Update UI
        document.querySelectorAll('.collection-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.classList.add('active');
        
        document.getElementById('selected-collection-name').textContent = collection.name;
        document.getElementById('config-area').style.display = 'block';
        document.getElementById('welcome-message').style.display = 'none';
        
        // Set defaults
        this.config.moduleKey = collection.name;
        this.config.moduleName = this.formatName(collection.name);
        document.getElementById('module-key').value = this.config.moduleKey;
        document.getElementById('module-name').value = this.config.moduleName;
        
        this.renderFields();
        this.updatePreview();
    }
    
    formatName(name) {
        return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    renderFields() {
        const listContainer = document.getElementById('list-fields-container');
        listContainer.innerHTML = '';
        
        const fields = this.currentCollection.schema || [];
        
        fields.forEach(field => {
            if (field.type === 'relation') return;
            
            const div = document.createElement('div');
            div.className = 'field-config';
            div.innerHTML = `
                <div class="field-header">
                    <h5>${field.name}</h5>
                    <label>
                        <input type="checkbox" class="field-include" checked> Include
                    </label>
                </div>
                <div class="field-options">
                    <input type="text" class="field-label form-control" 
                           value="${this.formatName(field.name)}" placeholder="Label">
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
    
    generateModule() {
        const code = `
// Generated module: ${this.config.moduleName}
class ${this.config.moduleKey.charAt(0).toUpperCase() + this.config.moduleKey.slice(1)}Module {
    constructor() {
        this.moduleKey = "${this.config.moduleKey}";
        this.name = "${this.config.moduleName}";
        this.collection = "${this.currentCollection.name}";
    }
    
    async fetchData(pb, churchId) {
        return await pb.collection('${this.currentCollection.name}').getList(1, 50, {
            filter: \`church = "\${churchId}"\`
        });
    }
}

// Register module
if (window.ModuleRegistry) {
    const module = new ${this.config.moduleKey.charAt(0).toUpperCase() + this.config.moduleKey.slice(1)}Module();
    window.ModuleRegistry.registerModule(module);
}
`;
        
        // Show code
        document.getElementById('code-preview').textContent = code;
        document.getElementById('code-preview-section').style.display = 'block';
    }
    
    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }
    
    updatePreview() {
        document.getElementById('json-preview').textContent = 
            JSON.stringify(this.config, null, 2);
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    window.moduleBuilder = new ModuleBuilderUI();
});