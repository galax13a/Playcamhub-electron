'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/playlistController');
const { validate } = require('../middleware/validate');
const {
  IdParamsSchema, DualIdParamsSchema,
  PlaylistCreateSchema, PlaylistUpdateSchema,
  AddSongSchema, ReorderSchema,
} = require('../schemas/playlists');

router.get('/',                         ctrl.list);
router.post('/',                        validate(PlaylistCreateSchema),             ctrl.create);
router.get('/:id',                      validate(IdParamsSchema, 'params'),         ctrl.getById);
router.put('/:id',                      validate(IdParamsSchema, 'params'), validate(PlaylistUpdateSchema), ctrl.update);
router.delete('/:id',                   validate(IdParamsSchema, 'params'),         ctrl.delete);
router.get('/:id/songs',                validate(IdParamsSchema, 'params'),         ctrl.getSongs);
router.post('/:id/songs',               validate(IdParamsSchema, 'params'), validate(AddSongSchema), ctrl.addSong);
router.delete('/:id/songs/:songId',     validate(DualIdParamsSchema, 'params'),     ctrl.removeSong);
router.put('/:id/songs/reorder',        validate(IdParamsSchema, 'params'), validate(ReorderSchema), ctrl.reorder);

module.exports = router;
