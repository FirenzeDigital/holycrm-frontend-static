// assets/js/core/DataService.js
import { pb } from "../auth.js";

// Backwards-compatible PB collection service used by your existing modules
export class DataService {
  constructor(collectionName, churchFieldName = "church") {
    this.collection = pb.collection(collectionName);
    this.churchFieldName = churchFieldName;
    this.isChurchSpecific = true;
  }

  static fromModuleConfig(moduleConfig) {
    // For now default to pb_collection (works with your current codebase)
    // You can switch to hook later when you add a generic modules_api hook.
    return new DataService(moduleConfig.datasource?.collection || moduleConfig.id, moduleConfig.datasource?.tenant?.field || "church");
  }

  async getList(churchId, expand = "", sort = "-created", filter = "") {
    let fullFilter = filter;

    if (this.isChurchSpecific && churchId) {
      const churchFilter = `${this.churchFieldName} = "${churchId}"`;
      fullFilter = fullFilter ? `(${fullFilter}) && (${churchFilter})` : churchFilter;
    }

    const params = { sort };
    if (fullFilter) params.filter = fullFilter;
    if (expand) params.expand = expand;

    return await this.collection.getFullList(params);
  }

  async getOne(id, expand = "") {
    const params = {};
    if (expand) params.expand = expand;
    return await this.collection.getOne(id, params);
  }

  async create(data) {
    return await this.collection.create(data);
  }

  async update(id, data) {
    return await this.collection.update(id, data);
  }

  async delete(id) {
    return await this.collection.delete(id);
  }

  markAsGlobal() {
    this.isChurchSpecific = false;
    return this;
  }
}

