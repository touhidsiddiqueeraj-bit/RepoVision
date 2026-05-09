// js/security.js — Security utilities, sanitization, path validation
// NOTE: SecureStore is already defined in inline script - these are ADDITIONAL utilities

// ══════════════════════════════════════════════
//  ERROR SANITIZATION
// ══════════════════════════════════════════════
function sanitizeError(err) {
    if (!err) return 'Unknown error';
    const msg = String(err.message || err || 'Unknown error');
    return msg
        .replace(/\/[\w\-\.]+(\/[\w\-\.]+)*/g, '[path]')
        .replace(/ghp_\w+/g, '[token]')
        .replace(/AIza[\w\-]+/g, '[api-key]')
        .replace(/sk-[\w\-]+/g, '[api-key]')
        .replace(/xox[baprs]-[0-9a-zA-Z\-]+/g, '[github-token]')
        .slice(0, 200);
}

// ══════════════════════════════════════════════
//  PATH TRAVERSAL GUARD
// ══════════════════════════════════════════════
function validatePath(path) {
    if (!path) return false;
    if (path.includes('..') || path.startsWith('/') || path.includes('~')) {
        console.warn('[Security] Path traversal attempt blocked:', path);
        return false;
    }
    return true;
}

// ══════════════════════════════════════════════
//  SECRET DETECTION
// ══════════════════════════════════════════════
const SECRET_PATTERNS = [
    /password\s*[:=]\s*['"][^'"]{4,}/i,
    /api[_-]?key\s*[:=]\s*['"][^'"]{10,}/i,
    /secret\s*[:=]\s*['"][^'"]{10,}/i,
    /token\s*[:=]\s*['"][^'"]{10,}/i,
    /private[_-]?key\s*[:=]\s*['"]/i,
    /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
];

function containsSecret(content) {
    if (!content) return false;
    return SECRET_PATTERNS.some(re => re.test(content));
}

function redactSecrets(text) {
    if (!text) return '';
    return text
        .replace(/ghp_\w{20,}/g, '[github-token]')
        .replace(/AIza[\w\-]{20,}/g, '[gemini-key]')
        .replace(/sk-[\w\-]{20,}/g, '[openai-key]')
        .replace(/xox[baprs]-[0-9a-zA-Z\-]{20,}/g, '[github-token]')
        .replace(/password\s*[:=]\s*['"][^'"]{4,}['"]/gi, 'password=[REDACTED]')
        .replace(/api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/gi, 'api_key=[REDACTED]');
}

// ══════════════════════════════════════════════
//  GITHUB API RATE LIMITER (30 req/min, token bucket)
// ══════════════════════════════════════════════
const GitHubRateLimiter = (() => {
    const MAX_TOKENS = 30;
    const REFILL_RATE = 0.5;
    let tokens = MAX_TOKENS;
    let lastRefill = Date.now();

    function refill() {
        const now = Date.now();
        const elapsed = (now - lastRefill) / 1000;
        const added = elapsed * REFILL_RATE;
        tokens = Math.min(MAX_TOKENS, tokens + added);
        lastRefill = now;
    }

    return {
        acquire() {
            refill();
            if (tokens >= 1) {
                tokens -= 1;
                return Promise.resolve(true);
            }
            return new Promise(resolve => {
                const waitTime = ((1 - tokens) / REFILL_RATE) * 1000;
                setTimeout(() => {
                    refill();
                    tokens -= 1;
                    resolve(true);
                }, Math.max(waitTime, 0));
            });
        },
        tokensRemaining() {
            refill();
            return Math.floor(tokens);
        },
        reset() {
            tokens = MAX_TOKENS;
            lastRefill = Date.now();
        }
    };
})();

// ══════════════════════════════════════════════
//  PARALLEL FETCH SEMAPHORE (max 6 concurrent)
// ══════════════════════════════════════════════
const FetchSemaphore = (() => {
    const MAX_CONCURRENT = 6;
    let running = 0;
    const queue = [];

    function acquire() {
        return new Promise(resolve => {
            if (running < MAX_CONCURRENT) {
                running++;
                resolve();
            } else {
                queue.push(resolve);
            }
        });
    }

    function release() {
        if (queue.length > 0) {
            const next = queue.shift();
            next();
        } else {
            running--;
        }
    }

    return {
        fetch(fn) {
            return new Promise(async (resolve, reject) => {
                await acquire();
                try {
                    resolve(await fn());
                } catch (e) {
                    reject(e);
                } finally {
                    release();
                }
            });
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sanitizeError, validatePath, containsSecret, redactSecrets, GitHubRateLimiter, FetchSemaphore };
}