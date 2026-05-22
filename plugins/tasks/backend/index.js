'use strict';

const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) {
    migrate(db);
  },
  register(router, db, _appPaths) {
    router.use('/tasks', (req, _res, next) => { req.db = db; next(); }, routes);
  },
};
