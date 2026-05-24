import EventBus       from './utils/eventBus.js';
import API            from './utils/api.js';
import { setLang }    from './utils/i18n.js';

const store = {
  state: {
    // Player
    currentSong:  null,
    queue:        [],
    queueIndex:   -1,
    isPlaying:    false,
    volume:       0.8,
    progress:     0,
    duration:     0,
    shuffle:      false,
    repeat:       'none', // 'none' | 'all' | 'one'

    // UI
    theme:        'dark',
    currentView:  'home',
    currentPlaylistId: null,

    // Data
    songs:        [],
    playlists:    [],
    categories:   [],
    downloadQueue:[],
    history:      [],
    settings:     {},
    appConfig:    { appName: 'PlaycamHub Studio', appSlogan: 'Plataforma Multimedia para Creators', appVersion: '1.0.1', logoText: 'PlaycamHub', appTitle: 'PlaycamHub Studio' },
    loggedUser:   null,
  },

  // ── State mutation ─────────────────────────────────────────────────────────
  setState(updates) {
    const prev = this.state;
    this.state = { ...this.state, ...updates };
    Object.keys(updates).forEach(key => {
      if (prev[key] !== updates[key]) {
        EventBus.emit(`store:${key}`, updates[key]);
      }
    });
    EventBus.emit('store:change', this.state);
  },

  // ── Data loaders ───────────────────────────────────────────────────────────
  async loadSongs(filters = {}) {
    try {
      const { songs } = await API.songs.list(filters);
      this.setState({ songs });
      return songs;
    } catch (_) { return []; }
  },

  async loadPlaylists() {
    try {
      const pls = await API.playlists.list();
      this.setState({ playlists: pls });
      return pls;
    } catch (_) { return []; }
  },

  async loadCategories() {
    try {
      const cats = await API.categories.list();
      this.setState({ categories: cats });
      return cats;
    } catch (_) { return []; }
  },

  async loadConfig() {
    try {
      const cfg = await API.config.get();
      this.setState({ appConfig: cfg });
    } catch (_) {}
  },

  async loadSettings() {
    try {
      const s = await API.settings.getAll();
      this.setState({ settings: s });
      if (s.theme)    this.applyTheme(s.theme);
      if (s.volume)   this.setState({ volume: Number(s.volume) / 100 });
      if (s.language) { setLang(s.language); }
      return s;
    } catch (_) { return {}; }
  },

  async loadUserProfile() {
    const { loggedUser } = this.state;
    if (!loggedUser?.username) return;
    try {
      const profile = await API.auth.getProfile(loggedUser.username);
      this.setState({ settings: { ...this.state.settings, ...profile } });
    } catch (_) {}
  },

  async loadHistory() {
    const items = await API.songs.history(26);
    this.setState({ history: items });
    return items;
  },

  async loadDownloadQueue() {
    const q = await API.downloads.list();
    this.setState({ downloadQueue: q });
    return q;
  },

  // ── Player helpers ─────────────────────────────────────────────────────────
  playSong(song, queueList) {
    const queue = queueList || this.state.songs;
    const idx   = queue.findIndex(s => s.id === song.id);
    this.setState({ currentSong: song, queue, queueIndex: idx, isPlaying: true });
    API.songs.played(song.id).catch(() => {});
  },

  togglePlay() {
    this.setState({ isPlaying: !this.state.isPlaying });
  },

  nextSong() {
    const { queue, queueIndex, shuffle, repeat, settings, songs } = this.state;
    if (!queue.length) return;

    const autoPlay = settings.auto_play !== 'false';

    // Library random: pick any song from the full library
    if (repeat === 'library') {
      const pool = songs.length ? songs : queue;
      const song = pool[Math.floor(Math.random() * pool.length)];
      this.setState({ currentSong: song, isPlaying: true });
      API.songs.played(song.id).catch(() => {});
      return;
    }

    let next;
    if (shuffle) {
      let idx;
      do { idx = Math.floor(Math.random() * queue.length); }
      while (idx === queueIndex && queue.length > 1);
      next = idx;
    } else if (queueIndex < queue.length - 1) {
      next = queueIndex + 1;
    } else if (repeat === 'all') {
      next = 0;
    } else {
      this.setState({ isPlaying: false });
      return;
    }

    if (!autoPlay && repeat === 'none') {
      this.setState({ isPlaying: false });
      return;
    }

    this.setState({ currentSong: queue[next], queueIndex: next, isPlaying: true });
    API.songs.played(queue[next].id).catch(() => {});
  },

  prevSong() {
    const { queue, queueIndex, progress } = this.state;
    if (!queue.length) return;
    if (progress > 3) { EventBus.emit('player:seek', 0); return; }
    const prev = Math.max(0, queueIndex - 1);
    this.setState({ currentSong: queue[prev], queueIndex: prev, isPlaying: true });
  },

  // ── Language ───────────────────────────────────────────────────────────────
  setLanguage(lang) {
    setLang(lang);
    const settings = { ...this.state.settings, language: lang };
    this.setState({ settings });
    API.settings.setMany({ language: lang }).catch(() => {});
    EventBus.emit('lang:change', lang);  // single controlled emission
  },

  // ── Theme ──────────────────────────────────────────────────────────────────
  // Theme can only be changed from Settings — do not call this from other components
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.setState({ theme });
    // Only persist to DB when logged in (boot() calls this without auth → 401 otherwise)
    if (this.state.loggedUser) API.settings.setMany({ theme }).catch(() => {});
  },

  // ── Navigation ─────────────────────────────────────────────────────────────
  navigate(view, extra = {}) {
    this.setState({ currentView: view, ...extra });
    EventBus.emit('navigate', { view, ...extra });
    try { localStorage.setItem('last_view', view); } catch (_) {}
  },
};

export default store;
