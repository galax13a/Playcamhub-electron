'use strict';

// PlayRyu plugin — backend entry point.
// PluginManager calls migrate() then register() on every app start.

const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) {
    migrate(db);
  },

  register(router, _db, _appPaths) {
    // Mount all PlayRyu routes at the same /api/* paths the frontend expects.
    router.use('/', routes);
  },
};
