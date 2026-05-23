'use strict';

class ContactModel {
  constructor(db) { this.db = db; }

  list({ search = '', status = '', active = '', username = '', page = 1, per_page = 25 } = {}) {
    let where = 'WHERE deleted_at IS NULL';
    const p   = [];

    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      p.push(s, s, s, s);
    }
    if (status) { where += ' AND status = ?';  p.push(status); }
    if (active !== '') { where += ' AND active = ?'; p.push(active === '1' || active === true ? 1 : 0); }
    if (username) {
      const row = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (row) { where += ' AND (user_id = ? OR user_id IS NULL)'; p.push(row.id); }
    }

    const orderBy = 'ORDER BY name COLLATE NOCASE ASC';
    const total   = this.db.prepare(`SELECT COUNT(*) as n FROM contacts ${where}`).get(...p).n;
    const offset  = (page - 1) * per_page;
    const items   = this.db.prepare(`SELECT * FROM contacts ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...p, per_page, offset);

    return { items, total, page, perPage: per_page };
  }

  get(id) {
    return this.db.prepare('SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL').get(id);
  }

  create({ name, company, email, phone, status = 'lead', active = 1, notes, username }) {
    const uid = this._userId(username);
    const r   = this.db.prepare(`
      INSERT INTO contacts (name, company, email, phone, status, active, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, company || null, email || null, phone || null, status, active ? 1 : 0, notes || null, uid);
    return this.get(r.lastInsertRowid);
  }

  update(id, fields) {
    const allowed = ['name','company','email','phone','status','active','notes'];
    const sets    = Object.keys(fields).filter(k => allowed.includes(k));
    if (!sets.length) return this.get(id);
    const vals = sets.map(k => k === 'active' ? (fields[k] ? 1 : 0) : (fields[k] || null));
    const sql  = `UPDATE contacts SET ${sets.map(k => `${k}=?`).join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`;
    this.db.prepare(sql).run(...vals, id);
    return this.get(id);
  }

  // Soft delete
  delete(id) {
    return this.db.prepare('UPDATE contacts SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
  }

  toggleActive(id) {
    this.db.prepare('UPDATE contacts SET active = NOT active, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
    return this.get(id);
  }

  _userId(username) {
    if (!username) return null;
    const row = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    return row ? row.id : null;
  }
}

module.exports = ContactModel;
