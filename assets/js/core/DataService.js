// assets/js/core/DataService.js
import { pb } from '../auth.js';

export class DataService {
  constructor(collectionName, churchFieldName = 'church') {
    this.collection = pb.collection(collectionName);
    this.churchFieldName = churchFieldName;
    this.isChurchSpecific = true;
  }

  async getList(churchId, expand = '', sort = '-created', filter = '') {
    try {
      let fullFilter = filter;
      
      // Only filter by church if it's a church-specific collection AND churchId is provided
      if (this.isChurchSpecific && churchId) {
        const churchFilter = `${this.churchFieldName} = "${churchId}"`;
        fullFilter = fullFilter ? `(${fullFilter}) && (${churchFilter})` : churchFilter;
      }
      
      const params = { sort };
      
      if (fullFilter) {
        params.filter = fullFilter;
      }
      
      if (expand) {
        params.expand = expand;
      }
      
      console.log(`[DataService] Fetching ${this.collection.name}`, params);
      const result = await this.collection.getFullList(params);
      console.log(`[DataService] Got ${result.length} records for ${this.collection.name}`);
      return result;
    } catch (error) {
      console.error(`[DataService] Error fetching ${this.collection.name}:`, error);
      throw error;
    }
  }

  async getOne(id, expand = '') {
    try {
      const params = {};
      if (expand) {
        params.expand = expand;
      }
      return await this.collection.getOne(id, params);
    } catch (error) {
      console.error(`[DataService] Error fetching one ${this.collection.name}:`, error);
      throw error;
    }
  }

  async create(data) {
    try {
      return await this.collection.create(data);
    } catch (error) {
      console.error(`[DataService] Error creating in ${this.collection.name}:`, error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      return await this.collection.update(id, data);
    } catch (error) {
      console.error(`[DataService] Error updating in ${this.collection.name}:`, error);
      throw error;
    }
  }

  async delete(id) {
    try {
      return await this.collection.delete(id);
    } catch (error) {
      console.error(`[DataService] Error deleting from ${this.collection.name}:`, error);
      throw error;
    }
  }

  markAsGlobal() {
    this.isChurchSpecific = false;
    return this;
  }
}