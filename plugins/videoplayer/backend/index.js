'use strict';

// Video Player plugin — backend entry point.
// PluginManager calls migrate() then register() on every app start.

const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) {
    migrate(db);
  },

  register(router, db, _appPaths) {
    router.use(
      '/videoplayer',
      (req, _res, next) => { req.db = db; next(); },
      routes,
    );
  },
};
