'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/categoryController');
const { validate } = require('../middleware/validate');
const { IdParamsSchema, CategoryCreateSchema, CategoryUpdateSchema } = require('../schemas/categories');

router.get('/',       ctrl.list);
router.post('/',      validate(CategoryCreateSchema),                                      ctrl.create);
router.get('/:id',    validate(IdParamsSchema, 'params'),                                  ctrl.getById);
router.put('/:id',    validate(IdParamsSchema, 'params'), validate(CategoryUpdateSchema),  ctrl.update);
router.delete('/:id', validate(IdParamsSchema, 'params'),                                  ctrl.delete);

module.exports = router;
