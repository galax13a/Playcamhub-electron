'use strict';

const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) {
    migrate(db);
  },
  register(router, db, _appPaths) {
    // Inject db into every request
    router.use('/notes', (req, _res, next) => { req.db = db; next(); }, routes);
  },
};
