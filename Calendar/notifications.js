// Lightweight notifications: browser permission + in-app toast queue
(function(){
  function requestPermission(){
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Promise.resolve(Notification.permission);
  }

  function showBrowser(title, options){
    try { if (Notification.permission === 'granted') new Notification(title, options); } catch(e){ console.warn('browser notif failed', e); }
  }

  function makeToastContainer(){
    let c = document.getElementById('toast-container');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'toast-container';
    c.style.position = 'fixed';
    c.style.right = '20px';
    c.style.bottom = '20px';
    c.style.zIndex = '100500';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.gap = '8px';
    document.body.appendChild(c);
    return c;
  }

  function showToast(message, opts){
    const c = makeToastContainer();
    const t = document.createElement('div');
    t.className = 'app-toast';
    t.textContent = message;
    t.style.background = (opts && opts.background) || '#222';
    t.style.color = (opts && opts.color) || '#fff';
    t.style.padding = '8px 12px';
    t.style.borderRadius = '8px';
    t.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
    t.style.opacity = '0';
    t.style.transition = 'opacity .18s ease, transform .18s ease';
    t.style.transform = 'translateY(6px)';
    c.appendChild(t);
    requestAnimationFrame(()=>{ t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    const timeout = (opts && opts.timeout) || 3500;
    setTimeout(()=>{ t.style.opacity = '0'; t.style.transform = 'translateY(6px)'; setTimeout(()=> t.remove(), 200); }, timeout);
  }

  // Expose simple API
  window.calendarNotify = {
    init: requestPermission,
    show: function(message, params){
      if (!params) params = {};
      if (params.browser) showBrowser(params.browser.title || message, params.browser.options || {});
      if (!params.silent) showToast(message, params);
    }
  };

  // auto-init
  document.addEventListener('DOMContentLoaded', ()=>{ window.calendarNotify.init().catch(()=>{}); });
})();
