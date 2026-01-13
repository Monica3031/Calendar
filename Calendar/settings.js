if (typeof THEME_KEY === 'undefined') {
    const THEME_KEY = 'calendar_dark_mode'; // already used by header.php
}
const VIEW_KEY = 'calendar_default_view';
const FIRST_DAY_KEY = 'calendar_first_day';
const MENU_CENTER_KEY = 'calendar_menu_centered';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const viewSelect = document.getElementById('default-view-select');
    const firstDayRadios = document.querySelectorAll('input[name="calendar-first-day"]');
    const menuCenteredCheckbox = document.getElementById('menu-centered');
    const saveBtn = document.getElementById('save-theme-btn');
    const clearBtn = document.getElementById('clear-theme-btn');
    const savedMarker = document.getElementById('theme-saved');

    function showSaved(){
        if(savedMarker){
            savedMarker.style.display = 'inline';
            setTimeout(()=> savedMarker.style.display = 'none', 1500);
        }
    }

    // INIT: Load saved preferences (if any)
    const savedView = localStorage.getItem(VIEW_KEY) || 'month';
    const savedFirst = localStorage.getItem(FIRST_DAY_KEY) || 'sunday';
    const savedMenuCentered = localStorage.getItem(MENU_CENTER_KEY) === '1';
    const savedPalette = localStorage.getItem('calendar_palette') || 'default';
    const defaultCategoryInput = document.getElementById('default-category-id');
    const savedDefaultCategory = localStorage.getItem('calendar_default_category_id');
    if (defaultCategoryInput && savedDefaultCategory) defaultCategoryInput.value = savedDefaultCategory;
    const addCategoryBtn = document.getElementById('add-category-btn');
    const newCategoryName = document.getElementById('new-category-name');
    const newCategoryColor = document.getElementById('new-category-color');
    const addCategoryMsg = document.getElementById('add-category-msg');

    const defaultCategorySelect = document.getElementById('default-category-id');

    async function loadCategoriesIntoSelect(){
        if (!defaultCategorySelect) return;
        try {
            const resp = await fetch('CRUD.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'categories' }) });
            const data = await resp.json();
            if (Array.isArray(data)){
                // clear but keep (none)
                const noneOption = defaultCategorySelect.querySelector('option[value=""]');
                defaultCategorySelect.innerHTML = '';
                if (noneOption) defaultCategorySelect.appendChild(noneOption);
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    opt.style.backgroundColor = c.color || '';
                    defaultCategorySelect.appendChild(opt);
                });
                const savedDefault = localStorage.getItem('calendar_default_category_id');
                if (savedDefault) defaultCategorySelect.value = savedDefault;
            }
        } catch (e){ console.warn('failed to load categories', e); }
    }

    // --- Category management table rendering ---
    const categoriesTableBody = document.querySelector('#categories-table tbody');

    async function loadAndRenderCategories(){
        try {
            const resp = await fetch('CRUD.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'categories' }) });
            if (!resp.ok) return;
            const cats = await resp.json();
            renderCategoriesTable(cats || []);
            // also refresh the default-category select
            await loadCategoriesIntoSelect();
        } catch (e) { console.warn('failed to load categories for table', e); }
    }

    function renderCategoriesTable(cats){
        if (!categoriesTableBody) return;
        categoriesTableBody.innerHTML = '';
        cats.forEach(c => {
            const tr = document.createElement('tr');
            tr.dataset.id = c.id;
            tr.innerHTML = `
                <td style="padding:6px;"><span class="cat-name">${escapeHtml(c.name)}</span><input class="edit-name" style="display:none;width:100%;padding:4px;" value="${escapeHtml(c.name)}"></td>
                <td style="padding:6px;vertical-align:middle;"><div class="cat-color" style="width:28px;height:20px;background:${escapeHtml(c.color || '#ffffff')};border:1px solid #ddd;border-radius:4px;"></div><input type="color" class="edit-color" style="display:none;margin-left:8px;" value="${escapeHtml(c.color || '#ffffff')}"></td>
                <td style="padding:6px;">
                    <button class="edit-btn">Edit</button>
                    <button class="save-btn" style="display:none;">Save</button>
                    <button class="cancel-btn" style="display:none;">Cancel</button>
                    <button class="delete-btn" style="margin-left:8px;">Delete</button>
                </td>
            `;
            categoriesTableBody.appendChild(tr);
        });
        attachTableHandlers();
    }

    function attachTableHandlers(){
        categoriesTableBody.querySelectorAll('tr').forEach(tr => {
            const id = tr.dataset.id;
            const editBtn = tr.querySelector('.edit-btn');
            const saveBtnRow = tr.querySelector('.save-btn');
            const cancelBtnRow = tr.querySelector('.cancel-btn');
            const deleteBtn = tr.querySelector('.delete-btn');
            const nameSpan = tr.querySelector('.cat-name');
            const nameInput = tr.querySelector('.edit-name');
            const colorDiv = tr.querySelector('.cat-color');
            const colorInput = tr.querySelector('.edit-color');

            editBtn.addEventListener('click', () => {
                nameSpan.style.display = 'none'; nameInput.style.display = 'inline-block';
                colorDiv.style.display = 'none'; colorInput.style.display = 'inline-block';
                editBtn.style.display = 'none'; saveBtnRow.style.display = 'inline-block'; cancelBtnRow.style.display = 'inline-block';
            });

            cancelBtnRow.addEventListener('click', () => {
                nameInput.style.display = 'none'; nameSpan.style.display = 'inline';
                colorInput.style.display = 'none'; colorDiv.style.display = 'block';
                editBtn.style.display = 'inline-block'; saveBtnRow.style.display = 'none'; cancelBtnRow.style.display = 'none';
            });

            saveBtnRow.addEventListener('click', async () => {
                const newName = nameInput.value.trim();
                const newColor = colorInput.value;
                if (!newName) return alert('Name required');
                try {
                    const r = await fetch('CRUD.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'update_category', id: id, name: newName, color: newColor }) });
                    const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch(e){}
                    if (!r.ok || !data || data.status !== 'success') { alert('Update failed: ' + (data && data.message ? data.message : txt)); return; }
                    nameSpan.textContent = newName; colorDiv.style.background = newColor;
                    cancelBtnRow.click();
                    await loadCategoriesIntoSelect();
                    try { window.calendarNotify.show('Category updated'); } catch(e){}
                } catch (e) { console.error('update failed', e); alert('Network error'); }
            });

            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Delete this category? This will fail if events reference it.')) return;
                try {
                    const r = await fetch('CRUD.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'delete_category', id: id }) });
                    const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch(e){}
                    if (!r.ok || !data || data.status !== 'success') { alert('Delete failed: ' + (data && data.message ? data.message : txt)); return; }
                    tr.remove();
                    await loadCategoriesIntoSelect();
                    try { window.calendarNotify.show('Category deleted'); } catch(e){}
                } catch (e) { console.error('delete failed', e); alert('Network error'); }
            });
        });
    }

    function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }


    addCategoryBtn?.addEventListener('click', async () => {
        const name = (newCategoryName.value || '').trim();
        const color = (newCategoryColor.value || '').trim();
        if (!name) return alert('Provide a category name');
        try {
            const resp = await fetch('CRUD.php?action=add_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color })
            });
            const txt = await resp.text().catch(()=>null);
            let data = null;
            try { data = txt ? JSON.parse(txt) : null; } catch(e){ /* ignore parse error */ }
            if (!resp.ok) {
                console.error('add_category failed', resp.status, txt);
                const msg = data && data.message ? data.message : (txt || resp.status);
                // If server returned an HTML error page (like nginx 404) or 5xx, try fallback endpoint
                if (txt && txt.trim().startsWith('<')) {
                    try {
                        const fb = await fetch('add_category_fallback.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
                        const fbTxt = await fb.text().catch(()=>null);
                        let fbData = null; try { fbData = fbTxt ? JSON.parse(fbTxt) : null; } catch(e){}
                        if (fb.ok && fbData && fbData.status === 'success') {
                            data = fbData; // treat as success
                        } else {
                            const fmsg = fbData && fbData.message ? fbData.message : (fbTxt || fb.status);
                            try { window.calendarNotify.show('Failed to add category: ' + fmsg, { background: '#c0392b' }); } catch(e){}
                            alert('Failed to add category: ' + fmsg);
                            return;
                        }
                    } catch (e2) {
                        try { window.calendarNotify.show('Failed to add category: ' + msg, { background: '#c0392b' }); } catch(e){}
                        alert('Failed to add category: ' + msg);
                        return;
                    }
                } else {
                    try { window.calendarNotify.show('Failed to add category: ' + msg, { background: '#c0392b' }); } catch(e){}
                    alert('Failed to add category: ' + msg);
                    return;
                }
            }
            if (!data || data.status !== 'success'){
                const msg = data && data.message ? data.message : (txt || 'Unknown server response');
                try { window.calendarNotify.show('Failed to add category: ' + msg, { background: '#c0392b' }); } catch(e){}
                alert('Failed: ' + msg);
                return;
            }
            // success
            localStorage.setItem('calendar_default_category_id', String(data.id));
            if (defaultCategorySelect){
                const opt = document.createElement('option');
                opt.value = data.id;
                opt.textContent = name;
                opt.style.backgroundColor = color || '';
                defaultCategorySelect.appendChild(opt);
                defaultCategorySelect.value = data.id;
            }
            addCategoryMsg.style.display = 'inline';
            setTimeout(()=> addCategoryMsg.style.display = 'none', 2000);
            try { window.calendarNotify.show('Category added', { browser: { title: 'Category added' } }); } catch(e){}
        } catch (e){
            console.error('Network error adding category', e);
            try { window.calendarNotify.show('Network error adding category', { background: '#c0392b' }); } catch(e){}
            alert('Network error');
        }
    });

    viewSelect.value = savedView;
    firstDayRadios.forEach(r => r.checked = (r.value === savedFirst));
    menuCenteredCheckbox.checked = savedMenuCentered;
    const paletteSelect = document.getElementById('palette-select');
    if (paletteSelect) paletteSelect.value = savedPalette;

    // Load categories for default-category select
    loadCategoriesIntoSelect();
    // Load and render categories management table
    loadAndRenderCategories();

    // Apply menu centered immediately (for preview)
    if(savedMenuCentered){ document.documentElement.classList.add('menu-centered'); }

    // SAVE: Save all preferences
    saveBtn?.addEventListener('click', () => {
        // Theme save handled by header.php; we save the rest here
        localStorage.setItem(VIEW_KEY, viewSelect.value);
        const selFirst = Array.from(firstDayRadios).find(r => r.checked);
        localStorage.setItem(FIRST_DAY_KEY, selFirst ? selFirst.value : 'sunday');
        localStorage.setItem(MENU_CENTER_KEY, menuCenteredCheckbox.checked ? '1' : '0');
        if (paletteSelect) {
            localStorage.setItem('calendar_palette', paletteSelect.value);
            try {
                document.documentElement.classList.forEach(c => { if (c.startsWith('palette-')) document.documentElement.classList.remove(c); });
                if (paletteSelect.value && paletteSelect.value !== 'default') document.documentElement.classList.add('palette-' + paletteSelect.value);
                window.dispatchEvent(new CustomEvent('calendarPrefChanged', { detail: { key: 'palette', value: paletteSelect.value } }));
            } catch (e) { console.warn('palette apply failed', e); }
        }

        // save default category id
        if (defaultCategoryInput){
            const v = defaultCategoryInput.value ? String(defaultCategoryInput.value) : '';
            if (v) localStorage.setItem('calendar_default_category_id', v);
            else localStorage.removeItem('calendar_default_category_id');
            window.dispatchEvent(new CustomEvent('calendarPrefChanged', { detail: { key: 'defaultCategory', value: v } }));
        }

        // Apply menu centering instantly
        if(menuCenteredCheckbox.checked){
            document.documentElement.classList.add('menu-centered');
        } else {
            document.documentElement.classList.remove('menu-centered');
        }

        showSaved();
    });

    // CLEAR: reset to defaults
    clearBtn?.addEventListener('click', () => {
        localStorage.removeItem(VIEW_KEY);
        localStorage.removeItem(FIRST_DAY_KEY);
        localStorage.removeItem(MENU_CENTER_KEY);

        

        viewSelect.value = 'month';
        firstDayRadios.forEach(r => r.checked = (r.value === 'sunday'));
        menuCenteredCheckbox.checked = false;
        document.documentElement.classList.remove('menu-centered');

        showSaved();
    });

    
});