# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2026-06-13

### Changed
- **Project renamed to Purview Playground** (formerly Purview DLP Logic Visualizer)
- Simulator conditions now use explicit True/False toggles instead of checkboxes, so negated conditions ("NOT attachment is password protected") are an active choice rather than something left unchecked
- Page headers and policy/rule rows wrap on narrow screens — no more horizontal scrolling on mobile

### Added
- **Rule Trigger Helper** in the simulator: one click computes and applies a combination of inputs that makes a chosen rule match, including conditions that must be False
- **AI Regex Builder** on the Settings page: describe what you want to match, get a .NET-compatible regex for Purview conditions, refine it through chat, and test it live against sample strings
- Microsoft non-affiliation disclaimer in the README

## [1.1.0] - 2026-06-12

### Added
- Progressive Web App support: manifest, icons, and offline-capable service worker
- Share links compressed with gzip (`CompressionStream`), producing much shorter URLs; legacy links still work

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
