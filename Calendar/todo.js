(function(){
  const QUICK_KEY = 'calendar_quick_bullets_v1';

  // Helper: pick the currently active date from the date-picker when available,
  // otherwise fall back to today. Used to scope localStorage keys per-day.
  function getActiveDate() {
    try {
      const dp = document.getElementById('date-picker-input');
      if (dp && dp.value) return dp.value;
    } catch (e) {}
    return new Date().toISOString().slice(0,10);
  }

  // Quick bullets helpers
  function readQuick(){
    try{
      const key = QUICK_KEY + ':' + getActiveDate();
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch(e){ return []; }
  }
  function writeQuick(items){
    try{ const key = QUICK_KEY + ':' + getActiveDate(); localStorage.setItem(key, JSON.stringify(items)); } catch(e){}
  }

  // Detect whether a server/API is available and a user is present
  function hasServer(){ return (typeof API_BASE !== 'undefined') && !!window.currentUserId; }

  // Render quick bullets
  function renderQuick(){
    const listEl = document.getElementById('quickList');
    const empty = document.getElementById('quickEmpty');
    // If user is logged in and server is available, quick bullets are server-backed
    const items = hasServer() ? [] : readQuick();
    if(!listEl) return;
    listEl.innerHTML = '';
    if (hasServer()) {
      // When server-backed quick bullets exist, don't show a local-help message; keep the empty node hidden.
      if (empty) { empty.style.display = 'none'; }
      return;
    }
    if(!items.length){ if(empty) empty.style.display='block'; return; } else { if(empty) empty.style.display='none'; }
    items.forEach((it, idx) => {
      const row = document.createElement('div'); row.className='todo-item' + (it.done? ' done':'');
      const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!it.done;
      chk.addEventListener('change', ()=>{ const arr = readQuick(); arr[idx].done = chk.checked; writeQuick(arr); renderQuick(); });
      const title = document.createElement('div'); title.className='title'; title.textContent = it.title;
      const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ const arr = readQuick(); arr.splice(idx,1); writeQuick(arr); renderQuick(); });
      row.appendChild(chk); row.appendChild(title); row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  function init(){
  const container = document.querySelector('.todo-main');
  // currentDate holds the day the user is viewing; default to today
  let currentDate = new Date().toISOString().slice(0,10);
  function updateDateDisplay(){
    try { const span = document.getElementById('currentDateSpan'); if (span) span.textContent = currentDate; const pageTitle = document.getElementById('pageTitle'); if (pageTitle) pageTitle.textContent = 'To-Do — ' + currentDate; } catch(e){}
  }
  // navigation helper: change day by offset and update UI
  function changeDay(offset){
    try{
      const dp = document.getElementById('date-picker-input');
      const cur = new Date((dp && dp.value) ? dp.value : currentDate);
      cur.setDate(cur.getDate() + Number(offset));
      const nv = cur.toISOString().slice(0,10);
      currentDate = nv; if (dp) dp.value = nv; updateDateDisplay(); loadListsForDate(currentDate);
    }catch(e){ console.warn('todo.js: changeDay error', e); }
  }

  // wire span/button navigation if present and make accessible
  try {
    const prev = document.getElementById('datePrev'); const next = document.getElementById('dateNext');
    if (prev) {
      prev.setAttribute('role','button'); prev.setAttribute('tabindex','0'); prev.style.cursor = 'pointer';
      prev.addEventListener('click', ()=> changeDay(-1));
      prev.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); changeDay(-1); } });
      const p = prev.querySelector && prev.querySelector('pre'); if (p) p.style.pointerEvents = 'none';
    }
    if (next) {
      next.setAttribute('role','button'); next.setAttribute('tabindex','0'); next.style.cursor = 'pointer';
      next.addEventListener('click', ()=> changeDay(1));
      next.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); changeDay(1); } });
      const p2 = next.querySelector && next.querySelector('pre'); if (p2) p2.style.pointerEvents = 'none';
    }
    // Document-level fallback: map clicks on inner <pre> to parent span
    document.addEventListener('click', function(evt){
      try {
        const pre = evt.target.closest && evt.target.closest ? evt.target.closest('#datePrev pre, #dateNext pre') : null;
        if (!pre) return;
        const span = pre.parentElement; if (!span) return; span.click();
      } catch(e) {}
    }, { capture: true });
  } catch(e){}
  // initialize display
  updateDateDisplay();

  // debug button removed

  // ensure the hidden/optional date-picker input (used by templates) starts with today
  try {
    const dp = document.getElementById('date-picker-input');
    if (dp) {
      dp.value = currentDate;
      dp.addEventListener('change', function(){ currentDate = this.value; updateDateDisplay(); loadListsForDate(currentDate); });
    }
    // If a server and user are available, load lists for today's date immediately
    try { if (typeof loadListsForDate === 'function' && hasServer()) loadListsForDate(currentDate); } catch(e) { /* ignore */ }
  } catch(e) { console.warn('todo.js: failed to init date-picker', e); }

  // Robust delegated handler: catch any clicks on the spans or their <pre> children
  try {
    document.addEventListener('click', function(evt){
      try {
        const target = evt.target;
        // look for span ids or inner pre
        const span = target.closest && target.closest('#datePrev, #dateNext, #datePrev pre, #dateNext pre') ? (target.closest('#datePrev') || target.closest('#dateNext') || (target.closest('#datePrev pre') && target.closest('#datePrev pre').parentElement) || (target.closest('#dateNext pre') && target.closest('#dateNext pre').parentElement)) : null;
        if (!span) return;
        // debug
        console.debug('todo.js: delegated click on date span id=', span.id);
        if (span.id === 'datePrev') {
          const d = new Date(currentDate); d.setDate(d.getDate()-1); currentDate = d.toISOString().slice(0,10); updateDateDisplay(); loadListsForDate(currentDate);
        }
        if (span.id === 'dateNext') {
          const d = new Date(currentDate); d.setDate(d.getDate()+1); currentDate = d.toISOString().slice(0,10); updateDateDisplay(); loadListsForDate(currentDate);
        }
      } catch(err) { console.warn('todo.js: delegated date click handler error', err); }
    }, { capture: true });
  } catch(e) { console.warn('todo.js: failed to attach delegated click handler', e); }

    // server sync handlers
    async function apiCall(payload){
      try {
  // Build API URL: prefer API_BASE when provided (e.g. '/Calendar'), otherwise use relative path to this folder
  const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
  const url = base ? (base.replace(/\/$/, '') + '/CRUD.php') : 'CRUD.php';
        console.debug('apiCall ->', url, payload);
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const txt = await res.text();
        console.debug('apiCall <-', txt);
        try { return JSON.parse(txt); } catch(e){ return { status:'error', message:'Invalid server response', raw:txt }; }
      } catch (err) { console.debug('apiCall error', err); return { status:'error', message: err.message }; }
    }

  // ...existing code...

    // Sync helper: refresh lists for current date and render items into the server-items area
      async function loadListsForDate(d){
        const date = d || new Date().toISOString().slice(0,10);
        if (!window.currentUserId) {
          console.debug('todo.js: loadListsForDate skipped because currentUserId is not set');
          return;
        }
        const payload = { action:'todo_get_lists', id_users: window.currentUserId, list_date: date };
        let r;
        try {
          r = await apiCall(payload);
        } catch (err) {
          r = { status: 'error', message: err && err.message ? err.message : String(err) };
        }
        if (r && r.status === 'success' && Array.isArray(r.lists)) {
          renderServerLists(r.lists);
        } else if (r && r.status === 'success' && Array.isArray(r)) {
          // defensive: some servers may return arrays directly
          renderServerLists(r);
        } else {
          console.warn('todo load failed', r);
          // show a user-visible message in the server lists area
          const quickSection = document.querySelector('section');
          let holder = document.getElementById('serverLists');
          if (!holder) { holder = document.createElement('div'); holder.id='serverLists'; holder.style.marginBottom = '12px'; quickSection.parentNode.insertBefore(holder, quickSection.nextSibling); }
          holder.innerHTML = '<div class="todo-empty server-message">Failed to load server lists: ' + (r && (r.message || JSON.stringify(r)) || 'unknown error') + '</div>';
          // retry once after a short delay to handle transient failures
          if (!window._todo_load_retry) { window._todo_load_retry = true; setTimeout(()=>{ loadListsForDate(date); }, 400); }
        }
      }

