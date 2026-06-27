// ==UserScript==
// @name         Claude Prompt Deck
// @namespace    https://github.com/SysAdminDoc
// @version      1.4.0
// @description  Sliding sidebar for Claude.ai - prompt templates, context tracking, auto-scroll, auto-approve, response timer, notifications, keyboard shortcuts
// @author       SysAdminDoc
// @match        https://claude.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'claude-prompt-deck-v1';
    const LOCK_KEY = 'claude-prompt-deck-lock';

    const CONFIG = {
        pollInterval: 2000,
        stuckTimeout: 90000,
        typingDelay: 300,
        scrollDebounce: 150,
        autoScroll: true,
        autoApprove: true,
        notifySound: true,
        notifyFlash: true,
        contextWindow: 200000,
        warnThreshold: 0.55,
        criticalThreshold: 0.75,
        newChatThreshold: 0.85,
        charsPerToken: 4,
        qualityDegradeTurns: 25,
        retractDelay: 600,        // ms after send before retract (unlocked)
        hoverOpenDelay: 180,      // ms hover on trigger before opening
        hoverCloseDelay: 400,     // ms after mouse leaves before closing
    };

    const SEL = {
        editor:     '.ProseMirror',
        editorAlt:  'div[contenteditable="true"][translate="no"].ProseMirror',
        sendBtn:    '[data-testid="send-button"]',
        sendBtnAlt: 'button[aria-label*="Send"]',
        stopBtn:    '[data-testid="stop-button"]',
        stopBtnAlt: 'button[aria-label*="Stop"]',
        userMsg:    '[data-testid="user-message"]',
        msgGroup:   '.group',
        dialog:     '[role="dialog"]',
        dialogOpen: '[role="dialog"][data-state="open"]',
        streaming:  '[data-is-streaming="true"]',
    };

    // ============================================================
    //  DEFAULT PROMPT TEMPLATES
    // ============================================================
    const DEFAULT_PROMPTS = [
        {
            id: 'spec', label: 'Spec', cat: 'pipeline',
            prompt: `You are now in **AUTOPILOT MODE**. A userscript monitors this chat and will send follow-up prompts.

**PROJECT:**
[DESCRIBE YOUR PROJECT HERE]

**PROTOCOL:**
1. End EVERY response with: \`STATUS: [STAGE] COMPLETE\` or \`STATUS: [STAGE] CONTINUING\`
2. If cut off, I will send "CONTINUE" - pick up EXACTLY where you left off
3. Write **production-ready, complete code** - NO placeholders, NO TODO stubs
4. Include ALL imports, ALL error handling, ALL edge cases
5. NEVER hallucinate packages - only use packages you are certain exist

---

**PHASE: SPECIFICATION**

Before ANY code, create a complete spec:
1. **Requirements** - Functional + non-functional
2. **User Stories** - 3-5 key stories
3. **Inputs & Outputs** - Data flow
4. **Edge Cases** - Boundary conditions, failure modes
5. **Acceptance Criteria** - How we verify each feature
6. **Security** - Auth, validation, sanitization needs
7. **Dependencies** - Only packages you are 100% certain exist

End with: \`STATUS: SPEC COMPLETE\``
        },
        {
            id: 'arch', label: 'Architecture', cat: 'pipeline',
            prompt: `AUTOPILOT: **ARCHITECTURE PHASE**

Define the technical architecture from the spec:
1. **Tech Stack** - Language, frameworks, tools (justify each)
2. **Project Structure** - Complete directory/file tree
3. **Data Models** - All types, interfaces, schemas, enums
4. **Component Map** - Module connections, dependency graph
5. **API Surface** - Function signatures, entry points, CLI args
6. **Configuration** - Settings, env vars, defaults
7. **Error Strategy** - Error types, handling patterns

End with: \`STATUS: ARCHITECTURE COMPLETE\``
        },
        {
            id: 'plan', label: 'Plan', cat: 'pipeline',
            prompt: `AUTOPILOT: **PLANNING PHASE**

Break implementation into numbered phases. Each must be self-contained and ordered by dependency (data models -> logic -> UI -> integration).

Format:
PHASE 1: [Name] - [What gets built]
PHASE 2: [Name] - [What gets built]
...

Also list tests for each phase.

End with: \`STATUS: PLAN COMPLETE\``
        },
        {
            id: 'build', label: 'Build Phase', cat: 'pipeline',
            prompt: `AUTOPILOT: Build **PHASE [N]** now.

Refer to the plan. Write complete, production-ready code:
- Complete file contents with ALL imports
- Full error handling and input validation
- Inline comments for non-obvious logic
- Consistent with architecture above
- Only real, verified packages

End with: \`STATUS: PHASE [N] COMPLETE\``
        },
        {
            id: 'mid_audit', label: 'Mid Audit', cat: 'pipeline',
            prompt: `AUTOPILOT: **MID-BUILD AUDIT**

Review ALL code so far:
1. **Consistency** - Same patterns, naming, types across phases?
2. **Integration** - Will phases connect? Mismatched signatures?
3. **Missing imports** - Undefined references across files?
4. **Data flow** - Data passes correctly between components?
5. **Error handling** - Unhandled exceptions or silent failures?
6. **Security** - Input validation, injection, exposed secrets?
7. **Dependencies** - All packages real and correct versions?

Fix every issue. Show corrected code.

End with: \`STATUS: MID_AUDIT COMPLETE\``
        },
        {
            id: 'testing', label: 'Testing', cat: 'pipeline',
            prompt: `AUTOPILOT: **TESTING PHASE**

Generate comprehensive test suite:
1. **Unit Tests** - Each function/method independently
2. **Integration Tests** - Component interactions
3. **Edge Cases** - Boundary values, empty/malformed inputs
4. **Error Paths** - Verify error handling works
5. **Smoke Tests** - End-to-end happy path

Use appropriate framework. Single-command runnable.

End with: \`STATUS: TESTING COMPLETE\``
        },
        {
            id: 'final_audit', label: 'Final Audit', cat: 'pipeline',
            prompt: `AUTOPILOT: **FINAL AUDIT**

Complete final review:
1. **Code Quality** - Dead code, duplication, complexity
2. **Security** - SQL injection, XSS, path traversal, hardcoded secrets, input validation
3. **Completeness** - Compare against original spec
4. **Performance** - Bottlenecks, N+1 queries, unbounded loops
5. **Error Messages** - Helpful and user-friendly?
6. **Documentation** - Functions documented? README complete?
7. **Dependencies** - All packages real and necessary?
8. **Cross-platform** - Works on Win/macOS/Linux?

Fix everything. Show corrected code.

End with: \`STATUS: FINAL_AUDIT COMPLETE\``
        },
        {
            id: 'features', label: 'Features', cat: 'pipeline',
            prompt: `AUTOPILOT: **FEATURE ENHANCEMENT**

Add polish:
1. Edge cases not yet handled
2. UX/DX improvements - progress bars, colors, formatting
3. Configuration - make hardcoded values configurable
4. Logging - structured with levels
5. Help/usage - --help, usage examples
6. Graceful degradation - missing deps, network failures
7. Performance - caching, lazy loading where applicable

Implement all with complete code.

End with: \`STATUS: FEATURES COMPLETE\``
        },
        {
            id: 'branding', label: 'Branding', cat: 'pipeline',
            prompt: `AUTOPILOT: **BRANDING PHASE**

1. **Logo Prompt** - Detailed prompt for DALL-E 3 / Midjourney / Stable Diffusion to generate a professional logo
2. **Color Palette** - 5-6 hex codes with names and usage
3. **Tagline** - One-line project description
4. **Icon Concepts** - 2-3 favicon/app icon ideas
5. **ASCII Banner** - For CLI/README

End with: \`STATUS: BRANDING COMPLETE\``
        },
        {
            id: 'packaging', label: 'Packaging', cat: 'pipeline',
            prompt: `AUTOPILOT: **PACKAGING PHASE**

1. **Standalone Executable** - Best tool for language (PyInstaller/pkg/nexe/go build), build script, config, icon, metadata, one-command build
2. **Portable Executable** - No install, runs from USB, self-contained, portable config
3. **Build README** - Steps, prerequisites, troubleshooting
4. **Release Script** - Automated build + package + hash

End with: \`STATUS: PACKAGING COMPLETE\``
        },
        {
            id: 'summary', label: 'Summary', cat: 'pipeline',
            prompt: `AUTOPILOT: **FINAL SUMMARY**

1. **File Manifest** - Every file, purpose, path
2. **Quick Start** - 3 steps or fewer
3. **Full Setup** - All platforms
4. **Usage Guide** - Commands, flags, config, examples
5. **Build Guide** - Standalone + portable compilation
6. **Architecture Diagram** - ASCII component diagram
7. **Tech Stack** - Languages, frameworks, tools, versions
8. **Known Limitations** - Honest assessment
9. **Future Roadmap** - Suggested next features

End with: \`STATUS: PROJECT COMPLETE\``
        },
        { id: 'continue', label: 'Continue', cat: 'recovery', prompt: `CONTINUE - Your response was cut off. Pick up EXACTLY where you stopped. Do not repeat anything.` },
        { id: 'continue_ctx', label: 'Continue +Ctx', cat: 'recovery', prompt: `CONTINUE - Your response was cut off. Check the roadmap/plan above, find where you stopped, and continue from that exact point. Do not restart or repeat.` },
        { id: 'stuck', label: 'Stuck Recovery', cat: 'recovery', prompt: `AUTOPILOT RECOVERY: Your last response appears stuck or incomplete.\n\nPlease check the conversation above, identify where you left off, and CONTINUE from that point. Do not restart.\n\nEnd with the appropriate STATUS line when done.` },
        { id: 'next_phase', label: 'Next Phase', cat: 'recovery', prompt: `AUTOPILOT: Previous phase done. Build the NEXT phase from the plan. Complete, production-ready code.\n\nEnd with: \`STATUS: PHASE [N] COMPLETE\`` },
        {
            id: 'analyze', label: 'Analyze Chat', cat: 'resume',
            prompt: `AUTOPILOT: **RESUME MODE - PROJECT ANALYSIS**

Analyze the conversation above and determine:
1. **Project** - What is being built?
2. **Current State** - What has been completed?
3. **Files Created** - All code produced so far
4. **Last Phase** - What was last completed?
5. **Next Steps** - What needs building?
6. **Issues** - Incomplete code, broken refs, errors?

Provide numbered remaining phases.

End with: \`STATUS: ANALYSIS COMPLETE\``
        },
        { id: 'resume_build', label: 'Resume Build', cat: 'resume', prompt: `AUTOPILOT: **RESUMING BUILD**\n\nContinue building from where the project left off. Build the next incomplete phase.\n\nWrite complete, production-ready code. NO placeholders. All imports, error handling.\n\nEnd with: \`STATUS: PHASE COMPLETE\`` },
        { id: 'custom1', label: 'Custom 1', cat: 'custom', prompt: '' },
        { id: 'custom2', label: 'Custom 2', cat: 'custom', prompt: '' },
        { id: 'custom3', label: 'Custom 3', cat: 'custom', prompt: '' },
        { id: 'custom4', label: 'Custom 4', cat: 'custom', prompt: '' },
    ];

    const CATEGORIES = [
        { id: 'pipeline', label: 'Build Pipeline', color: '#58a6ff' },
        { id: 'recovery', label: 'Recovery', color: '#d29922' },
        { id: 'resume',   label: 'Resume Project', color: '#bc8cff' },
        { id: 'custom',   label: 'Custom', color: '#3fb950' },
    ];

    // ---- State ----
    const state = { prompts: [], genStatus: 'idle', lastResponse: '', logs: [], editingId: null, genStartTime: null, lastResponseMs: 0, lastResponseWords: 0, lastResponseChars: 0 };

    // ---- Sidebar State ----
    let sidebarOpen = false;
    let sidebarLocked = false;
    let hoverOpenTimer = null;
    let hoverCloseTimer = null;

    // ---- Context Tracker ----
    const ctx = {
        chatStartTime: null, turns: 0, userMsgCount: 0, assistantMsgCount: 0,
        estimatedTokens: 0, sseUtilization: null, sseExpiry: null, lastSseData: null,
        lastEstimateTime: 0, history: [],
    };

    // ---- Persistence ----
    function loadPrompts() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                state.prompts = DEFAULT_PROMPTS.map(def => {
                    const s = parsed.find(p => p.id === def.id);
                    return s ? { ...def, label: s.label, prompt: s.prompt } : { ...def };
                });
                parsed.forEach(p => { if (!state.prompts.find(x => x.id === p.id)) state.prompts.push(p); });
                return;
            }
        } catch (e) { /* ignore */ }
        state.prompts = DEFAULT_PROMPTS.map(d => ({ ...d }));
    }
    function savePrompts() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prompts.map(p => ({ id: p.id, label: p.label, prompt: p.prompt, cat: p.cat })))); } catch (e) { /* ignore */ }
    }
    function loadLock() {
        try { sidebarLocked = localStorage.getItem(LOCK_KEY) === 'true'; } catch (e) { /* ignore */ }
    }
    function saveLock() {
        try { localStorage.setItem(LOCK_KEY, sidebarLocked ? 'true' : 'false'); } catch (e) { /* ignore */ }
    }

    // ---- Utilities ----
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function ts() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }
    function fmtDur(ms) { const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return h > 0 ? h + 'h ' + (m % 60) + 'm' : m > 0 ? m + 'm' : Math.floor(ms / 1000) + 's'; }

    // ---- Notification: Sound ----
    let audioCtx = null;
    function playNotificationSound() {
        if (!CONFIG.notifySound) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            // Two-tone chime: short rising beep
            const now = audioCtx.currentTime;
            [660, 880].forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine'; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.12, now + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.25);
            });
        } catch (e) { /* AudioContext not available */ }
    }

    // ---- Notification: Tab Flash ----
    let flashTimer = null, originalTitle = '';
    function flashTabTitle(msg) {
        if (!CONFIG.notifyFlash || document.hasFocus()) return;
        stopFlashTitle();
        originalTitle = document.title;
        let on = true;
        flashTimer = setInterval(() => { document.title = on ? msg : originalTitle; on = !on; }, 800);
        // Stop flashing when window regains focus
        const stopOnFocus = () => { stopFlashTitle(); window.removeEventListener('focus', stopOnFocus); };
        window.addEventListener('focus', stopOnFocus);
        // Auto-stop after 30s
        setTimeout(stopFlashTitle, 30000);
    }
    function stopFlashTitle() {
        if (flashTimer) { clearInterval(flashTimer); flashTimer = null; if (originalTitle) document.title = originalTitle; }
    }

    // ---- Response Timer ----
    let timerInterval = null;
    function startResponseTimer() {
        state.genStartTime = Date.now();
        stopResponseTimer();
        timerInterval = setInterval(refreshTimerDisplay, 200);
        refreshTimerDisplay();
    }
    function stopResponseTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
    function refreshTimerDisplay() {
        const el = document.getElementById('cpd-timer');
        if (!el) return;
        if (state.genStartTime && state.genStatus === 'generating') {
            const elapsed = ((Date.now() - state.genStartTime) / 1000).toFixed(1);
            el.textContent = elapsed + 's';
            el.style.color = '#d29922';
        } else if (state.lastResponseMs > 0) {
            el.textContent = (state.lastResponseMs / 1000).toFixed(1) + 's';
            el.style.color = '#3fb950';
        } else {
            el.textContent = '--';
            el.style.color = '#484f58';
        }
    }

    // ---- Response Stats ----
    function computeResponseStats(text) {
        if (!text) { state.lastResponseWords = 0; state.lastResponseChars = 0; return; }
        state.lastResponseChars = text.length;
        state.lastResponseWords = text.split(/\s+/).filter(w => w.length > 0).length;
    }
    function refreshResponseStats() {
        const el = document.getElementById('cpd-resp-stats');
        if (!el) return;
        if (state.lastResponseWords > 0) {
            el.textContent = fmtNum(state.lastResponseWords) + 'w / ' + fmtNum(state.lastResponseChars) + 'c';
            el.style.color = '#8b949e';
        } else {
            el.textContent = '';
        }
    }

    // ---- Copy Last Response ----
    function copyLastResponse() {
        const text = DOM.getLastResponse();
        if (!text) { log('No response to copy', 'warn'); return; }
        navigator.clipboard.writeText(text).then(() => {
            log('Copied last response (' + text.split(/\s+/).length + ' words)', 'success');
            const btn = document.getElementById('cpd-copy-resp');
            if (btn) { btn.textContent = 'OK!'; btn.style.color = '#3fb950'; setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 1200); }
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea'); ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            log('Copied last response (fallback)', 'success');
            const btn = document.getElementById('cpd-copy-resp');
            if (btn) { btn.textContent = 'OK!'; btn.style.color = '#3fb950'; setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 1200); }
        });
    }

    // ---- Quick Export ----
    function exportChatMarkdown() {
        const main = document.querySelector('main');
        if (!main) { log('No conversation to export', 'warn'); return; }
        const groups = main.querySelectorAll(SEL.msgGroup);
        if (groups.length === 0) { log('No messages found', 'warn'); return; }
        let md = '# Claude Conversation Export\n_Exported: ' + new Date().toISOString() + '_\n\n---\n\n';
        groups.forEach((g, i) => {
            const isUser = !!g.querySelector(SEL.userMsg);
            const role = isUser ? 'Human' : 'Assistant';
            const text = g.innerText.trim();
            if (text) md += '## ' + role + '\n\n' + text + '\n\n---\n\n';
        });
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'claude-chat-' + new Date().toISOString().slice(0, 10) + '.md';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log('Exported conversation as markdown', 'success');
    }

    function log(msg, level = 'info') {
        state.logs.push({ time: ts(), msg, level });
        if (state.logs.length > 400) state.logs.shift();
        const c = { info: '#8b949e', success: '#3fb950', warn: '#d29922', error: '#f85149', action: '#58a6ff' };
        console.log(`%c[PromptDeck ${ts()}] ${msg}`, `color:${c[level] || c.info}`);
        refreshLog();
    }

    // ---- Token Estimation ----
    function estimateTokens(text) {
        if (!text) return 0;
        const charEst = Math.ceil(text.length / CONFIG.charsPerToken);
        const wordEst = Math.ceil(text.split(/\s+/).filter(w => w).length * 1.3);
        return Math.max(charEst, wordEst);
    }
    function countConversationMetrics() {
        const main = document.querySelector('main') || document.querySelector('[class*="conversation"]');
        if (!main) return;
        const userMsgs = main.querySelectorAll(SEL.userMsg);
        const allGroups = main.querySelectorAll(SEL.msgGroup);
        let ac = 0; allGroups.forEach(g => { if (!g.querySelector(SEL.userMsg)) ac++; });
        ctx.userMsgCount = userMsgs.length; ctx.assistantMsgCount = ac;
        ctx.turns = Math.min(userMsgs.length, ac);
        if (ctx.turns > 0 && !ctx.chatStartTime) ctx.chatStartTime = Date.now();
        ctx.estimatedTokens = estimateTokens(main.innerText || '');
        ctx.lastEstimateTime = Date.now();
        const lastPt = ctx.history[ctx.history.length - 1];
        if (!lastPt || Date.now() - lastPt.time > 30000) {
            ctx.history.push({ time: Date.now(), tokens: ctx.estimatedTokens, turns: ctx.turns });
            if (ctx.history.length > 120) ctx.history.shift();
        }
    }
    function getContextFill() { return ctx.sseUtilization !== null ? ctx.sseUtilization : ctx.estimatedTokens / CONFIG.contextWindow; }
    function getBurnRate() {
        if (ctx.history.length < 2) return 0;
        const now = Date.now(), recent = ctx.history.filter(h => now - h.time < 300000);
        if (recent.length < 2) return 0;
        const dt = (recent[recent.length - 1].time - recent[0].time) / 60000;
        return dt < 0.5 ? 0 : Math.round((recent[recent.length - 1].tokens - recent[0].tokens) / dt);
    }
    function getTimeToFull() {
        const rate = getBurnRate(); if (rate <= 0) return null;
        const remaining = (CONFIG.newChatThreshold - getContextFill()) * CONFIG.contextWindow;
        return remaining <= 0 ? 0 : remaining / rate;
    }
    function getContextHealth() {
        const fill = getContextFill(), turns = ctx.turns, ttf = getTimeToFull();
        let score = 100;
        if (fill > CONFIG.newChatThreshold) score -= 60; else if (fill > CONFIG.criticalThreshold) score -= 40; else if (fill > CONFIG.warnThreshold) score -= 20;
        if (turns > CONFIG.qualityDegradeTurns * 2) score -= 30; else if (turns > CONFIG.qualityDegradeTurns) score -= 15; else if (turns > CONFIG.qualityDegradeTurns * 0.6) score -= 5;
        if (ttf !== null && ttf < 5) score -= 15; else if (ttf !== null && ttf < 15) score -= 5;
        score = Math.max(0, Math.min(100, score));
        let level, label, advice;
        if (score >= 70) { level = 'good'; label = 'Good'; advice = 'Context is healthy'; }
        else if (score >= 40) { level = 'warn'; label = 'Caution'; advice = 'Consider wrapping up soon'; }
        else if (score >= 15) { level = 'critical'; label = 'Critical'; advice = 'Start a new chat soon'; }
        else { level = 'danger'; label = 'New Chat'; advice = 'Start a new chat now'; }
        return { score, level, label, advice, fill, turns, ttf };
    }

    // ---- Fetch Interceptor (SSE) ----
    function setupFetchInterceptor() {
        const origFetch = window.fetch;
        window.fetch = async function (...args) {
            const response = await origFetch.apply(this, args);
            try {
                const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
                if (url.includes('/completion') || url.includes('/chat_conversations')) {
                    const ct = response.headers.get('content-type') || '';
                    if (ct.includes('text/event-stream')) readSSEStream(response.clone()).catch(() => {});
                }
            } catch (e) { /* never break app */ }
            return response;
        };
        log('Fetch interceptor active', 'info');
    }
    async function readSSEStream(response) {
        try {
            const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
            while (true) {
                const { done, value } = await reader.read(); if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n'); buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const j = line.substring(6).trim(); if (!j || j === '[DONE]') continue;
                    try { processSSEData(JSON.parse(j)); } catch (e) { /* skip */ }
                }
            }
        } catch (e) { /* stream error */ }
    }
    function processSSEData(data) {
        if (data.message_limit !== undefined) { ctx.lastSseData = data.message_limit; if (typeof data.message_limit === 'object' && data.message_limit.remaining !== undefined) { log(`SSE: ${data.message_limit.remaining} msgs remaining`, 'info'); ctx.sseExpiry = { remaining: data.message_limit.remaining, resetsAt: data.message_limit.resets_at || data.message_limit.resetsAt }; } }
        if (data.utilization !== undefined && typeof data.utilization === 'number') { ctx.sseUtilization = data.utilization; log(`SSE utilization: ${(data.utilization * 100).toFixed(1)}%`, 'info'); }
        if (data.usage) { const u = data.usage, total = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); if (total > 0) { ctx.sseUtilization = total / CONFIG.contextWindow; log(`SSE tokens: ${fmtNum(total)} (${(ctx.sseUtilization * 100).toFixed(1)}%)`, 'info'); } }
        if (data.type === 'message_limit' && data.message_limit?.type === 'within_limit') { ctx.sseExpiry = { remaining: data.message_limit.remaining, resetsAt: data.message_limit.resets_at || data.message_limit.resetsAt }; }
        if (data.rate_limit) { ctx.sseExpiry = { remaining: data.rate_limit.remaining, resetsAt: data.rate_limit.resets_at }; }
    }

    // ---- Auto-Scroll ----
    let scrollObs = null, scrollTmr = null;
    function scrollToBottom() {
        for (const el of [document.querySelector('main'), document.querySelector('[class*="overflow-y"]'), document.querySelector('[class*="scroll"]')].filter(Boolean)) {
            if (el.scrollHeight > el.clientHeight) { el.scrollTop = el.scrollHeight; return; }
        }
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    }
    function setupAutoScroll() {
        if (scrollObs) scrollObs.disconnect();
        scrollObs = new MutationObserver(() => { if (!CONFIG.autoScroll) return; clearTimeout(scrollTmr); scrollTmr = setTimeout(scrollToBottom, CONFIG.scrollDebounce); });
        scrollObs.observe(document.querySelector('main') || document.body, { childList: true, subtree: true, characterData: true });
    }

    // ---- Auto-Approve ----
    let approveObs = null;
    function setupAutoApprove() {
        if (approveObs) approveObs.disconnect();
        approveObs = new MutationObserver(() => {
            if (!CONFIG.autoApprove) return;
            const dlg = document.querySelector(SEL.dialogOpen) || document.querySelector(SEL.dialog); if (!dlg) return;
            for (const btn of dlg.querySelectorAll('button')) {
                const t = btn.textContent.toLowerCase().trim();
                if (t.includes('allow for this chat') || t.includes('allow once') || t.includes('allow always')) { log(`Auto-approved: "${btn.textContent.trim()}"`, 'action'); btn.click(); return; }
            }
        });
        approveObs.observe(document.body, { childList: true, subtree: true });
    }

    // ---- DOM Interface ----
    const DOM = {
        find(sel, ...fb) { for (const s of [sel, ...fb]) { const el = document.querySelector(s); if (el) return el; } return null; },
        getEditor()     { return this.find(SEL.editor, SEL.editorAlt); },
        getSendButton() { return this.find(SEL.sendBtn, SEL.sendBtnAlt); },
        getStopButton() { return this.find(SEL.stopBtn, SEL.stopBtnAlt); },
        isGenerating() {
            const stop = this.getStopButton(); if (stop && stop.offsetParent !== null) return true;
            const send = this.getSendButton(); if (send && !send.disabled && send.offsetParent !== null) return false;
            return !!document.querySelector(SEL.streaming);
        },
        async typeMessage(text) {
            const pm = this.getEditor(); if (!pm) throw new Error('Editor not found');
            const editor = pm.editor;
            if (editor?.chain) { try { editor.chain().focus().clearContent().insertContent({ type: 'paragraph', content: [{ type: 'text', text }] }).run(); await sleep(CONFIG.typingDelay); return; } catch (e) { /* fb */ } }
            try { pm.focus(); document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); document.execCommand('insertText', false, text); await sleep(CONFIG.typingDelay); return; } catch (e) { /* fb */ }
            pm.focus(); const p = document.createElement('p'); p.textContent = text; pm.innerHTML = ''; pm.appendChild(p); pm.dispatchEvent(new Event('input', { bubbles: true })); await sleep(CONFIG.typingDelay);
        },
        async sendMessage(text) {
            await this.typeMessage(text); await sleep(500);
            const btn = this.getSendButton(); if (btn && !btn.disabled) { btn.click(); return; }
            const pm = this.getEditor(); if (pm) { pm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); return; }
            throw new Error('Cannot send');
        },
        getLastResponse() {
            const groups = document.querySelectorAll(SEL.msgGroup);
            for (let i = groups.length - 1; i >= 0; i--) { if (!groups[i].querySelector(SEL.userMsg)) return groups[i].innerText.trim(); }
            return '';
        },
    };

    // ---- Monitor ----
    let monitorInterval = null, lastConvoLen = 0, lastChangeTs = Date.now(), stableCount = 0;
    function startMonitor() {
        if (monitorInterval) return;
        monitorInterval = setInterval(() => {
            const gen = DOM.isGenerating();
            const convo = (document.querySelector('main') || document.body).innerText;
            const now = Date.now();
            if (convo.length !== lastConvoLen) { lastConvoLen = convo.length; lastChangeTs = now; stableCount = 0; } else { stableCount++; }
            const wasGen = state.genStatus === 'generating';
            if (gen) {
                if (state.genStatus !== 'generating') startResponseTimer();
                state.genStatus = 'generating';
                if (CONFIG.autoScroll) scrollToBottom();
                if (now - lastChangeTs > CONFIG.stuckTimeout) state.genStatus = 'stuck';
            }
            else if (wasGen && stableCount >= 2) {
                const resp = DOM.getLastResponse(); state.lastResponse = resp;
                // Timer + stats
                state.lastResponseMs = state.genStartTime ? Date.now() - state.genStartTime : 0;
                stopResponseTimer();
                computeResponseStats(resp);
                refreshTimerDisplay();
                refreshResponseStats();
                state.genStatus = isResponseTruncated(resp) ? 'truncated' : 'complete';
                if (CONFIG.autoScroll) scrollToBottom();
                if (state.genStatus === 'truncated') log('Response appears truncated', 'warn');
                else {
                    const dur = (state.lastResponseMs / 1000).toFixed(1);
                    log('Response complete (' + dur + 's, ' + state.lastResponseWords + 'w)', 'success');
                }
                countConversationMetrics();
                // Notifications
                playNotificationSound();
                flashTabTitle('>> Claude Done <<');
            } else if (!gen && state.genStatus !== 'truncated' && state.genStatus !== 'complete') { state.genStatus = 'idle'; }
            refreshGenStatus(); refreshContextUI();
        }, CONFIG.pollInterval);
    }
    function isResponseTruncated(text) {
        if (!text || text.length < 50) return false; const t = text.trim();
        if ((t.match(/```/g) || []).length % 2 !== 0) return true;
        const tail = t.toLowerCase().slice(-300);
        for (const s of ['continue to keep the chat going', 'response was cut off', 'character limit', 'length limit', 'hit the limit']) { if (tail.includes(s)) return true; }
        const ll = t.split('\n').filter(l => l.trim()).pop() || '';
        if (!/[.!?:)`}\]>]$|COMPLETE$/i.test(ll.trim()) && !/[{;=,]$/.test(ll.trim()) && ll.length > 30) return true;
        return false;
    }

    // ---- Sidebar Open/Close ----
    function openSidebar() {
        if (sidebarOpen) return;
        sidebarOpen = true;
        clearTimeout(hoverCloseTimer);
        const p = document.getElementById('cpd');
        if (p) p.classList.add('open');
    }
    function closeSidebar() {
        if (!sidebarOpen || sidebarLocked) return;
        sidebarOpen = false;
        const p = document.getElementById('cpd');
        if (p) p.classList.remove('open');
    }
    function toggleLock() {
        sidebarLocked = !sidebarLocked;
        saveLock();
        const btn = document.getElementById('cpd-lock');
        if (btn) {
            btn.classList.toggle('locked', sidebarLocked);
            btn.title = sidebarLocked ? 'Unlock sidebar (auto-hide)' : 'Lock sidebar open';
        }
        if (sidebarLocked) openSidebar();
        else closeSidebar();
        log(sidebarLocked ? 'Sidebar locked open' : 'Sidebar unlocked', 'info');
    }

    function updateHandleLockState() {
        const handle = document.getElementById('cpd-handle');
        const lockBtn = document.getElementById('cpd-lock');
        if (handle) handle.classList.toggle('handle-locked', sidebarLocked);
        if (lockBtn) lockBtn.innerHTML = '<span class="cpd-lock-icon">' + (sidebarLocked ? '\uD83D\uDD12' : '\uD83D\uDD13') + '</span>';
    }

    // ---- Code Block Scanner ----

    // Extract code text with line numbers stripped
    function extractCleanCode(el) {
        // Clone so we don't mutate the live DOM
        const clone = el.cloneNode(true);

        // Remove elements that are line numbers (by class or role)
        const lineNumSelectors = [
            '[class*="line-number"]', '[class*="linenumber"]', '[class*="line-num"]',
            '[class*="LineNumber"]', '[class*="ln-num"]', '[class*="hljs-ln-n"]',
            '[class*="gutter"]', '[class*="Gutter"]',
            '[class*="line-numbers-row"]', '[class*="line-count"]',
            'td.hljs-ln-numbers', '.hljs-ln-numbers',
            '[data-line-number]', '[aria-hidden="true"]',
        ].join(',');
        try {
            clone.querySelectorAll(lineNumSelectors).forEach(n => n.remove());
        } catch (e) { /* selector issue */ }

        // If there's a table layout (hljs-ln pattern), only keep code cells
        const codeCells = clone.querySelectorAll('td.hljs-ln-code, td[class*="code"], td:last-child');
        if (codeCells.length > 0) {
            const lines = [];
            codeCells.forEach(td => lines.push(td.textContent || ''));
            const joined = lines.join('\n').trim();
            if (joined.length >= 10) return joined;
        }

        let text = clone.innerText || clone.textContent || '';

        // Regex fallback: strip leading line numbers (patterns like "1 ", "  12 ", " 123\t")
        // Only if most lines start with a number pattern (to avoid false positives)
        const rawLines = text.split('\n');
        const numPattern = /^\s*\d{1,5}[\s\t]/;
        const matchCount = rawLines.filter(l => l.trim() && numPattern.test(l)).length;
        const nonEmptyCount = rawLines.filter(l => l.trim()).length;
        if (nonEmptyCount > 2 && matchCount / nonEmptyCount > 0.7) {
            // Check if numbers are sequential (confirms they're line numbers, not code)
            let sequential = 0;
            let lastNum = 0;
            for (const line of rawLines) {
                const m = line.match(/^\s*(\d{1,5})[\s\t]/);
                if (m) {
                    const n = parseInt(m[1], 10);
                    if (n === lastNum + 1) sequential++;
                    lastNum = n;
                }
            }
            if (sequential >= Math.min(nonEmptyCount - 2, 3)) {
                text = rawLines.map(l => l.replace(/^\s*\d{1,5}[\s\t]/, '')).join('\n');
            }
        }

        return text.trim();
    }

    function scanCodeBlocks() {
        const blocks = [];
        const seen = new Set();

        function addBlock(el, text, source) {
            const t = (text || extractCleanCode(el)).trim();
            if (t.length < 10 || seen.has(t)) return;
            seen.add(t);
            // Detect language
            let lang = 'code';
            // Check code element classes
            const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code');
            if (codeEl) {
                for (const cls of codeEl.classList) {
                    const m = cls.match(/^(?:language-|lang-|hljs-)(.+)$/);
                    if (m) { lang = m[1]; break; }
                }
            }
            // Check parent/ancestor for language hints
            const wrapper = el.closest('[class*="code"]') || el.closest('[data-language]');
            if (wrapper) {
                const dl = wrapper.getAttribute('data-language');
                if (dl) lang = dl;
                // Look for a language label element inside wrapper (Claude shows language name in a header)
                const labelEl = wrapper.querySelector('[class*="text-text-"]') || wrapper.querySelector('span');
                if (labelEl && labelEl.textContent.trim().length < 20 && !labelEl.textContent.includes(' ')) {
                    const candidate = labelEl.textContent.trim().toLowerCase();
                    if (candidate && /^[a-z0-9#+._-]+$/i.test(candidate)) lang = candidate;
                }
            }
            // Check preceding sibling for language label
            const prev = el.previousElementSibling || (el.parentElement && el.parentElement.previousElementSibling);
            if (prev && prev.textContent && prev.textContent.trim().length < 25) {
                const ht = prev.textContent.trim().toLowerCase();
                if (ht && /^[a-z0-9#+._-]+$/i.test(ht) && !ht.includes(' ')) lang = ht;
            }
            const lines = t.split('\n').length;
            const preview = t.split('\n').slice(0, 2).join(' ').substring(0, 55);
            blocks.push({ idx: blocks.length, lang, lines, preview, text: t, el, source });
        }

        // Strategy 1: All <pre> elements anywhere in document (most common code container)
        document.querySelectorAll('pre').forEach(pre => {
            if (pre.closest('#cpd')) return;
            const code = pre.querySelector('code') || pre;
            addBlock(code, null, 'pre');
        });

        // Strategy 2: Multi-line <code> elements not inside <pre>
        document.querySelectorAll('code').forEach(code => {
            if (code.closest('#cpd') || code.closest('pre')) return;
            const raw = code.innerText || code.textContent || '';
            if (raw.includes('\n') && raw.trim().length >= 10) addBlock(code, null, 'code');
        });

        // Strategy 3: Elements with code-related classes/attributes
        const codeSelectors = [
            '[class*="code-block"]', '[class*="code_block"]', '[class*="codeblock"]',
            '[class*="CodeBlock"]', '[class*="code-content"]', '[class*="hljs"]',
            '[class*="shiki"]', '[class*="prism"]', '[class*="highlight"]',
            '[data-code]', '[data-language]',
        ].join(',');
        try {
            document.querySelectorAll(codeSelectors).forEach(el => {
                if (el.closest('#cpd')) return;
                if (el.querySelector('pre') || el.closest('pre')) return; // caught by strategy 1
                const text = el.innerText || el.textContent || '';
                if (text.includes('\n') && text.trim().length >= 10) addBlock(el, null, 'class');
            });
        } catch (e) { /* invalid selector on some browsers */ }

        // Strategy 4: Find Claude's copy buttons and trace back to their code containers
        document.querySelectorAll('button').forEach(btn => {
            if (btn.closest('#cpd')) return;
            const txt = (btn.textContent || '').toLowerCase().trim();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (txt === 'copy' || txt === 'copy code' || ariaLabel.includes('copy')) {
                // Walk up to find the code container
                let container = btn.closest('[class*="code"]') || btn.closest('[class*="Code"]') || btn.parentElement?.parentElement;
                if (!container) return;
                const pre = container.querySelector('pre');
                const code = container.querySelector('code');
                const target = pre || code || container;
                const text = target.innerText || target.textContent || '';
                if (text.trim().length >= 10) addBlock(target, null, 'copy-btn');
            }
        });

        if (blocks.length === 0) {
            // Debug: log what we can see
            const allPre = document.querySelectorAll('pre');
            const allCode = document.querySelectorAll('code');
            log(`Code scan: 0 blocks. DOM has ${allPre.length} <pre>, ${allCode.length} <code>, main=${!!document.querySelector('main')}`, 'warn');
        }
        return blocks;
    }

    function refreshCodeBlocks() {
        const container = document.getElementById('cpd-codeblocks');
        if (!container) return;
        const blocks = scanCodeBlocks();
        const cnt = document.getElementById('cpd-cb-count');
        if (cnt) cnt.textContent = blocks.length > 0 ? '(' + blocks.length + ')' : '';
        if (blocks.length === 0) {
            container.innerHTML = '<div style="color:#484f58;font-size:10px;padding:4px 0;text-align:center">No code blocks detected</div>';
            return;
        }
        const shown = blocks.slice().reverse().slice(0, 20);
        container.innerHTML = '';
        shown.forEach(b => {
            const row = mkEl('div', 'cpd-cb-row');
            const info = mkEl('div', 'cpd-cb-info');
            const langSpan = mkEl('span', 'cpd-cb-lang'); langSpan.textContent = b.lang;
            const lineSpan = mkEl('span', 'cpd-cb-lines'); lineSpan.textContent = b.lines + 'L';
            const prevSpan = mkEl('span', 'cpd-cb-preview'); prevSpan.textContent = b.preview;
            info.appendChild(langSpan); info.appendChild(lineSpan); info.appendChild(prevSpan);
            const copyBtn = mkEl('button', 'cpd-cb-copy'); copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(b.text).then(() => {
                    copyBtn.textContent = 'OK!'; copyBtn.classList.add('copied');
                    setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1200);
                    log(`Copied ${b.lang} (${b.lines}L) via ${b.source}`, 'success');
                }).catch(() => {
                    const ta = document.createElement('textarea'); ta.value = b.text;
                    ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta);
                    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                    copyBtn.textContent = 'OK!'; copyBtn.classList.add('copied');
                    setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1200);
                    log(`Copied ${b.lang} (${b.lines}L) via ${b.source}`, 'success');
                });
            });
            row.addEventListener('click', () => { b.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
            row.title = `Click to scroll \u2022 ${b.lang} \u2022 ${b.lines} lines \u2022 found via: ${b.source}`;
            row.appendChild(info); row.appendChild(copyBtn);
            container.appendChild(row);
        });
    }

    // ---- Send Prompt (with auto-retract) ----
    async function sendPrompt(promptObj) {
        const text = promptObj.prompt.trim();
        if (!text) { log(`"${promptObj.label}" is empty`, 'warn'); return; }
        try {
            log(`Sending "${promptObj.label}": ${text.length > 80 ? text.substring(0, 80) + '...' : text}`, 'action');
            state.genStatus = 'idle'; lastChangeTs = Date.now(); stableCount = 0;
            await DOM.sendMessage(text);
            if (CONFIG.autoScroll) setTimeout(scrollToBottom, 500);
            // Auto-retract if not locked
            if (!sidebarLocked) setTimeout(closeSidebar, CONFIG.retractDelay);
        } catch (e) { log(`Send failed: ${e.message}`, 'error'); }
    }

    // ============================================================
    //  UI
    // ============================================================
    let panel = null;

    function injectStyles() {
        const s = document.createElement('style');
        s.textContent = `
/* ---- Sidebar panel ---- */
#cpd{position:fixed;top:0;right:0;width:33.333vw;min-width:340px;max-width:520px;height:100vh;background:#0d1117;border-left:1px solid #30363d;box-shadow:-4px 0 24px rgba(0,0,0,.5);font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;color:#e6edf3;z-index:99999;display:flex;flex-direction:column;user-select:none;
  transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1)}
#cpd.open{transform:translateX(0)}

/* ---- Handle ---- */
#cpd-handle{position:absolute;top:0;left:-28px;width:28px;height:100%;z-index:1;cursor:pointer;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(90deg,rgba(13,17,23,.7) 0%,#161b22 100%);border:1px solid #30363d;border-right:none;border-radius:8px 0 0 8px;transition:background .2s,width .2s,left .2s}
#cpd-handle:hover{background:linear-gradient(90deg,rgba(22,27,34,.95) 0%,#1c2128 100%);width:32px;left:-32px}
#cpd-handle:active{background:#1f6feb}
#cpd-handle-grip{display:flex;flex-direction:column;align-items:center;gap:3px;opacity:.5;transition:opacity .2s}
#cpd-handle:hover #cpd-handle-grip{opacity:1}
#cpd-handle-grip span{display:block;width:4px;height:4px;border-radius:50%;background:#58a6ff}
#cpd-handle-label{position:absolute;font-size:11px;font-weight:700;color:#58a6ff;letter-spacing:1px;writing-mode:vertical-lr;text-orientation:mixed;opacity:0;transition:opacity .25s;pointer-events:none;text-transform:uppercase}
#cpd-handle:hover #cpd-handle-label{opacity:.8}
#cpd-handle.handle-locked{background:linear-gradient(90deg,#0d1f0d 0%,#112211 100%);border-color:#238636}
#cpd-handle.handle-locked #cpd-handle-grip span{background:#3fb950}
#cpd-handle.handle-locked #cpd-handle-label{color:#3fb950}

/* ---- Header ---- */
.cpd-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0}
.cpd-hdr-l{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}
.cpd-dot{width:8px;height:8px;border-radius:50%;background:#484f58;transition:background .3s;flex-shrink:0}
.cpd-dot.gen{background:#d29922;animation:cpd-blink 1s infinite}.cpd-dot.ok{background:#3fb950}.cpd-dot.trunc{background:#f85149;animation:cpd-blink .5s infinite}.cpd-dot.stuck{background:#f85149}
@keyframes cpd-blink{0%,100%{opacity:1}50%{opacity:.3}}
.cpd-hdr-r{display:flex;align-items:center;gap:6px}
.cpd-hdr-r span{font-size:10px;color:#8b949e}
.cpd-lock{background:none;border:1px solid #30363d;color:#8b949e;cursor:pointer;font-size:12px;padding:2px 5px;line-height:1;border-radius:4px;transition:all .15s;display:flex;align-items:center;gap:3px}
.cpd-lock:hover{color:#e6edf3;border-color:#58a6ff}
.cpd-lock.locked{color:#3fb950;border-color:#238636;background:#0d1f0d}
.cpd-lock-icon{font-size:12px}

/* ---- Body ---- */
.cpd-body{padding:6px 10px;display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1;min-height:0}
.cpd-body::-webkit-scrollbar{width:5px}.cpd-body::-webkit-scrollbar-track{background:transparent}.cpd-body::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}.cpd-body::-webkit-scrollbar-thumb:hover{background:#484f58}

/* ---- Code Blocks (top priority) ---- */
.cpd-cb-refresh{background:none;border:none;color:#8b949e;cursor:pointer;font-size:13px;padding:0 3px;line-height:1;transition:color .15s}
.cpd-cb-refresh:hover{color:#58a6ff}
.cpd-cb-container{display:flex;flex-direction:column;gap:3px;max-height:30vh;overflow-y:auto;padding:2px 0}
.cpd-cat.collapsed .cpd-cb-container{display:none}
.cpd-cb-container::-webkit-scrollbar{width:4px}.cpd-cb-container::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
.cpd-cb-row{display:flex;align-items:center;gap:5px;padding:4px 7px;background:#161b22;border:1px solid #30363d;border-radius:4px;cursor:pointer;transition:border-color .12s}
.cpd-cb-row:hover{border-color:#58a6ff}
.cpd-cb-info{flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.cpd-cb-lang{font-size:9px;font-weight:700;color:#f0883e;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.cpd-cb-lines{font-size:9px;color:#484f58;flex-shrink:0}
.cpd-cb-preview{font-size:9px;color:#8b949e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Cascadia Code','Fira Code','Consolas',monospace}
.cpd-cb-copy{padding:3px 8px;font-size:9px;font-weight:700;color:#e6edf3;background:#21262d;border:1px solid #30363d;border-radius:3px;cursor:pointer;white-space:nowrap;transition:all .12s;flex-shrink:0;font-family:inherit}
.cpd-cb-copy:hover{background:#1f6feb;border-color:#1f6feb;color:#fff}
.cpd-cb-copy.copied{background:#238636;border-color:#2ea043;color:#fff}

/* ---- Context ---- */
.cpd-ctx{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.cpd-ctx-row{display:flex;align-items:center;justify-content:space-between;font-size:10px}
.cpd-ctx-lbl{color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.5px;font-size:9px}
.cpd-ctx-val{font-weight:700;font-variant-numeric:tabular-nums;font-size:11px}
.cpd-ctx-bar{width:100%;height:6px;background:#21262d;border-radius:3px;overflow:hidden}
.cpd-ctx-fill{height:100%;border-radius:3px;transition:width .5s ease,background .5s ease;min-width:1px}
.cpd-ctx-fill.good{background:linear-gradient(90deg,#238636,#3fb950)}.cpd-ctx-fill.warn{background:linear-gradient(90deg,#9e6a03,#d29922)}.cpd-ctx-fill.critical{background:linear-gradient(90deg,#da3633,#f85149)}.cpd-ctx-fill.danger{background:linear-gradient(90deg,#da3633,#f85149);animation:cpd-blink 1s infinite}
.cpd-ctx-stats{display:flex;gap:4px;justify-content:space-between}
.cpd-ctx-stat{display:flex;flex-direction:column;align-items:center;gap:0;flex:1;min-width:40px}
.cpd-ctx-stat-v{font-size:12px;font-weight:700;color:#e6edf3;font-variant-numeric:tabular-nums;line-height:1.2}
.cpd-ctx-stat-k{font-size:8px;color:#484f58;text-transform:uppercase;letter-spacing:.3px}
.cpd-ctx-advice{font-size:10px;padding:3px 6px;border-radius:4px;text-align:center;font-weight:600}
.cpd-ctx-advice.good{background:#0d1f0d;color:#3fb950;border:1px solid #238636}
.cpd-ctx-advice.warn{background:#1c1500;color:#d29922;border:1px solid #9e6a03}
.cpd-ctx-advice.critical{background:#1f0d0d;color:#f85149;border:1px solid #da3633}
.cpd-ctx-advice.danger{background:#2d0d0d;color:#ff7b72;border:1px solid #f85149;animation:cpd-blink 1.5s infinite}

/* ---- Status bar ---- */
.cpd-stat{display:flex;align-items:center;gap:6px;padding:4px 8px;background:#161b22;border:1px solid #30363d;border-radius:4px;font-size:10px;color:#8b949e}
.cpd-stat-txt{flex:1}.cpd-stat-lbl{font-weight:700;text-transform:uppercase;letter-spacing:.5px}

/* ---- Toggles ---- */
.cpd-toggles{display:flex;gap:4px;flex-wrap:wrap}
.cpd-tog{display:flex;align-items:center;gap:4px;font-size:10px;color:#8b949e;cursor:pointer;padding:3px 7px;background:#161b22;border:1px solid #30363d;border-radius:4px;transition:all .15s}
.cpd-tog:hover{border-color:#58a6ff;color:#e6edf3}.cpd-tog.on{border-color:#238636;color:#3fb950}.cpd-tog input{display:none}

/* ---- Categories ---- */
.cpd-cat{margin-bottom:0}
.cpd-cat-hdr{display:flex;align-items:center;gap:5px;padding:3px 0;cursor:pointer;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#8b949e;user-select:none}
.cpd-cat-hdr:hover{color:#e6edf3}
.cpd-cat-arrow{transition:transform .2s;font-size:8px}
.cpd-cat.collapsed .cpd-cat-arrow{transform:rotate(-90deg)}.cpd-cat.collapsed .cpd-cat-btns{display:none}
.cpd-cat-line{flex:1;height:1px;background:#21262d}
.cpd-cat-btns{display:flex;flex-wrap:wrap;gap:3px;padding:2px 0}

/* ---- Buttons ---- */
.cpd-btn{display:flex;align-items:center;background:#161b22;border:1px solid #30363d;border-radius:4px;overflow:hidden;transition:all .12s;flex:0 0 auto}
.cpd-btn:hover{border-color:#58a6ff}
.cpd-btn-send{padding:3px 8px;font-size:11px;font-weight:600;color:#e6edf3;cursor:pointer;background:none;border:none;font-family:inherit;white-space:nowrap;transition:background .12s}
.cpd-btn-send:hover{background:#1f6feb;color:#fff}.cpd-btn-send:active{background:#1a5cc7}
.cpd-btn-edit{padding:3px 5px;font-size:10px;color:#484f58;cursor:pointer;background:none;border:none;border-left:1px solid #21262d;line-height:1;transition:color .12s}
.cpd-btn-edit:hover{color:#58a6ff}

/* ---- Editor overlay ---- */
.cpd-edit-overlay{position:absolute;inset:0;background:rgba(13,17,23,.97);z-index:10;display:flex;flex-direction:column;padding:12px}
.cpd-edit-top{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.cpd-edit-top input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#e6edf3;padding:5px 8px;font-size:12px;font-family:inherit;outline:none}
.cpd-edit-top input:focus{border-color:#58a6ff}
.cpd-edit-ta{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:5px;color:#e6edf3;padding:8px 10px;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:11px;resize:none;outline:none;line-height:1.4;min-height:0}
.cpd-edit-ta:focus{border-color:#58a6ff}
.cpd-edit-acts{display:flex;gap:5px;margin-top:8px}
.cpd-edit-acts button{padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #30363d;font-family:inherit;transition:all .12s}
.cpd-edit-save{background:#238636;border-color:#2ea043 !important;color:#fff}.cpd-edit-save:hover{background:#2ea043}
.cpd-edit-cancel{background:#161b22;color:#8b949e}.cpd-edit-cancel:hover{color:#e6edf3;border-color:#58a6ff}
.cpd-edit-reset{background:#161b22;color:#d29922;border-color:#d29922 !important;margin-left:auto}.cpd-edit-reset:hover{background:#1c2128}

/* ---- Manual input ---- */
.cpd-manual{display:flex;gap:4px}
.cpd-manual input{flex:1;background:#161b22;border:1px solid #30363d;border-radius:4px;color:#e6edf3;padding:4px 8px;font-size:11px;font-family:inherit;outline:none}
.cpd-manual input:focus{border-color:#58a6ff}
.cpd-manual button{padding:4px 10px;background:#21262d;border:1px solid #30363d;border-radius:4px;color:#8b949e;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600;transition:all .12s}
.cpd-manual button:hover{color:#e6edf3;border-color:#58a6ff}

/* ---- Log ---- */
.cpd-log{min-height:36px;max-height:80px;overflow-y:auto;background:#161b22;border:1px solid #30363d;border-radius:4px;padding:3px 6px;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:9px;line-height:1.4}
.cpd-log::-webkit-scrollbar{width:4px}.cpd-log::-webkit-scrollbar-track{background:transparent}.cpd-log::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
.cpd-le{white-space:pre-wrap;word-break:break-all}.cpd-lt{color:#484f58;margin-right:3px}
.l-info{color:#8b949e}.l-success{color:#3fb950}.l-warn{color:#d29922}.l-error{color:#f85149}.l-action{color:#58a6ff}

/* ---- Footer ---- */
.cpd-foot{padding:3px 10px;background:#161b22;border-top:1px solid #30363d;font-size:9px;color:#484f58;text-align:center;flex-shrink:0}

/* ---- Timer + Response Stats (header) ---- */
.cpd-timer{font-variant-numeric:tabular-nums;font-size:11px;font-weight:700;min-width:30px;text-align:right}
.cpd-resp-stats{font-size:9px;color:#484f58;font-variant-numeric:tabular-nums}
.cpd-hdr-meta{display:flex;align-items:center;gap:6px}

/* ---- Copy Response button ---- */
.cpd-copy-resp{background:none;border:1px solid #30363d;color:#8b949e;cursor:pointer;font-size:9px;font-weight:700;padding:2px 6px;line-height:1;border-radius:3px;transition:all .15s;white-space:nowrap;font-family:inherit}
.cpd-copy-resp:hover{color:#e6edf3;border-color:#58a6ff;background:#1f6feb22}
`;
        document.head.appendChild(s);
    }

    function buildPanel() {
        injectStyles();
        loadPrompts();
        loadLock();

        // ---- Main panel ----
        panel = document.createElement('div');
        panel.id = 'cpd';

        // ---- Handle (visible tab on left edge, always sticking out) ----
        const handle = document.createElement('div');
        handle.id = 'cpd-handle';
        handle.title = 'Open Prompt Deck';
        // Grip dots (visual indicator)
        const grip = document.createElement('div');
        grip.id = 'cpd-handle-grip';
        for (let i = 0; i < 7; i++) { grip.appendChild(document.createElement('span')); }
        handle.appendChild(grip);
        // Vertical label
        const handleLabel = document.createElement('div');
        handleLabel.id = 'cpd-handle-label';
        handleLabel.textContent = 'Deck';
        handle.appendChild(handleLabel);
        // Handle hover opens sidebar
        handle.addEventListener('mouseenter', () => {
            clearTimeout(hoverCloseTimer);
            hoverOpenTimer = setTimeout(openSidebar, CONFIG.hoverOpenDelay);
        });
        handle.addEventListener('mouseleave', () => { clearTimeout(hoverOpenTimer); });
        // Handle click = toggle lock
        handle.addEventListener('click', () => {
            if (!sidebarOpen) openSidebar();
            toggleLock();
            updateHandleLockState();
        });
        panel.appendChild(handle);

        // Keep open on hover over panel body
        panel.addEventListener('mouseenter', () => { clearTimeout(hoverCloseTimer); });
        panel.addEventListener('mouseleave', () => {
            if (sidebarLocked) return;
            clearTimeout(hoverCloseTimer);
            hoverCloseTimer = setTimeout(closeSidebar, CONFIG.hoverCloseDelay);
        });

        // ---- Header ----
        const hdr = mkEl('div', 'cpd-hdr');
        const hdrL = mkEl('div', 'cpd-hdr-l');
        // Lock button (left side for easy access)
        const lockBtn = mkEl('button', 'cpd-lock' + (sidebarLocked ? ' locked' : ''));
        lockBtn.id = 'cpd-lock';
        lockBtn.title = sidebarLocked ? 'Unlock sidebar (auto-hide)' : 'Lock sidebar open';
        lockBtn.innerHTML = '<span class="cpd-lock-icon">' + (sidebarLocked ? '\uD83D\uDD12' : '\uD83D\uDD13') + '</span>';
        lockBtn.addEventListener('click', () => {
            toggleLock();
            lockBtn.innerHTML = '<span class="cpd-lock-icon">' + (sidebarLocked ? '\uD83D\uDD12' : '\uD83D\uDD13') + '</span>';
            updateHandleLockState();
        });
        hdrL.appendChild(lockBtn);
        const dot = mkEl('span', 'cpd-dot'); dot.id = 'cpd-dot';
        hdrL.appendChild(dot);
        hdrL.appendChild(mkText('Prompt Deck'));
        hdr.appendChild(hdrL);

        const hdrR = mkEl('div', 'cpd-hdr-r');
        // Response stats (word/char count)
        const respStats = mkEl('span', 'cpd-resp-stats'); respStats.id = 'cpd-resp-stats';
        hdrR.appendChild(respStats);
        // Timer
        const timer = mkEl('span', 'cpd-timer'); timer.id = 'cpd-timer'; timer.textContent = '--'; timer.style.color = '#484f58'; timer.title = 'Response time';
        hdrR.appendChild(timer);
        // Copy last response button
        const copyResp = mkEl('button', 'cpd-copy-resp'); copyResp.id = 'cpd-copy-resp'; copyResp.textContent = 'Copy'; copyResp.title = 'Copy last Claude response';
        copyResp.addEventListener('click', copyLastResponse);
        hdrR.appendChild(copyResp);
        const statSpan = mkEl('span'); statSpan.id = 'cpd-stat-mini'; statSpan.textContent = 'idle';
        hdrR.appendChild(statSpan);
        hdr.appendChild(hdrR);
        panel.appendChild(hdr);

        // ---- Body ----
        const body = mkEl('div', 'cpd-body');

        // Code Blocks (TOP - most important)
        const cbLbl = mkEl('div'); cbLbl.className = 'cpd-cat-hdr'; cbLbl.style.cursor = 'pointer';
        cbLbl.innerHTML = '<span class="cpd-cat-arrow">\u25BE</span><span style="color:#f0883e">Code Blocks</span><span class="cpd-cb-count" id="cpd-cb-count" style="font-size:9px;color:#484f58;margin-left:3px"></span><span class="cpd-cat-line"></span><button class="cpd-cb-refresh" id="cpd-cb-refresh-btn" title="Refresh code blocks">&#8635;</button>';
        const cbContainer = mkEl('div', 'cpd-cb-container'); cbContainer.id = 'cpd-codeblocks';
        const cbSection = mkEl('div', 'cpd-cat'); cbSection.dataset.cat = 'codeblocks';
        cbLbl.addEventListener('click', (e) => {
            if (e.target.closest('.cpd-cb-refresh')) return;
            cbSection.classList.toggle('collapsed');
        });
        cbLbl.querySelector('.cpd-cb-refresh').addEventListener('click', (e) => {
            e.stopPropagation();
            refreshCodeBlocks();
            const cnt = document.getElementById('cpd-cb-count');
            if (cnt) cnt.textContent = '(' + scanCodeBlocks().length + ')';
        });
        cbSection.appendChild(cbLbl);
        cbSection.appendChild(cbContainer);
        body.appendChild(cbSection);

        // Context Health (compact)
        const ctxP = mkEl('div', 'cpd-ctx'); ctxP.id = 'cpd-ctx';
        ctxP.innerHTML = `<div class="cpd-ctx-row"><span class="cpd-ctx-lbl">Context</span><span class="cpd-ctx-val" id="cpd-ctx-pct">0%</span></div>
<div class="cpd-ctx-bar"><div class="cpd-ctx-fill good" id="cpd-ctx-fill" style="width:0%"></div></div>
<div class="cpd-ctx-stats">
<div class="cpd-ctx-stat"><span class="cpd-ctx-stat-v" id="cpd-ctx-tokens">0</span><span class="cpd-ctx-stat-k">Tokens</span></div>
<div class="cpd-ctx-stat"><span class="cpd-ctx-stat-v" id="cpd-ctx-turns">0</span><span class="cpd-ctx-stat-k">Turns</span></div>
<div class="cpd-ctx-stat"><span class="cpd-ctx-stat-v" id="cpd-ctx-time">0m</span><span class="cpd-ctx-stat-k">Time</span></div>
<div class="cpd-ctx-stat"><span class="cpd-ctx-stat-v" id="cpd-ctx-burn">0</span><span class="cpd-ctx-stat-k">Tok/m</span></div>
<div class="cpd-ctx-stat"><span class="cpd-ctx-stat-v" id="cpd-ctx-ttf">--</span><span class="cpd-ctx-stat-k">ETA</span></div>
</div>
<div class="cpd-ctx-advice good" id="cpd-ctx-advice">Context is healthy</div>`;
        body.appendChild(ctxP);

        // Status + Toggles on one line
        const statusRow = mkEl('div'); statusRow.style.cssText = 'display:flex;gap:4px;align-items:stretch';
        const statBar = mkEl('div', 'cpd-stat'); statBar.style.flex = '1';
        statBar.innerHTML = '<span class="cpd-stat-lbl" id="cpd-stat-lbl">Idle</span><span class="cpd-stat-txt" id="cpd-stat-txt">Waiting</span>';
        statusRow.appendChild(statBar);
        const toggles = mkEl('div', 'cpd-toggles');
        toggles.appendChild(makeToggle('Scroll', CONFIG.autoScroll, v => { CONFIG.autoScroll = v; }));
        toggles.appendChild(makeToggle('Approve', CONFIG.autoApprove, v => { CONFIG.autoApprove = v; }));
        toggles.appendChild(makeToggle('Notify', CONFIG.notifySound, v => { CONFIG.notifySound = v; CONFIG.notifyFlash = v; }));
        statusRow.appendChild(toggles);
        body.appendChild(statusRow);

        // Categories
        CATEGORIES.forEach(cat => {
            const sec = mkEl('div', 'cpd-cat'); sec.dataset.cat = cat.id;
            const hd = mkEl('div', 'cpd-cat-hdr');
            const arrow = mkEl('span', 'cpd-cat-arrow'); arrow.textContent = '\u25BE';
            const lbl = mkEl('span'); lbl.textContent = cat.label; lbl.style.color = cat.color;
            const ln = mkEl('span', 'cpd-cat-line');
            hd.appendChild(arrow); hd.appendChild(lbl); hd.appendChild(ln);
            hd.addEventListener('click', () => sec.classList.toggle('collapsed'));
            sec.appendChild(hd);
            const btns = mkEl('div', 'cpd-cat-btns');
            state.prompts.filter(p => p.cat === cat.id).forEach(p => btns.appendChild(makePromptBtn(p)));
            sec.appendChild(btns);
            body.appendChild(sec);
        });

        // Manual input
        const mLbl = mkEl('div'); mLbl.className = 'cpd-cat-hdr'; mLbl.style.cursor = 'default';
        mLbl.innerHTML = '<span style="color:#8b949e">Manual</span><span class="cpd-cat-line"></span>';
        body.appendChild(mLbl);
        const manual = mkEl('div', 'cpd-manual');
        const mIn = mkEl('input'); mIn.placeholder = 'Type a message...'; mIn.id = 'cpd-man-in';
        const mGo = mkEl('button'); mGo.textContent = 'Send';
        mGo.addEventListener('click', async () => {
            const msg = mIn.value.trim(); if (!msg) return;
            try { log(`Manual: "${msg.substring(0, 60)}..."`, 'action'); await DOM.sendMessage(msg); mIn.value = ''; if (!sidebarLocked) setTimeout(closeSidebar, CONFIG.retractDelay); } catch (e) { log(`Send failed: ${e.message}`, 'error'); }
        });
        mIn.addEventListener('keydown', e => { if (e.key === 'Enter') mGo.click(); });
        manual.appendChild(mIn); manual.appendChild(mGo);
        body.appendChild(manual);

        // Log
        const lLbl = mkEl('div'); lLbl.className = 'cpd-cat-hdr'; lLbl.style.cursor = 'default';
        lLbl.innerHTML = '<span style="color:#8b949e">Log</span><span class="cpd-cat-line"></span>';
        body.appendChild(lLbl);
        body.appendChild(Object.assign(mkEl('div', 'cpd-log'), { id: 'cpd-log' }));
        panel.appendChild(body);

        // Footer
        const foot = mkEl('div', 'cpd-foot');
        foot.innerHTML = 'Hover = open &bull; Click handle = lock';
        panel.appendChild(foot);

        document.body.appendChild(panel);

        // If locked, open immediately and set handle state
        if (sidebarLocked) { openSidebar(); updateHandleLockState(); }

        // Systems
        setupFetchInterceptor();
        setupAutoScroll();
        setupAutoApprove();
        startMonitor();
        countConversationMetrics();
        refreshCodeBlocks();
        setInterval(() => { countConversationMetrics(); refreshContextUI(); }, 10000);
        // Refresh code blocks less frequently (every 8s) to avoid DOM thrashing
        setInterval(() => {
            refreshCodeBlocks();
            const cnt = document.getElementById('cpd-cb-count');
            if (cnt) cnt.textContent = '(' + scanCodeBlocks().length + ')';
        }, 8000);

        // Detect navigation (new chat)
        let lastUrl = location.href;
        setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; resetCtx(); state.genStartTime = null; state.lastResponseMs = 0; state.lastResponseWords = 0; state.lastResponseChars = 0; refreshTimerDisplay(); refreshResponseStats(); log('Navigation detected - context reset', 'info'); } }, 2000);

        log('Prompt Deck v1.4 loaded', 'success');
    }

    function resetCtx() {
        ctx.chatStartTime = null; ctx.turns = 0; ctx.userMsgCount = 0; ctx.assistantMsgCount = 0;
        ctx.estimatedTokens = 0; ctx.sseUtilization = null; ctx.sseExpiry = null; ctx.lastSseData = null;
        ctx.lastEstimateTime = 0; ctx.history = [];
        refreshContextUI();
    }

    // ---- UI Helpers ----
    function mkEl(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
    function mkText(t) { const s = document.createElement('span'); s.textContent = t; return s; }
    function makeToggle(label, initial, onChange) {
        const wrap = mkEl('label', 'cpd-tog' + (initial ? ' on' : ''));
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = initial;
        cb.addEventListener('change', () => { onChange(cb.checked); wrap.classList.toggle('on', cb.checked); });
        wrap.appendChild(cb); wrap.appendChild(document.createTextNode(label)); return wrap;
    }
    function makePromptBtn(po) {
        const w = mkEl('div', 'cpd-btn');
        const sb = mkEl('button', 'cpd-btn-send'); sb.textContent = po.label; sb.title = 'Click to send';
        sb.addEventListener('click', () => sendPrompt(po));
        const eb = mkEl('button', 'cpd-btn-edit'); eb.innerHTML = '&#9998;'; eb.title = 'Edit';
        eb.addEventListener('click', e => { e.stopPropagation(); openEditor(po); });
        w.appendChild(sb); w.appendChild(eb); return w;
    }

    // ---- Editor ----
    function openEditor(po) {
        closeEditor(); state.editingId = po.id;
        const body = panel.querySelector('.cpd-body');
        const ov = mkEl('div', 'cpd-edit-overlay');
        const top = mkEl('div', 'cpd-edit-top');
        const li = document.createElement('input'); li.value = po.label; li.placeholder = 'Button label...';
        top.appendChild(li); ov.appendChild(top);
        const ta = document.createElement('textarea'); ta.className = 'cpd-edit-ta'; ta.value = po.prompt; ta.placeholder = 'Enter prompt template...';
        ov.appendChild(ta);
        const acts = mkEl('div', 'cpd-edit-acts');
        const sv = mkEl('button', 'cpd-edit-save'); sv.textContent = 'Save';
        sv.addEventListener('click', () => { po.label = li.value.trim() || po.label; po.prompt = ta.value; savePrompts(); rebuildButtons(); closeEditor(); log(`Saved "${po.label}"`, 'success'); });
        const cn = mkEl('button', 'cpd-edit-cancel'); cn.textContent = 'Cancel'; cn.addEventListener('click', closeEditor);
        const rs = mkEl('button', 'cpd-edit-reset'); rs.textContent = 'Reset Default';
        rs.addEventListener('click', () => { const d = DEFAULT_PROMPTS.find(x => x.id === po.id); if (d) { li.value = d.label; ta.value = d.prompt; } });
        acts.appendChild(sv); acts.appendChild(cn); acts.appendChild(rs);
        ov.appendChild(acts); body.style.position = 'relative'; body.appendChild(ov); ta.focus();
        const escH = e => { if (e.key === 'Escape') { closeEditor(); document.removeEventListener('keydown', escH); } };
        document.addEventListener('keydown', escH);
    }
    function closeEditor() { state.editingId = null; panel?.querySelector('.cpd-edit-overlay')?.remove(); }
    function rebuildButtons() {
        CATEGORIES.forEach(cat => {
            const sec = panel.querySelector(`[data-cat="${cat.id}"]`); if (!sec) return;
            const btns = sec.querySelector('.cpd-cat-btns'); btns.innerHTML = '';
            state.prompts.filter(p => p.cat === cat.id).forEach(p => btns.appendChild(makePromptBtn(p)));
        });
    }

    // ---- Refresh UI ----
    function refreshGenStatus() {
        const dot = document.getElementById('cpd-dot'), mini = document.getElementById('cpd-stat-mini');
        const lbl = document.getElementById('cpd-stat-lbl'), txt = document.getElementById('cpd-stat-txt');
        if (!dot) return; dot.className = 'cpd-dot';
        const s = state.genStatus;
        if (s === 'generating') { dot.classList.add('gen'); if (mini) mini.textContent = 'generating...'; if (lbl) { lbl.textContent = 'Generating'; lbl.style.color = '#d29922'; } if (txt) txt.textContent = 'Claude is writing...'; }
        else if (s === 'stuck') { dot.classList.add('stuck'); if (mini) mini.textContent = 'STUCK'; if (lbl) { lbl.textContent = 'Stuck'; lbl.style.color = '#f85149'; } if (txt) txt.textContent = 'No new content for ' + Math.round(CONFIG.stuckTimeout / 1000) + 's'; }
        else if (s === 'truncated') { dot.classList.add('trunc'); if (mini) mini.textContent = 'truncated'; if (lbl) { lbl.textContent = 'Truncated'; lbl.style.color = '#f85149'; } if (txt) txt.textContent = 'Response cut off - click Continue'; }
        else if (s === 'complete') { dot.classList.add('ok'); if (mini) mini.textContent = 'complete'; if (lbl) { lbl.textContent = 'Complete'; lbl.style.color = '#3fb950'; } if (txt) txt.textContent = 'Response finished'; }
        else { if (mini) mini.textContent = 'idle'; if (lbl) { lbl.textContent = 'Idle'; lbl.style.color = '#8b949e'; } if (txt) txt.textContent = 'Waiting for activity'; }
    }
    function refreshContextUI() {
        const h = getContextHealth();
        const pctEl = document.getElementById('cpd-ctx-pct'), fillEl = document.getElementById('cpd-ctx-fill');
        const tokEl = document.getElementById('cpd-ctx-tokens'), turnEl = document.getElementById('cpd-ctx-turns');
        const timeEl = document.getElementById('cpd-ctx-time'), burnEl = document.getElementById('cpd-ctx-burn');
        const ttfEl = document.getElementById('cpd-ctx-ttf'), advEl = document.getElementById('cpd-ctx-advice');
        if (!pctEl) return;
        const fp = Math.min(100, Math.round(h.fill * 100));
        pctEl.textContent = fp + '%';
        pctEl.style.color = { good: '#3fb950', warn: '#d29922', critical: '#f85149', danger: '#ff7b72' }[h.level];
        fillEl.style.width = fp + '%'; fillEl.className = 'cpd-ctx-fill ' + h.level;
        tokEl.textContent = fmtNum(ctx.estimatedTokens); turnEl.textContent = String(ctx.turns);
        const dur = ctx.chatStartTime ? Date.now() - ctx.chatStartTime : 0;
        timeEl.textContent = dur > 0 ? fmtDur(dur) : '0m';
        const br = getBurnRate(); burnEl.textContent = br > 0 ? fmtNum(br) : '0';
        const ttf = getTimeToFull();
        if (ttf !== null && ttf > 0) { ttfEl.textContent = ttf < 60 ? Math.round(ttf) + 'm' : (ttf / 60).toFixed(1) + 'h'; ttfEl.style.color = ''; }
        else if (ttf === 0) { ttfEl.textContent = 'NOW'; ttfEl.style.color = '#f85149'; }
        else { ttfEl.textContent = '--'; ttfEl.style.color = ''; }
        advEl.textContent = h.advice; advEl.className = 'cpd-ctx-advice ' + h.level;
    }
    function refreshLog() {
        const lb = document.getElementById('cpd-log'); if (!lb) return;
        lb.innerHTML = state.logs.slice(-80).map(e => `<div class="cpd-le"><span class="cpd-lt">${e.time}</span><span class="l-${e.level}">${esc(e.msg)}</span></div>`).join('');
        lb.scrollTop = lb.scrollHeight;
    }

    // ---- Init ----
    (function init() {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); return; }
        setTimeout(() => { buildPanel(); console.log('%c[Prompt Deck v1.4] Ready', 'color:#58a6ff;font-weight:bold;font-size:14px'); }, 2500);
    })();
})();
