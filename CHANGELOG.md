# Changelog

All notable changes to Claude Ultimate Enhancer will be documented in this file.

## Unreleased

### Added
- Top-level frame enforcement with `@noframes` and a runtime guard
- Versioned, bounded GM storage with legacy migration, quarantine, and write-failure reporting
- Schema-validated config/prompt import with safe partial-import reporting
- Branch-aware conversation serialization with metadata, active-path JSON, content-block preservation, artifact fields, and safe Markdown/HTML output
- API/SSE health diagnostics and fixture-backed Node contract tests

### Fixed
- Removed identity Trusted Types behavior and raw DOM trimming reparsing from conversation/export paths
- Exported conversation markup no longer carries CUE controls or executable attributes

## [v1.3.0] - 2026-06-27

### Added
- Usage plan selector for Pro, Max 5x, and Max 20x with per-tab, 5-hour, and 7-day rolling usage bars
- Pinned/resizable side panel with persisted width
- Conversation search panel backed by Claude's conversation list API and a local cache
- Fork-from-turn workflow that queues the transcript into a new conversation
- Voice dictation button using the browser Web Speech API
- Focus mode toggle for hiding the Claude sidebar
- Panel tools for copy/export/turn navigation without shortcut handlers

### Changed
- Removed current-release shortcut handlers; panel tools expose copy/export actions without key combos
- Settings reset now acts immediately with toast feedback instead of a confirmation dialog
- Prompt version history now persists across reloads
- Roadmap hygiene now keeps completed work out of ROADMAP.md and records hard blockers in Roadmap_Blocked.md

### Fixed
- Focus mode now initializes at startup instead of only being listed in the module table
- Removed old authorship wording from the archived Prompt Deck userscript

## [v1.2.0] - 2026-06-19

### Added
- Catppuccin Macchiato, Frappe, and Latte theme variants (completing the full Catppuccin set)
- Density modes: Compact / Comfortable / Reading — switchable from the panel
- Code Folding module: automatically folds code blocks over 15 lines with a "[+N lines] click to expand" toggle
- Copy Turn module: hover any message turn to reveal a one-click "Copy" button
- Snippet Trigger module: type `;summary`, `;fix`, `;review` etc. in the editor and press Space/Tab/Enter to expand inline (7 built-in snippets, add your own)
- Prompt variables with `{{placeholder}}` syntax — a fill-in modal appears before sending
- Conversation export to JSON and HTML formats (in addition to existing Markdown)
- Config import/export as JSON (settings + prompts)
- Turn Navigator panel section — click to jump between user/assistant turns
- Error Log panel section — shows which modules encountered errors, with clear button
- Graceful degradation: each module initializes inside a try/catch so one failure never takes down the rest
- Cache-hit indicator with countdown timer showing when prompt cache expires (5-minute TTL)
- Cost Estimator module: tracks estimated API cost per message and session total (Opus / Sonnet / Haiku pricing)
- Re-title conversation inline: double-click the active conversation title in the sidebar to rename it
- Prompt version history: each edit saves the previous version; up to 10 versions with one-click rollback from the editor modal

### Changed
- Bumped version from 1.1.0 to 1.2.0 (metadata + VERSION constant + panel badge + README badge)
- Export action now shows a format picker (Markdown / JSON / HTML) instead of immediately exporting Markdown
- Latte theme applies to `data-mode=light` selector (light theme support)

## [v1.1.0] - 2026-05-28

### Added
- Catppuccin Mocha theme variant (alongside Oceanic and Midnight)
- `@updateURL` and `@downloadURL` metadata — Tampermonkey / Violentmonkey now auto-check the GitHub `main` branch for new versions
- `@homepageURL` and `@supportURL` metadata pointing at the repo and issue tracker
- `@inject-into content` directive for Tampermonkey MV3 sandbox compatibility
- TrustedTypes policy (`cue-html`) wrapping every dynamic `innerHTML` assignment — keeps the script working on routes where claude.ai sets `require-trusted-types-for 'script'`

