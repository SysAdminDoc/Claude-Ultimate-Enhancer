# Claude Ultimate Enhancer

![Version](https://img.shields.io/badge/version-1.3.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Language](https://img.shields.io/badge/language-JavaScript-yellow)
![Type](https://img.shields.io/badge/type-Userscript-orange)
![Platform](https://img.shields.io/badge/platform-claude.ai-9cf)

All-in-one Claude.ai enhancement suite — theme engine, usage monitor, conversation search, prompt library, auto-scroll, DOM trimmer, visual upgrades, panel tools, and more.

## Features

- **Theme Engine** — Oceanic, Midnight, and full Catppuccin set (Mocha / Macchiato / Frappe / Latte) with optional sans-serif font override
- **Usage Monitor** — Live per-tab, 5h, and weekly rolling bars with Pro / Max 5x / Max 20x plan presets, backed by Claude's SSE `message_limit` stream when available
- **Context Tracker** — Real-time fill %, burn rate, turn count, and time-to-full projection with health advice
- **Response Monitor** — Generation status, completion tone + tab flash when the tab is unfocused, truncation detection
- **Prompt Library** — 18 built-in pipeline / recovery / resume prompts plus your own custom entries, right-click to edit
- **Auto-Scroll** — Follows streaming responses; auto-snaps to bottom when content arrives
- **Auto-Approve** — Optional one-tap dialog approval for "Allow once" / "Allow always" prompts
- **DOM Trimmer** — Keeps only the N most recent messages live; collapses the rest into placeholders that restore on demand
- **Visual Upgrades** — Color-coded action buttons (copy / edit / retry / thumbs / delete), bold/italic accents, custom scrollbar, smooth animations
- **Code Tools** — Cleaned-up code-block extraction (strips line numbers, hljs / shiki / prism / generic), one-tap copy
- **Code Folding** — Automatically folds long code blocks (15+ lines) with a "[+N lines] click to expand" toggle
- **Copy Turn** — Hover any message turn to reveal a "Copy" button that copies the full turn text
- **Snippet Trigger** — Type `;summary`, `;fix`, `;review` etc. in the editor and press Space/Tab/Enter to expand inline
- **Density Modes** — Switch between Compact, Comfortable, and Reading layouts
- **Pinned Side Panel** — Pin/unpin the tools panel and resize it with persisted width
- **Conversation Search** — Index Claude's conversation list API into a local cache and reopen matching chats from the panel
- **Conversation Forking** — Fork the current chat through any turn into a new conversation with the transcript queued automatically
- **Voice Dictation** — Insert speech-to-text into the composer through the browser Web Speech API
- **Focus Mode** — Hide the Claude sidebar for deep-work sessions
- **Turn Navigator** — Jump between user/assistant turns from the side panel
- **Conversation Export** — Exports the current chat to branch-aware Markdown, JSON, or self-contained HTML from the panel; uses Claude metadata when available and reports DOM-fallback limitations
- **Config Import/Export** — Versioned settings + prompts JSON with size/type validation, safe partial imports, and migration-friendly envelopes
- **Diagnostics** — Panel checks for editor/selectors, message groups, organization/API status, fetch interception, and SSE health
- **Native Feature Toggles** — Flip Claude's own features (Code Execution / Repl Tool / Memory / Search / Projects) without leaving the panel
- **Error Log** — See which modules encountered errors on the current page (toggle via panel)
- **Graceful Degradation** — Each module initializes independently; one failure never takes down the rest
- **Prompt Variables** — Use `{{topic}}`, `{{audience}}` placeholders in prompts; a fill-in modal appears before sending
- **Settings Panel** — Hover the right edge to open; every feature toggles independently and persists across sessions
- **Auto-Update** — `@updateURL` / `@downloadURL` point at GitHub raw so Tampermonkey checks for new versions automatically

## Installation

1. Install a userscript manager ([Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/))
2. Open [`Claude Ultimate Enhancer.user.js`](./Claude%20Ultimate%20Enhancer.user.js) — your manager will detect the metadata block and prompt to install
3. Visit [claude.ai](https://claude.ai) — the panel is hidden by default; hover the right edge to open it

Updates roll out automatically because the metadata block declares `@updateURL` and `@downloadURL` pointing at this repo's `main` branch.

## Verification

The repository includes dependency-free Node contract tests for metadata, storage migration, config validation, sanitizer behavior, API status handling, and branch-aware serialization:

```text
npm test
```

All tracked userscripts should also pass `node --check`. The active script is scoped to the top-level Claude document and stores structured local data through bounded versioned records. Conversation content is not uploaded by CUE, but browser/userscript storage is not encrypted; use the panel's clear-data controls and exported backups deliberately.

## License

MIT — see [LICENSE](./LICENSE).
