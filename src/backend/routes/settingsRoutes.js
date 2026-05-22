'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/settingsController');

router.get('/',  ctrl.getAll);
router.put('/',  ctrl.setMany);
router.post('/', ctrl.setMany);

module.exports = router;
