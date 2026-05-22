// Tiny pub/sub event bus shared across components
const EventBus = (() => {
  const listeners = {};

  function on(event, cb) {
    (listeners[event] ??= []).push(cb);
    return () => off(event, cb);
  }

  function off(event, cb) {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(fn => fn !== cb);
    }
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error('EventBus error', e); }
    });
  }

  function once(event, cb) {
    const unsub = on(event, (data) => { cb(data); unsub(); });
  }

  return { on, off, emit, once };
})();

export default EventBus;
