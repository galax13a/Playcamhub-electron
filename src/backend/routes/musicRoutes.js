'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/musicController');

router.get('/',              ctrl.list);
router.get('/recent',        ctrl.recent);
router.get('/favorites',     ctrl.favorites);
router.get('/stats',         ctrl.stats);
router.get('/history',       ctrl.history);
router.get('/most-played',   ctrl.mostPlayed);
router.delete('/history',    ctrl.clearHistory);
router.get('/:id',           ctrl.getById);
router.put('/:id',           ctrl.update);
router.delete('/:id',        ctrl.delete);
router.post('/:id/favorite',   ctrl.toggleFavorite);
router.post('/:id/played',     ctrl.played);
router.post('/:id/thumbnail',  ctrl.changeThumbnail);

module.exports = router;
