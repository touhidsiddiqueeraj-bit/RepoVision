// js/api.js — ADDITIONAL API utilities (not overriding existing functions)
// NOTE: fetchTree, fetchFileContent, githubHeaders, assertOnline, idbGet, idbPut, isCacheValid
// are already defined in the inline script. These are ADDITIONAL utilities only.

// ══════════════════════════════════════════════
//  CACHE DB (for failed request queue)
// ══════════════════════════════════════════════
let _cacheDB = null;
async function getCacheDB() {
    if (_cacheDB) return _cacheDB;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('repoCache', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { _cacheDB = request.result; resolve(_cacheDB); };
        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('failedRequests')) {
                db.createObjectStore('failedRequests', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// ══════════════════════════════════════════════
//  SEMAPHORE-WRAPPED FILE FETCHES
// ══════════════════════════════════════════════
async function fetchFileWithSemaphore(path) {
    // Use existing fetchFileContent but wrap with semaphore for parallel limiting
    return FetchSemaphore.fetch(() => fetchFileContent(path));
}

async function fetchMultipleFiles(paths, maxConcurrent = 6) {
    const results = [];
    for (let i = 0; i < paths.length; i += maxConcurrent) {
        const batch = paths.slice(i, i + maxConcurrent);
        const batchResults = await Promise.allSettled(batch.map(p => fetchFileWithSemaphore(p)));
        results.push(...batchResults);
    }
    return results;
}

// ══════════════════════════════════════════════
//  FAILED REQUEST QUEUE (for offline retry)
// ══════════════════════════════════════════════
async function queueFailedRequest(request) {
    // Use existing idbGet/idbPut from inline script
    const db = await getCacheDB();
    const tx = db.transaction('failedRequests', 'readwrite');
    tx.objectStore('failedRequests').add({
        ...request,
        timestamp: Date.now(),
        retries: 0
    });
}

async function processFailedRequestQueue() {
    const db = await getCacheDB();
    const tx = db.transaction('failedRequests', 'readwrite');
    const store = tx.objectStore('failedRequests');
    const requests = await new Promise(resolve => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });
    for (const req of requests) {
        if (req.retries >= 3) {
            store.delete(req.id);
            continue;
        }
        try {
            if (req.type === 'ai') {
                await callAI(req.prompt);
            } else if (req.type === 'fetch') {
                await fetchFileContent(req.path);
            }
            store.delete(req.id);
            showToast('Retried request completed', 'success');
        } catch (e) {
            req.retries++;
            store.put(req);
        }
    }
}

// ══════════════════════════════════════════════
//  REFRESH TREE (uses existing fetchTree from inline script)
// ══════════════════════════════════════════════
async function refreshTree() {
    if (!STATE.owner || !STATE.repo) return;
    showToast('🔄 Refreshing tree…', 'info');
    try {
        await fetchTree(STATE.owner, STATE.repo, STATE.branch);
        showToast('Tree refreshed', 'success');
    } catch (e) {
        showToast('Failed to refresh: ' + sanitizeError(e), 'error');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchFileWithSemaphore, fetchMultipleFiles, queueFailedRequest, processFailedRequestQueue, refreshTree };
}