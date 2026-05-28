# Claude Ultimate Enhancer (CUE) — Roadmap

All-in-one claude.ai userscript: theme engine, usage monitor, prompt library, auto-scroll, DOM trimmer, visual upgrades, settings panel.

## Shipped

### v1.1.0 (2026-05-28)
- Catppuccin Mocha theme variant (part of the broader Catppuccin set — Macchiato / Frappé / Latte still pending)
- `@updateURL` + `@downloadURL` metadata for auto-updates from this repo's `main` branch
- `@inject-into content` for Tampermonkey MV3 sandbox compatibility
- TrustedTypes `cue-html` policy wrapping every dynamic `innerHTML` site — survives `require-trusted-types-for 'script'` CSP
- `@version` ↔ README badge ↔ CHANGELOG sync workflow established
- `@homepageURL` + `@supportURL` metadata

### v1.0.0 (initial)
- Conversation export to Markdown (`Ctrl+Shift+E`)
- Live SSE `message_limit` subscription for unrounded 5h / weekly usage bars
- Burn-rate projection in the context tracker
- Native Claude feature toggles (Code Execution / Repl Tool / Memory / Search / Projects)
- Code-block extraction + clean copy across hljs / shiki / prism / generic markup

## Planned Features

### Usage / Tokens
- **Pre-send token count** using Anthropic's `/v1/messages/count_tokens` endpoint — requires opt-in API key stored in `GM_setValue`
- **Cache-hit indicator** — parse live SSE `message_limit` data like Claude Counter; show cache timer countdown
- **Per-session + 7-day + 5-hour** rolling bars (Pro / Max5 / Max20 thresholds)
- **Burn-rate projection** — estimate when the session will hit the cap at current spend
- **Cost estimate** per model using latest pricing (Opus 4.7 / Sonnet 4.6 / Haiku 4.5)
- **Context-window gauge** vs 200K (or 1M on 1M-context models)

### Prompt library
- **Import from promptly.fyi / PromptHub / the Awesome-Claude-Prompts repo** (curated JSON)
- **Variables + placeholders** (`{{topic}}`, `{{audience}}`) with a fill-in modal before send
- **Snippet trigger** — type `;summary` and expand inline
- **Shared-library folder** via Gist for teams (pull-only)
- **Version history** per prompt with one-click rollback

### UI / Themes
- **Shadow DOM** isolation for all injected UI (stop Claude CSS churn from breaking our styles)
- ~~**Catppuccin** (Mocha / Macchiato / Frappé / Latte) presets~~ — Mocha shipped in v1.1.0; Macchiato / Frappé / Latte still pending
- **Density modes** — Compact / Comfortable / Reading
- **Side-panel pin** for settings + library (resize + persist)
- **Message-tree sidebar** — jump between user/assistant turns in long conversations

### Conversation tooling
- **Export as Markdown / JSON / HTML** (single file, images inlined)
- **Search across all conversations** using the list API + local cache
- **Fold long code blocks** with "[+213 lines]" affordance
- **Copy whole turn** button with formatting preserved
- **Re-title conversation** inline (tap title → edit)

### Settings / Plumbing
- **Modular toggle bundle** — each feature lives in its own module, can be disabled without reload
- **Config import/export** as JSON
- ~~**`@updateURL` + `@downloadURL`** so users get auto-updates~~ — shipped v1.1.0
- ~~**Tampermonkey MV3** sandbox test pass (inject-into content gotchas)~~ — `@inject-into content` shipped v1.1.0
- ~~**`@version` sync** with README badge + CHANGELOG on every release~~ — shipped v1.1.0

### Reliability
- ~~`trustedTypes.createPolicy()` for all `innerHTML` so claude.ai's CSP never blocks us~~ — shipped v1.1.0 (`cue-html` policy)
- Graceful degradation when Claude renames DOM selectors — feature-flag modules independently
- Error log panel (toggle via settings) — see which modules broke on the current page

