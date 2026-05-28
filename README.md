# Claude Ultimate Enhancer

![Version](https://img.shields.io/badge/version-1.1.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Language](https://img.shields.io/badge/language-JavaScript-yellow)
![Type](https://img.shields.io/badge/type-Userscript-orange)
![Platform](https://img.shields.io/badge/platform-claude.ai-9cf)

All-in-one Claude.ai enhancement suite — theme engine, usage monitor, prompt library, auto-scroll, DOM trimmer, visual upgrades, keyboard shortcuts, and more.

## Features

- **Theme Engine** — Oceanic, Midnight, and Catppuccin Mocha dark themes with optional sans-serif font override
- **Usage Monitor** — Live 5h and weekly rate-limit bars sourced from Claude's SSE `message_limit` stream (no rounding)
- **Context Tracker** — Real-time fill %, burn rate, turn count, and time-to-full projection with health advice
- **Response Monitor** — Generation status, completion tone + tab flash when the tab is unfocused, truncation detection
- **Prompt Library** — 18 built-in pipeline / recovery / resume prompts plus your own custom entries, right-click to edit
- **Auto-Scroll** — Follows streaming responses; auto-snaps to bottom when content arrives
- **Auto-Approve** — Optional one-tap dialog approval for "Allow once" / "Allow always" prompts
- **DOM Trimmer** — Keeps only the N most recent messages live; collapses the rest into placeholders that restore on demand
- **Visual Upgrades** — Color-coded action buttons (copy / edit / retry / thumbs / delete), bold/italic accents, custom scrollbar, smooth animations
- **Code Tools** — Cleaned-up code-block extraction (strips line numbers, hljs / shiki / prism / generic), one-tap copy
- **Conversation Export** — `Ctrl+Shift+E` exports the current chat to a clean Markdown file
- **Native Feature Toggles** — Flip Claude's own features (Code Execution / Repl Tool / Memory / Search / Projects) without leaving the panel
- **Settings Panel** — Hover the right edge or press `Ctrl+Shift+D` to open; every feature toggles independently and persists across sessions
- **Auto-Update** — `@updateURL` / `@downloadURL` point at GitHub raw so Tampermonkey checks for new versions automatically

## Keyboard Shortcuts

| Combo | Action |
| --- | --- |
| `Ctrl+Shift+D` | Toggle the CUE control panel |
| `Ctrl+Shift+K` | Copy the last code block to clipboard |
| `Ctrl+Shift+C` | Copy the last Claude response (only when no text is selected) |
| `Ctrl+Shift+E` | Export the current conversation as Markdown |

## Installation

1. Install a userscript manager ([Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/))
2. Open [`Claude Ultimate Enhancer.user.js`](./Claude%20Ultimate%20Enhancer.user.js) — your manager will detect the metadata block and prompt to install
3. Visit [claude.ai](https://claude.ai) — the panel is hidden by default; hover the right edge or press `Ctrl+Shift+D` to open it

Updates roll out automatically because the metadata block declares `@updateURL` and `@downloadURL` pointing at this repo's `main` branch.

## License

MIT — see [LICENSE](./LICENSE).