function renderServerLists(lists) {
        // Show server lists and their items inline beneath quick bullets
        const quickSection = document.querySelector('section'); 
        let holder = document.getElementById('serverLists');
        if (!holder) { 
            holder = document.createElement('div'); 
            holder.id = 'serverLists'; 
            holder.style.marginBottom = '12px'; 
            quickSection.parentNode.insertBefore(holder, quickSection.nextSibling); 
        }
        holder.innerHTML = '';

        if (!Array.isArray(lists) || lists.length === 0) {
            holder.innerHTML = '<div class="todo-empty server-message">No server lists for this date.</div>';
            return;
        }

        // Improved Regex to identify the raw DB timestamp: "2026-01-13 00:00:00.000000"
        const rawTimestampRe = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)|([A-Z][a-z]{2} \d{1,2} \d{4} \d{1,2}:\d{2}[APM]{2})/g;

        lists.forEach(l => {
            // 1. Process and Clean the Title
            let safeTitle = '';
            if (typeof l.title === 'string') {
                safeTitle = l.title.replace(rawTimestampRe, '').trim();
            } else if (l.title && typeof l.title === 'object') {
                safeTitle = (l.title.title || l.title.name || '').toString().replace(rawTimestampRe, '').trim();
            }

            // 2. Process and Clean the Date
            let safeDate = '';
            let rawDateStr = '';
            if (typeof l.list_date === 'string') {
                rawDateStr = l.list_date.trim();
            } else if (l.list_date && typeof l.list_date === 'object') {
                rawDateStr = (l.list_date.date || l.list_date.list_date || '').toString().trim();
            }

            // If the date string is NOT a raw timestamp, we can use it
            if (rawDateStr && !rawTimestampRe.test(rawDateStr)) {
                safeDate = rawDateStr;
                try { 
                    const dt = new Date(safeDate); 
                    if (!isNaN(dt.getTime())) safeDate = dt.toLocaleDateString(); 
                } catch(e) {}
            }

            // 3. Filter out empty lists that have no title, no valid date, and no items
            const hasItems = Array.isArray(l.items) && l.items.length > 0;
            if (!safeTitle && !safeDate && !hasItems) return;

            // Create the container
            const box = document.createElement('div'); 
            box.className = 'server-list-box'; 
            box.style.border = '1px solid #ddd'; 
            box.style.padding = '8px'; 
            box.style.marginBottom = '8px'; 
            box.dataset.listId = l.id;

            // 4. Build the Header only if we have a clean Title or Date
            let headerText = [safeDate, safeTitle].filter(Boolean).join(' — ');
            if (headerText) {
                const h = document.createElement('div');
                h.textContent = headerText;
                h.style.fontWeight = '600'; 
                h.style.marginBottom = '6px';
                box.appendChild(h);
            }

            // 5. Render Items
            const itemsHolder = document.createElement('div'); 
            itemsHolder.className = 'server-items';
            (l.items || []).forEach(it => {
                const row = document.createElement('div'); 
                row.className = 'todo-item' + (it.done ? ' done' : ''); 
                row.style.display = 'flex'; 
                row.style.alignItems = 'center'; 
                row.style.gap = '8px'; 
                row.style.marginBottom = '6px';

                const chk = document.createElement('input'); 
                chk.type = 'checkbox'; 
                chk.checked = !!it.done;
                chk.addEventListener('change', async () => {
                    try {
                        await apiCall({ action: 'todo_update_item', id_users: window.currentUserId, item_id: it.item_id, done: chk.checked ? 1 : 0 });
                        await loadListsForDate(document.getElementById('date-picker-input') ? document.getElementById('date-picker-input').value : currentDate);
                    } catch(e) { console.warn('update item failed', e); }
                });

                const titleWrap = document.createElement('div'); 
                titleWrap.style.flex = '1'; 
                titleWrap.className = 'todo-title-wrap';
                
                const titleSpan = document.createElement('div'); 
                titleSpan.className = 'todo-title';
                let itemTitle = typeof it.title === 'string' ? it.title : (it.title?.title || it.title?.name || '').toString();
                titleSpan.textContent = itemTitle.replace(rawTimestampRe, '').trim();
                
                titleWrap.appendChild(titleSpan);

                const editBtn = document.createElement('button'); 
                editBtn.className = 'todo-edit'; 
                editBtn.textContent = '✎';
                editBtn.addEventListener('click', () => {
                    const input = document.createElement('input'); 
                    input.type = 'text'; 
                    input.value = titleSpan.textContent; 
                    input.className = 'todo-edit-input'; 
                    input.style.flex = '1';
                    
                    const save = document.createElement('button'); 
                    save.textContent = 'Save';
                    const cancel = document.createElement('button'); 
                    cancel.textContent = 'Cancel';
                    
                    titleWrap.innerHTML = ''; 
                    titleWrap.appendChild(input); 
                    titleWrap.appendChild(save); 
                    titleWrap.appendChild(cancel);
                    input.focus();

                    save.addEventListener('click', async () => {
                        try {
                            const resp = await apiCall({ action: 'todo_update_item', id_users: window.currentUserId, item_id: it.item_id, title: input.value.trim() });
                            if (resp?.status === 'success') await loadListsForDate(currentDate);
                        } catch (err) { console.warn('save item failed', err); }
                    });
                    cancel.addEventListener('click', () => {
                        titleWrap.innerHTML = ''; 
                        titleWrap.appendChild(titleSpan); 
                        titleWrap.appendChild(editBtn);
                    });
                });

                const del = document.createElement('button'); 
                del.className = 'todo-delete'; 
                del.textContent = '🗑️';
                del.addEventListener('click', async () => {
                    if (!confirm('Delete this item?')) return;
                    try {
                        const res = await apiCall({ action: 'todo_delete_item', id_users: window.currentUserId, item_id: it.item_id });
                        if (res?.status === 'success') await loadListsForDate(currentDate);
                    } catch(e) { console.warn('delete item failed', e); }
                });

                row.appendChild(chk); 
                row.appendChild(titleWrap); 
                row.appendChild(editBtn); 
                row.appendChild(del);
                itemsHolder.appendChild(row);
            });

            box.appendChild(itemsHolder);
            holder.appendChild(box);
        });
    }

  // date controls removed: lists load by today's date when needed
  // quick bullets bindings
    const qAdd = document.getElementById('quickAddBtn');
    const qIn = document.getElementById('quickInput');
    // Helper: ensure a server list exists for the provided date and return its id (or null)
    async function ensureServerListForDate(listDate){
      try {
        const probe = await apiCall({ action: 'todo_get_lists', id_users: window.currentUserId, list_date: listDate });
        if (probe && probe.status === 'success' && Array.isArray(probe.lists) && probe.lists.length) return probe.lists[0].id;
        // create an empty-titled list
        const cr = await apiCall({ action: 'todo_create_list', id_users: window.currentUserId, title: '', list_date: listDate });
        if (cr && cr.status === 'success') {
          // Accept either { created_id: id } or { list: { id: ... } }
          if (cr.list && cr.list.id) return cr.list.id;
          if (cr.created_id) return cr.created_id;
        }
        // fallback probe: re-query lists and find an empty-title one
        const probe2 = await apiCall({ action: 'todo_get_lists', id_users: window.currentUserId, list_date: listDate });
        if (probe2 && probe2.status === 'success' && Array.isArray(probe2.lists)){
          const found = probe2.lists.find(x => (x.title||'') === '' || x.title === null);
          if (found) return found.id;
        }
      } catch(e){ console.warn('ensureServerListForDate failed', e); }
      return null;
    }

    if(qAdd && qIn){
      qAdd.addEventListener('click', async ()=>{
        const v = qIn.value.trim(); if(!v) return;
        try {
          if (hasServer()){
            const listDate = (document.getElementById('date-picker-input') && document.getElementById('date-picker-input').value) ? document.getElementById('date-picker-input').value : currentDate;
            const listId = await ensureServerListForDate(listDate);
            if (listId) {
              const res = await apiCall({ action:'todo_add_item', id_users: window.currentUserId, title: v, list_id: listId });
              if (res && res.status === 'success') {
                qIn.value = '';
                // If server returned the created item, we can optimistically reload. Otherwise reload to ensure carry-forward rules apply
                await loadListsForDate(listDate);
                return;
              }
            }
            // If server path failed, fall back to local storage
          }
          // Local fallback
          const arr = readQuick(); arr.unshift({ title: v, done: false, created: Date.now() }); writeQuick(arr); qIn.value=''; renderQuick();
        } catch(e){ console.warn('quick add failed', e); const arr = readQuick(); arr.unshift({ title: v, done: false, created: Date.now() }); writeQuick(arr); qIn.value=''; renderQuick(); }
      });
      qIn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') qAdd.click(); });
    }

    // Ensure defaults (no automatic 'Shopping' list)
  renderQuick();
  // initial server load for today's date
  if (hasServer()) loadListsForDate(currentDate);
  // initial page title left as default (no date picker present)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();