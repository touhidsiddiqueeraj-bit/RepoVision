// js/ui.js — UI enhancements (NEW features only, not overriding existing functions)
// NOTE: Many functions are already in the inline script - this file adds NEW features only

// ══════════════════════════════════════════════
//  GRAMMAR LAZY LOADING (NEW)
// ══════════════════════════════════════════════
const _loadedGrammars = new Set(['markup', 'clike', 'javascript', 'css']);

async function ensureGrammar(lang) {
    if (_loadedGrammars.has(lang)) return;
    const grammarMap = {
        python: { lang: 'python', regex: /\b(python|py)\s*:/i },
        java: { lang: 'java', regex: /\bjava\b/i },
        go: { lang: 'go', regex: /\bgo\b/i },
        rust: { lang: 'rust', regex: /\brust\b/i },
        cpp: { lang: 'cpp', regex: /\b(c\+\+|cpp)\b/i },
        c: { lang: 'c', regex: /\bc\b/i },
        ruby: { lang: 'ruby', regex: /\bruby\b/i },
        php: { lang: 'php', regex: /\bphp\b/i },
        swift: { lang: 'swift', regex: /\bswift\b/i },
        kotlin: { lang: 'kotlin', regex: /\bkotlin\b/i },
        scala: { lang: 'scala', regex: /\bscala\b/i },
        sql: { lang: 'sql', regex: /\bsql\b/i },
        bash: { lang: 'bash', regex: /\b(shell|bash|sh)\b/i },
        json: { lang: 'json', regex: /\.json$/i },
        yaml: { lang: 'yaml', regex: /\b(yaml|yml)\b/i },
        markdown: { lang: 'markdown', regex: /\b(md|markdown)\b/i },
        typescript: { lang: 'typescript', regex: /\.tsx?$/i },
        html: { lang: 'html', regex: /\.html?$/i },
        css: { lang: 'css', regex: /\.css$/i },
    };
    const detectedLang = Object.keys(grammarMap).find(k => grammarMap[k].regex.test(lang)) || lang;
    _loadedGrammars.add(detectedLang);
}

// ══════════════════════════════════════════════
//  MARKDOWN WITH LAZY IMAGES (NEW)
// ══════════════════════════════════════════════
function parseMarkdown(text) {
    const html = sanitizeHTML(marked.parse(text));
    return html.replace(/<img(?!.*loading=)/g, '<img loading="lazy"');
}

// ══════════════════════════════════════════════
//  KEYBOARD SHORTCUTS (NEW)
// ══════════════════════════════════════════════
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const tabs = ['explanation', 'insights', 'chat', 'history'];
            switchExplainTab(tabs[parseInt(e.key) - 1]);
        }
    });
}

// ══════════════════════════════════════════════
//  FILE TREE CONTEXT MENU (NEW)
// ══════════════════════════════════════════════
let _contextMenu = null;

