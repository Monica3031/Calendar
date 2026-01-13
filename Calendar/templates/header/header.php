<?php
// Compute base path so image URLs resolve correctly regardless of including page's path
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($base === '/' || $base === '.') $base = '';
// Resolve images moved into Calendar/templates/images — use $base when available, otherwise use '/Calendar'
// Resolve a public URL path for the images folder by mapping the filesystem path to the document root.
// This avoids hardcoding "/Calendar" when the site is deployed at root or under a different base.
$assetPrefix = '/templates/images'; // sensible default
$fsImages = realpath(__DIR__ . '/../images'); // Calendar/templates/images
$docRoot = isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
if ($fsImages && $docRoot && strpos($fsImages, $docRoot) === 0) {
    $assetPrefix = '/' . trim(str_replace('\\', '/', substr($fsImages, strlen($docRoot))), '/');
} else {
    // Fallback: prefer a base-aware path if available
    if ($base !== '') $assetPrefix = rtrim($base, '/') . '/templates/images';
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="calendar.css">
</head>
<body>
    <header>
        <nav class="navbar">
            <a class="icon-link icon-only-link" href="index.php" title="Login/Register" aria-label="Login/Register"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/sign_2939220.png" alt="Login/Register"></a>
            <a class="icon-link icon-only-link" href="logout.php" title="Logout" aria-label="Logout"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/logout_3962656.png" alt="Logout"></a>
            <a class="icon-link icon-only-link" href="month.php" title="Month View" aria-label="Month View"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/calendar-week_17654738.png" alt="Month View"></a>
            <a class="icon-link icon-only-link" href="week.php" title="Week View" aria-label="Week View"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/schedule_9175971.png" alt="Week View"></a>
            <a class="icon-link icon-only-link" href="day.php" title="Day View" aria-label="Day View"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/calendar_12719332.png" alt="Day View"></a>
            <a class="icon-link icon-only-link" href="todo.php" title="To-Do List" aria-label="To-Do List"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/paper_15158880.png" alt="To-Do List"></a>
            <a class="icon-link icon-only-link" href="add_new_event.php" title="Add Event" aria-label="Add Event"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/plus-icon_7693267.png" alt="Add"></a>
            <button id="theme-toggle-btn" title="Toggle dark mode" class="icon-only" aria-label="Toggle dark mode"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/day-night_14366515.png" alt="Theme"></button>
            <a class="icon-link icon-only-link" href="settings.php" title="Settings" aria-label="Settings"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/setting_5736401.png" alt="Settings"></a>
        </nav>
        
    </header>

    <script>
    // Pointerdown capturing fallback: toggles dropdown open/close even if other scripts
    // overwrite window.onclick or stopPropagation on click. Runs in capture phase.
    (function(){
        try {
            document.addEventListener('pointerdown', function(ev){
                const btn = ev.target.closest && ev.target.closest('.dropbtn');
                if (!btn) return;
                // Use capture-phase toggle so it runs before other listeners
                ev.preventDefault(); ev.stopPropagation();
                const dd = btn.parentElement;
                if (!dd) return;
                const isOpen = dd.classList.toggle('open');
                btn.setAttribute('aria-expanded', isOpen);
                // close other dropdowns
                document.querySelectorAll('.dropdown.open').forEach(o => { if (o !== dd) o.classList.remove('open'); });
            }, { capture: true, passive: false });
        } catch (err) { console.warn('pointerdown fallback init failed', err); }
    })();
    </script>

    <main></main>

    <script>
        const THEME_KEY = 'calendar_dark_mode'; // Global constant

        function applyThemeClass(mode) {
            const html = document.documentElement;
            if (window.matchMedia) {
                const mq = window.matchMedia('(prefers-color-scheme: dark)');
                if (mq._listener) mq.removeEventListener('change', mq._listener);
            }
            if (mode === 'dark') {
                html.classList.add('dark-mode');
            } else if (mode === 'light') {
                html.classList.remove('dark-mode');
            } else if (mode === 'system') {
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) html.classList.add('dark-mode'); else html.classList.remove('dark-mode');
                if (window.matchMedia) {
                    const mq = window.matchMedia('(prefers-color-scheme: dark)');
                    const newListener = () => applyThemeClass('system');
                    mq.addEventListener('change', newListener);
                    mq._listener = newListener;
                }
            }
        }

        const initialPreference = localStorage.getItem(THEME_KEY) || 'system';
        applyThemeClass(initialPreference);

        (function applySavedPalette(){
            const pal = localStorage.getItem('calendar_palette') || 'default';
            if(pal && pal !== 'default') document.documentElement.classList.add('palette-' + pal);
            try {
                const a = localStorage.getItem('calendar_palette_accent');
                const b = localStorage.getItem('calendar_palette_bg');
                if (a) document.documentElement.style.setProperty('--cal-accent', a);
                if (b) document.documentElement.style.setProperty('--cal-bg', b);
            } catch (e) { console.warn('applySavedPalette colors failed', e); }
        })();

        document.addEventListener('DOMContentLoaded', () => {
            const radios = document.querySelectorAll('input[name="calendar-dark-mode"]');
            const saveBtn = document.getElementById('save-theme-btn');
            const clearBtn = document.getElementById('clear-theme-btn');
            const savedMarker = document.getElementById('theme-saved');

            if (radios.length > 0) {
                radios.forEach(r => { r.checked = (r.value === initialPreference); });
                function showSavedMessage(){ if(savedMarker){ savedMarker.style.display = 'inline'; setTimeout(() => savedMarker.style.display = 'none', 1500); } }
                saveBtn?.addEventListener('click', () => {
                    const sel = Array.from(radios).find(r => r.checked);
                    const mode = sel ? sel.value : 'system';
                    localStorage.setItem(THEME_KEY, mode);
                    applyThemeClass(mode);
                    showSavedMessage();
                });
                clearBtn?.addEventListener('click', () => {
                    localStorage.removeItem(THEME_KEY);
                    radios.forEach(r => r.checked = (r.value === 'system'));
                    applyThemeClass('system');
                    showSavedMessage();
                });
                window.addEventListener('storage', (e) => {
                    if (!e || e.key !== 'calendar_palette') return;
                    document.documentElement.classList.forEach(c => { if (c.startsWith('palette-')) document.documentElement.classList.remove(c); });
                    const pal = e.newValue || 'default';
                    if (pal && pal !== 'default') document.documentElement.classList.add('palette-' + pal);
                });
            }

            // Dropdown toggle logic
            try {
                document.querySelectorAll('.dropdown').forEach(dd => {
                    const btn = dd.querySelector('.dropbtn');
                    if (!btn) return;
                    btn.addEventListener('click', function(ev){ 
                        ev.preventDefault(); ev.stopPropagation();
                        const isOpen = dd.classList.toggle('open');
                        document.querySelectorAll('.dropdown.open').forEach(o => { if (o !== dd) o.classList.remove('open'); });
                        btn.setAttribute('aria-expanded', isOpen);
                    });
                });
                document.addEventListener('click', (ev) => {
                    if (!ev.target.closest('.dropdown.open')) {
                         document.querySelectorAll('.dropdown.open').forEach(d => { d.classList.remove('open'); const b = d.querySelector('.dropbtn'); if(b) b.setAttribute('aria-expanded', 'false'); });
                    }
                });
            } catch (e) { console.warn('header click-toggle init error', e); }
        });
    </script>

</body>
</html>