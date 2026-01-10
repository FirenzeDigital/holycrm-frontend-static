// assets/js/core/EnhancedCrudTable.js
export class EnhancedCrudTable extends CrudTable {
  constructor(config) {
    super(config);
    this.searchInput = config.searchInput;
    this.filters = config.filters || {};
    
    if (this.searchInput) {
      this.setupSearch();
    }
  }
  
  setupSearch() {
    const input = typeof this.searchInput === 'string' 
      ? document.querySelector(this.searchInput) 
      : this.searchInput;
    
    if (input) {
      input.addEventListener('input', (e) => {
        this.filterData(e.target.value);
      });
    }
  }
  
  filterData(searchTerm) {
    if (!this.originalData) {
      this.originalData = [...this.currentData];
    }
    
    if (!searchTerm) {
      this.render(this.originalData);
      return;
    }
    
    const filtered = this.originalData.filter(item => {
      return Object.values(item).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
    
    this.render(filtered);
  }
  
  render(data) {
    this.currentData = data;
    super.render(data);
  }
}