// Starcho plugin — frontend registration.
// Declares the nav items this plugin contributes to the Sidebar and maps
// view keys to the existing renderer components (no duplication needed).

export default {
  id: 'starcho',

  navItems: [
    { view: 'starcho:library',  icon: '🎵', label: 'library'  },
    { view: 'starcho:search',   icon: '🔍', label: 'search'   },
    { view: 'starcho:upload',   icon: '📂', label: 'upload'   },
    { view: 'starcho:history',  icon: '🕐', label: 'history'  },
  ],

  // Playlists sidebar section — plugin provides renderer & data hook
  hasSidebarPlaylists: true,

  views: {
    'starcho:library': async (el, extra) => {
      const { renderLibrary } = await import('../../../src/renderer/components/Library.js');
      renderLibrary(el, extra);
    },
    'starcho:search': async (el, extra) => {
      const { renderSearch } = await import('../../../src/renderer/components/Search.js');
      renderSearch(el, extra);
    },
    'starcho:upload': async (el, extra) => {
      const { renderUpload } = await import('../../../src/renderer/components/Upload.js');
      renderUpload(el, extra);
    },
    'starcho:history': async (el, extra) => {
      const { renderHistory } = await import('../../../src/renderer/components/History.js');
      renderHistory(el, extra);
    },
    'starcho:playlist': async (el, extra) => {
      const { renderPlaylistView } = await import('../../../src/renderer/components/PlaylistView.js');
      renderPlaylistView(el, extra);
    },
  },
};
