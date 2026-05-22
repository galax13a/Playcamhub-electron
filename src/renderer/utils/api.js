let BASE = 'http://127.0.0.1:3847';

function setBase(url) { BASE = url; }

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.fields = data.fields || null;
    err.form   = data.form   || null;
    throw err;
  }
  return data;
}

const API = {
  setBase,

  // App config
  config: {
    get: () => request('GET', '/config'),
  },

  // Songs
  songs: {
    list:          (q = {})  => request('GET', `/songs?${qs(q)}`),
    recent:        (limit)   => request('GET', `/songs/recent?limit=${limit || 12}`),
    favorites:     ()        => request('GET', '/songs/favorites'),
    mostPlayed:    (limit)   => request('GET', `/songs/most-played?limit=${limit || 12}`),
    stats:         ()        => request('GET', '/songs/stats'),
    get:           (id)      => request('GET', `/songs/${id}`),
    update:        (id, d)   => request('PUT', `/songs/${id}`, d),
    delete:        (id)      => request('DELETE', `/songs/${id}`),
    toggleFav:       (id)        => request('POST', `/songs/${id}/favorite`),
    played:          (id)        => request('POST', `/songs/${id}/played`),
    changeThumbnail: (id, fp)    => request('POST', `/songs/${id}/thumbnail`, { filePath: fp }),
    history:         (limit)     => request('GET', `/songs/history?limit=${limit || 26}`),
    clearHistory:    ()          => request('DELETE', '/songs/history'),
  },

  // Playlists
  playlists: {
    list:          ()        => request('GET', '/playlists'),
    get:           (id)      => request('GET', `/playlists/${id}`),
    getSongs:      (id)      => request('GET', `/playlists/${id}/songs`),
    create:        (d)       => request('POST', '/playlists', d),
    update:        (id, d)   => request('PUT', `/playlists/${id}`, d),
    delete:        (id)      => request('DELETE', `/playlists/${id}`),
    addSong:       (id, sid) => request('POST', `/playlists/${id}/songs`, { songId: sid }),
    removeSong:    (id, sid) => request('DELETE', `/playlists/${id}/songs/${sid}`),
    reorder:       (id, ids) => request('PUT', `/playlists/${id}/songs/reorder`, { songIds: ids }),
  },

  // Categories
  categories: {
    list:   ()          => request('GET', '/categories'),
    create: (d)         => request('POST', '/categories', d),
    update: (id, d)     => request('PUT', `/categories/${id}`, d),
    delete: (id)        => request('DELETE', `/categories/${id}`),
  },

  // Upload (local files)
  upload: {
    files: (paths) => request('POST', '/upload', { paths }),
  },

  // Auth / user profile
  auth: {
    getProfile:    (username) => request('GET', `/auth/profile?username=${encodeURIComponent(username)}`),
    updateProfile: (d)        => request('PUT', '/auth/profile', d),
  },

  // Plugin management + per-plugin DB settings (prefix plugin_{id}_ in settings table)
  plugins: {
    list:       ()              => request('GET',  '/plugins'),
    setEnabled: (id, enabled)   => request('PUT',  `/plugins/${id}`, { enabled }),
    getSettings:(id)            => request('GET',  `/plugins/${id}/settings`),
    setSetting: (id, key, val)  => request('POST', `/plugins/${id}/settings`, { key, value: String(val) }),
    setSettings:(id, obj)       => request('POST', `/plugins/${id}/settings`, { settings: obj }),
  },

  // Contacts plugin
  contacts: {
    list:        (q = {}) => request('GET',    `/contacts?${qs(q)}`),
    get:         (id)     => request('GET',    `/contacts/${id}`),
    create:      (d)      => request('POST',   '/contacts', d),
    update:      (id, d)  => request('PUT',    `/contacts/${id}`, d),
    delete:      (id)     => request('DELETE', `/contacts/${id}`),
    toggleActive:(id)     => request('POST',   `/contacts/${id}/toggle-active`),
  },

  // Notes plugin
  notes: {
    list:   (q = {}) => request('GET',    `/notes?${qs(q)}`),
    get:    (id)     => request('GET',    `/notes/${id}`),
    create: (d)      => request('POST',   '/notes', d),
    update: (id, d)  => request('PUT',    `/notes/${id}`, d),
    delete: (id)     => request('DELETE', `/notes/${id}`),
  },

  // Tasks plugin
  tasks: {
    list:        (q = {}) => request('GET',    `/tasks?${qs(q)}`),
    get:         (id)     => request('GET',    `/tasks/${id}`),
    create:      (d)      => request('POST',   '/tasks', d),
    update:      (id, d)  => request('PUT',    `/tasks/${id}`, d),
    delete:      (id)     => request('DELETE', `/tasks/${id}`),
    updateStatus:(id, s)  => request('PATCH',  `/tasks/${id}/status`, { status: s }),
  },

  // Settings
  settings: {
    getAll:  ()     => request('GET', '/settings'),
    setMany: (d)    => request('POST', '/settings', d),
  },

  // YouTube download queue
  downloads: {
    list:         ()              => request('GET', '/download-queue'),
    add:          (url, format)   => request('POST', '/download-queue', { url, format }),
    remove:       (id)            => request('DELETE', `/download-queue/${id}`),
    clearFinished:()              => request('DELETE', '/download-queue/clear'),
  },

  // Library export / import / migration
  library: {
    export:          ()              => request('GET', '/library/export'),
    import:          (data, dl)      => request('POST', '/library/import', { data, redownload: dl }),
    migrationStatus: (batchId)       => request('GET', `/library/migration-status?batchId=${encodeURIComponent(batchId)}`),
    activate:        (key)           => request('POST', '/library/activate', { key }),
    reset:           ()             => request('POST', '/library/reset'),
  },

  // Media URLs
  musicUrl:     (filePath)  => `${BASE}/music/${filePath}`,
  thumbnailUrl: (filePath)  => `${BASE}/thumbnails/${filePath}`,
};

function qs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export default API;
export { setBase };
