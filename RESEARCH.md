# Research - Claude Ultimate Enhancer

## Executive Summary
Claude Ultimate Enhancer is a readable, local-first claude.ai userscript that already combines theme/layout controls, usage/context tracking, prompt snippets, conversation search, voice dictation, forking, export, and panel tools. Its strongest shape is a privacy-preserving power-user overlay, not a hosted prompt marketplace or heavyweight extension. Highest-value direction: harden trust and recovery first, then make the single-file script more testable and resilient to claude.ai DOM/API drift. Priority opportunities: branch-aware exports with metadata, schema-validated import/export, selector health diagnostics, observer/interval lifecycle cleanup, DOM mock regression tests, panel accessibility, privacy/mutating-action disclosures, Greasy Fork/install troubleshooting, prompt chaining, and lightweight i18n.

## Product Map
- Core workflows: tune Claude UI/theme/density; monitor usage/context/response state; store/send prompts/snippets; search/fork/export conversations; toggle selected native Claude settings.
- User personas: Claude-heavy builders managing long chats; local-first users who want readable scripts; power users who need prompt reuse and export; users near usage/context limits.
- Platforms and distribution: Tampermonkey/Violentmonkey userscript on `https://claude.ai/*`, direct GitHub raw auto-update via `@updateURL`/`@downloadURL`, Chrome/Edge/Firefox userscript managers.
- Key integrations and data flows: Claude same-origin `/api/organizations`, `/usage`, `/chat_conversations`, `/account/settings`; SSE `fetch` interception; `GM_getValue`/`GM_setValue` local persistence; Web Speech API; clipboard and file download APIs.

## Competitive Landscape
- Claude Conversation Exporter: strong bulk, filtered, branch-aware exports with model/timestamp metadata. Learn export correctness, progress reporting, and failure summaries; avoid requiring manual organization-ID setup when same-origin userscript calls already work.
- ChatGPT Exporter: mature multi-format export including uploaded official export JSON, screenshot/HTML/Markdown/JSON, batch actions, and Greasy Fork distribution. Learn import-from-official-export and install-channel polish; avoid destructive archive/delete actions in CUE.
- Superpower ChatGPT: broad chat organization, prompt chains, prompt history/favorites, template variables, folders, local sync, and search. Learn prompt-chain/history UX; avoid hosted community prompt sharing, newsletter coupling, and restrictive licensing posture.
- AI Conversation Navigator: strong selector registry, multi-platform DOM adapters, SPA health checks, mock DOM/Playwright selector testing, platform-specific install notes, context bars, bookmarks, and i18n. Learn selector diagnostics and test harnesses; avoid expanding CUE into every AI chat site before claude.ai reliability is hardened.
- Say, Pi: demonstrates robust browser-extension architecture for voice with TypeScript, state machines, offscreen audio, compatibility matrix, and i18n. Learn graceful capability detection and compatibility docs; avoid remote STT/TTS infrastructure for a privacy-first userscript.
- AIPRM / PromptFolder / commercial prompt managers: expose paywalled value around team prompt libraries, categorization, variables, sharing, and analytics. Learn prompt organization depth; avoid multi-user/team sync until auth and privacy architecture exists.
- Tampermonkey / Violentmonkey ecosystems: metadata, update URLs, run timing, and browser-specific user-script requirements matter for install success. Learn release/install verification; avoid assuming Chrome MV3 userscript execution is frictionless.

## Security, Privacy, and Reliability
- `Claude Ultimate Enhancer.user.js:40-42` centralizes Trusted Types wrapping but still intentionally accepts generated HTML; keep all user-controlled values escaped and add tests around modal/search/export rendering.
- `Claude Ultimate Enhancer.user.js:280` and `:2372` capture `group.innerHTML`; exported HTML can include host markup and injected controls unless scrubbed consistently.
- `Claude Ultimate Enhancer.user.js:298-370`, `:1697`, and `:3225-3255` call private same-origin Claude APIs; failures should surface endpoint, status, and fallback guidance without assuming response shape stability.
- `Claude Ultimate Enhancer.user.js:929-955` auto-approves permission dialogs; add a visible high-risk toggle description, event log entry, and last-action undo/disable affordance rather than a confirmation dialog.
- `Claude Ultimate Enhancer.user.js:2995-3024` imports arbitrary JSON into settings/prompts without schema version, size caps, type checks, or prompt object validation.
- Missing guardrails: no export failure manifest, no branch/current-node awareness, no data-retention/privacy panel for locally cached conversations/prompts, no migration/version stamp for stored config, no selector health dashboard.
- Recovery needs: failed fork payloads in `cue_pending_fork` need TTL, retry/clear controls, and duplicate-send protection; failed conversation indexing should keep partial results plus a readable error summary.

