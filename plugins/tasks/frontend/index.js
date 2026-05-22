export default {
  id: 'tasks',

  onLoad() {
    const link = document.createElement('link');
    link.rel   = 'stylesheet';
    link.href  = new URL('./styles/tasks.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'tasks:list', icon: '✅', label: 'Tareas' },
  ],

  views: {
    'tasks:list': async (el) => {
      const { renderTaskList } = await import('./views/TaskList.js');
      renderTaskList(el);
    },
  },
};
