'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/playlistController');

router.get('/',                           ctrl.list);
router.post('/',                          ctrl.create);
router.get('/:id',                        ctrl.getById);
router.put('/:id',                        ctrl.update);
router.delete('/:id',                     ctrl.delete);
router.get('/:id/songs',                  ctrl.getSongs);
router.post('/:id/songs',                 ctrl.addSong);
router.delete('/:id/songs/:songId',       ctrl.removeSong);
router.put('/:id/songs/reorder',          ctrl.reorder);

module.exports = router;
