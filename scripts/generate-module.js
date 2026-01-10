// scripts/generate-module.js
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CLI_ModuleGenerator {
  constructor() {
    this.templates = {
      basic: this.getBasicTemplate(),
      withFilters: this.getFilteredTemplate()
    };
  }
  
  generateFromFile(pbJsonPath, options) {
    const pbJson = JSON.parse(fs.readFileSync(pbJsonPath, 'utf8'));
    const config = this.createConfig(pbJson, options);
    
    const code = this.generateModule(config);
    
    const outputDir = options.output || './assets/js/modules/generated';
    const filename = `${config.moduleName}.js`;
    
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, filename), code);
    
    // Also generate module registry entry
    this.generateRegistryEntry(config, outputDir);
    
    console.log(`✅ Module generated: ${filename}`);
    console.log(`📁 Location: ${outputDir}/${filename}`);
  }
  
  createConfig(pbJson, options) {
    // Similar parsing logic as browser version
    // Returns configuration object
  }
  
  generateModule(config) {
    // Use template with config
    let template = this.templates.basic;
    
    // Replace placeholders
    return template
      .replace(/{{MODULE_NAME}}/g, config.moduleName)
      .replace(/{{COLLECTION_NAME}}/g, config.collectionName)
      .replace(/{{TABLE_COLUMNS}}/g, JSON.stringify(config.tableColumns, null, 2))
      .replace(/{{FORM_FIELDS}}/g, JSON.stringify(config.formFields, null, 2));
  }
  
  getBasicTemplate() {
    return `// Auto-generated module
import { DataService } from "../core/DataService.js";
import { CrudTable } from "../core/CrudTable.js";
import { ModalForm } from "../core/ModalForm.js";

// ... template content same as browser version
`;
  }
  
  generateRegistryEntry(config, outputDir) {
    const entry = {
      name: config.moduleName,
      label: config.moduleLabel,
      icon: config.icon,
      collection: config.collectionName,
      file: `generated/${config.moduleName}.js`
    };
    
    const registryFile = path.join(outputDir, '../module-registry.json');
    let registry = [];
    
    if (fs.existsSync(registryFile)) {
      registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    }
    
    // Check if already exists
    const existing = registry.find(m => m.name === config.moduleName);
    if (!existing) {
      registry.push(entry);
      fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
      console.log(`📋 Added to module registry`);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  node generate-module.js <pocketbase-json-file> [options]
  
Options:
  --name=<module-name>    Custom module name
  --label=<display-label> Display label
  --icon=<emoji>          Module icon
  --output=<dir>          Output directory
  
Example:
  node generate-module.js members.json --name=members --label="Miembros" --icon="👥"
    `);
    process.exit(0);
  }
  
  const generator = new CLI_ModuleGenerator();
  const options = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value;
    }
  });
  
  const jsonFile = args[0];
  generator.generateFromFile(jsonFile, options);
}

module.exports = CLI_ModuleGenerator;