# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.9.0] - 2026-06-20

### Changed
- **Higher-contrast colour scheme for Policies vs Rules** (light and dark): Policies keep the indigo identity (now with a deeper border), while Rules switch from blue to **amber** so the two containers are immediately distinguishable instead of reading as the same colour. Applied consistently to the Rule Builder and the Rule Summary page (which previously rendered both as neutral grey), including matching "Policy" / "Rule" badges and the hierarchy caption. Blue is now reserved for conditions/logic tokens, sharpening the separation between a rule and the conditions inside it

## [1.8.0] - 2026-06-20

### Added
- **Simulator results export**: after running a simulation, two new buttons in the Evaluation Trace header let you **Copy** the result as a plain-text report or **Download** it as a timestamped `.txt` file. The report captures the channel, the conditions set to True, the user-override choice, every policy/rule outcome per phase (match / no-match / skipped / deferred / disabled, with actions and halt reasons), and the final bundled outcome — a snapshot of exactly what was evaluated, independent of later input changes

### Changed
- The clipboard helper is now shared across pages (`window.copyToClipboard` in `state.js`), powering both the Rule Summary copy buttons and the new Simulator export

## [1.7.0] - 2026-06-20

### Added
- **Copy rule logic / copy plain-English**: each rule on the Rule Summary page now has two one-click "Copy" buttons — one copies the raw boolean expression, the other copies the generated plain-English explanation — so a single rule can be dropped into a ticket, chat, or doc without exporting the whole runbook. The explanation's copy button appears once its text finishes generating; buttons flash "Copied!" and fall back to a manual prompt if the clipboard API is blocked
- The summary card now labels its two sections ("Logic" and "Plain English") for clarity

## [1.6.0] - 2026-06-20

### Added
- **Workspace file backup**: download the current workspace as a timestamped `.json` file, and load one back from disk — durable backup/restore that does not depend on copy-paste or share links (Import / Export dialog)
- **Truth table CSV export**: a "Download CSV" button on the truth table exports every condition combination, the logic trace, a plain-English explanation, and the final result as an Excel-friendly CSV (UTF-8 BOM, RFC-4180 escaping)
- **Markdown runbook export**: the Rule Summary page can export selected rules as a `.md` runbook — per rule it records status, workloads, actions, stop-processing, the raw logic, and the plain-English explanation, ready to drop into a wiki or repo
- **Duplicate rule / duplicate policy**: one-click "Duplicate" buttons clone a rule or an entire policy (with fresh IDs and a "(copy)" name) directly below the original, so variations can be built without rebuilding logic from scratch
- **Three new example templates**: GDPR – EU Personal Data (Email), HIPAA – Protected Health Information (Email + Endpoint), and Source Code Exfiltration (Endpoint), bringing the gallery to six ready-to-explore scenarios

### Changed
- The "Load Example" gallery is now rendered from the `DLP_EXAMPLES` data array, so cards can no longer drift out of sync with the underlying examples; gallery cards are keyboard-accessible

## [1.5.0] - 2026-06-13

### Added
- **Import/Export format guide**: the modal now shows a colour-coded legend explaining the difference between Purview PowerShell format (purple) and Visualizer workspace format (blue) — first-time users know exactly which button to use
- **Policy & Rule visual hierarchy**: Policies now have an indigo badge and indigo-tinted background; Rules have a blue badge and blue-bordered card, making the containment relationship immediately obvious
- Hierarchy caption below the "Policy & Rule Hierarchy" heading explains that Policies are enforcement containers, Rules are evaluated in priority order, and the first match triggers actions

### Changed
- Policy cards use an indigo border and background (was grey) to visually separate them from Rule cards
- Rule cards use a blue border (was grey) and gain a "Rule" badge alongside each Policy's "Policy" badge

## [1.4.0] - 2026-06-13

### Added
- Shared header component (`js/nav.js`): consistent brand mark, the **"Purview Playground"** product name, and icon-equipped navigation on every page
- Simulator: a **"Conditions set to True"** summary row above the condition list, with one-click removal chips
- Prominent **production-safety warning** when exporting to Purview PowerShell JSON (back up first, review carefully, use at your own risk)

### Changed
- Every page now shows the "Purview Playground" product name in its header, with the page name as a subtitle
- Navigation links across all pages now share consistent icons for a cohesive look

### Fixed
- Condition pool: the "+ Add" and edit (pencil) buttons are no longer pushed out of view by long condition names — the label now wraps and the actions stay visible

## [1.3.0] - 2026-06-13

### Changed
- **AI Regex Builder moved to its own page** (`regex.html`, linked in the main nav) so it is no longer buried in Settings
- The Regex Tester is now a standalone panel with its own manual pattern input, decoupled from the AI chat — no auto-population, the chat and tester are independent

### Added
- "Ignore case" toggle in the Regex Tester (adds the equivalent of the .NET `(?i)` flag)
- Match details: the tester now lists the matched substrings, and hints when a non-match is likely a case-sensitivity issue
- "Send to tester" button on each AI-generated regex to push it into the tester with one click

### Fixed
- Regex Tester is now reachable without first using the AI chat (previously the test field was hidden inside the chat refine row)

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
