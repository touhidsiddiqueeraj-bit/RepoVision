# RepoVision Security

## Encryption

API keys are stored using **WebCrypto AES-GCM** encryption:
- Per-device 256-bit key generated via `crypto.getRandomValues()`
- Key stored in IndexedDB (never exported or transmitted)
- Each value encrypted with unique 96-bit IV
- No plaintext storage of secrets

## Rate Limiting

### GitHub API
- **Token bucket algorithm**: 30 requests/minute
- Separate from AI API rate limiting
- Automatic refilling at 0.5 tokens/second
- Queued requests wait for token availability

### AI API
- Uses existing AIQueue with user-configured limits
- Failed requests queued for retry on connection restore

## Secret Detection

### Path-Based Detection
Blocked paths:
- Path traversal attempts (`..`, `/`, `~`)
- Common secret file patterns: `.env`, `credentials`, `*.key`

### Content Scanning
Patterns detected and redacted:
- `password=...`, `api_key=...`, `secret=...`
- GitHub tokens (`ghp_...`, `xoxb-...`)
- Google API keys (`AIza...`)
- OpenAI keys (`sk-...`)
- PEM private keys

## Threat Model

### Mitigated Threats
| Threat | Mitigation |
|--------|-------------|
| XSS | All markdown HTML sanitized via `sanitizeHTML()` |
| Path Traversal | `validatePath()` blocks `..`, `/`, `~` in file paths |
| Secret Exposure | Content scanning + redaction before display |
| Rate Limit Exhaustion | Token bucket limits GitHub API to 30/min |
| CSRF | Read-only GitHub API, no server-side state |

### Residual Risks
- Client-side only: User responsible for HTTPS transport
- Browser extension access: Keys in memory during session
- IndexedDB: Vulnerable to local access (browser sandbox)

## Security Headers

Content Security Policy (CSP):
- `script-src`: External scripts only with SRI integrity
- `connect-src`: Whitelisted APIs only (GitHub, npm, Google)
- `img-src`: Data URIs + HTTPS allowed
- `frame-src: none`: No iframe embedding

## Reporting Security Issues

For security vulnerabilities, please contact the maintainer via GitHub Issues (do not disclose publicly until fixed).