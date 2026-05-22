export default {
  id: 'notes',

  onLoad() {
    const link = document.createElement('link');
    link.rel   = 'stylesheet';
    link.href  = new URL('./styles/notes.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'notes:list', icon: '📝', label: 'Notas' },
  ],

  views: {
    'notes:list': async (el) => {
      const { renderNoteList } = await import('./views/NoteList.js');
      renderNoteList(el);
    },
  },
};
