# 🔮 RepoVision

**AI-powered GitHub codebase explorer and auditor.**

Live at: https://touhidsiddiqueeraj-bit.github.io/RepoVision/

RepoVision is a single-page application that maps any public GitHub repository,
explains files on-demand with AI, detects zombie code and TODO debt, renders
interactive dependency graphs, and generates full audit reports — all running
entirely in your browser with no server-side component.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features](#features)
3. [How It Works](#how-it-works)
   - [Caching Strategy](#caching-strategy)
   - [Privacy Model](#privacy-model)
   - [AI Model Selection](#ai-model-selection)
   - [Virtual Scrolling](#virtual-scrolling)
   - [Web Worker Scanning](#web-worker-scanning)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [File Structure](#file-structure)
6. [Running Locally](#running-locally)
7. [Running the Tests](#running-the-tests)
8. [Cross-Browser IndexedDB Behavior](#cross-browser-indexeddb-behavior)
9. [Security Notes](#security-notes)
10. [License](#license)

---

## Quick Start

1. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).
2. Paste a public GitHub repo URL, e.g. `https://github.com/facebook/react`.
3. Enter your [Gemini API key](https://aistudio.google.com/app/apikey) (free tier is sufficient).
4. Click **Explore Repository**.

No build step. No npm install. No server needed.

---

## Features

| Feature | Description |
|---|---|
| **File Tree** | Virtual-scrolling tree with directory expand/collapse. Handles repos with 1 000+ files without DOM bloat. |
| **AI Explanation** | Streams a contextual explanation of any file at Easy / Medium / Hard depth. |
| **Explanation History** | Stores the last 10 explanations in IndexedDB so you can revisit them without re-calling the AI. |
| **Copy Button** | One-click copy of any explanation to the clipboard. |
| **Syntax Highlighting** | Prism.js with grammars for JS/TS, Python, Rust, Go, Ruby, Java, C/C++, C#, Bash, SQL, YAML, JSON, and Markdown. |
| **Code Insights** | Automatic detection of TODO/FIXME/HACK/BUG/XXX comments with line references. |
| **AI Fix** | One-click AI rewrite of a flagged code block with a proper unified diff view (LCS-based). |
| **Dependency Graph** | Interactive D3 force-directed graph of relative imports across up to 80 source files. |
| **Architecture Overview** | AI-generated high-level report of the repo's structure, tech stack, and design patterns. |
| **TODO Dashboard** | Cross-repo TODO/FIXME scan using an inline Web Worker — main thread stays responsive. |
| **Zombie Detector** | Finds declared-but-never-used symbols across up to 200 files, also via Web Worker. |
| **Audit Export** | Full markdown audit report (architecture + TODOs + zombies) with one-click download. |
| **Share Link** | Generates a compressed, keyless URL that opens the same repo/file for a teammate. |
| **Semantic Search** | AI-ranked file search: type a natural language query and get the most relevant file paths. |
| **Offline Detection** | Clear "No internet connection" error before any network call; online/offline toast banners. |

---

## How It Works

### Caching Strategy

RepoVision uses a **two-tier cache** to minimise redundant API calls and keep
the UI fast on repeated visits.

```
Request
  │
  ├─▶ 1. In-memory (STATE.fileCache / STATE.archOverview)
  │       Hit → return immediately (zero I/O)
  │
  ├─▶ 2. IndexedDB (7-day TTL per entry)
  │       Hit → hydrate memory cache, return
  │
  └─▶ 3. Network (GitHub API / raw CDN / Gemini API)
          Response → write to IDB + memory, return
```

**What is cached:**

| Store | Key | TTL | Contents |
|---|---|---|---|
| `repoCache` | `owner/repo/branch` | 7 days | Full recursive file tree from GitHub API |
| `fileCache` | `owner/repo/path` | 7 days | Raw file content from raw.githubusercontent.com |
| `explanationCache` | `model:path:difficulty` | 7 days | AI-generated explanation markdown |
| `explanationHistory` | auto-increment | permanent (capped at 10) | Last 10 explanations for the History tab |
| `semanticIndex` | `owner/repo` | 7 days | AI-generated semantic file-path embeddings |

A localStorage fallback (`rv_tree_*` keys, 1-hour TTL) is used for the file
tree in browsers where IndexedDB is unavailable.

The "Cached" badge on explanations links to a **Refresh** action that deletes
the entry and re-streams from the AI.

---

### Privacy Model

RepoVision is a **fully client-side application**. There is no RepoVision
server. Your data flows as follows:

```
Your browser
  │
  ├──▶ GitHub API / raw CDN  (repo tree, file content)
  │       Auth: optional GitHub token you supply
  │
  └──▶ Google Gemini API  (AI explanations)
          Auth: Gemini API key you supply
```

**What RepoVision never does:**

- ✅ Never sends your API keys to any RepoVision server (there is none).
- ✅ Never proxies your requests through a third-party backend.
- ✅ Never logs your browsing history or the repos you explore.

**What you should know:**

- ⚠️ API keys are stored in **plaintext `localStorage`** in your browser
  profile. Anyone with access to your browser can read them via DevTools.
  Do not use RepoVision on a shared or public computer.
- ⚠️ File content and AI explanations are sent to **Google's Gemini API**.
  Review [Google's data usage policy](https://ai.google.dev/gemini-api/terms)
  before exploring private or sensitive repositories.
- ⚠️ For private repos you must supply a **GitHub Personal Access Token** with
  `repo` scope. The token is stored in localStorage alongside your API key.

---

### AI Model Selection

RepoVision currently targets the **Gemini** family via Google's public API.
Model selection is available in ⚙️ Settings:

| Model | Best for |
|---|---|
| `gemini-2.5-flash` | Default. Fast, accurate, generous free quota. |
| `gemini-2.5-flash-lite` | Faster, lower cost, smaller context window. |
| `gemini-2.5-pro` | Deepest analysis; use for Hard-difficulty explanations. |
| Custom | Enter any model string supported by the Gemini API. |

**Local LLM support:** If you run a local model via
[Ollama](https://ollama.com/) or any OpenAI-compatible server, enter the base
URL (e.g. `http://localhost:11434/v1`) and model name in the Optional Settings
panel on the landing page. Local mode bypasses all Gemini-specific logic.

**Rate limit handling:** Both `callAI` and `callAIStream` share a single
`handleRateLimit()` utility. On a 429 response it checks for quota-exhaustion
signals (returns a hard error with model-switch advice) vs. transient
rate-limits (exponential back-off: 8 s, 16 s, 24 s, then error).

---

### Virtual Scrolling

The file tree uses a custom `IntersectionObserver`-based virtual scroller
(`_vs` in `api.js`) rather than a full virtual-DOM library:

1. `buildTree(files)` converts the flat GitHub file list into a nested object.
2. `flattenTree(root, depth, openDirs)` produces a **flat ordered array** of
   row descriptors for all currently-visible rows (open dirs recursively
   included, closed dirs' children excluded).
3. `renderTree(root, container)` renders the first 80 rows immediately, then
   appends a 1 px sentinel `<div>`. When the sentinel scrolls into view the
   `IntersectionObserver` fires and renders the next batch of 80 rows.
4. Directory open/close rebuilds the flat list and re-renders from scratch —
   keeping the sentinel-observer cycle correct.

This means a 10 000-file repo renders ~80 DOM nodes initially instead of
10 000, with more loaded on demand as the user scrolls.

---

### Web Worker Scanning

TODO and Zombie scans iterate over up to 200 files with regex. To keep the
main thread responsive, both scans run inside an **inline Web Worker** created
from a `Blob` URL (no separate worker file required — RepoVision is a
single-directory project):

```
Main thread                       Worker thread
─────────────────                 ──────────────────
fetchFileContent()  ──batch──▶   (CORS: must be main)
Build fileContents map
postMessage({type, files,         regex scan loop
             fileContents})  ──▶  postMessage(results)
onResult(results)  ◀───────────
renderUI(results)
```

A synchronous `runScanInline()` fallback runs on the main thread if the
`Worker` or `Blob` API is blocked by a strict Content Security Policy.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `/` | Focus the file filter input |
| `Ctrl+K` / `⌘K` | Focus the file filter input |
| `Escape` | Close dependency graph modal / close settings menu |
| `Ctrl+Click` / `⌘+Click` on a file | Add to multi-file chat selection |
| `Enter` in AI search box | Run semantic file search |

---

## File Structure

```
repovision/
├── index.html          # Shell HTML — 296 lines of markup, no inline JS/CSS
├── styles.css          # All ~800 lines of CSS (GitHub-style design tokens)
├── js/
│   ├── state.js        # STATE object + localStorage persistence helpers
│   ├── db.js           # IndexedDB layer: openDB, idbGet/Put/Clear, history
│   ├── api.js          # GitHub API, AI API, file fetching, tree utilities,
│   │                   #   offline detection, virtual scroller, AIQueue
│   ├── ui.js           # All UI panels: explanation, code preview, insights,
│   │                   #   diff view, history, chat, dep graph, repo profile
│   └── app.js          # Scan worker, dashboards, export, share, nav, init
└── tests/
    └── repovision.test.js  # Unit tests (Node.js, zero dependencies)
```

Scripts load in dependency order via plain `<script src="…">` tags — no
bundler, no module graph. All functions are global, which keeps the runtime
simple and DevTools-friendly.

---

## Running Locally

Because RepoVision fetches from `raw.githubusercontent.com` (no CORS issues)
and the Gemini API (CORS-open), it works from `file://` in most browsers.
For the best experience serve it over HTTP:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# Then open:
# http://localhost:8080
```

---

## Running the Tests

The test suite covers `shouldSkipPath`, `buildTree`, `flattenTree`, and
`computeLineDiff` — all pure functions with no browser dependencies.

```bash
node tests/repovision.test.js
```

Expected output:

```
📋  shouldSkipPath
  ✅  allows normal source files
  ✅  skips top-level node_modules
  … (13 tests)

🌲  buildTree
  ✅  returns a root node with no path
  … (11 tests)

📂  flattenTree
  ✅  root-level dirs are open by default (depth 0)
  … (7 tests)

🔀  computeLineDiff
  ✅  identical strings produce only ctx entries
  … (6 tests)

──────────────────────────────────────────────────
  37 tests  ·  37 passed  ·  0 failed

🎉  All tests passed!
```

To run with Jest or Vitest, add this to `package.json`:

```json
{
  "scripts": {
    "test": "node tests/repovision.test.js"
  }
}
```

---

## Cross-Browser IndexedDB Behavior

RepoVision's `db.js` has been manually verified across the following browsers.
Known quirks are documented here for contributors.

### Chrome / Chromium (v112+)
- **Status:** ✅ Full support.
- IDB transactions complete reliably. `CompressionStream` (used for share
  URLs) is available.
- No known issues.

### Firefox (v115+)
- **Status:** ✅ Full support with one caveat.
- IDB works correctly. `CompressionStream` is available from Firefox 113.
- **Quirk:** Firefox enforces stricter storage quotas in Private Browsing mode.
  IDB writes silently fail; `idbPut` returns `false` and the app falls back to
  in-memory caching. The share URL falls back to plain base64 encoding.

### Safari (v16.4+)
- **Status:** ✅ Works with caveats.
- `CompressionStream` available from Safari 16.4.
- **Quirk:** Safari clears IDB storage for origins not visited in 7 days under
  Intelligent Tracking Prevention (ITP). This means the 7-day cache TTL may
  effectively be shorter. No code change needed — the app simply re-fetches.
- **Quirk:** `indexedDB.open()` can fail silently in Safari's Private Browsing
  mode. `openDB()` resolves to `null` and the app falls back gracefully to
  in-memory + localStorage.
- **Quirk:** Safari requires a user gesture before the Clipboard API
  (`navigator.clipboard.writeText`) succeeds. The Copy button and Share button
  both sit inside user-initiated `click` handlers, so this is not an issue in
  practice.

### Edge (Chromium, v112+)
- **Status:** ✅ Full support (identical to Chrome).

### Brave
- **Status:** ✅ Works. Brave's aggressive fingerprint-blocking does not affect
  IDB or the Clipboard API when the site is served over HTTPS or localhost.

### Opera, Vivaldi
- **Status:** ✅ Chromium-based; behaves identically to Chrome.

### Not tested / not supported
- Internet Explorer — no IDB v2, no `async/await`, no `fetch`. Not targeted.
- Firefox ESR < 115 — missing `CompressionStream`. Share URL falls back to
  plain base64; all other features work.

---

## Security Notes

- **No `eval`, no `innerHTML` from untrusted sources.** All AI-generated HTML
  is sanitised via `sanitizeHTML()` (DOMParser + `on*` attribute stripping +
  `javascript:` href removal) before insertion.
- **XSS surface:** The `escHtml()` function is used for all non-AI text
  interpolated into HTML strings. AI text goes through `sanitizeHTML(marked.parse(…))`.
- **CSP compatibility:** The inline Web Worker uses `Blob` + `URL.createObjectURL`.
  If your deployment enforces `worker-src 'self'` without `blob:`, the worker
  will fail and fall back to synchronous scanning on the main thread.
- **API key exposure:** Keys live in `localStorage`. See [Privacy Model](#privacy-model).

---

## License

MIT — see `LICENSE` for details.
