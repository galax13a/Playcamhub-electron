'use strict';

const Category = require('../models/Category');

const categoryController = {
  list(_req, res) {
    res.json(Category.findAll());
  },

  getById(req, res) {
    const cat = Category.findById(parseInt(req.params.id));
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  },

  create(req, res) {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const cat = Category.create({ name, color, icon });
    res.status(201).json(cat);
  },

  update(req, res) {
    const cat = Category.update(parseInt(req.params.id), req.body);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  },

  delete(req, res) {
    Category.delete(parseInt(req.params.id));
    res.json({ ok: true });
  },
};

module.exports = categoryController;
