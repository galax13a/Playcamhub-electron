'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/settingsController');
const { validate } = require('../middleware/validate');
const { SettingsManySchema } = require('../schemas/settings');

router.get('/',  ctrl.getAll);
router.put('/',  validate(SettingsManySchema), ctrl.setMany);
router.post('/', validate(SettingsManySchema), ctrl.setMany);

module.exports = router;