### Changed
- Bumped userscript version from `1.0.0` to `1.1.0` (metadata block + in-script `VERSION` constant + on-panel badge)
- README refreshed with a version badge, full feature list, and corrected installation steps
- `@namespace` now points at the actual repo URL instead of just the user profile

### Fixed
- CHANGELOG header was a broken template placeholder (`%Y->`) — rewritten with proper sections

## [v1.0.0] - 2026 (initial release)

### Added
- All-in-one Claude.ai userscript: theme engine (Oceanic / Midnight), live usage monitor via SSE `message_limit` stream, context tracker with burn-rate projection, response monitor with tab-flash + completion tone, prompt library with 18 built-in pipeline / recovery / resume prompts, auto-scroll, DOM trimmer, paste fix, code-block scanner, native Claude feature toggles (Code Execution / Repl Tool / Memory / Search / Projects)
- Panel actions for copying code/responses and exporting chat to Markdown
- Hover-strip side panel with persistent settings (`GM_setValue`)
- MIT license, README, ROADMAP

## Roadmap archive — 2026-08-10 — ROADMAP.md

<details>
<summary>Original roadmap snapshot</summary>

```markdown
# Claude Ultimate Enhancer (CUE) — Roadmap

All-in-one claude.ai userscript: theme engine, usage monitor, prompt library, auto-scroll, DOM trimmer, visual upgrades, settings panel.

No remaining actionable roadmap items.

## Research-Driven Additions

- [ ] P0 - Branch-aware conversation export with metadata
  Why: Current export is DOM-current only and competitors preserve branches, model/timestamp metadata, and failure summaries.
  Evidence: `Claude Ultimate Enhancer.user.js:266`, `Claude Ultimate Enhancer.user.js:2372`, Claude Conversation Exporter, ChatGPT Exporter.
  Touches: `Claude Ultimate Enhancer.user.js` `getConversationMessages`, `PanelToolsModule`, export modal.
  Acceptance: Markdown/JSON/HTML exports identify active branch, omit injected CUE controls, include conversation title/id/timestamps/model when available, and produce a failure summary for missing API data.
  Complexity: L

- [ ] P0 - Schema-validated config and prompt import
  Why: Imported JSON currently mutates settings/prompts without versioning, size caps, type validation, or migration checks.
  Evidence: `Claude Ultimate Enhancer.user.js:2995`, `Claude Ultimate Enhancer.user.js:2106`, OWASP DOM XSS guidance.
  Touches: `Claude Ultimate Enhancer.user.js` settings import/export, `PromptModule`, toast/error log paths.
  Acceptance: Imports reject unknown schema versions, invalid setting types, oversized files, malformed prompt records, and unsafe labels while preserving valid partial imports with a toast and error-log detail.
  Complexity: M

- [ ] P0 - Selector and private API health diagnostics
  Why: Claude DOM/API selectors are brittle and failures currently degrade into empty panels or generic toasts.
  Evidence: `Claude Ultimate Enhancer.user.js:142`, `Claude Ultimate Enhancer.user.js:298`, AI Conversation Navigator selector registry and SPA health checks.
  Touches: `Claude Ultimate Enhancer.user.js` selector constants, `ClaudeAPI`, `ErrorLogModule`, control panel diagnostics.
  Acceptance: Panel shows a diagnostics section with pass/fail checks for editor, send/stop buttons, message groups, org id, usage API, conversation API, and last fetch status.
  Complexity: M

- [ ] P1 - Observer and interval lifecycle cleanup
  Why: Multiple observers/intervals run for disabled features or across SPA navigation, increasing drift and performance risk.
  Evidence: `Claude Ultimate Enhancer.user.js:826`, `Claude Ultimate Enhancer.user.js:1026`, `Claude Ultimate Enhancer.user.js:3658`, `Roadmap_Blocked.md` hot-swap blocker.
  Touches: `Claude Ultimate Enhancer.user.js` module init/destroy, EventBus, navigation handler.
  Acceptance: Navigation/unload calls registered cleanup handlers, disabled polling modules stop timers, and the Error Log reports lifecycle failures.
  Complexity: M

- [ ] P1 - Local DOM fixture and smoke test harness
  Why: `node --check` cannot catch selector drift, export pollution, import schema regressions, or panel accessibility issues.
  Evidence: `CLAUDE.md`, AI Conversation Navigator mock DOM/Playwright testing notes, `Claude Ultimate Enhancer.user.js:2494`.
  Touches: package/test tooling, fixtures for Claude chat DOM, `Claude Ultimate Enhancer.user.js` test seams.
  Acceptance: One local command runs syntax checks plus DOM fixture tests for panel boot, message extraction, export cleanup, snippet expansion, config import validation, and fetch/SSE mocks.
  Complexity: L

- [ ] P1 - Panel accessibility pass
  Why: Hover-only panel access, one-letter buttons, color-coded statuses, and modals need accessible names and focus management.
  Evidence: `Claude Ultimate Enhancer.user.js:3089`, `Claude Ultimate Enhancer.user.js:3503`, WCAG 2.2 quick reference.
  Touches: `ControlPanel`, modal builders, tool buttons, status indicators, CSS.
  Acceptance: All interactive controls have accessible labels, modal focus is trapped/restored, focus-visible styles are present, and status conveys meaning without color alone.
  Complexity: M

- [ ] P1 - Privacy and high-risk action transparency panel
  Why: The script caches conversations/prompts locally and can auto-approve dialogs or mutate Claude settings without a consolidated trust view.
  Evidence: `Claude Ultimate Enhancer.user.js:929`, `Claude Ultimate Enhancer.user.js:1746`, `Claude Ultimate Enhancer.user.js:3225`, Chrome extension security guidance.
  Touches: settings panel, `AutoApproveModule`, `ConversationSearchModule`, `ClaudeAPI.toggleFeature`, local storage keys.
  Acceptance: Panel lists local data stores, last high-risk action, clear-data buttons, auto-approve warning text, and undo/disable affordance for the last mutating action where feasible.
  Complexity: M

- [ ] P2 - Browser-specific installation and distribution hardening
  Why: Chrome/Edge MV3 userscript execution now needs explicit browser setup, and competitors reduce support load with Greasy Fork/install troubleshooting.
  Evidence: Tampermonkey docs, Violentmonkey metadata docs, AI Conversation Navigator browser setup notes, ChatGPT Exporter Greasy Fork distribution.
  Touches: README install section, userscript metadata, release checklist.
  Acceptance: README documents Chrome/Edge Allow User Scripts, Firefox/Violentmonkey notes, raw GitHub fallback, update verification, and known Web Speech/browser limitations.
  Complexity: S

- [ ] P2 - Prompt chain runner and prompt history search
  Why: CUE has prompt templates, variables, snippets, and version history but not ordered prompt chains or searchable sent-prompt history.
  Evidence: `Claude Ultimate Enhancer.user.js:1958`, `Claude Ultimate Enhancer.user.js:2044`, Superpower ChatGPT prompt chains/history.
  Touches: `PromptModule`, `SnippetModule`, panel prompt UI, GM storage migration.
  Acceptance: Users can save an ordered chain, run each step from the panel, pause between sends, and search local prompt history without adding keyboard shortcuts.
  Complexity: L

- [ ] P3 - Lightweight UI string catalog and language setting
  Why: Panel text is hardcoded throughout the userscript, blocking even small localized installs and making copy consistency harder.
  Evidence: `Claude Ultimate Enhancer.user.js:3145`, `Claude Ultimate Enhancer.user.js:3425`, Say Pi i18n workflow, AI Conversation Navigator i18n support.
  Touches: `Claude Ultimate Enhancer.user.js` panel strings, settings defaults, README.
  Acceptance: Core panel labels/statuses come from a local string catalog with English default and one additional locale, with no runtime network translation.
  Complexity: M
```

</details>
