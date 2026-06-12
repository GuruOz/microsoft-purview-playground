# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-06-12

### Added
- PowerShell JSON export: convert visual rule tokens back to Purview `AdvancedRule` AST format for use with `New-DlpComplianceRule`
- Rule conflict detection: yellow warning badges on rules that are logically unreachable (`A AND NOT A`) or exact duplicates within a policy
- SharePoint/OneDrive and Teams workload categories in the condition pool
- Additional PowerShell property mappings for SharePoint (`SPContent*`, `SiteURL*`) and Teams (`TeamsMessage*`) conditions
- Three built-in example policies accessible via the "Load Example" button
- Content Security Policy meta tag on all pages; whitelists only Tailwind CDN and the four AI provider endpoints
- Unit test suite: 99 tests across evaluator, state, parser, and conflict-detector modules (Vitest + jsdom)
- CI pipeline: lint and tests run on every push and pull request to `main`
- ESLint v9 flat config with zero warnings across all JS files
- Prettier configuration for consistent formatting
- GitHub Pages automated deployment on push to `main`
- Input validation on imported JSON with actionable error messages
- Version number displayed in the application footer

### Fixed
- `NOT` operator precedence corrected to 3 (was 2), fixing evaluation of `A AND NOT B` with separate `AND` and `NOT` tokens
- XSS vulnerabilities: all user-controlled strings escaped via `escapeHtml()` before insertion into `innerHTML` across `ui.js`, `simulator-ui.js`, `summary-ui.js`, `app.js`, `evaluator.js`, and `settings-ui.js`
- AI provider API keys moved from `localStorage` to `sessionStorage` — no longer persisted to disk across browser sessions

### Security
- CSP blocks all external script sources except whitelisted CDNs
- `escapeHtml()` using `document.createTextNode` prevents HTML injection in rule names, condition values, and error messages
- API keys stored in session memory only; never included in exported JSON or share links
