// js/state.js — NEW state management functions (getters/setters, filtering)
// NOTE: STATE is already defined in the inline script - this only adds new properties and functions

// ══════════════════════════════════════════════
//  STATE EXTENSION - Add new properties to existing STATE
// ══════════════════════════════════════════════
if (typeof STATE !== 'undefined') {
    STATE._activeTab = STATE._activeTab || 'explanation';
    STATE._compareRepo = null;
    STATE._fileFilter = STATE._fileFilter || 'all';
    STATE._lastError = null;
}

// ══════════════════════════════════════════════
//  STATE GETTERS/SETTERS
// ══════════════════════════════════════════════
function getState() {
    return { ...STATE };
}

function setState(updates, source = 'unknown') {
    Object.assign(STATE, updates);
    if (typeof console !== 'undefined' && location && location.hostname === 'localhost') {
        console.log('[State] Changed:', Object.keys(updates).join(', '), 'from:', source);
    }
}

function getStateField(key) {
    return STATE[key];
}

function setStateField(key, value, source = 'unknown') {
    setState({ [key]: value }, source);
}

// ══════════════════════════════════════════════
//  REPO MANAGEMENT
// ══════════════════════════════════════════════
function setRepoInfo(owner, repo, branch) {
    setState({ owner, repo, branch }, 'setRepoInfo');
}

function clearRepo() {
    setState({
        owner: '', repo: '', branch: 'main',
        files: [], tree: null, activeFile: null,
        fileCache: {}, archOverview: null,
        chatHistories: {}, multiChatSelection: [],
        zombieData: null, tangleRating: 0,
        semanticIndex: null, repoType: 'unknown', repoStats: {}
    }, 'clearRepo');
}

function setCompareRepo(owner, repo, branch) {
    STATE._compareRepo = { owner, repo, branch };
}

function clearCompareRepo() {
    STATE._compareRepo = null;
}

// ══════════════════════════════════════════════
//  TAB & FILTER MANAGEMENT
// ══════════════════════════════════════════════
function setActiveTab(tab) {
    STATE._activeTab = tab;
}

function setFileFilter(filter) {
    STATE._fileFilter = filter;
}

function getFilteredFiles() {
    const filter = STATE._fileFilter;
    if (filter === 'all') return STATE.files;
    const codeExts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cs', '.cpp', '.c', '.h', '.php', '.swift', '.kt']);
    const configExts = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.xml']);
    const mdExts = new Set(['.md', '.markdown', '.mdown', '.mkd']);
    return STATE.files.filter(f => {
        const ext = '.' + (f.path.split('.').pop() || '').toLowerCase();
        if (filter === 'code') return codeExts.has(ext);
        if (filter === 'config') return configExts.has(ext);
        if (filter === 'markdown') return mdExts.has(ext);
        return true;
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getState, setState, subscribeState, getStateField, setStateField, setRepoInfo, clearRepo, setCompareRepo, clearCompareRepo, setActiveTab, setFileFilter, getFilteredFiles };
}