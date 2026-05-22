// Contacts plugin — frontend registration.

export default {
  id: 'contacts',

  // Inject plugin stylesheet into the document once
  onLoad() {
    if (!document.getElementById('contacts-css')) {
      const link  = document.createElement('link');
      link.id     = 'contacts-css';
      link.rel    = 'stylesheet';
      link.href   = '../../plugins/contacts/frontend/styles/contacts.css';
      document.head.appendChild(link);
    }
  },

  navItems: [
    { view: 'contacts:list', icon: '👥', label: 'Contactos' },
  ],

  views: {
    'contacts:list': async (el) => {
      const { renderContactList } = await import('./views/ContactList.js');
      renderContactList(el);
    },
  },
};
