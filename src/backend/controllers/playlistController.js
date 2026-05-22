'use strict';

const Playlist = require('../models/Playlist');

const playlistController = {
  list(_req, res) {
    res.json(Playlist.findAll());
  },

  getById(req, res) {
    const pl = Playlist.findById(parseInt(req.params.id));
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    res.json(pl);
  },

  getSongs(req, res) {
    res.json(Playlist.getSongs(parseInt(req.params.id)));
  },

  create(req, res) {
    const { name, description, cover } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const pl = Playlist.create({ name, description, cover });
    res.status(201).json(pl);
  },

  update(req, res) {
    const id = parseInt(req.params.id);
    const pl = Playlist.update(id, req.body);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    res.json(pl);
  },

  delete(req, res) {
    const id = parseInt(req.params.id);
    if (id === 1) return res.status(403).json({ error: 'Cannot delete Favorites playlist' });
    const pl = Playlist.findById(id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    Playlist.delete(id);
    res.json({ ok: true });
  },

  addSong(req, res) {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId is required' });
    Playlist.addSong(parseInt(req.params.id), parseInt(songId));
    res.json({ ok: true });
  },

  removeSong(req, res) {
    Playlist.removeSong(parseInt(req.params.id), parseInt(req.params.songId));
    res.json({ ok: true });
  },

  reorder(req, res) {
    const { songIds } = req.body;
    if (!Array.isArray(songIds)) return res.status(400).json({ error: 'songIds array required' });
    Playlist.reorder(parseInt(req.params.id), songIds);
    res.json({ ok: true });
  },
};

module.exports = playlistController;
