// assets/js/core/DataService.js
import { pb } from '../auth.js';

export class DataService {
  constructor(collectionName, churchIdField = 'church') {
    this.collection = pb.collection(collectionName);
    this.churchIdField = churchIdField;
  }

  async getList(churchId, expand = '', sort = '-created') {
    const filter = `${this.churchIdField}.id="${churchId}"`;
    return this.collection.getFullList({ filter, expand, sort });
  }

  async getOne(id, expand = '') {
    return this.collection.getOne(id, { expand });
  }

  async create(data) {
    return this.collection.create(data);
  }

  async update(id, data) {
    return this.collection.update(id, data);
  }

  async delete(id) {
    return this.collection.delete(id);
  }
}