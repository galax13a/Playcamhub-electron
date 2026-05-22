// PlayRyu plugin — frontend registration.
// Declares the nav items this plugin contributes to the Sidebar and maps
// view keys to the existing renderer components (no duplication needed).

export default {
  id: 'playryu',

  navItems: [
    { view: 'playryu:library',  icon: '🎵', label: 'library'  },
    { view: 'playryu:search',   icon: '🔍', label: 'search'   },
    { view: 'playryu:upload',   icon: '📂', label: 'upload'   },
    { view: 'playryu:history',  icon: '🕐', label: 'history'  },
  ],

  // Playlists sidebar section — plugin provides renderer & data hook
  hasSidebarPlaylists: true,

  views: {
    'playryu:library': async (el, extra) => {
      const { renderLibrary } = await import('../../../src/renderer/components/Library.js');
      renderLibrary(el, extra);
    },
    'playryu:search': async (el, extra) => {
      const { renderSearch } = await import('../../../src/renderer/components/Search.js');
      renderSearch(el, extra);
    },
    'playryu:upload': async (el, extra) => {
      const { renderUpload } = await import('../../../src/renderer/components/Upload.js');
      renderUpload(el, extra);
    },
    'playryu:history': async (el, extra) => {
      const { renderHistory } = await import('../../../src/renderer/components/History.js');
      renderHistory(el, extra);
    },
    'playryu:playlist': async (el, extra) => {
      const { renderPlaylistView } = await import('../../../src/renderer/components/PlaylistView.js');
      renderPlaylistView(el, extra);
    },
  },
};
