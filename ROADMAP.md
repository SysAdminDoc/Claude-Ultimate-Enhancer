# Claude Ultimate Enhancer (CUE) — Roadmap

Actionable work only. Historical and completed roadmap material is archived in CHANGELOG.md; blocked work is kept in Roadmap_Blocked.md.

## Actionable Items

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
