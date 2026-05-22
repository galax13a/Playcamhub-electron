'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/musicController');
const { validate } = require('../middleware/validate');
const {
  IdParamsSchema, SongQuerySchema, LimitQuerySchema,
  HistoryQuerySchema, SongUpdateSchema, ThumbnailSchema,
} = require('../schemas/songs');

router.get('/',            validate(SongQuerySchema, 'query'),   ctrl.list);
router.get('/recent',      validate(LimitQuerySchema, 'query'),  ctrl.recent);
router.get('/favorites',                                         ctrl.favorites);
router.get('/stats',                                             ctrl.stats);
router.get('/history',     validate(HistoryQuerySchema, 'query'),ctrl.history);
router.get('/most-played', validate(LimitQuerySchema, 'query'),  ctrl.mostPlayed);
router.delete('/history',                                        ctrl.clearHistory);
router.get('/:id',         validate(IdParamsSchema, 'params'),   ctrl.getById);
router.put('/:id',         validate(IdParamsSchema, 'params'), validate(SongUpdateSchema), ctrl.update);
router.delete('/:id',      validate(IdParamsSchema, 'params'),   ctrl.delete);
router.post('/:id/favorite',   validate(IdParamsSchema, 'params'), ctrl.toggleFavorite);
router.post('/:id/played',     validate(IdParamsSchema, 'params'), ctrl.played);
router.post('/:id/thumbnail',  validate(IdParamsSchema, 'params'), validate(ThumbnailSchema), ctrl.changeThumbnail);

module.exports = router;
