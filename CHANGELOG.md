# Changelog

All notable changes to Claude Ultimate Enhancer will be documented in this file.

## [v1.1.0] - 2026-05-28

### Added
- Catppuccin Mocha theme variant (alongside Oceanic and Midnight)
- `@updateURL` and `@downloadURL` metadata — Tampermonkey / Violentmonkey now auto-check the GitHub `main` branch for new versions
- `@homepageURL` and `@supportURL` metadata pointing at the repo and issue tracker
- `@inject-into content` directive for Tampermonkey MV3 sandbox compatibility
- TrustedTypes policy (`cue-html`) wrapping every dynamic `innerHTML` assignment — keeps the script working on routes where claude.ai sets `require-trusted-types-for 'script'`

### Changed
- Bumped userscript version from `1.0.0` to `1.1.0` (metadata block + in-script `VERSION` constant + on-panel badge)
- README refreshed with a version badge, full feature list, keyboard-shortcut table, and corrected installation steps
- `@namespace` now points at the actual repo URL instead of just the user profile

### Fixed
- CHANGELOG header was a broken template placeholder (`%Y->`) — rewritten with proper sections

## [v1.0.0] - 2026 (initial release)

### Added
- All-in-one Claude.ai userscript: theme engine (Oceanic / Midnight), live usage monitor via SSE `message_limit` stream, context tracker with burn-rate projection, response monitor with tab-flash + completion tone, prompt library with 18 built-in pipeline / recovery / resume prompts, auto-scroll, DOM trimmer, paste fix, code-block scanner, native Claude feature toggles (Code Execution / Repl Tool / Memory / Search / Projects)
- Keyboard shortcuts: `Ctrl+Shift+D` (panel), `Ctrl+Shift+K` (copy last code), `Ctrl+Shift+C` (copy last response), `Ctrl+Shift+E` (export chat to Markdown)
- Hover-strip side panel with persistent settings (`GM_setValue`)
- MIT license, README, ROADMAP
