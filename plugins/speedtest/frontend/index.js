/**
 * SpeedTest plugin — frontend registration.
 * Disabled by default (plugin.json "enabled": false).
 */
export default {
  id: 'speedtest',

  navItems: [
    { view: 'speedtest:main', icon: '⚡', labelKey: 'nav_speedtest', label: 'Speed Test' },
  ],

  views: {
    'speedtest:main': async (el) => {
      const { renderSpeedTest } = await import('./views/SpeedTest.js');
      renderSpeedTest(el);
    },
  },
};
