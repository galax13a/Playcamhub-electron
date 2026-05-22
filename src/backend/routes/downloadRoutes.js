'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/downloadController');

router.get('/',       ctrl.list);
router.post('/',      ctrl.add);
router.delete('/clear', ctrl.clearFinished);
router.delete('/:id', ctrl.remove);

module.exports = router;