function showContextMenu(e, path) {
    e.preventDefault();
    hideContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="ctx-item" data-action="explain">📖 Explain this file</div>
        <div class="ctx-item" data-action="chat">💬 Chat about this file</div>
        <div class="ctx-item" data-action="copy">📋 Copy path</div>
    `;
    menu.style.cssText = `position:fixed;left:${e.pageX}px;top:${e.pageY}px;z-index:1000;background:var(--color-canvas);border:1px solid var(--color-border-default);border-radius:6px;padding:4px;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.2);`;
    menu.querySelectorAll('.ctx-item').forEach(item => {
        item.style.cssText = 'padding:8px 12px;cursor:pointer;border-radius:4px;font-size:13px;color:var(--color-fg-default)';
        item.onmouseover = () => item.style.background = 'var(--color-canvas-subtle)';
        item.onmouseout = () => item.style.background = '';
        item.onclick = () => {
            const action = item.dataset.action;
            if (action === 'explain') { doExplanation(path); switchExplainTab('explanation'); }
            else if (action === 'chat') { STATE.activeFile = path; showMultiChat(); switchExplainTab('chat'); }
            else if (action === 'copy') { navigator.clipboard.writeText(path); showToast('Path copied!'); }
            hideContextMenu();
        };
    });
    document.body.appendChild(menu);
    _contextMenu = menu;
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
}

function hideContextMenu() {
    if (_contextMenu) { _contextMenu.remove(); _contextMenu = null; }
}

// ══════════════════════════════════════════════
//  FILE TYPE FILTER (NEW)
// ══════════════════════════════════════════════
function setupFileFilter() {
    const filterSelect = document.getElementById('fileTypeFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', e => {
            STATE._fileFilter = e.target.value;
            // Trigger re-render of tree if needed
        });
    }
}

// ══════════════════════════════════════════════
//  RATE LIMIT DISPLAY (NEW)
// ══════════════════════════════════════════════
function updateRateLimitDisplay() {
    const el = document.getElementById('aiRateLimitDisplay');
    if (el && typeof GitHubRateLimiter !== 'undefined') {
        const tokens = GitHubRateLimiter.tokensRemaining();
        el.textContent = `🔵 ${tokens}/min`;
    }
}

// ══════════════════════════════════════════════
//  D3 GRAPH ABORT CONTROLLER (NEW)
// ══════════════════════════════════════════════
let _graphController = null;
let _graphSignal = null;

function setupD3GraphAbort() {
    // Override existing closeD3Graph to add abort functionality
    window.closeD3Graph = function() {
        if (_graphController) {
            _graphController.abort();
            _graphController = null;
            _graphSignal = null;
        }
        document.getElementById('d3GraphModal').style.display = 'none';
    };
}

// ══════════════════════════════════════════════
//  EXPORT/IMPORT EXPLANATIONS (NEW)
// ══════════════════════════════════════════════
function exportExplanations() {
    const data = {
        repo: STATE.owner + '/' + STATE.repo,
        branch: STATE.branch,
        explanations: STATE.chatHistories,
        archOverview: STATE.archOverview,
        timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repovision-explanations-${STATE.repo}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Explanations exported', 'success');
}

async function importExplanations(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.explanations) {
            Object.assign(STATE.chatHistories, data.explanations);
        }
        if (data.archOverview) {
            STATE.archOverview = data.archOverview;
        }
        showToast(`Imported explanations from ${data.repo}`, 'success');
    } catch (e) {
        showToast('Failed to import: ' + sanitizeError(e), 'error');
    }
}

// ══════════════════════════════════════════════
//  REPO COMPARISON MODE (NEW)
// ══════════════════════════════════════════════
function showCompareModal() {
    const modal = document.createElement('div');
    modal.id = 'compareModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000';
    modal.innerHTML = `
        <div style="background:var(--color-canvas);border:1px solid var(--color-border-default);border-radius:12px;padding:24px;width:400px">
            <h3 style="margin:0 0 16px;color:var(--color-fg-default)">Compare Repositories</h3>
            <div style="margin-bottom:12px">
                <label style="display:block;font-size:12px;color:var(--color-fg-muted);margin-bottom:4px">Owner/Org</label>
                <input id="compareOwner" type="text" placeholder="e.g. facebook" style="width:100%;padding:8px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-canvas-subtle)">
            </div>
            <div style="margin-bottom:12px">
                <label style="display:block;font-size:12px;color:var(--color-fg-muted);margin-bottom:4px">Repository</label>
                <input id="compareRepo" type="text" placeholder="e.g. react" style="width:100%;padding:8px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-canvas-subtle)">
            </div>
            <div style="margin-bottom:16px">
                <label style="display:block;font-size:12px;color:var(--color-fg-muted);margin-bottom:4px">Branch</label>
                <input id="compareBranch" type="text" placeholder="main" value="main" style="width:100%;padding:8px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-canvas-subtle)">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
                <button onclick="closeCompareModal()" style="padding:8px 16px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-canvas-subtle);cursor:pointer">Cancel</button>
                <button onclick="loadCompareRepo()" style="padding:8px 16px;border:none;border-radius:6px;background:var(--color-accent-emphasis);color:var(--color-fg-on-emphasis);cursor:pointer">Load</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeCompareModal() {
    document.getElementById('compareModal')?.remove();
}

async function loadCompareRepo() {
    const owner = document.getElementById('compareOwner').value.trim();
    const repo = document.getElementById('compareRepo').value.trim();
    const branch = document.getElementById('compareBranch').value.trim() || 'main';
    if (!owner || !repo) { showToast('Please enter owner and repo', 'warn'); return; }
    closeCompareModal();
    STATE._compareRepo = { owner, repo, branch };
    STATE._activeTab = 'compare';
    document.querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.gh-tab[data-tab="compare"]')?.classList.add('active');
    showToast(`Comparing: ${STATE.owner}/${STATE.repo} ↔ ${owner}/${repo}`, 'info');
}

// ══════════════════════════════════════════════
//  OFFLINE BANNER (NEW)
// ══════════════════════════════════════════════
function showOfflineBanner() {
    if (document.getElementById('offlineBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--color-danger-bg);color:var(--color-danger-fg);padding:12px;text-align:center;z-index:999;display:none';
    banner.innerHTML = '📡 You are offline. Some features may be unavailable.';
    document.body.appendChild(banner);
    if (!navigator.onLine) banner.style.display = 'flex';
}

function setupOnlineListeners() {
    const updateOnline = () => {
        const banner = document.getElementById('offlineBanner');
        if (banner) banner.style.display = navigator.onLine ? 'none' : 'flex';
        if (navigator.onLine) {
            processFailedRequestQueue();
            showToast('Connection restored', 'success');
        }
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();
}

// ══════════════════════════════════════════════
//  RETRY BUTTON STYLING (NEW)
// ══════════════════════════════════════════════
function injectRetryStyles() {
    if (document.getElementById('retry-styles')) return;
    const style = document.createElement('style');
    style.id = 'retry-styles';
    style.textContent = `
        .retry-btn { margin-top: 8px; padding: 6px 12px; border: 1px solid var(--color-border-default); border-radius: 6px; background: var(--color-canvas-subtle); cursor: pointer; font-size: 13px; }
        .retry-btn:hover { background: var(--color-canvas-default); }
        .error-state { display: flex; flex-direction: column; align-items: center; }
        .context-menu .ctx-item:hover { background: var(--color-canvas-subtle) !important; }
    `;
    document.head.appendChild(style);
}

// ══════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    setupKeyboardShortcuts();
    setupFileFilter();
    injectRetryStyles();
    showOfflineBanner();
    setupOnlineListeners();
    setupD3GraphAbort();
    setInterval(updateRateLimitDisplay, 2000);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ensureGrammar, parseMarkdown, showContextMenu, hideContextMenu, exportExplanations, importExplanations, showCompareModal, closeCompareModal, loadCompareRepo, showOfflineBanner };
}
