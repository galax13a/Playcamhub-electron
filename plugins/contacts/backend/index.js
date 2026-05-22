'use strict';

const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) {
    migrate(db);
  },

  register(router, db, _appPaths) {
    // Inject db into every contacts request so the model can use it
    router.use('/contacts', (req, _res, next) => { req.db = db; next(); }, routes);
  },
};
