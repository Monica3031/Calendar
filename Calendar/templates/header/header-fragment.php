<?php
// ensure $base is defined so relative template image paths work from any include depth
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
    <link rel="stylesheet" href='calendar.css'>
    <!-- PWA manifest: prefer the app-local manifest when present, otherwise fall back to site-root /manifest.json -->
    <?php
    // Prefer a root-level manifest when present (many hosts expect /manifest.json)
    $rootManifest = realpath(__DIR__ . '/../../manifest.json');
    if ($rootManifest && file_exists($rootManifest)) {
        echo '<link rel="manifest" href="/manifest.json">';
    } else {
        // Prefer manifest next to the Calendar folder when it exists on disk
        $localManifest = realpath(__DIR__ . '/../manifest.json');
        if ($localManifest && file_exists($localManifest)) {
            // When a local manifest is present in the Calendar folder, ensure the href points
            // to the Calendar path so browsers fetch the correct file (use $base when available,
            // otherwise default to '/Calendar').
            $manifestHref = ($base !== '' ? $base : '/Calendar') . '/manifest.json';
            echo '<link rel="manifest" href="' . $manifestHref . '">';
        } else {
            // No manifest found on disk; still emit site-root href as a reasonable default
            echo '<link rel="manifest" href="/manifest.json">';
        }
    }
    ?>

    <!-- Ensure common manifest locations are attempted by browsers even if server-side checks miss them -->
    <link rel="manifest" href="/manifest.json">

    <?php
    // As a last-resort fallback, if a local Calendar/manifest.json exists in the repo,
    // embed it into the page as a blob URL. This avoids depending on the hosting path
    // for the static file (useful when deployments strip or relocate the Calendar folder).
    $localManifestPath = realpath(__DIR__ . '/../manifest.json');
    if ($localManifestPath && file_exists($localManifestPath)) {
        $manifestBody = file_get_contents($localManifestPath);
        // JSON-encode to safely embed inside a JS string
        $jsonForJs = json_encode($manifestBody);
        echo "\n<script>\ntry {\n  const mStr = $jsonForJs;\n  const blob = new Blob([mStr], { type: 'application/json' });\n  const blobUrl = URL.createObjectURL(blob);\n  if (!document.querySelector('link[rel=\"manifest\"]')) {\n    const l = document.createElement('link'); l.rel = 'manifest'; l.href = blobUrl; document.head.appendChild(l);\n    console.debug('Injected manifest from embedded blob');\n  } else {\n    // still append an additional link so any browser that chooses the first wins\n    const l2 = document.createElement('link'); l2.rel = 'manifest'; l2.href = blobUrl; document.head.appendChild(l2);\n    console.debug('Appended blob manifest fallback');\n  }\n} catch (e) { console.warn('embedded manifest fallback failed', e); }\n</script>\n";
    }
    ?>

        <script>
            // Runtime manifest probe: try a few sane locations and inject a <link rel="manifest"> when found.
            (async function(){
                // candidates is declared here so it's available for diagnostics after the try/catch
                let candidates = [];
                try {
                    const base = <?php echo json_encode($base); ?> || '';
                    // Start with server-known candidates (may be absolute or base-aware)
                    candidates = [
                        '/manifest.php', // Prefer PHP fallback endpoint first when available
                        base ? (base + '/manifest.json') : '/manifest.json',
                        '/manifest.json',
                        (base ? base + '/manifest.json' : '/manifest.json'),
                    ];

                    // Add runtime-derived candidates to handle deployments where Calendar isn't mounted at /Calendar
                    try {
                        const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
                        const pathBase = base ? (origin + base) : origin;
                        // candidate: origin + base + /manifest.json and origin + base + /manifest.php
                        candidates.push(pathBase + '/manifest.json');
                        candidates.push(pathBase + '/manifest.php');
                        // candidate: current page relative manifest (e.g., './manifest.json')
                        try { candidates.push(new URL('manifest.json', window.location.href).href); } catch(e) { /* ignore */ }
                        // also try origin + /Calendar variants explicitly
                        candidates.push(origin + '/Calendar/manifest.json');
                        candidates.push(origin + '/Calendar/manifest.php');
                    } catch (e) { /* ignore runtime candidate errors */ }

                    // Deduplicate while preserving order
                    candidates = Array.from(new Set(candidates));
                    for (const url of candidates) {
                        try {
                            // Use a single GET probe to avoid HEAD-related server/CORS issues.
                            // Manifests are small; GET is usually fine and simpler.
                            let res = null;
                            try {
                                res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                            } catch (fetchErr) {
                                res = null;
                            }

                            if (!res || !res.ok) continue;
                            const ct = res.headers.get('content-type') || '';
                            if (!/json/.test(ct)) continue;
                            // If a manifest link already exists pointing to this URL, respect it
                            if (!document.querySelector('link[rel="manifest"][href="' + url + '"]')) {
                                const l = document.createElement('link'); l.rel = 'manifest'; l.href = url;
                                document.head.appendChild(l);
                                console.debug('Injected manifest link for', url);
                            }
                            break;
                        } catch (e) { /* try next candidate */ }
                    }
                } catch (err) { console.warn('manifest probe failed', err); }
                // If none of the candidates worked, emit a small diagnostic to the console.
                console.debug('manifest probe: tried candidates', candidates);
            })();
        </script>

    <!-- Inline fallback for the calendar background variable so pages show the expected gradient -->
    <style>
      :root { --cal-bg: linear-gradient(#336b73, #12b7c3, #ffffff); }
    </style>

    <script>
        // Early theme initializer - runs as soon as header fragment is parsed
        (function initTheme(){
            try {
                const m = localStorage.getItem('calendar_dark_mode') || 'system';
                if (m === 'dark') document.documentElement.classList.add('dark-mode');
                else if (m === 'light') document.documentElement.classList.remove('dark-mode');
                // Apply saved palette colors early
                const a = localStorage.getItem('calendar_palette_accent');
                const b = localStorage.getItem('calendar_palette_bg');
                if (a) document.documentElement.style.setProperty('--cal-accent', a);
                if (b) document.documentElement.style.setProperty('--cal-bg', b);
                const pal = localStorage.getItem('calendar_palette') || 'default';
                if (pal && pal !== 'default') document.documentElement.classList.add('palette-' + pal);
            } catch (e) { console.warn('initTheme failed', e); }
        })();

        const THEME_KEY = 'calendar_dark_mode'; // Global constant

        function applyThemeClass(mode) {
            const html = document.documentElement;
            if (window.matchMedia) {
                const mq = window.matchMedia('(prefers-color-scheme: dark)');
                if (mq._listener) mq.removeEventListener('change', mq._listener);
            }
            if (mode === 'dark') html.classList.add('dark-mode');
            else if (mode === 'light') html.classList.remove('dark-mode');
            else if (mode === 'system') {
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

        window.addEventListener('storage', (e) => {
            if (!e) return;
            // Palette changes
            if (e.key === 'calendar_palette') {
                document.documentElement.classList.forEach(c => { if (c.startsWith('palette-')) document.documentElement.classList.remove(c); });
                const pal = e.newValue || 'default';
                if (pal && pal !== 'default') document.documentElement.classList.add('palette-' + pal);
            }
            // Dark-mode preference changed in another tab
            if (e.key === 'calendar_dark_mode') {
                try {
                    // e.newValue may be null when removed; fallback to 'system'
                    const mode = e.newValue || 'system';
                    if (typeof applyThemeClass === 'function') applyThemeClass(mode);
                } catch (err) { console.warn('applyThemeClass on storage failed', err); }
            }
        });
        window.addEventListener('calendarPrefChanged', (ev) => {
            try {
                if (!ev || !ev.detail) return;
                if (ev.detail.key === 'palette') {
                    document.documentElement.classList.forEach(c => { if (c.startsWith('palette-')) document.documentElement.classList.remove(c); });
                    const pal = ev.detail.value || 'default';
                    if (pal && pal !== 'default') document.documentElement.classList.add('palette-' + pal);
                }
                if (ev.detail.key === 'darkMode') {
                    try { applyThemeClass(ev.detail.value || 'system'); } catch (err) { console.warn('calendarPrefChanged darkMode apply failed', err); }
                }
                if (ev.detail.key === 'paletteColors') {
                    const d = ev.detail.value || {};
                    if (d.accent) document.documentElement.style.setProperty('--cal-accent', d.accent);
                    if (d.bg) document.documentElement.style.setProperty('--cal-bg', d.bg);
                }
            } catch (err) { console.error('palette apply error', err); }
        });
    </script>

        <script>
            // Theme toggle for quick testing
            document.addEventListener('DOMContentLoaded', () => {
                const btn = document.getElementById('theme-toggle-btn');
                if (!btn) return;
                btn.addEventListener('click', () => {
                    const cur = localStorage.getItem('calendar_dark_mode') || 'system';
                    const next = cur === 'dark' ? 'light' : 'dark';
                    localStorage.setItem('calendar_dark_mode', next);
                    window.dispatchEvent(new CustomEvent('calendarPrefChanged', { detail: { key: 'darkMode', value: next } }));
                    if (next === 'dark') document.documentElement.classList.add('dark-mode'); else document.documentElement.classList.remove('dark-mode');
                });
            });
        </script>

        <script src="notifications.js" defer></script>

        <header>
            <div class="navbar"> 
                        <div class="menu">
                        <a class="icon-link icon-only-link" href="index.php" title="Login/Register" aria-label="Login/Register"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/sign_2939220.png" alt="Login/Register"></a>
                        <a class="icon-link icon-only-link" href="logout.php" title="Logout" aria-label="Logout"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/logout_3962656.png" alt="Logout"></a>
                        <a class="icon-link icon-only-link" href="month.php" title="Month View" aria-label="Month View"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/calendar-week_17654738.png" alt="Month View"></a>
                        <a class="icon-link icon-only-link" href="week.php" title="Week View" aria-label="Week View"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/schedule_9175971.png" alt="Week View"></a>
                        <a class="icon-link icon-only-link" href="day.php" title="Day View" aria-label="Day View"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/calendar_12719332.png" alt="Day View"></a>
                        <a class="icon-link icon-only-link" href="todo.php" title="To-Do List" aria-label="To-Do List"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/paper_15158880.png" alt="To-Do List"></a>
                        <a class="icon-link icon-only-link" href="add_new_event.php" title="Add Event" aria-label="Add Event"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/plus-icon_7693267.png" alt="Add"></a>
                        <button id="theme-toggle-btn" title="Toggle dark mode" class="icon-only" aria-label="Toggle dark mode"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/day-night_14366515.png" alt="Theme"></button>
                        <a class="icon-link icon-only-link" href="settings.php" title="Settings" aria-label="Settings"><img class="nav-icon" src="<?php echo $assetPrefix; ?>/setting_5736401.png" alt="Settings"></a>
                        </div>
                        </div>

    <!-- Icon sizing and link helpers moved to calendar.css; header fragment kept markup and scripts only -->

        
        </header>

        <script>
        // Runtime icon fallback: if a nav icon 404s, try alternate likely locations and swap src
        (function navIconFallback(){
            try {
                const imgs = Array.from(document.querySelectorAll('.nav-icon'));
                if (!imgs.length) return;
                const headCheck = async (url) => {
                    try {
                        const res = await fetch(url, { method: 'HEAD', credentials: 'same-origin' });
                        return res && res.ok;
                    } catch (e) { return false; }
                };

                imgs.forEach(async (img) => {
                    const orig = img.getAttribute('src') || '';
                    if (!orig || /^https?:\/\//i.test(orig)) return; // skip absolute URLs
                    const candidates = [];
                    // If original starts with /Calendar/, try without it
                    if (/^\/Calendar\//.test(orig)) candidates.push(orig.replace(/^\/Calendar/, ''));
                    // Try replacing '/Calendar/templates/images' with '/templates/images'
                    candidates.push(orig.replace('/Calendar/templates/images', '/templates/images'));
                    // Try removing duplicate segments
                    candidates.push(orig.replace('/templates/images/templates/images', '/templates/images'));
                    // Try adding /Calendar prefix if missing
                    if (!/^\/Calendar\//.test(orig)) candidates.push('/Calendar' + (orig.startsWith('/') ? '' : '/') + orig);

                    // Try original first, then fallbacks
                    const tried = [orig, ...candidates];
                    for (const url of tried) {
                        if (!url) continue;
                        if (await headCheck(url)) {
                            if (url !== orig) img.src = url;
                            break;
                        }
                    }
                });
            } catch (err) { console.warn('navIconFallback failed', err); }
        })();
        </script>

                <script>
                    // Make dropdowns open on click/tap as well as hover
                    document.addEventListener('DOMContentLoaded', () => {
                        try {
                            document.querySelectorAll('.dropdown').forEach(dd => {
                                const btn = dd.querySelector('.dropbtn');
                                if (!btn) return;
                                btn.addEventListener('click', (ev) => {
                                    ev.preventDefault(); ev.stopPropagation();
                                    console.log('fragment dropdown click handler fired', {button: btn, dropdown: dd});
                                    // toggle open class
                                    const isOpen = dd.classList.toggle('open');
                                    // close others
                                    document.querySelectorAll('.dropdown.open').forEach(other => { if (other !== dd) other.classList.remove('open'); });
                                });
                            });
                            // Close dropdown when clicking outside
                            document.addEventListener('click', () => document.querySelectorAll('.dropdown.open').forEach(d=>d.classList.remove('open')));
                        } catch (e) { console.warn('dropdown toggle init failed', e); }
                    });
                </script>

                                <script>
                                // Pointerdown capturing fallback (fragment): ensures dropdown toggles even when other scripts
                                // interfere with normal click handlers.
                                (function(){
                                    try {
                                        document.addEventListener('pointerdown', function(ev){
                                            const btn = ev.target.closest && ev.target.closest('.dropbtn');
                                            if (!btn) return;
                                            console.log('pointerdown fallback (fragment): Menu pressed', {target: btn});
                                            ev.preventDefault(); ev.stopPropagation();
                                            const dd = btn.parentElement;
                                            if (!dd) return;
                                            const isOpen = dd.classList.toggle('open');
                                            btn.setAttribute('aria-expanded', isOpen);
                                            document.querySelectorAll('.dropdown.open').forEach(o => { if (o !== dd) o.classList.remove('open'); });
                                        }, { capture: true, passive: false });
                                    } catch (err) { console.warn('pointerdown fallback fragment init failed', err); }
                                })();
                                </script>

        <main>
                <style>
                    /* Minimal last-resort safety: keep top header transparent and constrain calendar card width.
                       Most visual rules are defined in calendar.css. */
                    header, header .navbar, nav.navbar { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
                    .calendar { margin-left: auto !important; margin-right: auto !important; max-width: 1200px !important; box-sizing: border-box !important; }
                    .calendar-header { margin-left: auto !important; margin-right: auto !important; max-width: 1200px !important; box-sizing: border-box !important; }
                    body > .container { background: transparent !important; }
                </style>
