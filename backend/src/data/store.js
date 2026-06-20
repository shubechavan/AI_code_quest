/**
 * In-memory data store.
 *
 * The product targets MongoDB with seven collections. For a runnable slice that needs no
 * database install, this module implements the same access patterns in memory behind a
 * small repository interface. Every method maps 1:1 to a Mongo operation, so swapping in
 * a real `mongodb` driver is a localized change — the routes and services never touch the
 * storage mechanism directly.
 *
 * Collections modelled: users, transactions, assessments, alerts, auditLogs, reports.
 * (sanctionsCache and modelMetrics live in the ML service for the slice.)
 */
import crypto from 'node:crypto';

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

class Collection {
  #docs = new Map();

  insert(doc) {
    const _id = doc._id ?? id(this.prefix);
    const record = { _id, ...doc, createdAt: doc.createdAt ?? new Date().toISOString() };
    this.#docs.set(_id, record);
    return record;
  }

  constructor(prefix) {
    this.prefix = prefix;
  }

  get(_id) {
    return this.#docs.get(_id) ?? null;
  }

  update(_id, patch) {
    const existing = this.#docs.get(_id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.#docs.set(_id, updated);
    return updated;
  }

  find(predicate = () => true) {
    return [...this.#docs.values()].filter(predicate);
  }

  findOne(predicate) {
    return this.find(predicate)[0] ?? null;
  }

  count(predicate = () => true) {
    return this.find(predicate).length;
  }
}

export const db = {
  users: new Collection('usr'),
  transactions: new Collection('txn'),
  assessments: new Collection('asm'),
  alerts: new Collection('alt'),
  auditLogs: new Collection('aud'),
  reports: new Collection('rpt'),
};

export { id };