## Competitive Research
- **Claude Counter** ([she-llac/claude-counter](https://github.com/she-llac/claude-counter)) — minimal extension: token count, cache timer, 5h + 7d usage bars using `/usage` + SSE. Open source. Best-in-class usage accuracy — mirror the approach.
- **Claude Usage Tracker (lugia19)** — open source, Firefox + Chrome. Reference for UI patterns.
- **Promptly** ([Chrome Web Store](https://chromewebstore.google.com/detail/promptly-%E2%80%93-ai-prompt-enha/jjfoaldlbbcfgkhbfmadjjelphbgmngg)) — one-click optimizer (`Ctrl+M`), community library (promptly.fyi/library), export conversation (`Ctrl+E`). Mine the keyboard-triggered-enhance flow.
- **Claude Code Usage Monitor** ([Maciek-roboblog/Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor)) — terminal tool; ML-based burn-rate prediction. Port the prediction math.
- **Greasyfork claude.ai userscripts** — broad bench of small single-purpose scripts; validate we don't step on toes.

## Nice-to-Haves
- "Fork conversation" — clone the current thread from any message (saves manual copy-paste)
- Voice dictation hook via Web Speech API
- Image-paste OCR (local Tesseract WASM) before send for scanned docs
- Cross-model compare — same prompt to Opus + Sonnet + Haiku in a split view
- Anti-distraction mode — hide sidebar conversations list for deep work
- Keyboard-driven navigation (all features reachable without mouse, respecting global "No keyboard shortcuts" rule by making it opt-in)

## Open-Source Research (Round 2)

### Related OSS Projects
- **she-llac/claude-counter** — https://github.com/she-llac/claude-counter — browser extension that shows token count, cache timer, usage bars on claude.ai; uses `/usage` API + live SSE `message_limit`; DOM-observer injection pattern; zero-tracking local-only
- **lugia19/Claude-Usage-Extension** — https://github.com/lugia19/Claude-Usage-Extension — Claude Usage Tracker; calculates token consumption across uploads, project knowledge, chat history, AI output
- **simonw/tools (claude-token-counter.html)** — https://github.com/simonw/tools/blob/main/claude-token-counter.html — standalone web counter using Anthropic's API; good reference for counting attachments (images/PDFs)
- **soulduse/ai-token-monitor** — https://github.com/soulduse/ai-token-monitor — cross-platform tray app tracking Claude Code + Codex + OpenCode with leaderboard and webhook alerts
- **nadimtuhin/claude-token-optimizer** — https://github.com/nadimtuhin/claude-token-optimizer — reusable CLAUDE.md setup prompts for 90% token savings; paste-in drop-ins
- **alexgreensh/token-optimizer** — https://github.com/alexgreensh/token-optimizer — detects "ghost tokens" that stay after compaction and degrade quality
- **drona23/claude-token-efficient** — https://github.com/drona23/claude-token-efficient — CLAUDE.md preset that keeps Claude's responses terse, drop-in

### Features to Borrow
- Live SSE `message_limit` subscription for exact unrounded utilization rather than the native rounded percentage (claude-counter) — precise progress bars
- Cache timer countdown showing when prompt-cache expires on the current conversation (claude-counter)
- Per-project breakdown: how many tokens are sitting in files, project knowledge, history, system prompt (Claude-Usage-Extension)
- "Ghost-token" detector that flags messages likely to be demoted by compaction (alexgreensh/token-optimizer)
- Quick-apply CLAUDE.md presets from a menu: "terse mode", "code-only mode", "thinking-off" (drona23 drop-ins)
- Prompt cost estimator button that previews tokens/$$ before sending (simonw counter UX)
- Attachment token counter: dropped file → instant byte/token count + OCR/PDF page count before send (simonw counter)
- Cross-session leaderboard and daily/weekly stats panel (soulduse/ai-token-monitor)
- Export conversation as JSON/MD with message-level token counts (common feature across trackers)
- "Copy as prompt with cache-anchor" — one-click export of a conversation prefix optimized for `cache_control: ephemeral` reuse (pattern from prompt-caching docs)
- "Thinking budget" visualizer when Extended Thinking is on (Claude-Usage-Extension extended-thinking handling)

### Patterns & Architectures Worth Studying
- MutationObserver + Shadow DOM root attach: claude.ai uses closed-ish shadow roots in places; inject into a known-host via `attachShadow({mode:'open'})` shim or fall back to portal-mounted UI (claude-counter)
- SSE parser that consumes `text/event-stream` from `message_limit` endpoint and publishes to the page via `window.postMessage` (claude-counter)
- Split userscript / extension packaging: same core logic, two wrappers (Violentmonkey + MV3 extension) so users can pick their shell — CUE could ship both from one source (general userscript-to-extension pattern)
- Usage-calculation boundary: never trust DOM text for numeric state; always re-query the source (`/usage` API + SSE) — eliminates drift (claude-counter)
- Tiny no-runtime-deps build: pure HTML/CSS/JS, no React/Vue — keeps the injected UI <5KB and boot time ~0 (claude-counter, simonw counter)

## Implementation Deep Dive (Round 3)

### Reference Implementations to Study
- **mizaelpv write-up "Building a Chrome extension for Claude.ai"** — https://dev.to/mizaelpv/what-i-learned-building-a-chrome-extension-for-claudeai-1cn0 — documents Claude's undocumented DOM, `data-testid` enumeration, and the 300ms MutationObserver debounce against token-stream re-injection.
- **koi.ai "ShadowPrompt" postmortem** — https://www.koi.ai/blog/shadowprompt-how-any-website-could-have-hijacked-anthropic-claude-chrome-extension — React `dangerouslySetInnerHTML` + missing `event.origin` check; read before adding any `postMessage` listener to CUE.
- **Anthropic extension 1.0.41 fix (origin allowlist tightening)** — https://thehackernews.com/2026/03/claude-extension-flaw-enabled-zero.html — authoritative guidance on exact-match origin checks; apply to any bridge between page and isolated world.
- **React Shadow DOM patterns** — https://javascript.plainenglish.io/how-i-solved-css-conflicts-in-react-using-shadow-dom-and-portals-be3ee3f18aba — `attachShadow({ mode:"open" })` + React portal; template for our injected UI.
- **dev.to "Solving CSS and JavaScript Interference in Chrome Extensions"** — https://dev.to/developertom01/solving-css-and-javascript-interference-in-chrome-extensions-a-guide-to-react-shadow-dom-and-best-practices-9l — why class-prefixing and iframes lose to Shadow DOM for React-heavy hosts.
- **Claude internal `<deck-stage>` CustomEvent pattern** — from Anthropic's own artifacts; useful shape: `bubbles:true, composed:true, detail:{ reason:"init"|"keyboard"|"click"|"tap"|"api" }` — mirror for our injected events so consumers can listen outside shadow.

### Known Pitfalls from Similar Projects
- **Streaming response re-injection** — token-by-token streaming fires mutations per batch; unguarded injection spawns dozens of duplicate buttons per turn. Fix: 300ms debounce + `data-cue-injected` idempotency attribute. Reference: https://dev.to/mizaelpv/what-i-learned-building-a-chrome-extension-for-claudeai-1cn0
- **`data-testid` churn** — Claude rebuilds its testid map frequently; hard-selector code breaks weekly. Use feature-detection + fallback chains (role, aria-label, structural).
- **CSP blocks content-script fetch** — any `fetch()` to external URLs from content.js gets "blocked" with no clear hint; route through SW.
- **Style bleed from/into React tree** — un-shadowed injected UI inherits Claude's Tailwind utilities and vice versa. Shadow DOM + explicit `all: initial` inside the root.
- **`postMessage` origin spoofing** — ShadowPrompt demonstrated trust by subdomain pattern `*.claude.ai` is dangerous; enforce exact equality on `event.origin`.
- **React reconciliation stomps injected nodes** — if we graft into Claude's actual React children, a re-render deletes us. Always inject into a parent we control (portal target we own) or as a sibling, not a child of a React-managed node.
- **Shadow-root-scoped theme variables** — CSS `var(--x)` doesn't inherit across shadow boundary without explicit `::part` or `:host`; pre-copy CSS vars on attach.

### Library Integration Checklist
- **@types/chrome** pin `>=0.0.260`; entrypoint standard; gotcha: MV3 `scripting` + `userScripts` types lag releases.
- **MutationObserver** native; entrypoint `new MutationObserver`; gotcha: `subtree:true, childList:true` on Claude's chat root is high-volume — scope to the message list container and debounce 300ms.
- **postMessage bridge** native; gotcha: validate `event.origin === "https://claude.ai"` (exact), and `event.source === window` when listening on the page world.
- **Shadow DOM** native `Element.attachShadow`; gotcha: adopt stylesheets via `adoptedStyleSheets` (Chrome 99+) — cheaper than `<style>` nodes in hot paths.
- **highlight.js** pin `>=11.9` (code blocks); gotcha: worker recommended for large diffs; load from `web_accessible_resources`, not CDN (CSP).
- **marked** pin `>=12.x` (our markdown preview if added); gotcha: set `breaks:true, gfm:true` to match Claude's renderer; sanitize with DOMPurify.
- **DOMPurify** pin `>=3.1`; entrypoint `DOMPurify.sanitize`; gotcha: required before any `innerHTML` write near Claude's tree — ShadowPrompt root cause was skipping this.