## Architecture Assessment
- The active app is a single 3,600+ line userscript with module objects and shared globals; keep it ship-readable, but add a local test/build harness so behavior is not verified by syntax checks alone.
- Selectors are partly centralized in `SEL` but many modules still use ad hoc selectors and text matching; move Claude DOM/API contracts into registries with self-test output in the Error Log panel.
- Module lifecycle is inconsistent: many observers/intervals have `destroy()` methods, but feature toggles often leave observers alive and polling checks gated by settings; add a lifecycle registry for navigation/unload cleanup without attempting a full hot-swappable module system.
- Panel accessibility gaps: hover-only strip, compact one-letter buttons (`P`, `U`, `F`), icon-like controls, modal focus handling, and color-coded status need `aria-label`, focus trapping, focus-visible styles, and non-color text.
- Test gaps: no tracked package manifest, DOM fixture tests, storage migration tests, export fixture tests, import validation tests, or fetch/SSE mock tests; `CLAUDE.md` currently lists only `node --check` plus a Node VM smoke.
- Documentation gaps: README lacks browser-specific Chrome/Edge "Allow User Scripts" notes, Greasy Fork/install fallback, privacy/data-retention details, known limitations for private Claude APIs, and troubleshooting for Web Speech/API drift.

## Rejected Ideas
- Full MV3 extension rewrite now: Chrome extension architecture would help service-worker relays and stores, but it conflicts with the readable no-build userscript shape until export/import/test hardening lands.
- Hosted community prompt marketplace: commercial competitors validate demand, but hosting prompts introduces moderation, account, privacy, and trust work that does not fit local-first CUE.
- Remote Whisper/TTS voice stack: Say, Pi shows the ceiling, but sending voice/transcripts to remote services conflicts with CUE's current local-only posture.
- Cross-platform AI chat support: AI Conversation Navigator proves the adapter model, but CUE's Claude API features are site-specific; broaden only after a Claude selector/API registry exists.
- Keyboard shortcuts: several competitors use them, but repo notes explicitly keep the current release panel-driven only.
- Pre-send API token counting: already blocked in `Roadmap_Blocked.md` by API-key and CSP/background-relay requirements.
- Cross-model compare: already blocked in `Roadmap_Blocked.md` by unreliable web UI model routing.
- Shared prompt library via Gist/OAuth: already blocked in `Roadmap_Blocked.md` by missing auth infrastructure.

## Sources
Direct OSS:
- https://github.com/SysAdminDoc/Claude-Ultimate-Enhancer
- https://github.com/socketteer/Claude-Conversation-Exporter
- https://github.com/pionxzh/chatgpt-exporter
- https://github.com/saeedezzati/superpower-chatgpt
- https://github.com/JoonJ14/ai-conversation-navigator
- https://github.com/Pedal-Intelligence/saypi-userscript
- https://github.com/Shy-Plus/claude-auto-backup
- https://github.com/toddbartholow/claude-chat-downloader
- https://github.com/iikoshteruu/Enhanced-Claude.Ai-Export-v2.1
- https://github.com/awesome-scripts/awesome-userscripts

Commercial / Product:
- https://www.aiprm.com/
- https://promptfolder.com/
- https://sider.ai/
- https://monica.im/
- https://maxai.me/

Platform / Standards:
- https://www.tampermonkey.net/documentation.php
- https://violentmonkey.github.io/api/metadata-block/
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
- https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- https://www.w3.org/WAI/WCAG22/quickref/
- https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html

Claude / Security:
- https://support.anthropic.com/
- https://docs.anthropic.com/
- https://www.ox.security/blog/prompt-poaching-chrome-extension-risk/
- https://snyk.io/blog/malicious-browser-extensions/
- https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure

## Open Questions
- Which Claude private API response shapes changed most recently for `/chat_conversations` and `/usage` on Pro versus Max accounts?
- Should branch-aware export preserve all branches or only the active branch by default?
