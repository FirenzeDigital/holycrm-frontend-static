// admin/module-builder-ui.js
class ModuleBuilderUI {
    constructor() {
        this.pb = null;
        this.currentCollection = null;
        this.collections = [];
        this.modules = [];
        this.config = {
            moduleKey: '',
            moduleName: '',
            collectionId: '',
            icon: 'people',
            type: 'crud',
            listView: { columns: [], defaultSort: '', itemsPerPage: 25 },
            formView: { fields: [], layout: 'single' },
            permissions: {}
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadExistingModules();
        this.initPermissionsTable();
    }
    
    bindEvents() {
        // Connection
        document.getElementById('connect-btn').addEventListener('click', () => this.connectToPocketBase());
        document.getElementById('fetch-btn').addEventListener('click', () => this.fetchCollections());
        
        // Tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Actions
        document.getElementById('copy-json-btn').addEventListener('click', () => this.copyJSON());
        document.getElementById('download-json-btn').addEventListener('click', () => this.downloadConfig());
        document.getElementById('generate-module-btn').addEventListener('click', () => this.generateModule());
        document.getElementById('copy-code-btn').addEventListener('click', () => this.copyCode());
        document.getElementById('save-module-btn').addEventListener('click', () => this.saveModule());
        
        // Form field type changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('field-type')) {
                this.toggleRelationOptions(e.target);
            }
        });
    }
    
    async connectToPocketBase() {
        const url = document.getElementById('pb-url').value;
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        try {
            this.pb = new PocketBase(url);
            await this.pb.admins.authWithPassword(email, password);
            
            document.getElementById('fetch-btn').disabled = false;
            this.showMessage('success', 'Connected to PocketBase successfully!');
        } catch (error) {
            this.showMessage('error', `Connection failed: ${error.message}`);
        }
    }
    
    async fetchCollections() {
        if (!this.pb) {
            this.showMessage('error', 'Please connect to PocketBase first');
            return;
        }
        
        try {
            this.collections = await this.pb.collections.getFullList();
            this.renderCollectionsList();
        } catch (error) {
            this.showMessage('error', `Failed to fetch collections: ${error.message}`);
        }
    }
    
    renderCollectionsList() {
        const container = document.getElementById('collections-list');
        container.innerHTML = '';
        
        // Filter out system collections
        const userCollections = this.collections.filter(c => 
            !c.name.startsWith('_') && c.name !== 'users'
        );
        
        userCollections.forEach(collection => {
            const div = document.createElement('div');
            div.className = 'collection-item';
            div.textContent = collection.name;
            div.dataset.id = collection.id;
            
            div.addEventListener('click', () => this.selectCollection(collection));
            
            container.appendChild(div);
        });
    }
    
    async selectCollection(collection) {
        this.currentCollection = collection;
        
        // Update UI
        document.querySelectorAll('.collection-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.classList.add('active');
        
        document.getElementById('selected-collection-name').textContent = collection.name;
        document.getElementById('config-area').style.display = 'block';
        document.getElementById('welcome-message').style.display = 'none';
        
        // Set default config values
        this.config.collectionId = collection.id;
        this.config.moduleKey = collection.name;
        this.config.moduleName = this.formatCollectionName(collection.name);
        
        document.getElementById('module-key').value = this.config.moduleKey;
        document.getElementById('module-name').value = this.config.moduleName;
        
        // Load and render fields
        await this.renderFieldConfigurations();
        this.updatePreview();
    }
    
    formatCollectionName(name) {
        return name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    async renderFieldConfigurations() {
        // List View Fields
        const listContainer = document.getElementById('list-fields-container');
        const formContainer = document.getElementById('form-fields-container');
        const sortSelect = document.getElementById('default-sort');
        
        listContainer.innerHTML = '';
        formContainer.innerHTML = '';
        sortSelect.innerHTML = '<option value="">-- Select --</option>';
        
        const template = document.getElementById('field-config-template');
        
        // Get collection schema fields
        const fields = this.currentCollection.schema || [];
        
        fields.forEach(field => {
            if (field.type === 'file' || field.type === 'relation') return;
            
            // List View Field
            const listField = template.content.cloneNode(true);
            const listElement = listField.querySelector('.field-config');
            listElement.dataset.fieldName = field.name;
            
            listField.querySelector('.field-name').textContent = field.name;
            listField.querySelector('.field-label').value = this.formatFieldName(field.name);
            listField.querySelector('.field-include').addEventListener('change', (e) => {
                this.toggleFieldOptions(e.target);
            });
            
            // Add to sort options
            const option = document.createElement('option');
            option.value = field.name;
            option.textContent = this.formatFieldName(field.name);
            sortSelect.appendChild(option.cloneNode(true));
            
            listContainer.appendChild(listField);
            
            // Form View Field
            const formField = template.content.cloneNode(true);
            const formElement = formField.querySelector('.field-config');
            formElement.dataset.fieldName = field.name;
            
            formField.querySelector('.field-name').textContent = field.name;
            formField.querySelector('.field-label').value = this.formatFieldName(field.name);
            formField.querySelector('.field-required').checked = field.required || false;
            formField.querySelector('.field-include').addEventListener('change', (e) => {
                this.toggleFieldOptions(e.target);
            });
            
            // Set appropriate field type based on PocketBase type
            const typeSelect = formField.querySelector('.field-type');
            this.mapFieldType(field.type, typeSelect);
            
            formContainer.appendChild(formField);
        });
    }
    
    formatFieldName(name) {
        return name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    mapFieldType(pbType, selectElement) {
        const typeMap = {
            'text': 'text',
            'email': 'email',
            'url': 'text',
            'number': 'number',
            'bool': 'checkbox',
            'date': 'date',
            'select': 'select',
            'json': 'textarea',
            'editor': 'textarea'
        };
        
        selectElement.value = typeMap[pbType] || 'text';
    }
    
    toggleFieldOptions(checkbox) {
        const fieldConfig = checkbox.closest('.field-config');
        const options = fieldConfig.querySelector('.field-options');
        options.style.display = checkbox.checked ? 'block' : 'none';
    }
    
    toggleRelationOptions(select) {
        const fieldConfig = select.closest('.field-config');
        const relationTarget = fieldConfig.querySelector('#relation-target');
        relationTarget.style.display = select.value === 'relation' ? 'block' : 'none';
    }
    
    initPermissionsTable() {
        const roles = ['admin', 'manager', 'volunteer', 'member', 'guest'];
        const tbody = document.getElementById('permissions-body');
        tbody.innerHTML = '';
        
        roles.forEach(role => {
            const row = document.createElement('tr');
            
            const roleCell = document.createElement('td');
            roleCell.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            
            // Create permission checkboxes
            const perms = ['create', 'read', 'update', 'delete'];
            
            perms.forEach(perm => {
                const permCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = `perm-checkbox perm-${role}-${perm}`;
                checkbox.checked = this.getDefaultPermission(role, perm);
                checkbox.addEventListener('change', () => this.updateConfig());
                
                permCell.appendChild(checkbox);
                row.appendChild(permCell);
            });
            
            tbody.appendChild(row);
        });
    }
    
    getDefaultPermission(role, action) {
        const defaults = {
            admin: { create: true, read: true, update: true, delete: true },
            manager: { create: true, read: true, update: true, delete: false },
            volunteer: { create: false, read: true, update: false, delete: false },
            member: { create: false, read: true, update: false, delete: false },
            guest: { create: false, read: false, update: false, delete: false }
        };
        
        return defaults[role]?.[action] || false;
    }
    
    updateConfig() {
        // Update config from form values
        this.config.moduleKey = document.getElementById('module-key').value;
        this.config.moduleName = document.getElementById('module-name').value;
        this.config.icon = document.getElementById('module-icon').value;
        this.config.type = document.getElementById('module-type').value;
        
        // List view columns
        this.config.listView.columns = [];
        document.querySelectorAll('#list-fields-container .field-config').forEach(fieldEl => {
            const checkbox = fieldEl.querySelector('.field-include');
            if (checkbox.checked) {
                const column = {
                    field: fieldEl.dataset.fieldName,
                    label: fieldEl.querySelector('.field-label').value,
                    sortable: fieldEl.querySelector('.field-sortable')?.checked || false
                };
                this.config.listView.columns.push(column);
            }
        });
        
        this.config.listView.defaultSort = document.getElementById('default-sort').value;
        this.config.listView.itemsPerPage = parseInt(document.getElementById('items-per-page').value);
        
        // Form view fields
        this.config.formView.fields = [];
        document.querySelectorAll('#form-fields-container .field-config').forEach(fieldEl => {
            const checkbox = fieldEl.querySelector('.field-include');
            if (checkbox.checked) {
                const field = {
                    field: fieldEl.dataset.fieldName,
                    label: fieldEl.querySelector('.field-label').value,
                    type: fieldEl.querySelector('.field-type').value,
                    required: fieldEl.querySelector('.field-required')?.checked || false
                };
                
                if (field.type === 'relation') {
                    field.relation = {
                        collection: fieldEl.querySelector('.relation-collection')?.value
                    };
                }
                
                this.config.formView.fields.push(field);
            }
        });
        
        this.config.formView.layout = document.getElementById('form-layout').value;
        
        // Permissions
        this.config.permissions = {};
        ['admin', 'manager', 'volunteer', 'member', 'guest'].forEach(role => {
            this.config.permissions[role] = {
                create: document.querySelector(`.perm-${role}-create`)?.checked || false,
                read: document.querySelector(`.perm-${role}-read`)?.checked || false,
                update: document.querySelector(`.perm-${role}-update`)?.checked || false,
                delete: document.querySelector(`.perm-${role}-delete`)?.checked || false
            };
        });
        
        this.config.allowOverrides = document.getElementById('allow-overrides')?.checked || false;
        
        this.updatePreview();
    }
    
    updatePreview() {
        const preview = document.getElementById('json-preview');
        preview.textContent = JSON.stringify(this.config, null, 2);
    }
    
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
        
        if (tabName === 'preview') {
            this.updatePreview();
        }
    }
    
    async loadExistingModules() {
        try {
            // In a real app, you'd fetch from your modules directory
            const response = await fetch('../assets/js/modules.json');
            this.modules = await response.json();
            this.renderExistingModules();
        } catch (error) {
            console.log('No existing modules found or error loading:', error);
        }
    }
    
    renderExistingModules() {
        const container = document.getElementById('modules-list');
        container.innerHTML = '';
        
        this.modules.forEach(module => {
            const div = document.createElement('div');
            div.className = 'collection-item';
            div.textContent = module.name;
            div.title = `Click to load configuration`;
            
            div.addEventListener('click', () => this.loadModuleConfig(module));
            container.appendChild(div);
        });
    }
    
    loadModuleConfig(module) {
        // Load an existing module configuration
        this.config = module;
        this.populateFormFromConfig();
        this.showMessage('info', `Loaded module: ${module.name}`);
    }
    
    populateFormFromConfig() {
        // Populate all form fields from config
        document.getElementById('module-key').value = this.config.moduleKey;
        document.getElementById('module-name').value = this.config.moduleName;
        // ... populate all other fields
        
        this.updatePreview();
    }
    
    copyJSON() {
        navigator.clipboard.writeText(JSON.stringify(this.config, null, 2))
            .then(() => this.showMessage('success', 'JSON copied to clipboard!'))
            .catch(err => this.showMessage('error', 'Failed to copy: ' + err));
    }
    
    downloadConfig() {
        const dataStr = JSON.stringify(this.config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${this.config.moduleKey}.json`;
        link.click();
    }
    
    generateModule() {
        // Generate the actual module JavaScript code
        const code = this.generateModuleCode();
        const preview = document.getElementById('code-preview');
        preview.textContent = code;
        
        document.getElementById('code-preview-section').style.display = 'block';
        this.showMessage('success', 'Module code generated!');
    }
    
    generateModuleCode() {
        const { moduleKey, moduleName, icon, type, listView, formView } = this.config;
        
        return `// Generated module: ${moduleName}
// Date: ${new Date().toISOString()}

class ${this.toClassName(moduleKey)}Module {
    constructor() {
        this.moduleKey = "${moduleKey}";
        this.name = "${moduleName}";
        this.icon = "${icon}";
        this.type = "${type}";
        this.permissions = ${JSON.stringify(this.config.permissions, null, 4)};
    }
    
    async initialize(pb, churchId) {
        this.pb = pb;
        this.churchId = churchId;
        this.collection = "${this.currentCollection?.name || 'unknown'}";
        
        // Register with ModuleRegistry
        if (window.ModuleRegistry) {
            window.ModuleRegistry.registerModule(this);
        }
    }
    
    getListViewConfig() {
        return ${JSON.stringify(listView, null, 4)};
    }
    
    getFormViewConfig() {
        return ${JSON.stringify(formView, null, 4)};
    }
    
    async fetchData(params = {}) {
        const { page = 1, perPage = ${listView.itemsPerPage}, sort = "${listView.defaultSort}", filter = '' } = params;
        
        try {
            const result = await this.pb.collection('${this.currentCollection?.name}').getList(page, perPage, {
                filter: \`church = "\${this.churchId}"\` + (filter ? \` && \${filter}\` : ''),
                sort: sort
            });
            
            return {
                items: result.items,
                totalPages: result.totalPages,
                page: result.page,
                perPage: result.perPage,
                totalItems: result.totalItems
            };
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }
    
    async createRecord(data) {
        data.church = this.churchId;
        return await this.pb.collection('${this.currentCollection?.name}').create(data);
    }
    
    async updateRecord(id, data) {
        return await this.pb.collection('${this.currentCollection?.name}').update(id, data);
    }
    
    async deleteRecord(id) {
        return await this.pb.collection('${this.currentCollection?.name}').delete(id);
    }
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.${this.toClassName(moduleKey)}Module = new ${this.toClassName(moduleKey)}Module();
}`;
    }
    
    toClassName(str) {
        return str.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
    
    copyCode() {
        const code = document.getElementById('code-preview').textContent;
        navigator.clipboard.writeText(code)
            .then(() => this.showMessage('success', 'Code copied to clipboard!'))
            .catch(err => this.showMessage('error', 'Failed to copy: ' + err));
    }
    
    async saveModule() {
        // Save to your modules system
        const moduleCode = document.getElementById('code-preview').textContent;
        
        // In a real implementation, you'd save to your filesystem or database
        // For now, we'll just offer a download
        const blob = new Blob([moduleCode], { type: 'application/javascript' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.config.moduleKey}.js`;
        link.click();
        
        this.showMessage('success', `Module saved as ${this.config.moduleKey}.js`);
    }
    
    showMessage(type, text) {
        // Simple notification system
        const div = document.createElement('div');
        div.className = `alert alert-${type}`;
        div.textContent = text;
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            min-width: 300px;
        `;
        
        document.body.appendChild(div);
        
        setTimeout(() => div.remove(), 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.moduleBuilder = new ModuleBuilderUI();
});