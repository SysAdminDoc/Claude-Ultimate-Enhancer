// ==UserScript==
// @name         Claude Ultimate Enhancer
// @namespace    https://github.com/SysAdminDoc/Claude-Ultimate-Enhancer
// @version      1.3.0
// @description  All-in-one Claude.ai enhancement suite - theme engine, usage monitor, conversation search, prompt library, auto-scroll, DOM trimmer, code folding, visual upgrades, panel tools, and more
// @author       SysAdminDoc
// @homepageURL  https://github.com/SysAdminDoc/Claude-Ultimate-Enhancer
// @supportURL   https://github.com/SysAdminDoc/Claude-Ultimate-Enhancer/issues
// @updateURL    https://raw.githubusercontent.com/SysAdminDoc/Claude-Ultimate-Enhancer/main/Claude%20Ultimate%20Enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/SysAdminDoc/Claude-Ultimate-Enhancer/main/Claude%20Ultimate%20Enhancer.user.js
// @match        https://claude.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-start
// @inject-into  content
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // @match applies to frames unless the manager honors @noframes. Keep the
    // runtime guard as the defense-in-depth boundary for both managers.
    try { if (window.top !== window.self) return; } catch (e) { return; }
    if (window.__claudeUltimateLoaded) return;
    window.__claudeUltimateLoaded = true;

    const VERSION = '1.3.0';
    const PREFIX = 'cue';
    const LOG_TAG = '[CUE]';

    // =====================================================================
    //  TRUSTED TYPES / HTML SAFETY
    // =====================================================================
    // CUE renders its own compact templates, but conversation/config values
    // can reach the same sinks. Keep the policy non-identity and strip the
    // executable parts before a string ever reaches innerHTML.
    const UNSAFE_TAG_RE = /<\s*\/?\s*(?:script|iframe|object|embed|base|meta|link|svg|math|style)\b[^>]*>/gi;
    const EVENT_ATTR_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
    const UNSAFE_ATTR_RE = /\s+(?:srcdoc|formaction|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
    const URL_ATTR_RE = /\s+(href|src|action)\s*=\s*("|')([\s\S]*?)\2/gi;

    function sanitizeMarkup(html) {
        let safe = String(html ?? '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<\s*(?:script|iframe|object|embed|base|meta|link|svg|math|style)\b[\s\S]*?<\s*\/\s*(?:script|iframe|object|embed|base|meta|link|svg|math|style)\s*>/gi, '')
            .replace(UNSAFE_TAG_RE, '')
            .replace(EVENT_ATTR_RE, '')
            .replace(UNSAFE_ATTR_RE, '')
            .replace(URL_ATTR_RE, (match, name, quote, value) => {
                const normalized = String(value).trim().toLowerCase();
                return /^(?:javascript:|vbscript:|data:text\/html|data:application\/javascript)/i.test(normalized)
                    ? ''
                    : match;
            });
        // Unquoted dangerous URLs are uncommon in CUE templates, but remove
        // them too so a malformed imported value cannot bypass the quoted rule.
        safe = safe.replace(/\s+(?:href|src|action)\s*=\s*(?:javascript:|vbscript:|data:text\/html|data:application\/javascript)[^\s>]+/gi, '');
        return safe;
    }

    let _ttPolicy = null;
    try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            _ttPolicy = window.trustedTypes.createPolicy(PREFIX + '-html', { createHTML: sanitizeMarkup });
        }
    } catch (e) { /* policy already exists or TT disabled */ }

    function setHTML(el, html) {
        if (!el) return;
        const safe = sanitizeMarkup(html);
        el.innerHTML = _ttPolicy ? _ttPolicy.createHTML(safe) : safe;
    }

    // =====================================================================
    //  SETTINGS MANAGER
    // =====================================================================
    const Settings = {
        _cache: {},
        _loaded: false,
        STORAGE_KEY: PREFIX + '_settings',
        _defaults: {
            // -- Theme --
            themeEnabled: true,
            themeVariant: 'oceanic',   // oceanic | midnight | none
            fontOverride: true,        // replace serif with sans
            // -- Layout --
            wideMode: true,
            chatWidthPct: 90,
            densityMode: 'comfortable', // comfortable | compact | reading
            focusMode: false,           // hide sidebar for deep work
            // -- Visual --
            coloredButtons: true,
            coloredBoldItalic: true,
            smoothAnimations: true,
            customScrollbar: true,
            // -- Usage Monitor --
            usageMonitor: true,
            usagePlan: 'pro',          // pro | max5 | max20
            usageFetchInterval: 300,   // seconds between API polls
            // -- Feature Toggles --
            featureToggles: true,
            // -- DOM Trimmer --
            domTrimmer: false,
            domKeepVisible: 20,
            // -- Auto Features --
            autoScroll: true,
            autoApprove: false,
            // -- Context Tracker --
            contextTracker: true,
            contextWindow: 200000,
            warnThreshold: 0.55,
            criticalThreshold: 0.75,
            // -- Code Fold --
            codeFold: true,
            // -- Copy Turn --
            copyTurn: true,
            // -- Snippet Trigger --
            snippetTrigger: true,
            // -- Conversation Tools --
            conversationSearch: true,
            forkConversation: true,
            voiceDictation: true,
            // -- Prompt Library --
            promptLibrary: true,
            // -- Response Monitor --
            responseMonitor: true,
            notifySound: true,
            notifyFlash: true,
            // -- Paste Fix --
            pasteFix: true,
            // -- Panel --
            panelPosition: 'bottom-right',
            panelCollapsed: true,
            panelPinned: false,
            panelWidth: 320,
        },
        _rules: {
            themeEnabled: 'boolean', fontOverride: 'boolean', wideMode: 'boolean', coloredButtons: 'boolean',
            coloredBoldItalic: 'boolean', smoothAnimations: 'boolean', customScrollbar: 'boolean', pasteFix: 'boolean',
            autoScroll: 'boolean', autoApprove: 'boolean', contextTracker: 'boolean', responseMonitor: 'boolean',
            notifySound: 'boolean', notifyFlash: 'boolean', codeFold: 'boolean', copyTurn: 'boolean',
            snippetTrigger: 'boolean', conversationSearch: 'boolean', forkConversation: 'boolean', voiceDictation: 'boolean',
            promptLibrary: 'boolean', usageMonitor: 'boolean', featureToggles: 'boolean', domTrimmer: 'boolean',
            focusMode: 'boolean', panelPinned: 'boolean',
            themeVariant: ['oceanic', 'midnight', 'mocha', 'macchiato', 'frappe', 'latte', 'none'],
            usagePlan: ['pro', 'max5', 'max20'],
            densityMode: ['comfortable', 'compact', 'reading'],
            panelPosition: ['bottom-right', 'top-right', 'bottom-left', 'top-left'],
            chatWidthPct: { min: 50, max: 100, integer: true },
            usageFetchInterval: { min: 30, max: 3600, integer: true },
            domKeepVisible: { min: 5, max: 100, integer: true },
            contextWindow: { min: 1000, max: 10000000, integer: true },
            warnThreshold: { min: 0, max: 1 },
            criticalThreshold: { min: 0, max: 1 },
            panelWidth: { min: 280, max: 640, integer: true },
        },
        _isValid(key, value) {
            if (!(key in this._defaults)) return false;
            const rule = this._rules[key];
            if (rule === 'boolean') return typeof value === 'boolean';
            if (Array.isArray(rule)) return typeof value === 'string' && rule.includes(value);
            if (rule && typeof rule === 'object') {
                return typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max && (!rule.integer || Number.isInteger(value));
            }
            return typeof value === typeof this._defaults[key];
        },
        _load() {
            if (this._loaded) return;
            const stored = StorageRepository.read(this.STORAGE_KEY, {}, {
                version: 1,
                maxBytes: 64 * 1024,
                validate: value => value && typeof value === 'object' && !Array.isArray(value),
                migrate: (value) => value?.settings && typeof value.settings === 'object' ? value.settings : value
            });
            const legacy = {};
            Object.keys(this._defaults).forEach(key => {
                if (Object.prototype.hasOwnProperty.call(stored, key) && this._isValid(key, stored[key])) return;
                try {
                    const value = GM_getValue(PREFIX + '_' + key, undefined);
                    if (value !== undefined && this._isValid(key, value)) legacy[key] = value;
                } catch (e) { /* use default */ }
            });
            this._cache = {};
            Object.keys(this._defaults).forEach(key => {
                const value = Object.prototype.hasOwnProperty.call(stored, key) && this._isValid(key, stored[key])
                    ? stored[key]
                    : Object.prototype.hasOwnProperty.call(legacy, key) ? legacy[key] : this._defaults[key];
                this._cache[key] = value;
            });
            this._loaded = true;
            if (!Object.keys(stored).length || Object.keys(legacy).length) StorageRepository.write(this.STORAGE_KEY, this._cache, { version: 1, maxBytes: 64 * 1024 });
        },
        get(key) {
            this._load();
            return key in this._cache ? this._cache[key] : undefined;
        },
        set(key, val) {
            this._load();
            if (!this._isValid(key, val)) {
                StorageRepository._emit('warn', 'rejected invalid setting value', this.STORAGE_KEY);
                return false;
            }
            const previous = this._cache[key];
            this._cache[key] = val;
            if (!StorageRepository.write(this.STORAGE_KEY, this._cache, { version: 1, maxBytes: 64 * 1024 })) {
                this._cache[key] = previous;
                return false;
            }
            EventBus.emit('setting:' + key, val);
            EventBus.emit('settings:changed', { key, val });
            return true;
        },
        toggle(key) {
            const v = !this.get(key);
            this.set(key, v);
            return v;
        },
        defaults() { return { ...this._defaults }; },
        reset() {
            this._load();
            this._cache = { ...this._defaults };
            StorageRepository.write(this.STORAGE_KEY, this._cache, { version: 1, maxBytes: 64 * 1024 });
            Object.keys(this._defaults).forEach(k => {
                EventBus.emit('setting:' + k, this._defaults[k]);
                EventBus.emit('settings:changed', { key: k, val: this._defaults[k] });
            });
        }
    };

    const ConfigCodec = {
        SCHEMA: 1,
        MAX_BYTES: 512 * 1024,

        create() {
            const settings = {};
            Object.keys(Settings._defaults).forEach(key => { settings[key] = Settings.get(key); });
            return {
                format: 'claude-ultimate-enhancer-config',
                schema: this.SCHEMA,
                version: VERSION,
                exported: new Date().toISOString(),
                settings,
                prompts: PromptModule.prompts.map(p => ({ id: p.id, label: p.label, prompt: p.prompt, cat: p.cat, history: p.history || [] }))
            };
        },

        parse(text) {
            if (typeof text !== 'string' || text.length > this.MAX_BYTES) throw new Error('Config exceeds 512 KB');
            let raw;
            try { raw = JSON.parse(text); } catch (e) { throw new Error('Malformed JSON'); }
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Config must be a JSON object');
            const schema = raw.schema === undefined ? 0 : raw.schema;
            if (schema !== 0 && schema !== this.SCHEMA) throw new Error('Unsupported config schema: ' + schema);
            const sourceSettings = schema === 0 ? raw : raw.settings;
            if (!sourceSettings || typeof sourceSettings !== 'object' || Array.isArray(sourceSettings)) throw new Error('Missing settings object');
            const acceptedSettings = {};
            const rejected = [];
            Object.keys(Settings._defaults).forEach(key => {
                if (!Object.prototype.hasOwnProperty.call(sourceSettings, key)) return;
                if (Settings._isValid(key, sourceSettings[key])) acceptedSettings[key] = sourceSettings[key];
                else rejected.push('setting:' + key);
            });
            const promptSource = schema === 0 ? raw._prompts : raw.prompts;
            const acceptedPrompts = [];
            if (promptSource !== undefined) {
                if (!Array.isArray(promptSource) || promptSource.length > 500) rejected.push('prompts');
                else promptSource.forEach((prompt, index) => {
                    const normalized = PromptModule._normalize(prompt);
                    if (normalized) acceptedPrompts.push(normalized);
                    else rejected.push('prompt[' + index + ']');
                });
            }
            if (!Object.keys(acceptedSettings).length && !acceptedPrompts.length) throw new Error('Config contains no valid settings or prompts');
            return { schema, settings: acceptedSettings, prompts: acceptedPrompts, rejected };
        }
    };

    // =====================================================================
    //  EVENT BUS
    // =====================================================================
    const EventBus = {
        _listeners: {},
        on(event, fn) {
            (this._listeners[event] ||= []).push(fn);
            return () => this.off(event, fn);
        },
        off(event, fn) {
            const arr = this._listeners[event];
            if (arr) this._listeners[event] = arr.filter(f => f !== fn);
        },
        emit(event, data) {
            (this._listeners[event] || []).forEach(fn => {
                try { fn(data); } catch (e) { console.error(LOG_TAG, 'Event error:', event, e); }
            });
        }
    };

    // =====================================================================
    //  UTILITY HELPERS
    // =====================================================================
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
    const fmtDur = ms => {
        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
        return h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
    };
    const ts = () => new Date().toLocaleTimeString('en', { hour12: false });

    function waitForElement(sel, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const el = $(sel);
            if (el) return resolve(el);
            const obs = new MutationObserver(() => {
                const el = $(sel);
                if (el) { obs.disconnect(); clearTimeout(t); resolve(el); }
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            const t = setTimeout(() => { obs.disconnect(); reject(new Error('Timeout: ' + sel)); }, timeout);
        });
    }

    function injectCSS(id, css) {
        let el = document.getElementById(id);
        if (el) { el.textContent = css; return el; }
        el = document.createElement('style');
        el.id = id;
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
        return el;
    }

    function removeCSS(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function showToast(msg, duration = 3500, type = 'info') {
        const colors = { info: '#58a6ff', success: '#3fb950', warn: '#d29922', error: '#f85149' };
        const toast = document.createElement('div');
        Object.assign(toast.style, {
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: '#1a1a2e', color: '#e0e0e0', padding: '12px 24px', borderRadius: '10px',
            boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${colors[type]}40`,
            zIndex: '999999', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px', borderLeft: `4px solid ${colors[type]}`, transition: 'opacity 0.4s, transform 0.4s',
            opacity: '0', maxWidth: '500px'
        });
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(10px)'; setTimeout(() => toast.remove(), 400); }, duration);
    }

    // =====================================================================
    //  DOM SELECTORS
    // =====================================================================
    const SEL = {
        editor:     '.ProseMirror',
        editorAlt:  'div[contenteditable="true"][translate="no"].ProseMirror',
        sendBtn:    '[data-testid="send-button"]',
        sendBtnAlt: 'button[aria-label*="Send"]',
        stopBtn:    '[data-testid="stop-button"]',
        stopBtnAlt: 'button[aria-label*="Stop"]',
        userMsg:    '[data-testid="user-message"]',
        msgGroup:   '.group',
        streaming:  '[data-is-streaming="true"]',
        dialog:     '[role="dialog"]',
        dialogOpen: '[role="dialog"][data-state="open"]',
        main:       'main',
    };

    // =====================================================================
    //  DOM INTERFACE (from Prompt Deck v1.4)
    // =====================================================================
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
            if (editor?.chain) { try { editor.chain().focus().clearContent().insertContent({ type: 'paragraph', content: [{ type: 'text', text }] }).run(); await sleep(300); return; } catch (e) { /* fb */ } }
            try { pm.focus(); document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); document.execCommand('insertText', false, text); await sleep(300); return; } catch (e) { /* fb */ }
            pm.focus(); const p = document.createElement('p'); p.textContent = text; setHTML(pm, ''); pm.appendChild(p); pm.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
        },
        async sendMessage(text) {
            await this.typeMessage(text); await sleep(500);
            const btn = this.getSendButton(); if (btn && !btn.disabled) { btn.click(); return; }
            const pm = this.getEditor(); if (pm) { pm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); return; }
            throw new Error('Cannot send');
        },
        getLastResponse() {
            const groups = document.querySelectorAll(SEL.msgGroup);
            for (let i = groups.length - 1; i >= 0; i--) { if (!groups[i].querySelector(SEL.userMsg)) return getCleanElementText(groups[i]); }
            return '';
        },
    };

    function getCleanElementText(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        clone.querySelectorAll('[class^="' + PREFIX + '-"], [class*=" ' + PREFIX + '-"]').forEach(node => node.remove());
        return (clone.innerText || clone.textContent || '').trim();
    }

    function getSafeElementHTML(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        clone.querySelectorAll('[class^="' + PREFIX + '-"], [class*=" ' + PREFIX + '-"], [id^="' + PREFIX + '-"], [data-cue-styled], [data-cue-trimmed]').forEach(node => node.remove());
        clone.querySelectorAll('*').forEach(node => {
            [...node.attributes].forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = String(attr.value || '').trim().toLowerCase();
                if (name.startsWith('on') || ['srcdoc', 'formaction', 'xlink:href'].includes(name) ||
                    (['href', 'src', 'action'].includes(name) && /^(?:javascript:|vbscript:|data:text\/html|data:application\/javascript)/i.test(value))) {
                    node.removeAttribute(attr.name);
                }
            });
            if (/^(SCRIPT|IFRAME|OBJECT|EMBED|BASE|META|LINK|SVG|MATH|STYLE)$/.test(node.tagName)) node.remove();
        });
        return sanitizeMarkup(clone.innerHTML);
    }

    function getConversationMessages(maxIndex = null) {
        const main = document.querySelector('main');
        if (!main) return [];
        const groups = $$(SEL.msgGroup, main);
        const last = maxIndex === null ? groups.length - 1 : Math.min(maxIndex, groups.length - 1);
        const messages = [];
        for (let i = 0; i <= last; i++) {
            const group = groups[i];
            const text = getCleanElementText(group);
            if (!text) continue;
            messages.push({
                index: i,
                role: group.querySelector(SEL.userMsg) ? 'human' : 'assistant',
                text,
                html: getSafeElementHTML(group),
                id: group.dataset?.messageId || group.dataset?.id || `turn-${i}`
            });
        }
        return messages;
    }

    function getCurrentConversationId() {
        const match = location.pathname.match(/\/chat\/([a-f0-9-]+)/i);
        return match ? match[1] : null;
    }

    function cloneJSON(value) {
        try { return JSON.parse(JSON.stringify(value)); } catch (e) { return null; }
    }

    function messageTextFromRaw(message) {
        if (!message || typeof message !== 'object') return '';
        if (typeof message.text === 'string') return message.text;
        if (typeof message.message === 'string') return message.message;
        if (typeof message.content === 'string') return message.content;
        const blocks = Array.isArray(message.content) ? message.content : Array.isArray(message.content?.blocks) ? message.content.blocks : [];
        return blocks.map(block => {
            if (typeof block === 'string') return block;
            if (!block || typeof block !== 'object') return '';
            return block.text || block.content || block.caption || block.title || '';
        }).filter(Boolean).join('\n');
    }

    function contentBlocksFromRaw(message) {
        if (!message || typeof message !== 'object') return [];
        const content = Array.isArray(message.content) ? message.content : Array.isArray(message.content?.blocks) ? message.content.blocks : null;
        if (content) return content.map(block => typeof block === 'object' ? cloneJSON(block) : { type: 'text', text: String(block) });
        const text = messageTextFromRaw(message);
        return text ? [{ type: 'text', text }] : [];
    }

    const ConversationSerializer = {
        _messageArray(raw) {
            const candidates = [
                raw?.chat_messages, raw?.messages, raw?.turns, raw?.nodes,
                raw?.conversation?.chat_messages, raw?.conversation?.messages,
                raw?.data?.chat_messages, raw?.data?.messages
            ];
            return candidates.find(Array.isArray) || [];
        },

        _role(message) {
            const role = String(message?.sender || message?.role || message?.author || '').toLowerCase();
            return role === 'human' || role === 'user' || role === 'human_user' ? 'human' : role === 'system' ? 'system' : 'assistant';
        },

        _normalizeMessage(message, index, source) {
            const id = String(message?.uuid || message?.id || message?.message_uuid || message?.messageId || `${source}-turn-${index}`);
            const parentId = message?.parent_message_uuid || message?.parentMessageUuid || message?.parent_id || message?.parentId || null;
            const contentBlocks = contentBlocksFromRaw(message);
            return {
                id,
                parentId: parentId ? String(parentId) : null,
                index,
                role: this._role(message),
                text: messageTextFromRaw(message),
                contentBlocks,
                createdAt: message?.created_at || message?.createdAt || null,
                updatedAt: message?.updated_at || message?.updatedAt || null,
                model: message?.model || message?.model_name || message?.modelName || null,
                attachments: cloneJSON(message?.attachments || message?.files || []) || [],
                artifacts: cloneJSON(message?.artifacts || []) || [],
                truncated: message?.truncated === true || message?.is_truncated === true || message?.stop_reason === 'max_tokens',
                stopReason: message?.stop_reason || message?.stopReason || null,
                renderedHtml: source === 'dom' ? message.html || '' : '',
                raw: cloneJSON(message) || {}
            };
        },

        from(raw, fallbackMessages = []) {
            const apiMessages = this._messageArray(raw);
            const source = apiMessages.length ? 'api' : 'dom';
            const messages = (apiMessages.length ? apiMessages : fallbackMessages).map((message, index) => this._normalizeMessage(message, index, source));
            const id = String(raw?.uuid || raw?.id || raw?.conversation_uuid || raw?.conversationId || getCurrentConversationId() || 'current');
            const metadata = {
                id,
                title: String(raw?.name || raw?.title || raw?.summary || document.title || 'Claude Conversation').trim().slice(0, 500),
                createdAt: raw?.created_at || raw?.createdAt || null,
                updatedAt: raw?.updated_at || raw?.updatedAt || null,
                model: raw?.model || raw?.model_name || raw?.modelName || null,
                project: raw?.project?.name || raw?.project_name || raw?.project || null,
                source
            };
            const byId = new Map(messages.map(message => [message.id, message]));
            const children = {};
            const roots = [];
            messages.forEach(message => {
                if (message.parentId && byId.has(message.parentId)) (children[message.parentId] ||= []).push(message.id);
                else roots.push(message.id);
            });
            const currentId = String(raw?.current_message_uuid || raw?.currentMessageUuid || raw?.current_message_id || messages[messages.length - 1]?.id || '');
            const activePath = [];
            const seen = new Set();
            let cursor = currentId;
            while (cursor && byId.has(cursor) && !seen.has(cursor)) {
                seen.add(cursor);
                activePath.unshift(cursor);
                cursor = byId.get(cursor).parentId;
            }
            if (!activePath.length) messages.forEach(message => activePath.push(message.id));
            return {
                schema: 2,
                exported: new Date().toISOString(),
                metadata,
                messages,
                branches: { roots, children, activePath },
                failures: source === 'dom' && getCurrentConversationId() ? [{ stage: 'conversation-detail', reason: 'API detail unavailable; rendered DOM fallback used' }] : [],
                limitations: source === 'dom' ? ['Only messages currently rendered in the page were available'] : []
            };
        },

        _activeMessages(archive) {
            const ids = new Set(archive.branches.activePath || []);
            return archive.messages.filter(message => ids.has(message.id)).sort((a, b) => (archive.branches.activePath.indexOf(a.id) - archive.branches.activePath.indexOf(b.id)));
        },

        toMarkdown(archive) {
            const lines = [
                '# Claude Conversation Export',
                '',
                `- Title: ${archive.metadata.title}`,
                `- Conversation ID: ${archive.metadata.id}`,
                `- Source: ${archive.metadata.source}`,
                `- Exported: ${archive.exported}`,
                archive.metadata.model ? `- Model: ${archive.metadata.model}` : '',
                archive.metadata.createdAt ? `- Created: ${archive.metadata.createdAt}` : '',
                archive.metadata.updatedAt ? `- Updated: ${archive.metadata.updatedAt}` : '',
                archive.failures.length ? `- Limitations: ${archive.failures.map(f => f.reason).join('; ')}` : '',
                '',
                '---', '',
                archive.metadata.source === 'api' ? '_Markdown follows the active branch; JSON preserves the full tree._' : '_Rendered DOM fallback; unloaded branches are unavailable._',
                ''
            ].filter(Boolean);
            this._activeMessages(archive).forEach(message => {
                lines.push(`## ${message.role === 'human' ? 'Human' : message.role === 'system' ? 'System' : 'Assistant'}`);
                if (message.createdAt) lines.push(`_${message.createdAt}_`, '');
                lines.push(message.text || '_[No text content]_', '');
                if (message.attachments.length) lines.push(`Attachments: ${message.attachments.length}`, '');
                if (message.artifacts.length) lines.push(`Artifacts: ${message.artifacts.length}`, '');
                lines.push('---', '');
            });
            return lines.join('\n');
        },

        toHTML(archive) {
            const messageHTML = this._activeMessages(archive).map(message => {
                const blockDetails = message.contentBlocks.length > 1
                    ? `<details><summary>Content blocks (${message.contentBlocks.length})</summary><pre>${esc(JSON.stringify(message.contentBlocks, null, 2))}</pre></details>` : '';
                return `<article class="msg ${esc(message.role)}"><div class="role">${esc(message.role)}</div><div class="body">${esc(message.text || '[No text content]').replace(/\n/g, '<br>')}</div>${blockDetails}</article>`;
            }).join('');
            const failure = archive.failures.length ? `<p class="notice">${esc(archive.failures.map(f => f.reason).join('; '))}</p>` : '';
            return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
                esc(archive.metadata.title) + '</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#1a1a2e;color:#e0e0e0}.msg{margin:20px 0;padding:16px;border-radius:8px;border-left:4px solid}.human{border-color:#58a6ff;background:rgba(88,166,255,.05)}.assistant{border-color:#bc8cff;background:rgba(188,140,255,.05)}.system{border-color:#d29922;background:rgba(210,153,34,.05)}.role{font-size:12px;font-weight:700;margin-bottom:8px;text-transform:uppercase}.notice{color:#d29922}pre{white-space:pre-wrap;background:rgba(0,0,0,.3);padding:12px;border-radius:6px;overflow:auto}</style></head><body><h1>' +
                esc(archive.metadata.title) + '</h1><p>Conversation ' + esc(archive.metadata.id) + ' · Exported ' + esc(archive.exported) + '</p>' + failure + messageHTML + '</body></html>';
        }
    };

    // =====================================================================
    //  CLAUDE API HELPERS
    // =====================================================================
    const ClaudeAPI = {
        _orgId: null,
        _health: {},

        _category(status) {
            if (status === 401 || status === 403) return 'auth';
            if (status === 404) return 'unsupported';
            if (status === 429) return 'rate-limited';
            if (status >= 500) return 'server';
            return status >= 400 ? 'http-error' : 'unknown';
        },

        _record(label, data = {}) {
            const current = this._health[label] || {};
            this._health[label] = {
                ...current,
                ...data,
                label,
                lastAttempt: data.lastAttempt || new Date().toISOString()
            };
            EventBus.emit('api:health', this._health[label]);
        },

        async _requestJSON(label, url, options = {}) {
            const started = Date.now();
            try {
                const response = await fetch(url, options);
                const retryAfter = response.headers?.get?.('Retry-After') || null;
                if (!response.ok) {
                    this._record(label, { status: response.status, category: this._category(response.status), retryAfter, ok: false, duration: Date.now() - started, detail: 'HTTP ' + response.status });
                    return { ok: false, data: null };
                }
                let data;
                try { data = await response.json(); } catch (e) {
                    this._record(label, { status: response.status, category: 'schema', retryAfter, ok: false, duration: Date.now() - started, detail: 'Invalid JSON response' });
                    return { ok: false, data: null };
                }
                this._record(label, { status: response.status, category: 'ok', retryAfter, ok: true, duration: Date.now() - started, detail: 'OK', lastSuccess: new Date().toISOString() });
                return { ok: true, data };
            } catch (e) {
                this._record(label, { status: 0, category: 'network', ok: false, duration: Date.now() - started, detail: e.message || 'Network request failed' });
                return { ok: false, data: null };
            }
        },

        async getOrgs() {
            const result = await this._requestJSON('organizations', '/api/organizations', { credentials: 'include' });
            if (!result.ok) return [];
            const data = result.data;
            const orgs = Array.isArray(data) ? data : data?.organizations || data?.data || [];
            if (!Array.isArray(orgs)) {
                this._record('organizations', { category: 'schema', ok: false, detail: 'Organizations array missing' });
                return [];
            }
            return orgs;
        },
        async getOrgId() {
            if (this._orgId) return this._orgId;
            const orgs = await this.getOrgs();
            this._orgId = orgs[0]?.uuid || orgs[0]?.id || null;
            return this._orgId;
        },
        async getUsage() {
            const orgId = await this.getOrgId();
            if (!orgId) {
                this._record('usage', { status: 0, category: 'auth', ok: false, detail: 'Organization unavailable' });
                return null;
            }
            const result = await this._requestJSON('usage', `/api/organizations/${orgId}/usage`, { credentials: 'include' });
            if (!result.ok || !result.data || typeof result.data !== 'object') {
                if (result.ok) this._record('usage', { category: 'schema', ok: false, detail: 'Usage object missing' });
                return null;
            }
            return result.data;
        },
        async getSettings() {
            const result = await this._requestJSON('account', '/api/account', { credentials: 'include' });
            if (!result.ok) return null;
            if (!result.data || typeof result.data.settings !== 'object') {
                this._record('account', { category: 'schema', ok: false, detail: 'Settings object missing' });
                return null;
            }
            return result.data.settings;
        },
        async toggleFeature(key, value, exclusiveKey = null) {
            const body = { [key]: value };
            if (exclusiveKey && value) body[exclusiveKey] = false;
            const result = await this._requestJSON('accountSettings', '/api/account/settings', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
            });
            return result.ok ? result.data : null;
        },
        _extractConversationArray(data) {
            if (Array.isArray(data)) return data;
            const candidates = [data?.chat_conversations, data?.conversations, data?.items, data?.data];
            return candidates.find(Array.isArray) || [];
        },
        async listConversations(limit = 200) {
            const orgId = await this.getOrgId();
            if (!orgId) return [];
            const out = [];
            let cursor = null;
            let offset = 0;
            const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
            for (let page = 0; page < 20 && out.length < safeLimit; page++) {
                const pageLimit = Math.min(100, safeLimit - out.length);
                const query = cursor ? `limit=${pageLimit}&cursor=${encodeURIComponent(cursor)}` : `limit=${pageLimit}&offset=${offset}`;
                const result = await this._requestJSON('conversationList', `/api/organizations/${orgId}/chat_conversations?${query}`, { credentials: 'include' });
                if (!result.ok) break;
                const data = result.data;
                const items = this._extractConversationArray(data);
                if (!items.length) {
                    if (data && !Array.isArray(data)) this._record('conversationList', { category: 'schema', ok: false, detail: 'Conversation array missing' });
                    break;
                }
                out.push(...items);
                cursor = data.next_cursor || data.nextCursor || data.cursor || null;
                offset += items.length;
                if (!cursor && data.has_more !== true && data.hasMore !== true) break;
            }
            return out;
        },
        async getConversation(id) {
            const orgId = await this.getOrgId();
            if (!orgId || !id) return null;
            const result = await this._requestJSON('conversationDetail', `/api/organizations/${orgId}/chat_conversations/${encodeURIComponent(id)}`, { credentials: 'include' });
            return result.ok && result.data && typeof result.data === 'object' ? result.data : null;
        },
        getHealth() {
            return Object.fromEntries(Object.entries(this._health).map(([key, value]) => [key, { ...value }]));
        },
        getLastStatus(label) {
            return this._health[label] ? { ...this._health[label] } : null;
        }
    };

    // =====================================================================
    //  VERSIONED LOCAL STORAGE
    // =====================================================================
    // GM_* values are shared with older CUE releases and may be strings,
    // objects, malformed JSON, or values written by a different manager.
    // Every structured store goes through this repository so reads are
    // bounded, migrations are explicit, and a bad value never overwrites a
    // good one silently.
    const StorageRepository = {
        MAX_BYTES: 1024 * 1024,
        MAX_QUARANTINE_BYTES: 256 * 1024,
        _stores: new Map(),

        _size(value) {
            const text = typeof value === 'string' ? value : JSON.stringify(value);
            try { return new TextEncoder().encode(text).length; } catch (e) { return text.length; }
        },

        _emit(level, message, key) {
            EventBus.emit('storage:error', { level, source: key || 'storage', message: String(message) });
        },

        _getRaw(key) {
            try { return GM_getValue(key, null); } catch (e) {
                this._emit('error', 'read failed: ' + e.message, key);
                return null;
            }
        },

        _parse(raw) {
            if (raw === null || raw === undefined || raw === '') return null;
            if (typeof raw === 'string') return JSON.parse(raw);
            return raw;
        },

        _quarantine(key, raw, reason) {
            const serialized = typeof raw === 'string' ? raw : (() => {
                try { return JSON.stringify(raw); } catch (e) { return String(raw); }
            })();
            const record = JSON.stringify({
                schema: 1,
                key,
                quarantinedAt: new Date().toISOString(),
                reason: String(reason),
                raw: serialized.slice(0, this.MAX_QUARANTINE_BYTES)
            });
            try {
                GM_setValue(key + '_quarantine', record);
                this._emit('warn', 'invalid data quarantined (' + reason + ')', key);
            } catch (e) {
                this._emit('error', 'quarantine failed: ' + e.message, key);
            }
        },

        read(key, fallback, options = {}) {
            const version = Number.isInteger(options.version) ? options.version : 1;
            const maxBytes = options.maxBytes || this.MAX_BYTES;
            const raw = this._getRaw(key);
            if (raw === null || raw === undefined || raw === '') {
                this._stores.set(key, { version, bytes: 0, updated: null, valid: true });
                return fallback;
            }
            if (this._size(raw) > maxBytes) {
                this._quarantine(key, raw, 'value exceeds ' + maxBytes + ' bytes');
                this._stores.set(key, { version, bytes: this._size(raw), updated: null, valid: false });
                return fallback;
            }

            let parsed;
            try { parsed = this._parse(raw); } catch (e) {
                this._quarantine(key, raw, 'malformed JSON');
                this._stores.set(key, { version, bytes: this._size(raw), updated: null, valid: false });
                return fallback;
            }

            const envelope = parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'schema') && Object.prototype.hasOwnProperty.call(parsed, 'data');
            let data = envelope ? parsed.data : parsed;
            const storedVersion = envelope ? Number(parsed.schema) : 0;
            let migrated = false;
            try {
                if (storedVersion > version) throw new Error('unsupported schema ' + storedVersion);
                if (options.migrate && storedVersion !== version) {
                    data = options.migrate(data, storedVersion);
                    migrated = true;
                }
                if (options.validate && !options.validate(data)) throw new Error('schema validation failed');
            } catch (e) {
                this._quarantine(key, raw, e.message);
                this._stores.set(key, { version, bytes: this._size(raw), updated: parsed?.updated || null, valid: false });
                return fallback;
            }

            const shouldRewrite = !envelope || storedVersion !== version || migrated;
            if (shouldRewrite) this.write(key, data, { version, maxBytes });
            this._stores.set(key, { version, bytes: this._size(raw), updated: parsed?.updated || null, valid: true });
            return data;
        },

        write(key, data, options = {}) {
            const version = Number.isInteger(options.version) ? options.version : 1;
            const maxBytes = options.maxBytes || this.MAX_BYTES;
            const envelope = { schema: version, updated: new Date().toISOString(), data };
            let serialized;
            try { serialized = JSON.stringify(envelope); } catch (e) {
                this._emit('error', 'serialization failed: ' + e.message, key);
                return false;
            }
            const bytes = this._size(serialized);
            if (bytes > maxBytes) {
                this._emit('error', 'write rejected above ' + maxBytes + ' bytes', key);
                return false;
            }
            try {
                GM_setValue(key, serialized);
                this._stores.set(key, { version, bytes, updated: envelope.updated, valid: true });
                return true;
            } catch (e) {
                this._emit('error', 'write failed: ' + e.message, key);
                return false;
            }
        },

        remove(key) {
            try {
                GM_setValue(key, '');
                this._stores.delete(key);
                return true;
            } catch (e) {
                this._emit('error', 'clear failed: ' + e.message, key);
                return false;
            }
        },

        inspect(keys) {
            return keys.map(key => {
                const known = this._stores.get(key);
                const raw = this._getRaw(key);
                return { key, bytes: known?.bytes || (raw ? this._size(raw) : 0), updated: known?.updated || null, valid: known?.valid !== false };
            });
        }
    };

    // =====================================================================
    //  FETCH INTERCEPTOR (SSE stream usage data)
    // =====================================================================
    const StreamMonitor = {
        _installed: false,
        lastUsage: null,
        lastMessageLimit: null,
        _lastStream: null,

        install() {
            if (this._installed) return;
            this._installed = true;
            const origFetch = window.fetch;
            const self = this;
            window.fetch = async function (...args) {
                try {
                    const request = args[0];
                    const init = args[1] || {};
                    const url = typeof request === 'string' ? request : request?.url || '';
                    const method = (init.method || request?.method || 'GET').toUpperCase();
                    if (method === 'POST' && (url.includes('/completion') || url.includes('/chat_conversations'))) {
                        EventBus.emit('usage:sent', { time: Date.now(), url });
                    }
                } catch (e) { /* never break app */ }
                const response = await origFetch.apply(this, args);
                try {
                    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
                    if (url.includes('/completion') || url.includes('/chat_conversations')) {
                        const ct = response.headers?.get?.('content-type') || '';
                        if (ct.includes('text/event-stream')) {
                            self._processStream(response.clone()).catch(() => {});
                        }
                    }
                } catch (e) { /* never break app */ }
                return response;
            };
        },

        async _processStream(response) {
            if (!response?.body?.getReader) {
                this._lastStream = { status: 'unsupported', detail: 'SSE response body unavailable', time: new Date().toISOString() };
                EventBus.emit('stream:health', this._lastStream);
                return;
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let malformed = 0;
            let events = 0;
            let streamStatus = 'complete';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const j = line.substring(6).trim();
                        if (!j || j === '[DONE]') continue;
                        try { this._processSSE(JSON.parse(j)); events++; } catch (e) { malformed++; }
                    }
                }
            } catch (e) { streamStatus = 'aborted'; }
            this._lastStream = { status: streamStatus, events, malformed, time: new Date().toISOString(), detail: malformed ? 'Malformed SSE events skipped' : 'OK' };
            EventBus.emit('stream:health', this._lastStream);
            EventBus.emit('stream:end');
        },

        _processSSE(data) {
            if (!data || typeof data !== 'object') throw new Error('SSE payload is not an object');
            // Message limit data
            if (data.message_limit !== undefined) {
                this.lastMessageLimit = data.message_limit;
                EventBus.emit('stream:messageLimit', data.message_limit);
            }
            // Direct utilization value
            if (data.utilization !== undefined && typeof data.utilization === 'number') {
                EventBus.emit('stream:utilization', data.utilization);
            }
            // Token usage data
            if (data.usage) {
                this.lastUsage = data.usage;
                EventBus.emit('stream:usage', data.usage);
            }
            // Message limit within_limit type
            if (data.type === 'message_limit' && data.message_limit?.type === 'within_limit') {
                EventBus.emit('stream:messageLimit', data.message_limit);
            }
            // Rate limit data
            if (data.rate_limit) {
                EventBus.emit('stream:rateLimit', data.rate_limit);
            }
            // Generation lifecycle
            if (data.type === 'message_start') EventBus.emit('stream:start', data);
            if (data.type === 'message_stop') EventBus.emit('stream:stop', data);
        }
    };

    // =====================================================================
    //  MODULE: THEME ENGINE
    // =====================================================================
    const ThemeModule = {
        id: 'theme',

        THEMES: {
            oceanic: {
                name: 'Oceanic Dark',
                vars: `
                    --accent-main-000: 195 54.2% 44.2%; --accent-main-100: 195 63.1% 52.6%;
                    --accent-main-200: 195 63.1% 52.6%; --accent-main-900: 0 0% 0%;
                    --bg-000: 240 8% 11.4%; --bg-100: 240 8% 7.5%; --bg-200: 210 8% 4.8%;
                    --bg-300: var(--bg-000); --bg-400: var(--bg-000); --bg-500: 0 0% 0%;
                    --text-000: 228 33.3% 90.1%; --text-100: 228 33.3% 90.1%;
                    --text-200: 230 9% 66.7%; --text-300: 230 9% 66.7%;
                    --text-400: 228 4.8% 52.2%; --text-500: 228 4.8% 52.2%;
                    --border-100: 231 16.5% 77.5%; --border-200: 231 16.5% 77.5%;
                    --border-300: 231 16.5% 77.5%; --border-400: 231 16.5% 77.5%;
                    --danger-000: 180 98.4% 68.1%; --danger-100: 180 67% 52.6%;
                    --danger-200: 180 67% 52.6%; --danger-900: 180 46.5% 20.8%;
                    --success-000: 277 59.1% 39.1%; --success-100: 277 75% 25.9%;
                    --success-200: 277 75% 25.9%; --success-900: 307 100% 6.9%;
                    --accent-pro-000: 71 84.6% 67.5%; --accent-pro-100: 71 40.2% 47.1%;
                    --accent-secondary-000: 30 65.5% 60.1%; --accent-secondary-100: 30 70.9% 44.6%;
                    --oncolor-100: 0 0% 93%; --oncolor-200: 240 6.7% 90.1%; --oncolor-300: 240 6.7% 90.1%;
                `
            },
            midnight: {
                name: 'Midnight',
                vars: `
                    --accent-main-000: 260 60% 50%; --accent-main-100: 260 70% 60%;
                    --accent-main-200: 260 70% 60%; --accent-main-900: 0 0% 0%;
                    --bg-000: 240 12% 9%; --bg-100: 240 12% 6%; --bg-200: 240 12% 4%;
                    --bg-300: var(--bg-000); --bg-400: var(--bg-000); --bg-500: 0 0% 0%;
                    --text-000: 220 30% 92%; --text-100: 220 30% 92%;
                    --text-200: 220 10% 65%; --text-300: 220 10% 65%;
                    --text-400: 220 5% 50%; --text-500: 220 5% 50%;
                    --border-100: 240 10% 25%; --border-200: 240 10% 25%;
                    --border-300: 240 10% 25%; --border-400: 240 10% 25%;
                    --danger-000: 0 80% 65%; --danger-100: 0 70% 55%;
                    --success-000: 150 60% 45%; --success-100: 150 50% 35%;
                    --oncolor-100: 0 0% 93%; --oncolor-200: 0 0% 88%; --oncolor-300: 0 0% 88%;
                `
            },
            // Catppuccin Mocha — https://github.com/catppuccin/catppuccin
            // Base palette converted to HSL: base=#1e1e2e, mantle=#181825, crust=#11111b,
            // text=#cdd6f4, subtext0=#a6adc8, mauve=#cba6f7 (accent), red=#f38ba8, green=#a6e3a1
            mocha: {
                name: 'Catppuccin Mocha',
                vars: `
                    --accent-main-000: 267 84% 81%; --accent-main-100: 267 84% 81%;
                    --accent-main-200: 267 84% 75%; --accent-main-900: 240 21% 15%;
                    --bg-000: 240 21% 15%; --bg-100: 240 23% 12%; --bg-200: 240 23% 9%;
                    --bg-300: var(--bg-000); --bg-400: var(--bg-000); --bg-500: 240 23% 9%;
                    --text-000: 226 64% 88%; --text-100: 226 64% 88%;
                    --text-200: 228 24% 72%; --text-300: 228 24% 72%;
                    --text-400: 228 17% 64%; --text-500: 228 17% 64%;
                    --border-100: 234 13% 31%; --border-200: 234 13% 31%;
                    --border-300: 234 13% 31%; --border-400: 234 13% 31%;
                    --danger-000: 343 81% 75%; --danger-100: 343 81% 68%;
                    --danger-200: 343 81% 68%; --danger-900: 343 50% 25%;
                    --success-000: 115 54% 76%; --success-100: 115 54% 68%;
                    --success-200: 115 54% 68%; --success-900: 115 50% 20%;
                    --accent-pro-000: 41 86% 83%; --accent-pro-100: 41 86% 70%;
                    --accent-secondary-000: 23 92% 75%; --accent-secondary-100: 23 92% 65%;
                    --oncolor-100: 240 21% 15%; --oncolor-200: 240 21% 15%; --oncolor-300: 240 21% 15%;
                `
            },
            // Catppuccin Macchiato — base=#24273a, mantle=#1e2030, crust=#181926,
            // text=#cad3f5, subtext0=#a5adcb, mauve=#c6a0f6 (accent), red=#ed8796, green=#a6da95
            macchiato: {
                name: 'Catppuccin Macchiato',
                vars: `
                    --accent-main-000: 267 83% 80%; --accent-main-100: 267 83% 80%;
                    --accent-main-200: 267 83% 74%; --accent-main-900: 232 23% 18%;
                    --bg-000: 232 23% 18%; --bg-100: 233 24% 15%; --bg-200: 233 30% 11%;
                    --bg-300: var(--bg-000); --bg-400: var(--bg-000); --bg-500: 233 30% 11%;
                    --text-000: 227 68% 88%; --text-100: 227 68% 88%;
                    --text-200: 228 20% 73%; --text-300: 228 20% 73%;
                    --text-400: 228 15% 65%; --text-500: 228 15% 65%;
                    --border-100: 231 16% 34%; --border-200: 231 16% 34%;
                    --border-300: 231 16% 34%; --border-400: 231 16% 34%;
                    --danger-000: 351 74% 73%; --danger-100: 351 74% 66%;
                    --danger-200: 351 74% 66%; --danger-900: 351 50% 25%;
                    --success-000: 105 48% 72%; --success-100: 105 48% 64%;
                    --success-200: 105 48% 64%; --success-900: 105 40% 20%;
                    --accent-pro-000: 40 70% 78%; --accent-pro-100: 40 70% 65%;
                    --accent-secondary-000: 21 86% 73%; --accent-secondary-100: 21 86% 63%;
                    --oncolor-100: 232 23% 18%; --oncolor-200: 232 23% 18%; --oncolor-300: 232 23% 18%;
                `
            },
            // Catppuccin Frappe — base=#303446, mantle=#292c3c, crust=#232634,
            // text=#c6d0f5, subtext0=#a5adce, mauve=#ca9ee6 (accent), red=#e78284, green=#a6d189
            frappe: {
                name: 'Catppuccin Frappé',
                vars: `
                    --accent-main-000: 277 59% 76%; --accent-main-100: 277 59% 76%;
                    --accent-main-200: 277 59% 70%; --accent-main-900: 229 19% 23%;
                    --bg-000: 229 19% 23%; --bg-100: 231 19% 20%; --bg-200: 231 20% 17%;
                    --bg-300: var(--bg-000); --bg-400: var(--bg-000); --bg-500: 231 20% 17%;
                    --text-000: 227 70% 87%; --text-100: 227 70% 87%;
                    --text-200: 228 17% 73%; --text-300: 228 17% 73%;
                    --text-400: 228 13% 65%; --text-500: 228 13% 65%;
                    --border-100: 230 13% 38%; --border-200: 230 13% 38%;
                    --border-300: 230 13% 38%; --border-400: 230 13% 38%;
                    --danger-000: 359 68% 71%; --danger-100: 359 68% 64%;
                    --danger-200: 359 68% 64%; --danger-900: 359 50% 25%;
                    --success-000: 96 44% 68%; --success-100: 96 44% 60%;
                    --success-200: 96 44% 60%; --success-900: 96 40% 20%;
                    --accent-pro-000: 40 62% 73%; --accent-pro-100: 40 62% 60%;
                    --accent-secondary-000: 20 79% 70%; --accent-secondary-100: 20 79% 60%;
                    --oncolor-100: 229 19% 23%; --oncolor-200: 229 19% 23%; --oncolor-300: 229 19% 23%;
                `
            },
            // Catppuccin Latte (LIGHT theme) — base=#eff1f5, mantle=#e6e9ef, crust=#dce0e8,
            // text=#4c4f69, subtext0=#6c6f85, mauve=#8839ef (accent), red=#d20f39, green=#40a02b
            latte: {
                name: 'Catppuccin Latte',
                light: true,
                vars: `
                    --accent-main-000: 266 85% 58%; --accent-main-100: 266 85% 58%;
                    --accent-main-200: 266 85% 50%; --accent-main-900: 220 23% 95%;
                    --bg-000: 220 23% 95%; --bg-100: 227 16% 92%; --bg-200: 223 16% 88%;
                    --bg-300: var(--bg-000); --bg-400: var(--bg-000); --bg-500: 223 16% 88%;
                    --text-000: 234 16% 35%; --text-100: 234 16% 35%;
                    --text-200: 233 10% 47%; --text-300: 233 10% 47%;
                    --text-400: 233 10% 55%; --text-500: 233 10% 55%;
                    --border-100: 225 14% 77%; --border-200: 225 14% 77%;
                    --border-300: 225 14% 77%; --border-400: 225 14% 77%;
                    --danger-000: 347 87% 44%; --danger-100: 347 87% 38%;
                    --danger-200: 347 87% 38%; --danger-900: 347 60% 85%;
                    --success-000: 109 58% 40%; --success-100: 109 58% 34%;
                    --success-200: 109 58% 34%; --success-900: 109 40% 85%;
                    --accent-pro-000: 35 77% 49%; --accent-pro-100: 35 77% 42%;
                    --accent-secondary-000: 22 99% 52%; --accent-secondary-100: 22 99% 45%;
                    --oncolor-100: 220 23% 95%; --oncolor-200: 227 16% 92%; --oncolor-300: 227 16% 92%;
                `
            }
        },

        init() {
            this._apply();
            EventBus.on('setting:themeEnabled', () => this._apply());
            EventBus.on('setting:themeVariant', () => this._apply());
            EventBus.on('setting:fontOverride', () => this._apply());
        },

        _apply() {
            if (!Settings.get('themeEnabled') || Settings.get('themeVariant') === 'none') {
                removeCSS(PREFIX + '-theme');
                return;
            }
            const theme = this.THEMES[Settings.get('themeVariant')];
            if (!theme) { removeCSS(PREFIX + '-theme'); return; }
            const fontCSS = Settings.get('fontOverride') ? `
                :root { --font-anthropic-serif: var(--font-anthropic-sans) !important; --font-ui-serif: var(--font-ui) !important; }
            ` : '';
            const modeSelector = theme.light
                ? '[data-theme=claude][data-mode=light]'
                : '[data-theme=claude][data-mode=dark]';
            injectCSS(PREFIX + '-theme', `
                ${modeSelector} { ${theme.vars} }
                ${fontCSS}
                * { scrollbar-color: hsla(var(--bg-300, 240 8% 11.4%)/50%) transparent !important; }
                *, *:after, *:before { --tw-gradient-from-position: none !important; }
            `);
        },

        destroy() { removeCSS(PREFIX + '-theme'); }
    };

    // =====================================================================
    //  MODULE: FOCUS MODE (anti-distraction)
    // =====================================================================
    const FocusModule = {
        id: 'focusMode',

        init() {
            this._apply();
            EventBus.on('setting:focusMode', () => this._apply());
        },

        _apply() {
            if (!Settings.get('focusMode')) { removeCSS(PREFIX + '-focus'); return; }
            injectCSS(PREFIX + '-focus', `
                /* Hide the sidebar/navigation */
                nav, [class*="sidebar"], [class*="side-navigation"] { display: none !important; }
                /* Expand main content area */
                main { margin-left: 0 !important; }
                [class*="has-sidebar"] { grid-template-columns: 1fr !important; }
            `);
        },

        destroy() { removeCSS(PREFIX + '-focus'); }
    };

    // =====================================================================
    //  MODULE: DENSITY
    // =====================================================================
    const DensityModule = {
        id: 'density',

        MODES: {
            comfortable: { name: 'Comfortable', css: '' }, // default — no overrides
            compact: {
                name: 'Compact',
                css: `
                    .font-claude-message, [class*="prose"] { font-size: 14px !important; line-height: 1.45 !important; }
                    .group, [data-testid="user-message"] { padding-top: 4px !important; padding-bottom: 4px !important; }
                    h1 { font-size: 1.3em !important; } h2 { font-size: 1.15em !important; } h3 { font-size: 1.05em !important; }
                    pre { padding: 8px !important; margin: 6px 0 !important; }
                    ul, ol { margin: 4px 0 !important; }
                    p { margin: 4px 0 !important; }
                `
            },
            reading: {
                name: 'Reading',
                css: `
                    .font-claude-message, [class*="prose"] { font-size: 17px !important; line-height: 1.8 !important; letter-spacing: 0.01em !important; }
                    .group, [data-testid="user-message"] { padding-top: 16px !important; padding-bottom: 16px !important; }
                    p { margin: 12px 0 !important; }
                    pre { padding: 16px !important; margin: 16px 0 !important; font-size: 15px !important; }
                `
            }
        },

        init() {
            this._apply();
            EventBus.on('setting:densityMode', () => this._apply());
        },

        _apply() {
            const mode = Settings.get('densityMode');
            const m = this.MODES[mode];
            if (!m || !m.css) { removeCSS(PREFIX + '-density'); return; }
            injectCSS(PREFIX + '-density', m.css);
        },

        destroy() { removeCSS(PREFIX + '-density'); }
    };

    // =====================================================================
    //  MODULE: WIDE LAYOUT
    // =====================================================================
    const LayoutModule = {
        id: 'layout',
        _observer: null,

        init() {
            this._apply();
            EventBus.on('setting:wideMode', () => this._apply());
            EventBus.on('setting:chatWidthPct', () => this._apply());
        },

        _apply() {
            if (!Settings.get('wideMode')) { removeCSS(PREFIX + '-layout'); this._stopObserver(); return; }
            const pct = Settings.get('chatWidthPct');
            injectCSS(PREFIX + '-layout', `
                /* Wide layout override */
                [class*="mx-auto"] { max-width: ${pct}% !important; }
                .mx-auto { max-width: ${pct}% !important; }
                div[data-test-render-count] { max-width: ${pct}% !important; }
                div[data-test-render-count] > * { max-width: 100% !important; }
                /* Also widen parent containers */
                main > div > div > div { max-width: ${pct}% !important; }
            `);
        },

        _stopObserver() { if (this._observer) { this._observer.disconnect(); this._observer = null; } },
        destroy() { removeCSS(PREFIX + '-layout'); this._stopObserver(); }
    };

    // =====================================================================
    //  MODULE: VISUAL ENHANCEMENT
    // =====================================================================
    const VisualModule = {
        id: 'visual',
        _boldObserver: null,

        COLORS: {
            orange: 'darkorange', green: 'springgreen', lime: 'limegreen', darkGreen: '#00ad00',
            red: 'crimson', yellow: 'gold', skyblue: 'deepskyblue', blue: '#4285f4',
            violet: 'darkviolet', purple: '#9c27b0', cyan: '#00bcd4', pink: '#e91e63',
            gray: 'gray', teal: '#009688'
        },

        init() {
            this._applyButtons();
            this._applyBoldItalic();
            this._applyAnimations();
            this._applyScrollbar();
            this._startBoldObserver();
            EventBus.on('setting:coloredButtons', () => this._applyButtons());
            EventBus.on('setting:coloredBoldItalic', () => { this._applyBoldItalic(); this._colorBoldElements(); });
            EventBus.on('setting:smoothAnimations', () => this._applyAnimations());
            EventBus.on('setting:customScrollbar', () => this._applyScrollbar());
        },

        _applyButtons() {
            if (!Settings.get('coloredButtons')) { removeCSS(PREFIX + '-buttons'); return; }
            const C = this.COLORS;
            injectCSS(PREFIX + '-buttons', `
                /* Copy - Orange */
                button[aria-label*="Copy" i] svg { color: ${C.orange} !important; opacity: 0.9; transition: all 0.3s ease !important; }
                button[aria-label*="Copy" i]:hover svg { filter: drop-shadow(0 0 8px ${C.orange}) !important; opacity: 1 !important; }
                /* Edit - Yellow */
                button[aria-label*="Edit" i] svg { color: ${C.yellow} !important; opacity: 0.8; transition: all 0.3s ease !important; }
                button[aria-label*="Edit" i]:hover svg { filter: drop-shadow(0 0 8px ${C.yellow}) !important; opacity: 1 !important; }
                /* Retry - Sky Blue */
                button[aria-label*="Retry" i] svg, button[aria-label*="Regenerate" i] svg { color: ${C.skyblue} !important; opacity: 0.9; transition: all 0.3s ease !important; }
                button[aria-label*="Retry" i]:hover svg { filter: drop-shadow(0 0 8px ${C.skyblue}) !important; opacity: 1 !important; }
                /* Thumbs Up - Green */
                button[aria-label*="Good" i] svg { color: ${C.darkGreen} !important; opacity: 0.9; transition: all 0.3s ease !important; }
                button[aria-label*="Good" i]:hover svg { filter: drop-shadow(0 0 8px ${C.darkGreen}) !important; opacity: 1 !important; }
                button[aria-label*="Good" i]:hover { background: rgba(0,173,0,0.12) !important; }
                /* Thumbs Down - Red */
                button[aria-label*="Bad" i] svg { color: ${C.red} !important; opacity: 0.9; transition: all 0.3s ease !important; }
                button[aria-label*="Bad" i]:hover svg { filter: drop-shadow(0 0 8px ${C.red}) !important; opacity: 1 !important; }
                button[aria-label*="Bad" i]:hover { background: rgba(220,53,69,0.12) !important; }
                /* Delete - Red */
                button[aria-label*="Delete" i] svg { color: #e02e2a !important; }
                button[aria-label*="Delete" i]:hover { background: rgba(224,46,42,0.15) !important; box-shadow: 0 0 15px rgba(224,46,42,0.3) !important; }
                /* Share - Sky Blue */
                button[aria-label*="Share" i] svg { color: ${C.skyblue} !important; opacity: 0.8; transition: all 0.3s ease !important; }
                button[aria-label*="Share" i]:hover svg { filter: drop-shadow(0 0 8px ${C.skyblue}) !important; }
                /* List markers */
                .font-claude-message ul li::marker, [class*="prose"] ul li::marker { color: ${C.green} !important; }
                .font-claude-message ol li::marker, [class*="prose"] ol li::marker { color: ${C.blue} !important; font-weight: bold !important; }
                /* Blockquote */
                blockquote { border-left: 4px solid ${C.green} !important; padding-left: 16px !important; opacity: 0.9; }
                /* Code blocks */
                pre { border-radius: 8px !important; }
            `);
        },

        _applyBoldItalic() {
            if (!Settings.get('coloredBoldItalic')) { removeCSS(PREFIX + '-bold'); return; }
            const C = this.COLORS;
            injectCSS(PREFIX + '-bold', `
                .font-claude-message strong, .font-claude-message b,
                [class*="prose"] strong, [class*="prose"] b { color: ${C.green} !important; }
                .font-claude-message em, .font-claude-message i,
                [class*="prose"] em, [class*="prose"] i { color: ${C.skyblue} !important; }
            `);
        },

        _colorBoldElements() {
            if (!Settings.get('coloredBoldItalic')) return;
            $$('b:not([data-cue-styled]), strong:not([data-cue-styled])').forEach(el => {
                el.setAttribute('data-cue-styled', '1');
                el.style.setProperty('color', this.COLORS.green, 'important');
            });
            $$('i:not([data-cue-styled]), em:not([data-cue-styled])').forEach(el => {
                el.setAttribute('data-cue-styled', '1');
                el.style.setProperty('color', this.COLORS.skyblue, 'important');
            });
        },

        _startBoldObserver() {
            if (this._boldObserver) this._boldObserver.disconnect();
            let timer;
            this._boldObserver = new MutationObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => this._colorBoldElements(), 200);
            });
            const start = () => {
                if (document.body) this._boldObserver.observe(document.body, { childList: true, subtree: true });
                else setTimeout(start, 200);
            };
            start();
        },

        _applyAnimations() {
            if (!Settings.get('smoothAnimations')) { removeCSS(PREFIX + '-anim'); return; }
            injectCSS(PREFIX + '-anim', `
                @keyframes cue-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                button svg { transition: all 0.3s cubic-bezier(0.4,0,0.2,1) !important; }
                button:focus-visible { outline: 2px solid #4285f4 !important; outline-offset: 2px !important; }
            `);
        },

        _applyScrollbar() {
            if (!Settings.get('customScrollbar')) { removeCSS(PREFIX + '-scroll'); return; }
            injectCSS(PREFIX + '-scroll', `
                ::-webkit-scrollbar { width: 10px; height: 10px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.25); border-radius: 5px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.4); }
            `);
        },

        destroy() {
            removeCSS(PREFIX + '-buttons');
            removeCSS(PREFIX + '-bold');
            removeCSS(PREFIX + '-anim');
            removeCSS(PREFIX + '-scroll');
            if (this._boldObserver) this._boldObserver.disconnect();
        }
    };

    // =====================================================================
    //  MODULE: PASTE FIX
    // =====================================================================
    const PasteFixModule = {
        id: 'pasteFix',
        _handler: null,

        init() {
            this._handler = (e) => {
                if (!Settings.get('pasteFix')) return;
                const cd = e.clipboardData || window.clipboardData;
                if (cd.types.includes('text/plain') && cd.types.includes('text/html')) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const plain = cd.getData('text/plain');
                    const dt = new DataTransfer();
                    dt.setData('text/plain', plain.trimStart());
                    e.target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
                }
            };
            document.addEventListener('paste', this._handler, true);
        },
        destroy() {
            if (this._handler) document.removeEventListener('paste', this._handler, true);
        }
    };

    // =====================================================================
    //  MODULE: AUTO-SCROLL
    // =====================================================================
    const AutoScrollModule = {
        id: 'autoScroll',
        _observer: null,
        _timer: null,

        init() {
            this._start();
            EventBus.on('setting:autoScroll', (v) => v ? this._start() : this._stop());
        },

        scrollToBottom() {
            for (const el of [document.querySelector('main'), document.querySelector('[class*="overflow-y"]'), document.querySelector('[class*="scroll"]')].filter(Boolean)) {
                if (el.scrollHeight > el.clientHeight) { el.scrollTop = el.scrollHeight; return; }
            }
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
        },

        _start() {
            if (this._observer) this._observer.disconnect();
            this._observer = new MutationObserver(() => {
                if (!Settings.get('autoScroll')) return;
                clearTimeout(this._timer);
                this._timer = setTimeout(() => this.scrollToBottom(), 150);
            });
            this._observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true, characterData: true });
        },

        _stop() { if (this._observer) this._observer.disconnect(); },
        destroy() { this._stop(); }
    };

    // =====================================================================
    //  MODULE: AUTO-APPROVE
    // =====================================================================
    const AutoApproveModule = {
        id: 'autoApprove',
        _observer: null,

        init() {
            this._start();
            EventBus.on('setting:autoApprove', (v) => v ? this._start() : this._stop());
        },

        _start() {
            if (this._observer) this._observer.disconnect();
            this._observer = new MutationObserver(() => {
                if (!Settings.get('autoApprove')) return;
                const dlg = $(SEL.dialogOpen) || $(SEL.dialog);
                if (!dlg) return;
                for (const btn of dlg.querySelectorAll('button')) {
                    const t = btn.textContent.toLowerCase().trim();
                    if (t.includes('allow for this chat') || t.includes('allow once') || t.includes('allow always')) {
                        btn.click();
                        showToast('Auto-approved: ' + btn.textContent.trim(), 2000, 'info');
                        return;
                    }
                }
            });
            this._observer.observe(document.body, { childList: true, subtree: true });
        },

        _stop() { if (this._observer) this._observer.disconnect(); },
        destroy() { this._stop(); }
    };

    // =====================================================================
    //  MODULE: USAGE TRACKER (local rolling send counters)
    // =====================================================================
    const UsageTrackerModule = {
        id: 'usageTracker',
        STORAGE_KEY: PREFIX + '_usage_events',
        _events: [],
        _sessionStart: Date.now(),

        init() {
            this._load();
            EventBus.on('usage:sent', (d) => this.record(d?.time || Date.now()));
        },

        _load() {
            this._events = StorageRepository.read(this.STORAGE_KEY, [], {
                version: 1,
                maxBytes: 256 * 1024,
                migrate: value => Array.isArray(value) ? value : JSON.parse(value || '[]'),
                validate: value => Array.isArray(value) && value.every(t => Number.isFinite(t))
            }).filter(t => Number.isFinite(t)).slice(-10000);
            this._prune();
        },

        _save() { StorageRepository.write(this.STORAGE_KEY, this._events, { version: 1, maxBytes: 256 * 1024 }); },

        _prune() {
            const cutoff = Date.now() - (8 * 24 * 60 * 60 * 1000);
            this._events = this._events.filter(t => t >= cutoff);
        },

        record(time) {
            this._events.push(time);
            this._prune();
            this._save();
            EventBus.emit('usage:localUpdated', this.getStats());
        },

        getStats() {
            const now = Date.now();
            const within = ms => this._events.filter(t => now - t <= ms).length;
            return {
                session: this._events.filter(t => t >= this._sessionStart).length,
                fiveHour: within(5 * 60 * 60 * 1000),
                sevenDay: within(7 * 24 * 60 * 60 * 1000),
                totalCached: this._events.length
            };
        },

        destroy() {}
    };

    // =====================================================================
    //  MODULE: CONTEXT TRACKER
    // =====================================================================
    const ContextModule = {
        id: 'context',
        _interval: null,
        QUALITY_DEGRADE_TURNS: 25,
        NEW_CHAT_THRESHOLD: 0.85,
        data: {
            turns: 0, userMsgs: 0, assistantMsgs: 0,
            estimatedTokens: 0, chatStartTime: null,
            sseUtilization: null, history: [],
        },

        init() {
            this._count();
            this._interval = setInterval(() => { this._count(); }, 10000);
            EventBus.on('stream:usage', (u) => {
                const total = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
                if (total > 0) this.data.sseUtilization = total / Settings.get('contextWindow');
            });
            EventBus.on('stream:utilization', (v) => { this.data.sseUtilization = v; });
        },

        _count() {
            if (!Settings.get('contextTracker')) return;
            const main = document.querySelector('main') || document.querySelector('[class*="conversation"]');
            if (!main) return;
            const userMsgs = main.querySelectorAll(SEL.userMsg);
            const allGroups = main.querySelectorAll(SEL.msgGroup);
            let ac = 0; allGroups.forEach(g => { if (!g.querySelector(SEL.userMsg)) ac++; });
            this.data.userMsgs = userMsgs.length;
            this.data.assistantMsgs = ac;
            this.data.turns = Math.min(userMsgs.length, ac);
            if (this.data.turns > 0 && !this.data.chatStartTime) this.data.chatStartTime = Date.now();
            // Token estimation: max of char-based and word-based
            const text = main.innerText || '';
            const charEst = Math.ceil(text.length / 4);
            const wordEst = Math.ceil(text.split(/\s+/).filter(w => w).length * 1.3);
            this.data.estimatedTokens = Math.max(charEst, wordEst);
            // History for burn rate
            const lastPt = this.data.history[this.data.history.length - 1];
            if (!lastPt || Date.now() - lastPt.time > 30000) {
                this.data.history.push({ time: Date.now(), tokens: this.data.estimatedTokens, turns: this.data.turns });
                if (this.data.history.length > 120) this.data.history.shift();
            }
            EventBus.emit('context:updated', this.getHealth());
        },

        getFill() {
            return this.data.sseUtilization !== null
                ? this.data.sseUtilization
                : this.data.estimatedTokens / Settings.get('contextWindow');
        },

        getBurnRate() {
            const h = this.data.history;
            if (h.length < 2) return 0;
            const now = Date.now(), recent = h.filter(p => now - p.time < 300000);
            if (recent.length < 2) return 0;
            const dt = (recent[recent.length - 1].time - recent[0].time) / 60000;
            return dt < 0.5 ? 0 : Math.round((recent[recent.length - 1].tokens - recent[0].tokens) / dt);
        },

        getTimeToFull() {
            const rate = this.getBurnRate(); if (rate <= 0) return null;
            const remaining = (this.NEW_CHAT_THRESHOLD - this.getFill()) * Settings.get('contextWindow');
            return remaining <= 0 ? 0 : remaining / rate;
        },

        getHealth() {
            const fill = this.getFill(), turns = this.data.turns, ttf = this.getTimeToFull();
            let score = 100;
            // Fill scoring
            if (fill > this.NEW_CHAT_THRESHOLD) score -= 60;
            else if (fill > Settings.get('criticalThreshold')) score -= 40;
            else if (fill > Settings.get('warnThreshold')) score -= 20;
            // Turn quality degradation
            if (turns > this.QUALITY_DEGRADE_TURNS * 2) score -= 30;
            else if (turns > this.QUALITY_DEGRADE_TURNS) score -= 15;
            else if (turns > this.QUALITY_DEGRADE_TURNS * 0.6) score -= 5;
            // Time-to-full urgency
            if (ttf !== null && ttf < 5) score -= 15;
            else if (ttf !== null && ttf < 15) score -= 5;
            score = Math.max(0, Math.min(100, score));
            let level, advice;
            if (score >= 70) { level = 'good'; advice = 'Context is healthy'; }
            else if (score >= 40) { level = 'warn'; advice = 'Consider wrapping up soon'; }
            else if (score >= 15) { level = 'critical'; advice = 'Start a new chat soon'; }
            else { level = 'danger'; advice = 'Start a new chat now'; }
            return {
                score, fill: Math.min(1, fill), level, advice, turns, ttf,
                tokens: this.data.estimatedTokens, burnRate: this.getBurnRate(),
                duration: this.data.chatStartTime ? Date.now() - this.data.chatStartTime : 0
            };
        },

        destroy() { clearInterval(this._interval); }
    };

    // =====================================================================
    //  MODULE: CACHE INDICATOR
    // =====================================================================
    const CacheModule = {
        id: 'cacheIndicator',
        _timerInterval: null,
        lastCacheHit: false,
        lastCacheTime: null,
        CACHE_TTL: 300, // 5 minutes default TTL for prompt caching

        init() {
            EventBus.on('stream:usage', (u) => {
                const cacheRead = u.cache_read_input_tokens || 0;
                if (cacheRead > 0) {
                    this.lastCacheHit = true;
                    this.lastCacheTime = Date.now();
                    EventBus.emit('cache:hit', { tokens: cacheRead });
                    this._startCountdown();
                } else {
                    this.lastCacheHit = false;
                    EventBus.emit('cache:miss');
                }
            });
            EventBus.on('navigation', () => {
                this.lastCacheHit = false;
                this.lastCacheTime = null;
                this._stopCountdown();
            });
        },

        _startCountdown() {
            this._stopCountdown();
            this._timerInterval = setInterval(() => {
                if (!this.lastCacheTime) { this._stopCountdown(); return; }
                const elapsed = (Date.now() - this.lastCacheTime) / 1000;
                const remaining = Math.max(0, this.CACHE_TTL - elapsed);
                EventBus.emit('cache:timer', { remaining, total: this.CACHE_TTL });
                if (remaining <= 0) {
                    this.lastCacheHit = false;
                    this.lastCacheTime = null;
                    EventBus.emit('cache:expired');
                    this._stopCountdown();
                }
            }, 1000);
        },

        _stopCountdown() {
            if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
        },

        destroy() { this._stopCountdown(); }
    };

    // =====================================================================
    //  MODULE: COST ESTIMATOR
    // =====================================================================
    const CostModule = {
        id: 'costEstimate',
        // Pricing per million tokens (as of mid-2026)
        PRICING: {
            'opus':   { input: 15.00, output: 75.00, cache_read: 1.50, cache_write: 18.75 },
            'sonnet': { input: 3.00,  output: 15.00, cache_read: 0.30, cache_write: 3.75 },
            'haiku':  { input: 0.80,  output: 4.00,  cache_read: 0.08, cache_write: 1.00 },
        },
        sessionCost: 0,
        lastModel: 'sonnet',
        messageCosts: [],

        init() {
            EventBus.on('stream:usage', (u) => this._calcCost(u));
            EventBus.on('stream:start', (d) => {
                // Try to detect model from stream data
                if (d.message?.model) {
                    const m = d.message.model.toLowerCase();
                    if (m.includes('opus')) this.lastModel = 'opus';
                    else if (m.includes('haiku')) this.lastModel = 'haiku';
                    else this.lastModel = 'sonnet';
                }
            });
            EventBus.on('navigation', () => { this.sessionCost = 0; this.messageCosts = []; });
        },

        _calcCost(usage) {
            const pricing = this.PRICING[this.lastModel] || this.PRICING.sonnet;
            const inputTokens = usage.input_tokens || 0;
            const outputTokens = usage.output_tokens || 0;
            const cacheRead = usage.cache_read_input_tokens || 0;
            const cacheWrite = usage.cache_creation_input_tokens || 0;

            const cost = (inputTokens * pricing.input / 1e6) +
                         (outputTokens * pricing.output / 1e6) +
                         (cacheRead * pricing.cache_read / 1e6) +
                         (cacheWrite * pricing.cache_write / 1e6);

            this.sessionCost += cost;
            this.messageCosts.push({ time: Date.now(), cost, model: this.lastModel });
            EventBus.emit('cost:updated', { messageCost: cost, sessionCost: this.sessionCost, model: this.lastModel });
        },

        getSessionCost() { return this.sessionCost; },
        getLastModel() { return this.lastModel; },

        destroy() {}
    };

    // =====================================================================
    //  MODULE: RESPONSE MONITOR
    // =====================================================================
    const ResponseModule = {
        id: 'responseMonitor',
        _interval: null,
        _timerInterval: null,
        _lastLen: 0,
        _lastChangeTs: 0,
        _stableCount: 0,
        _audioCtx: null,
        _flashTimer: null,
        _originalTitle: '',
        status: 'idle',  // idle | generating | stuck | complete | truncated
        genStartTime: null,
        lastDuration: 0,
        lastWords: 0,
        lastChars: 0,

        init() {
            this._lastChangeTs = Date.now();
            this._interval = setInterval(() => this._poll(), 2000);
        },

        _poll() {
            if (!Settings.get('responseMonitor')) return;
            const gen = DOM.isGenerating();
            const convo = (document.querySelector('main') || document.body).innerText;
            const now = Date.now();
            if (convo.length !== this._lastLen) { this._lastLen = convo.length; this._lastChangeTs = now; this._stableCount = 0; }
            else { this._stableCount++; }
            const wasGen = this.status === 'generating';
            if (gen) {
                if (this.status !== 'generating') {
                    this.genStartTime = Date.now();
                    this._startTimer();
                }
                this.status = 'generating';
                if (Settings.get('autoScroll')) AutoScrollModule.scrollToBottom();
                if (now - this._lastChangeTs > 90000) this.status = 'stuck';
                EventBus.emit('response:status', this.status);
            }
            else if (wasGen && this._stableCount >= 2) {
                const resp = DOM.getLastResponse();
                this.lastDuration = this.genStartTime ? Date.now() - this.genStartTime : 0;
                this._stopTimer();
                // Stats
                this.lastChars = resp.length;
                this.lastWords = resp.split(/\s+/).filter(w => w.length > 0).length;
                this.status = this._isTruncated(resp) ? 'truncated' : 'complete';
                this.genStartTime = null;
                EventBus.emit('response:status', this.status);
                EventBus.emit('response:complete', { duration: this.lastDuration, words: this.lastWords, chars: this.lastChars });
                if (Settings.get('autoScroll')) AutoScrollModule.scrollToBottom();
                // Notifications
                if (Settings.get('notifySound')) this._playSound();
                if (Settings.get('notifyFlash')) this._flashTab();
            }
            else if (!gen && this.status !== 'truncated' && this.status !== 'complete') {
                this.status = 'idle';
                EventBus.emit('response:status', this.status);
            }
        },

        _startTimer() {
            this._stopTimer();
            this._timerInterval = setInterval(() => EventBus.emit('response:timer', this.genStartTime ? Date.now() - this.genStartTime : 0), 200);
        },
        _stopTimer() {
            if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
        },

        _isTruncated(text) {
            if (!text || text.length < 50) return false;
            const t = text.trim();
            if ((t.match(/```/g) || []).length % 2 !== 0) return true;
            const tail = t.toLowerCase().slice(-300);
            for (const s of ['continue to keep the chat going', 'response was cut off', 'character limit', 'length limit', 'hit the limit']) { if (tail.includes(s)) return true; }
            const ll = t.split('\n').filter(l => l.trim()).pop() || '';
            if (!/[.!?:)`}\]>]$|COMPLETE$/i.test(ll.trim()) && !/[{;=,]$/.test(ll.trim()) && ll.length > 30) return true;
            return false;
        },

        _playSound() {
            if (document.hasFocus()) return;
            try {
                if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const now = this._audioCtx.currentTime;
                [660, 880].forEach((freq, i) => {
                    const osc = this._audioCtx.createOscillator();
                    const gain = this._audioCtx.createGain();
                    osc.type = 'sine'; osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.12, now + i * 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
                    osc.connect(gain); gain.connect(this._audioCtx.destination);
                    osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.25);
                });
            } catch (e) { /* AudioContext not available */ }
        },

        _flashTab() {
            if (document.hasFocus()) return;
            this._stopFlash();
            this._originalTitle = document.title;
            let on = true;
            this._flashTimer = setInterval(() => { document.title = on ? '>> Claude Done <<' : this._originalTitle; on = !on; }, 800);
            const stopOnFocus = () => { this._stopFlash(); window.removeEventListener('focus', stopOnFocus); };
            window.addEventListener('focus', stopOnFocus);
            setTimeout(() => this._stopFlash(), 30000);
        },
        _stopFlash() {
            if (this._flashTimer) { clearInterval(this._flashTimer); this._flashTimer = null; if (this._originalTitle) document.title = this._originalTitle; }
        },

        destroy() { clearInterval(this._interval); this._stopTimer(); this._stopFlash(); }
    };

    // =====================================================================
    //  MODULE: DOM TRIMMER
    // =====================================================================
    const DomTrimmerModule = {
        id: 'domTrimmer',
        _observer: null,
        _cache: new Map(),

        init() {
            EventBus.on('setting:domTrimmer', (v) => { if (!v) this.restoreAll(); });
            this._observer = new MutationObserver(() => {
                if (Settings.get('domTrimmer')) this._prune();
            });
            if (document.body) this._observer.observe(document.body, { childList: true, subtree: true });
        },

        _getMessages() {
            const main = $(SEL.main);
            if (!main) return [];
            // Look for conversation message groups
            return $$('.group, [data-testid="user-message"]', main).map(el => {
                // Walk up to find the actual removable container
                let target = el;
                while (target.parentElement && target.parentElement !== main && !target.parentElement.matches('main, [class*="flex-col"]')) {
                    target = target.parentElement;
                }
                return target;
            }).filter((el, i, arr) => arr.indexOf(el) === i); // deduplicate
        },

        _prune() {
            const msgs = this._getMessages();
            const keep = Settings.get('domKeepVisible');
            if (msgs.length <= keep) return;
            const toRemove = msgs.slice(0, msgs.length - keep);
            toRemove.forEach(el => {
                if (el.dataset.cueTrimmed) return;
                const id = 'trim-' + (this._cache.size + 1);
                const placeholder = document.createElement('div');
                placeholder.className = PREFIX + '-trim-placeholder';
                placeholder.dataset.trimId = id;
                placeholder.style.cssText = 'height:4px;margin:2px 0;background:rgba(128,128,128,0.1);border-radius:2px;';
                // Keep the original node detached instead of serializing and
                // reparsing host HTML. This preserves event handlers and
                // avoids turning conversation markup into an executable sink.
                this._cache.set(id, { node: el, parent: el.parentElement, next: el.nextSibling });
                el.replaceWith(placeholder);
            });
            EventBus.emit('trimmer:pruned', { removed: toRemove.length, total: msgs.length });
        },

        restoreAll() {
            this._cache.forEach((data, id) => {
                const ph = $(`[data-trim-id="${id}"]`);
                if (ph) {
                    ph.replaceWith(data.node);
                } else if (data.parent && data.parent.isConnected) {
                    data.parent.insertBefore(data.node, data.next && data.next.parentNode === data.parent ? data.next : null);
                }
            });
            this._cache.clear();
            EventBus.emit('trimmer:restored');
        },

        destroy() {
            if (this._observer) this._observer.disconnect();
            this.restoreAll();
        }
    };

    // =====================================================================
    //  MODULE: CODE FOLD
    // =====================================================================
    const CodeFoldModule = {
        id: 'codeFold',
        _observer: null,
        FOLD_THRESHOLD: 15, // lines before folding kicks in
        VISIBLE_LINES: 6,   // lines to show when folded

        init() {
            this._applyStyles();
            this._start();
            EventBus.on('setting:codeFold', (v) => { if (v) this._start(); else this._stop(); });
        },

        _applyStyles() {
            injectCSS(PREFIX + '-codefold', `
                .${PREFIX}-fold-container { position: relative; }
                .${PREFIX}-fold-container.folded pre { max-height: none; }
                .${PREFIX}-fold-container.folded .${PREFIX}-fold-code { display: none; }
                .${PREFIX}-fold-container.folded .${PREFIX}-fold-preview { display: block; }
                .${PREFIX}-fold-container:not(.folded) .${PREFIX}-fold-code { display: block; }
                .${PREFIX}-fold-container:not(.folded) .${PREFIX}-fold-preview { display: none; }
                .${PREFIX}-fold-toggle {
                    display: block; width: 100%; padding: 4px 12px; margin: 0;
                    background: rgba(88,166,255,0.06); border: none; border-top: 1px solid rgba(88,166,255,0.15);
                    color: #58a6ff; font-size: 11px; font-family: monospace; cursor: pointer;
                    text-align: left; transition: background 0.2s;
                }
                .${PREFIX}-fold-toggle:hover { background: rgba(88,166,255,0.12); }
                .${PREFIX}-fold-preview { white-space: pre; overflow: hidden; }
            `);
        },

        _start() {
            if (!Settings.get('codeFold')) return;
            // Process existing code blocks
            this._processAll();
            // Observe for new ones
            if (this._observer) this._observer.disconnect();
            let timer;
            this._observer = new MutationObserver(() => {
                if (!Settings.get('codeFold')) return;
                clearTimeout(timer);
                timer = setTimeout(() => this._processAll(), 500);
            });
            this._observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
        },

        _stop() {
            if (this._observer) this._observer.disconnect();
            // Unfold all
            $$('.' + PREFIX + '-fold-container').forEach(c => {
                c.classList.remove('folded');
                const toggle = c.querySelector('.' + PREFIX + '-fold-toggle');
                if (toggle) toggle.remove();
                const preview = c.querySelector('.' + PREFIX + '-fold-preview');
                if (preview) preview.remove();
                c.classList.remove(PREFIX + '-fold-container');
            });
        },

        _processAll() {
            $$('pre').forEach(pre => {
                if (pre.closest('#' + PREFIX + '-panel')) return;
                if (pre.dataset.cueFolded) return;
                const code = pre.querySelector('code') || pre;
                const text = code.innerText || code.textContent || '';
                const lines = text.split('\n');
                if (lines.length <= this.FOLD_THRESHOLD) return;
                pre.dataset.cueFolded = '1';

                // Wrap in container
                const container = document.createElement('div');
                container.className = PREFIX + '-fold-container folded';
                pre.parentNode.insertBefore(container, pre);

                // Move pre into container as the full code
                pre.classList.add(PREFIX + '-fold-code');
                container.appendChild(pre);

                // Create preview (first N lines)
                const previewEl = document.createElement('pre');
                previewEl.className = PREFIX + '-fold-preview';
                const previewCode = document.createElement('code');
                // Copy class from original code element for syntax highlighting
                if (code.className) previewCode.className = code.className;
                previewCode.textContent = lines.slice(0, this.VISIBLE_LINES).join('\n');
                previewEl.appendChild(previewCode);
                container.insertBefore(previewEl, pre);

                // Add toggle button
                const hidden = lines.length - this.VISIBLE_LINES;
                const toggle = document.createElement('button');
                toggle.className = PREFIX + '-fold-toggle';
                toggle.textContent = `[+${hidden} lines] Click to expand`;
                toggle.addEventListener('click', () => {
                    const isFolded = container.classList.contains('folded');
                    container.classList.toggle('folded');
                    toggle.textContent = isFolded
                        ? `[-${hidden} lines] Click to collapse`
                        : `[+${hidden} lines] Click to expand`;
                });
                container.appendChild(toggle);
            });
        },

        destroy() {
            this._stop();
            removeCSS(PREFIX + '-codefold');
        }
    };

    // =====================================================================
    //  MODULE: COPY TURN
    // =====================================================================
    const CopyTurnModule = {
        id: 'copyTurn',
        _observer: null,

        init() {
            this._applyStyles();
            this._start();
            EventBus.on('setting:copyTurn', (v) => { if (v) this._start(); else this._stop(); });
        },

        _applyStyles() {
            injectCSS(PREFIX + '-copyturn', `
                .${PREFIX}-copy-turn-btn {
                    position: absolute; top: 4px; right: 4px;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: #888; font-size: 10px; padding: 2px 6px; border-radius: 4px;
                    cursor: pointer; opacity: 0; transition: opacity 0.2s, background 0.2s;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    z-index: 10;
                }
                .group:hover .${PREFIX}-copy-turn-btn,
                [data-testid="user-message"]:hover ~ .${PREFIX}-copy-turn-btn,
                .${PREFIX}-copy-turn-btn:hover { opacity: 1; }
                .${PREFIX}-copy-turn-btn:hover { background: rgba(88,166,255,0.15); color: #58a6ff; }
                .${PREFIX}-copy-turn-btn.copied { color: #3fb950; border-color: rgba(63,185,80,0.3); }
            `);
        },

        _start() {
            if (!Settings.get('copyTurn')) return;
            this._processAll();
            if (this._observer) this._observer.disconnect();
            let timer;
            this._observer = new MutationObserver(() => {
                if (!Settings.get('copyTurn')) return;
                clearTimeout(timer);
                timer = setTimeout(() => this._processAll(), 500);
            });
            this._observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
        },

        _stop() {
            if (this._observer) this._observer.disconnect();
            $$('.' + PREFIX + '-copy-turn-btn').forEach(b => b.remove());
        },

        _processAll() {
            const main = document.querySelector('main');
            if (!main) return;
            $$(SEL.msgGroup, main).forEach(group => {
                if (group.querySelector('.' + PREFIX + '-copy-turn-btn')) return;
                // Ensure the group has relative positioning for absolute child
                const cs = window.getComputedStyle(group);
                if (cs.position === 'static') group.style.position = 'relative';

                const btn = document.createElement('button');
                btn.className = PREFIX + '-copy-turn-btn';
                btn.textContent = 'Copy';
                btn.title = 'Copy this turn';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const text = getCleanElementText(group);
                    navigator.clipboard.writeText(text).then(() => {
                        btn.textContent = 'Copied!';
                        btn.classList.add('copied');
                        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
                    }).catch(() => {
                        // Fallback
                        const ta = document.createElement('textarea'); ta.value = text;
                        ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta);
                        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                    });
                });
                group.appendChild(btn);
            });
        },

        destroy() {
            this._stop();
            removeCSS(PREFIX + '-copyturn');
        }
    };

    // =====================================================================
    //  MODULE: ERROR LOG
    // =====================================================================
    const ErrorLogModule = {
        id: 'errorLog',
        _logs: [],
        MAX_LOGS: 100,

        init() {
            // Capture module errors
            EventBus.on('module:error', (data) => this._add('error', data.module, data.error));
            EventBus.on('storage:error', (data) => this._add(data.level || 'warn', data.source || 'storage', data.message));
        },

        _add(level, source, message) {
            this._logs.push({
                time: new Date().toLocaleTimeString('en', { hour12: false }),
                level,
                source,
                message: typeof message === 'string' ? message : (message?.message || String(message))
            });
            if (this._logs.length > this.MAX_LOGS) this._logs.shift();
            EventBus.emit('errorlog:updated', this._logs);
        },

        getLogs() { return [...this._logs]; },

        clear() {
            this._logs = [];
            EventBus.emit('errorlog:updated', this._logs);
        },

        getHTML() {
            if (this._logs.length === 0) return '<span style="color:#555;font-size:10px">No errors</span>';
            return this._logs.slice(-10).map(l => {
                const color = l.level === 'error' ? '#f85149' : l.level === 'warn' ? '#d29922' : '#888';
                return `<div style="font-size:9px;color:${color};margin:1px 0;word-break:break-all">` +
                    `<span style="color:#555">${esc(l.time)}</span> ` +
                    `<span style="color:#58a6ff">[${esc(l.source)}]</span> ${esc(l.message)}</div>`;
            }).join('');
        },

        destroy() {}
    };

    // =====================================================================
    //  MODULE: RE-TITLE CONVERSATION
    // =====================================================================
    const RetitleModule = {
        id: 'retitle',
        _observer: null,

        init() {
            this._start();
        },

        _start() {
            // Watch for title elements and make them editable on click
            if (this._observer) this._observer.disconnect();
            let timer;
            this._observer = new MutationObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => this._inject(), 500);
            });
            this._observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => this._inject(), 2000);
        },

        _inject() {
            // Find the active conversation title in the sidebar
            const activeLink = document.querySelector('nav a[href*="/chat/"].bg-') ||
                               document.querySelector('nav a[href*="/chat/"][class*="active"]') ||
                               document.querySelector('nav a[href*="/chat/"][class*="bg-"]');
            if (!activeLink) return;
            if (activeLink.dataset.cueRetitle) return;
            activeLink.dataset.cueRetitle = '1';

            activeLink.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const textEl = activeLink.querySelector('div') || activeLink;
                const origText = textEl.textContent.trim();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = origText;
                input.style.cssText = 'width:100%;background:rgba(0,0,0,0.3);color:#e0e0e0;border:1px solid #58a6ff;' +
                    'border-radius:4px;padding:2px 4px;font-size:inherit;font-family:inherit;outline:none;';
                const save = async () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== origText) {
                        // Extract conversation ID from URL
                        const href = activeLink.getAttribute('href') || '';
                        const match = href.match(/\/chat\/([a-f0-9-]+)/);
                        if (match) {
                            try {
                                const orgs = await ClaudeAPI.getOrgs();
                                const orgId = orgs[0]?.uuid;
                                if (orgId) {
                                    await fetch(`/api/organizations/${orgId}/chat_conversations/${match[1]}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ name: newTitle })
                                    });
                                    showToast('Title updated', 1500, 'success');
                                }
                            } catch (err) { showToast('Failed to rename', 2000, 'error'); }
                        }
                    }
                    input.replaceWith(document.createTextNode(newTitle || origText));
                    activeLink.dataset.cueRetitle = '';
                    setTimeout(() => this._inject(), 100);
                };
                input.addEventListener('blur', save);
                input.addEventListener('keydown', (ke) => {
                    if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
                    if (ke.key === 'Escape') { input.value = origText; input.blur(); }
                });
                textEl.textContent = '';
                textEl.appendChild(input);
                input.focus();
                input.select();
            });
        },

        _stop() { if (this._observer) this._observer.disconnect(); },
        destroy() { this._stop(); }
    };

    // =====================================================================
    //  MODULE: CONVERSATION SEARCH
    // =====================================================================
    const ConversationSearchModule = {
        id: 'conversationSearch',
        STORAGE_KEY: PREFIX + '_conversation_cache',
        items: [],
        lastIndexed: null,
        loading: false,

        init() {
            this._load();
            EventBus.on('navigation', () => this.captureCurrent());
            setTimeout(() => this.captureCurrent(), 2500);
        },

        _load() {
            const saved = StorageRepository.read(this.STORAGE_KEY, { items: [], lastIndexed: null }, {
                version: 1,
                maxBytes: 1024 * 1024,
                migrate: value => Array.isArray(value) ? { items: value, lastIndexed: null } : value,
                validate: value => value && typeof value === 'object' && Array.isArray(value.items) && value.items.every(item =>
                    item && typeof item.id === 'string' && item.id.length <= 200 && typeof item.title === 'string' &&
                    typeof item.text === 'string' && item.text.length <= 200000)
            });
            this.items = saved.items.slice(0, 500);
            this.lastIndexed = typeof saved.lastIndexed === 'string' ? saved.lastIndexed : null;
        },

        _save() {
            StorageRepository.write(this.STORAGE_KEY, {
                lastIndexed: this.lastIndexed,
                items: this.items.slice(0, 500)
            }, { version: 1, maxBytes: 1024 * 1024 });
        },

        _normalize(raw) {
            const id = String(raw.uuid || raw.id || raw.conversation_uuid || raw.conversationId || '');
            if (!id) return null;
            const title = String(raw.name || raw.title || raw.summary || 'Untitled conversation').slice(0, 500);
            const updated = String(raw.updated_at || raw.updatedAt || raw.created_at || raw.createdAt || '');
            const messages = raw.chat_messages || raw.messages || [];
            const messageText = Array.isArray(messages)
                ? messages.map(m => String(m?.text || m?.content || m?.message || '')).join(' ')
                : '';
            const text = [
                title,
                raw.summary || '',
                raw.preview || '',
                raw.last_message || '',
                messageText
            ].map(value => String(value)).join(' ').replace(/\s+/g, ' ').trim().slice(0, 200000);
            return { id, title, updated, text };
        },

        async refresh(limit = 200) {
            if (!Settings.get('conversationSearch') || this.loading) return this.items;
            this.loading = true;
            EventBus.emit('conversationSearch:loading', true);
            try {
                const list = await ClaudeAPI.listConversations(limit);
                const normalized = list.map(c => this._normalize(c)).filter(Boolean);
                const byId = new Map(this.items.map(item => [item.id, item]));
                normalized.forEach(item => byId.set(item.id, { ...byId.get(item.id), ...item }));
                this.items = [...byId.values()].sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
                this.lastIndexed = new Date().toISOString();
                this._save();
                EventBus.emit('conversationSearch:updated', this.items);
                showToast(`Indexed ${normalized.length} conversations`, 1800, 'success');
                return this.items;
            } catch (e) {
                showToast('Conversation index failed: ' + e.message, 3000, 'error');
                EventBus.emit('module:error', { module: this.id, error: e });
                return this.items;
            } finally {
                this.loading = false;
                EventBus.emit('conversationSearch:loading', false);
            }
        },

        captureCurrent() {
            const id = getCurrentConversationId();
            if (!id) return;
            const active = document.querySelector('nav a[href*="/chat/"][class*="bg-"], nav a[href*="/chat/"][aria-current="page"]');
            const title = (active?.innerText || document.title || 'Current conversation').replace(/\s+/g, ' ').trim();
            const item = { id, title, updated: new Date().toISOString(), text: title };
            const idx = this.items.findIndex(x => x.id === id);
            if (idx >= 0) this.items[idx] = { ...this.items[idx], ...item };
            else this.items.unshift(item);
            this._save();
            EventBus.emit('conversationSearch:updated', this.items);
        },

        search(query, max = 8) {
            const q = (query || '').trim().toLowerCase();
            const source = q
                ? this.items.filter(item => (item.text || item.title || '').toLowerCase().includes(q))
                : this.items;
            return source.slice(0, max);
        },

        open(id) {
            if (!id) return;
            location.href = `${location.origin}/chat/${id}`;
        },

        destroy() {}
    };

    // =====================================================================
    //  MODULE: HEALTH DIAGNOSTICS
    // =====================================================================
    const DiagnosticsModule = {
        id: 'diagnostics',
        checks: [],
        lastRun: null,

        init() {
            EventBus.on('api:health', () => this.collect(false));
            EventBus.on('stream:health', () => this.collect(false));
        },

        async collect(force = false) {
            if (force && !ClaudeAPI.getLastStatus('organizations')) await ClaudeAPI.getOrgId();
            const health = ClaudeAPI.getHealth();
            const apiCheck = (id, label, key) => {
                const status = health[key];
                return { id, label, state: status ? (status.ok ? 'pass' : 'fail') : 'unknown', detail: status ? `${status.category}: ${status.detail}` : 'Not checked' };
            };
            const sse = StreamMonitor._lastStream;
            this.checks = [
                { id: 'editor', label: 'Editor', state: DOM.getEditor() ? 'pass' : 'fail', detail: DOM.getEditor() ? 'Found' : 'Selector not found' },
                { id: 'send', label: 'Send button', state: DOM.getSendButton() ? 'pass' : 'fail', detail: DOM.getSendButton() ? 'Found' : 'Selector not found' },
                { id: 'stop', label: 'Stop button', state: DOM.getStopButton() ? 'pass' : 'unknown', detail: DOM.getStopButton() ? 'Found' : 'Not visible while idle' },
                { id: 'messages', label: 'Message groups', state: document.querySelectorAll(SEL.msgGroup).length ? 'pass' : 'unknown', detail: `${document.querySelectorAll(SEL.msgGroup).length} found` },
                { id: 'org', label: 'Organization', state: ClaudeAPI._orgId ? 'pass' : health.organizations?.category === 'auth' ? 'fail' : 'unknown', detail: ClaudeAPI._orgId ? 'Resolved' : health.organizations?.detail || 'Not checked' },
                apiCheck('usage', 'Usage API', 'usage'),
                apiCheck('conversation', 'Conversation API', 'conversationDetail'),
                { id: 'fetch', label: 'Fetch monitor', state: StreamMonitor._installed ? 'pass' : 'fail', detail: StreamMonitor._installed ? 'Installed' : 'Not installed' },
                { id: 'sse', label: 'Last SSE stream', state: !sse ? 'unknown' : sse.status === 'complete' && !sse.malformed ? 'pass' : 'fail', detail: sse ? `${sse.status}, ${sse.events || 0} events, ${sse.malformed || 0} malformed` : 'No stream observed' }
            ];
            this.lastRun = new Date().toISOString();
            EventBus.emit('diagnostics:updated', this.getSummary());
            return this.getSummary();
        },

        getSummary() { return { checks: this.checks.map(check => ({ ...check })), lastRun: this.lastRun }; },
        destroy() {}
    };

    // =====================================================================
    //  MODULE: VOICE DICTATION
    // =====================================================================
    const VoiceDictationModule = {
        id: 'voiceDictation',
        recognition: null,
        active: false,

        init() {},

        isSupported() {
            return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        },

        toggle() {
            if (this.active) this.stop();
            else this.start();
        },

        start() {
            if (!Settings.get('voiceDictation')) { showToast('Voice dictation is disabled', 1800, 'warn'); return; }
            if (!this.isSupported()) { showToast('Speech recognition is not available in this browser', 3000, 'warn'); return; }
            const editor = DOM.getEditor();
            if (!editor) { showToast('Editor not found', 2000, 'warn'); return; }
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = document.documentElement.lang || navigator.language || 'en-US';
            this.recognition.onresult = (event) => {
                let finalText = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0]?.transcript || '';
                    if (event.results[i].isFinal) finalText += transcript;
                }
                if (finalText.trim()) this._insert(finalText.trim());
            };
            this.recognition.onerror = (e) => {
                showToast('Voice dictation error: ' + (e.error || 'unknown'), 2500, 'error');
                EventBus.emit('voice:status', 'error');
            };
            this.recognition.onend = () => {
                this.active = false;
                EventBus.emit('voice:status', 'idle');
            };
            this.active = true;
            this.recognition.start();
            EventBus.emit('voice:status', 'listening');
            showToast('Voice dictation listening', 1500, 'info');
        },

        stop() {
            if (this.recognition) this.recognition.stop();
            this.active = false;
            EventBus.emit('voice:status', 'idle');
        },

        _insert(text) {
            const editor = DOM.getEditor();
            if (!editor) return;
            editor.focus();
            const prefix = (editor.innerText || '').trim() ? ' ' : '';
            document.execCommand('insertText', false, prefix + text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            showToast('Dictation inserted', 1200, 'success');
        },

        destroy() { this.stop(); }
    };

    // =====================================================================
    //  MODULE: FORK CONVERSATION
    // =====================================================================
    const ForkConversationModule = {
        id: 'forkConversation',
        PENDING_KEY: PREFIX + '_pending_fork',
        _sending: false,

        init() {
            setTimeout(() => this.trySendPending(), 1500);
            EventBus.on('navigation', () => setTimeout(() => this.trySendPending(), 1500));
        },

        forkAt(index = null) {
            if (!Settings.get('forkConversation')) { showToast('Fork conversation is disabled', 1800, 'warn'); return; }
            const messages = getConversationMessages(index);
            if (!messages.length) { showToast('No conversation turns found', 2000, 'warn'); return; }
            let transcript = messages.map(m => `${m.role === 'human' ? 'Human' : 'Assistant'}:\n${m.text}`).join('\n\n---\n\n');
            const maxChars = 120000;
            if (transcript.length > maxChars) {
                transcript = '[Older transcript omitted because it exceeded the safe paste size.]\n\n' + transcript.slice(-maxChars);
            }
            const prompt = `Continue from this forked Claude conversation. Preserve the decisions, constraints, and current task state from the transcript below, then proceed from the final turn.\n\n---\n\n${transcript}`;
            StorageRepository.write(this.PENDING_KEY, { prompt, created: Date.now() }, { version: 1, maxBytes: 256 * 1024 });
            showToast(`Fork queued through turn ${messages.length}`, 1800, 'success');
            location.href = `${location.origin}/new`;
        },

        async trySendPending() {
            if (this._sending || getCurrentConversationId()) return;
            const payload = StorageRepository.read(this.PENDING_KEY, null, {
                version: 1,
                maxBytes: 256 * 1024,
                migrate: value => typeof value === 'string' ? JSON.parse(value) : value,
                validate: value => !value || (value && typeof value.prompt === 'string' && value.prompt.length <= 120000 && Number.isFinite(value.created))
            });
            if (!payload?.prompt) return;
            this._sending = true;
            try {
                await waitForElement(SEL.editor, 20000);
                await DOM.sendMessage(payload.prompt);
                StorageRepository.remove(this.PENDING_KEY);
                showToast('Fork sent to new conversation', 2200, 'success');
            } catch (e) {
                showToast('Fork send failed: ' + e.message, 3000, 'error');
                EventBus.emit('module:error', { module: this.id, error: e });
            } finally {
                this._sending = false;
            }
        },

        destroy() {}
    };

    // =====================================================================
    //  MODULE: SNIPPET TRIGGER
    // =====================================================================
    const SnippetModule = {
        id: 'snippetTrigger',
        STORAGE_KEY: PREFIX + '_snippets',
        snippets: {},
        _handler: null,

        DEFAULT_SNIPPETS: {
            ';summary': 'Please provide a concise summary of the above.',
            ';explain': 'Please explain this in detail, step by step.',
            ';fix': 'Please identify and fix any bugs or issues in the code above.',
            ';review': 'Please review the code above for best practices, potential issues, and improvements.',
            ';refactor': 'Please refactor the code above for better readability, maintainability, and performance.',
            ';test': 'Please write comprehensive tests for the code above.',
            ';continue': 'CONTINUE - Your response was cut off. Pick up EXACTLY where you stopped.',
        },

        init() {
            this._load();
            this._handler = (e) => {
                if (!Settings.get('snippetTrigger')) return;
                const editor = DOM.getEditor();
                if (!editor || !editor.contains(e.target)) return;
                if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Tab') return;
                // Get text before cursor
                const sel = window.getSelection();
                if (!sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                const textNode = range.startContainer;
                if (textNode.nodeType !== 3) return; // Text node only
                const text = textNode.textContent;
                const pos = range.startOffset;
                // Find trigger word before cursor
                const before = text.substring(0, pos);
                const match = before.match(/;[\w]+$/);
                if (!match) return;
                const trigger = match[0];
                const expansion = this.snippets[trigger];
                if (!expansion) return;
                e.preventDefault();
                e.stopPropagation();
                // Replace trigger with expansion
                const start = pos - trigger.length;
                textNode.textContent = text.substring(0, start) + expansion + text.substring(pos);
                // Move cursor to end of expansion
                const newRange = document.createRange();
                newRange.setStart(textNode, start + expansion.length);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
                // Fire input event so ProseMirror picks up the change
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                showToast(`Expanded "${trigger}"`, 1500, 'info');
            };
            document.addEventListener('keydown', this._handler, true);
        },

        _load() {
            const saved = StorageRepository.read(this.STORAGE_KEY, { ...this.DEFAULT_SNIPPETS }, {
                version: 1,
                maxBytes: 256 * 1024,
                migrate: value => value && typeof value === 'object' && !Array.isArray(value) ? value : JSON.parse(value || '{}'),
                validate: value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key =>
                    /^;[\w-]{1,40}$/.test(key) && typeof value[key] === 'string' && value[key].length <= 20000)
            });
            this.snippets = { ...this.DEFAULT_SNIPPETS, ...saved };
        },

        save() {
            StorageRepository.write(this.STORAGE_KEY, this.snippets, { version: 1, maxBytes: 256 * 1024 });
        },

        add(trigger, expansion) {
            if (!trigger.startsWith(';')) trigger = ';' + trigger;
            this.snippets[trigger] = expansion;
            this.save();
        },

        remove(trigger) {
            delete this.snippets[trigger];
            this.save();
        },

        destroy() {
            if (this._handler) document.removeEventListener('keydown', this._handler, true);
        }
    };

    // =====================================================================
    //  MODULE: PROMPT LIBRARY
    // =====================================================================
    const PromptModule = {
        id: 'promptLibrary',
        STORAGE_KEY: PREFIX + '_prompts',
        prompts: [],

        DEFAULT_PROMPTS: [
            { id: 'spec', label: 'Spec', cat: 'pipeline', prompt: `You are now in **AUTOPILOT MODE**. A userscript monitors this chat and will send follow-up prompts.\n\n**PROJECT:**\n[DESCRIBE YOUR PROJECT HERE]\n\n**PROTOCOL:**\n1. End EVERY response with: \`STATUS: [STAGE] COMPLETE\` or \`STATUS: [STAGE] CONTINUING\`\n2. If cut off, I will send "CONTINUE" - pick up EXACTLY where you left off\n3. Write **production-ready, complete code** - NO placeholders, NO TODO stubs\n4. Include ALL imports, ALL error handling, ALL edge cases\n5. NEVER hallucinate packages - only use packages you are certain exist\n\n---\n\n**PHASE: SPECIFICATION**\n\nBefore ANY code, create a complete spec:\n1. **Requirements** - Functional + non-functional\n2. **User Stories** - 3-5 key stories\n3. **Inputs & Outputs** - Data flow\n4. **Edge Cases** - Boundary conditions, failure modes\n5. **Acceptance Criteria** - How we verify each feature\n6. **Security** - Auth, validation, sanitization needs\n7. **Dependencies** - Only packages you are 100% certain exist\n\nEnd with: \`STATUS: SPEC COMPLETE\`` },
            { id: 'arch', label: 'Architecture', cat: 'pipeline', prompt: `AUTOPILOT: **ARCHITECTURE PHASE**\n\nDefine the technical architecture from the spec:\n1. **Tech Stack** - Language, frameworks, tools (justify each)\n2. **Project Structure** - Complete directory/file tree\n3. **Data Models** - All types, interfaces, schemas, enums\n4. **Component Map** - Module connections, dependency graph\n5. **API Surface** - Function signatures, entry points, CLI args\n6. **Configuration** - Settings, env vars, defaults\n7. **Error Strategy** - Error types, handling patterns\n\nEnd with: \`STATUS: ARCHITECTURE COMPLETE\`` },
            { id: 'plan', label: 'Plan', cat: 'pipeline', prompt: `AUTOPILOT: **PLANNING PHASE**\n\nBreak implementation into numbered phases. Each must be self-contained and ordered by dependency (data models -> logic -> UI -> integration).\n\nFormat:\nPHASE 1: [Name] - [What gets built]\nPHASE 2: [Name] - [What gets built]\n...\n\nAlso list tests for each phase.\n\nEnd with: \`STATUS: PLAN COMPLETE\`` },
            { id: 'build', label: 'Build Phase', cat: 'pipeline', prompt: `AUTOPILOT: Build **PHASE [N]** now.\n\nRefer to the plan. Write complete, production-ready code:\n- Complete file contents with ALL imports\n- Full error handling and input validation\n- Inline comments for non-obvious logic\n- Consistent with architecture above\n- Only real, verified packages\n\nEnd with: \`STATUS: PHASE [N] COMPLETE\`` },
            { id: 'mid_audit', label: 'Mid Audit', cat: 'pipeline', prompt: `AUTOPILOT: **MID-BUILD AUDIT**\n\nReview ALL code so far:\n1. **Consistency** - Same patterns, naming, types across phases?\n2. **Integration** - Will phases connect? Mismatched signatures?\n3. **Missing imports** - Undefined references across files?\n4. **Data flow** - Data passes correctly between components?\n5. **Error handling** - Unhandled exceptions or silent failures?\n6. **Security** - Input validation, injection, exposed secrets?\n7. **Dependencies** - All packages real and correct versions?\n\nFix every issue. Show corrected code.\n\nEnd with: \`STATUS: MID_AUDIT COMPLETE\`` },
            { id: 'testing', label: 'Testing', cat: 'pipeline', prompt: `AUTOPILOT: **TESTING PHASE**\n\nGenerate comprehensive test suite:\n1. **Unit Tests** - Each function/method independently\n2. **Integration Tests** - Component interactions\n3. **Edge Cases** - Boundary values, empty/malformed inputs\n4. **Error Paths** - Verify error handling works\n5. **Smoke Tests** - End-to-end happy path\n\nUse appropriate framework. Single-command runnable.\n\nEnd with: \`STATUS: TESTING COMPLETE\`` },
            { id: 'final_audit', label: 'Final Audit', cat: 'pipeline', prompt: `AUTOPILOT: **FINAL AUDIT**\n\nComplete final review:\n1. **Code Quality** - Dead code, duplication, complexity\n2. **Security** - SQL injection, XSS, path traversal, hardcoded secrets, input validation\n3. **Completeness** - Compare against original spec\n4. **Performance** - Bottlenecks, N+1 queries, unbounded loops\n5. **Error Messages** - Helpful and user-friendly?\n6. **Documentation** - Functions documented? README complete?\n7. **Dependencies** - All packages real and necessary?\n8. **Cross-platform** - Works on Win/macOS/Linux?\n\nFix everything. Show corrected code.\n\nEnd with: \`STATUS: FINAL_AUDIT COMPLETE\`` },
            { id: 'features', label: 'Features', cat: 'pipeline', prompt: `AUTOPILOT: **FEATURE ENHANCEMENT**\n\nAdd polish:\n1. Edge cases not yet handled\n2. UX/DX improvements - progress bars, colors, formatting\n3. Configuration - make hardcoded values configurable\n4. Logging - structured with levels\n5. Help/usage - --help, usage examples\n6. Graceful degradation - missing deps, network failures\n7. Performance - caching, lazy loading where applicable\n\nImplement all with complete code.\n\nEnd with: \`STATUS: FEATURES COMPLETE\`` },
            { id: 'branding', label: 'Branding', cat: 'pipeline', prompt: `AUTOPILOT: **BRANDING PHASE**\n\n1. **Logo Prompt** - Detailed prompt for DALL-E 3 / Midjourney / Stable Diffusion to generate a professional logo\n2. **Color Palette** - 5-6 hex codes with names and usage\n3. **Tagline** - One-line project description\n4. **Icon Concepts** - 2-3 favicon/app icon ideas\n5. **ASCII Banner** - For CLI/README\n\nEnd with: \`STATUS: BRANDING COMPLETE\`` },
            { id: 'packaging', label: 'Packaging', cat: 'pipeline', prompt: `AUTOPILOT: **PACKAGING PHASE**\n\n1. **Standalone Executable** - Best tool for language (PyInstaller/pkg/nexe/go build), build script, config, icon, metadata, one-command build\n2. **Portable Executable** - No install, runs from USB, self-contained, portable config\n3. **Build README** - Steps, prerequisites, troubleshooting\n4. **Release Script** - Automated build + package + hash\n\nEnd with: \`STATUS: PACKAGING COMPLETE\`` },
            { id: 'summary', label: 'Summary', cat: 'pipeline', prompt: `AUTOPILOT: **FINAL SUMMARY**\n\n1. **File Manifest** - Every file, purpose, path\n2. **Quick Start** - 3 steps or fewer\n3. **Full Setup** - All platforms\n4. **Usage Guide** - Commands, flags, config, examples\n5. **Build Guide** - Standalone + portable compilation\n6. **Architecture Diagram** - ASCII component diagram\n7. **Tech Stack** - Languages, frameworks, tools, versions\n8. **Known Limitations** - Honest assessment\n9. **Future Roadmap** - Suggested next features\n\nEnd with: \`STATUS: PROJECT COMPLETE\`` },
            { id: 'continue', label: 'Continue', cat: 'recovery', prompt: 'CONTINUE - Your response was cut off. Pick up EXACTLY where you stopped. Do not repeat anything.' },
            { id: 'continue_ctx', label: 'Continue +Ctx', cat: 'recovery', prompt: 'CONTINUE - Your response was cut off. Check the roadmap/plan above, find where you stopped, and continue from that exact point. Do not restart or repeat.' },
            { id: 'stuck', label: 'Stuck Recovery', cat: 'recovery', prompt: 'AUTOPILOT RECOVERY: Your last response appears stuck or incomplete.\n\nPlease check the conversation above, identify where you left off, and CONTINUE from that point. Do not restart.\n\nEnd with the appropriate STATUS line when done.' },
            { id: 'next_phase', label: 'Next Phase', cat: 'recovery', prompt: 'AUTOPILOT: Previous phase done. Build the NEXT phase from the plan. Complete, production-ready code.\n\nEnd with: `STATUS: PHASE [N] COMPLETE`' },
            { id: 'analyze', label: 'Analyze Chat', cat: 'resume', prompt: `AUTOPILOT: **RESUME MODE - PROJECT ANALYSIS**\n\nAnalyze the conversation above and determine:\n1. **Project** - What is being built?\n2. **Current State** - What has been completed?\n3. **Files Created** - All code produced so far\n4. **Last Phase** - What was last completed?\n5. **Next Steps** - What needs building?\n6. **Issues** - Incomplete code, broken refs, errors?\n\nProvide numbered remaining phases.\n\nEnd with: \`STATUS: ANALYSIS COMPLETE\`` },
            { id: 'resume_build', label: 'Resume Build', cat: 'resume', prompt: 'AUTOPILOT: **RESUMING BUILD**\n\nContinue building from where the project left off. Build the next incomplete phase.\n\nWrite complete, production-ready code. NO placeholders. All imports, error handling.\n\nEnd with: `STATUS: PHASE COMPLETE`' },
            { id: 'custom1', label: 'Custom 1', cat: 'custom', prompt: '' },
            { id: 'custom2', label: 'Custom 2', cat: 'custom', prompt: '' },
            { id: 'custom3', label: 'Custom 3', cat: 'custom', prompt: '' },
            { id: 'custom4', label: 'Custom 4', cat: 'custom', prompt: '' },
        ],

        CATEGORIES: [
            { id: 'pipeline', label: 'Build Pipeline', color: '#58a6ff' },
            { id: 'recovery', label: 'Recovery', color: '#d29922' },
            { id: 'resume', label: 'Resume Project', color: '#bc8cff' },
            { id: 'custom', label: 'Custom', color: '#3fb950' },
        ],

        init() { this._load(); },

        _normalize(raw) {
            if (!raw || typeof raw !== 'object') return null;
            const id = String(raw.id || '');
            const label = String(raw.label || '').trim();
            const prompt = String(raw.prompt || '');
            const cat = this.CATEGORIES.some(c => c.id === raw.cat) ? raw.cat : 'custom';
            if (!/^[\w-]{1,80}$/.test(id) || !label || label.length > 120 || prompt.length > 50000 || /[<>]/.test(label)) return null;
            const history = Array.isArray(raw.history) ? raw.history.slice(-10).filter(h => h && typeof h.prompt === 'string' && typeof h.label === 'string').map(h => ({
                prompt: h.prompt.slice(0, 50000), label: h.label.slice(0, 120), time: Number.isFinite(h.time) ? h.time : Date.now()
            })) : [];
            return { id, label, prompt, cat, history };
        },

        _load() {
            const parsed = StorageRepository.read(this.STORAGE_KEY, [], {
                version: 1,
                maxBytes: 1024 * 1024,
                migrate: value => Array.isArray(value) ? value : JSON.parse(value || '[]'),
                validate: value => Array.isArray(value) && value.length <= 500
            });
            const valid = parsed.map(p => this._normalize(p)).filter(Boolean);
            this.prompts = this.DEFAULT_PROMPTS.map(def => {
                const saved = valid.find(p => p.id === def.id);
                return saved ? { ...def, ...saved } : { ...def, history: [] };
            });
            valid.forEach(p => { if (!this.prompts.find(x => x.id === p.id)) this.prompts.push(p); });
        },

        save() {
            const records = this.prompts.map(p => ({
                id: p.id, label: p.label, prompt: p.prompt, cat: p.cat,
                history: p.history || []
            }));
            StorageRepository.write(this.STORAGE_KEY, records, { version: 1, maxBytes: 1024 * 1024 });
        },

        add(label, prompt, cat = 'custom') {
            const id = 'user_' + Date.now();
            const record = this._normalize({ id, label, prompt, cat, history: [] });
            if (!record) { StorageRepository._emit('warn', 'rejected invalid prompt', this.STORAGE_KEY); return null; }
            this.prompts.push(record);
            this.save();
            return id;
        },

        update(id, label, prompt) {
            const p = this.prompts.find(x => x.id === id);
            if (p && this._normalize({ id, label, prompt, cat: p.cat, history: p.history })) {
                // Save version history before overwriting
                if (p.prompt && p.prompt !== prompt) {
                    if (!p.history) p.history = [];
                    p.history.push({ prompt: p.prompt, label: p.label, time: Date.now() });
                    // Keep max 10 versions
                    if (p.history.length > 10) p.history.shift();
                }
                p.label = label.trim(); p.prompt = prompt; this.save();
            }
        },

        getHistory(id) {
            const p = this.prompts.find(x => x.id === id);
            return p?.history || [];
        },

        rollback(id, historyIdx) {
            const p = this.prompts.find(x => x.id === id);
            if (!p || !p.history || !p.history[historyIdx]) return false;
            const version = p.history[historyIdx];
            // Save current as a history entry before rollback
            p.history.push({ prompt: p.prompt, label: p.label, time: Date.now() });
            if (p.history.length > 10) p.history.shift();
            p.prompt = version.prompt;
            p.label = version.label;
            this.save();
            return true;
        },

        remove(id) {
            this.prompts = this.prompts.filter(p => p.id !== id);
            this.save();
        },

        async send(promptText) {
            const text = promptText.trim();
            if (!text) { showToast('Prompt is empty', 2000, 'warn'); return; }
            // Check for {{variable}} placeholders
            const vars = [...new Set((text.match(/\{\{(\w+)\}\}/g) || []).map(v => v.slice(2, -2)))];
            if (vars.length > 0) {
                this._showVariableModal(text, vars);
                return;
            }
            try {
                await DOM.sendMessage(text);
                if (Settings.get('autoScroll')) setTimeout(() => AutoScrollModule.scrollToBottom(), 500);
            } catch (e) { showToast('Send failed: ' + e.message, 3000, 'error'); }
        },

        _showVariableModal(template, vars) {
            const overlay = document.createElement('div');
            overlay.className = PREFIX + '-modal-overlay';
            const modal = document.createElement('div');
            modal.className = PREFIX + '-modal';
            const inputs = vars.map(v =>
                `<div style="margin-bottom:8px">
                    <label style="display:block;font-size:11px;color:#888;margin-bottom:2px">${esc(v)}</label>
                    <input class="${PREFIX}-var-input" data-var="${esc(v)}" placeholder="Enter ${esc(v)}..." style="width:100%">
                </div>`
            ).join('');
            setHTML(modal, `
                <h3>Fill in variables</h3>
                ${inputs}
                <div class="${PREFIX}-modal-actions">
                    <button class="${PREFIX}-modal-btn secondary" id="${PREFIX}-var-cancel">Cancel</button>
                    <button class="${PREFIX}-modal-btn primary" id="${PREFIX}-var-send">Send</button>
                </div>
            `);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
            $(`#${PREFIX}-var-cancel`, modal).addEventListener('click', () => overlay.remove());
            $(`#${PREFIX}-var-send`, modal).addEventListener('click', async () => {
                let filled = template;
                modal.querySelectorAll('.' + PREFIX + '-var-input').forEach(inp => {
                    const name = inp.dataset.var;
                    const val = inp.value || name;
                    filled = filled.split('{{' + name + '}}').join(val);
                });
                overlay.remove();
                try {
                    await DOM.sendMessage(filled);
                    if (Settings.get('autoScroll')) setTimeout(() => AutoScrollModule.scrollToBottom(), 500);
                } catch (e) { showToast('Send failed: ' + e.message, 3000, 'error'); }
            });
            // Focus first input
            const firstInput = modal.querySelector('.' + PREFIX + '-var-input');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        },

        destroy() {}
    };

    // =====================================================================
    //  CODE BLOCK SCANNER (from Prompt Deck v1.4)
    // =====================================================================
    function extractCleanCode(el) {
        const clone = el.cloneNode(true);
        // Remove line number elements
        const lineNumSelectors = [
            '[class*="line-number"]', '[class*="linenumber"]', '[class*="line-num"]',
            '[class*="LineNumber"]', '[class*="ln-num"]', '[class*="hljs-ln-n"]',
            '[class*="gutter"]', '[class*="Gutter"]',
            '[class*="line-numbers-row"]', '[class*="line-count"]',
            'td.hljs-ln-numbers', '.hljs-ln-numbers',
            '[data-line-number]', '[aria-hidden="true"]',
        ].join(',');
        try { clone.querySelectorAll(lineNumSelectors).forEach(n => n.remove()); } catch (e) { /* selector issue */ }
        // If table layout (hljs-ln pattern), keep only code cells
        const codeCells = clone.querySelectorAll('td.hljs-ln-code, td[class*="code"], td:last-child');
        if (codeCells.length > 0) {
            const lines = []; codeCells.forEach(td => lines.push(td.textContent || ''));
            const joined = lines.join('\n').trim();
            if (joined.length >= 10) return joined;
        }
        let text = clone.innerText || clone.textContent || '';
        // Regex fallback: strip leading line numbers if most lines match
        const rawLines = text.split('\n');
        const numPattern = /^\s*\d{1,5}[\s\t]/;
        const matchCount = rawLines.filter(l => l.trim() && numPattern.test(l)).length;
        const nonEmptyCount = rawLines.filter(l => l.trim()).length;
        if (nonEmptyCount > 2 && matchCount / nonEmptyCount > 0.7) {
            let sequential = 0, lastNum = 0;
            for (const line of rawLines) {
                const m = line.match(/^\s*(\d{1,5})[\s\t]/);
                if (m) { const n = parseInt(m[1], 10); if (n === lastNum + 1) sequential++; lastNum = n; }
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
            let lang = 'code';
            const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code');
            if (codeEl) { for (const cls of codeEl.classList) { const m = cls.match(/^(?:language-|lang-|hljs-)(.+)$/); if (m) { lang = m[1]; break; } } }
            const wrapper = el.closest('[class*="code"]') || el.closest('[data-language]');
            if (wrapper) {
                const dl = wrapper.getAttribute('data-language'); if (dl) lang = dl;
                const labelEl = wrapper.querySelector('[class*="text-text-"]') || wrapper.querySelector('span');
                if (labelEl && labelEl.textContent.trim().length < 20 && !labelEl.textContent.includes(' ')) {
                    const candidate = labelEl.textContent.trim().toLowerCase();
                    if (candidate && /^[a-z0-9#+._-]+$/i.test(candidate)) lang = candidate;
                }
            }
            const prev = el.previousElementSibling || (el.parentElement && el.parentElement.previousElementSibling);
            if (prev && prev.textContent && prev.textContent.trim().length < 25) {
                const ht = prev.textContent.trim().toLowerCase();
                if (ht && /^[a-z0-9#+._-]+$/i.test(ht) && !ht.includes(' ')) lang = ht;
            }
            const lines = t.split('\n').length;
            const preview = t.split('\n').slice(0, 2).join(' ').substring(0, 55);
            blocks.push({ idx: blocks.length, lang, lines, preview, text: t, el, source });
        }
        // Strategy 1: All <pre> elements
        document.querySelectorAll('pre').forEach(pre => {
            if (pre.closest('#' + PREFIX + '-panel')) return;
            const code = pre.querySelector('code') || pre;
            addBlock(code, null, 'pre');
        });
        // Strategy 2: Multi-line <code> not inside <pre>
        document.querySelectorAll('code').forEach(code => {
            if (code.closest('#' + PREFIX + '-panel') || code.closest('pre')) return;
            const raw = code.innerText || code.textContent || '';
            if (raw.includes('\n') && raw.trim().length >= 10) addBlock(code, null, 'code');
        });
        // Strategy 3: Code-related classes/attributes
        const codeSelectors = [
            '[class*="code-block"]', '[class*="code_block"]', '[class*="codeblock"]',
            '[class*="CodeBlock"]', '[class*="code-content"]', '[class*="hljs"]',
            '[class*="shiki"]', '[class*="prism"]', '[class*="highlight"]',
            '[data-code]', '[data-language]',
        ].join(',');
        try {
            document.querySelectorAll(codeSelectors).forEach(el => {
                if (el.closest('#' + PREFIX + '-panel')) return;
                if (el.querySelector('pre') || el.closest('pre')) return;
                const text = el.innerText || el.textContent || '';
                if (text.includes('\n') && text.trim().length >= 10) addBlock(el, null, 'class');
            });
        } catch (e) { /* invalid selector */ }
        // Strategy 4: Find copy buttons and trace back to code containers
        document.querySelectorAll('button').forEach(btn => {
            if (btn.closest('#' + PREFIX + '-panel')) return;
            const txt = (btn.textContent || '').toLowerCase().trim();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (txt === 'copy' || txt === 'copy code' || ariaLabel.includes('copy')) {
                let container = btn.closest('[class*="code"]') || btn.closest('[class*="Code"]') || btn.parentElement?.parentElement;
                if (!container) return;
                const pre = container.querySelector('pre');
                const code = container.querySelector('code');
                const target = pre || code || container;
                const text = target.innerText || target.textContent || '';
                if (text.trim().length >= 10) addBlock(target, null, 'copy-btn');
            }
        });
        return blocks;
    }

    // =====================================================================
    //  MODULE: PANEL TOOLS
    // =====================================================================
    const PanelToolsModule = {
        id: 'panelTools',

        init() {},

        _copyLastCode() {
            const blocks = scanCodeBlocks();
            if (blocks.length > 0) {
                const last = blocks[blocks.length - 1];
                navigator.clipboard.writeText(last.text).then(() => {
                    showToast('Copied ' + last.lang + ' (' + last.lines + 'L)', 2000, 'success');
                }).catch(() => {});
            } else { showToast('No code blocks found', 2000, 'warn'); }
        },

        _copyLastResponse() {
            const text = DOM.getLastResponse();
            if (!text) { showToast('No response to copy', 2000, 'warn'); return; }
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied response (' + text.split(/\s+/).length + ' words)', 2000, 'success');
            }).catch(() => {
                // Fallback
                const ta = document.createElement('textarea'); ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                showToast('Copied response (fallback)', 2000, 'success');
            });
        },

        async _showExportMenu() {
            const fallbackMessages = getConversationMessages();
            const id = getCurrentConversationId();
            let raw = null;
            if (id) raw = await ClaudeAPI.getConversation(id);
            const archive = ConversationSerializer.from(raw, fallbackMessages);
            if (!archive.messages.length) { showToast('No conversation found', 2000, 'warn'); return; }
            const branchEdges = Object.values(archive.branches.children).reduce((sum, ids) => sum + ids.length, 0);

            const overlay = document.createElement('div');
            overlay.className = PREFIX + '-modal-overlay';
            const modal = document.createElement('div');
            modal.className = PREFIX + '-modal';
            setHTML(modal, `
                <h3>Export Conversation</h3>
                <p style="color:#888;font-size:12px;margin:0 0 12px">${archive.messages.length} messages · ${branchEdges} branch links · ${esc(archive.metadata.source)} source</p>
                ${archive.failures.length ? `<p style="color:#d29922;font-size:10px">${esc(archive.failures.map(f => f.reason).join('; '))}</p>` : ''}
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="${PREFIX}-modal-btn primary" data-fmt="md">Markdown</button>
                    <button class="${PREFIX}-modal-btn primary" data-fmt="json" style="background:#bc8cff;border-color:#bc8cff">JSON</button>
                    <button class="${PREFIX}-modal-btn primary" data-fmt="html" style="background:#d29922;border-color:#d29922">HTML</button>
                </div>
                <div class="${PREFIX}-modal-actions" style="margin-top:12px">
                    <button class="${PREFIX}-modal-btn secondary" id="${PREFIX}-export-cancel">Cancel</button>
                </div>
            `);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
            $(`#${PREFIX}-export-cancel`, modal).addEventListener('click', () => overlay.remove());

            modal.querySelectorAll('[data-fmt]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fmt = btn.dataset.fmt;
                    const datestamp = new Date().toISOString().slice(0, 10);
                    let content, mime, ext;

                    if (fmt === 'md') {
                        content = ConversationSerializer.toMarkdown(archive);
                        mime = 'text/markdown'; ext = 'md';
                    } else if (fmt === 'json') {
                        content = JSON.stringify(archive, null, 2);
                        mime = 'application/json'; ext = 'json';
                    } else {
                        content = ConversationSerializer.toHTML(archive);
                        mime = 'text/html'; ext = 'html';
                    }

                    const blob = new Blob([content], { type: mime });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'claude-chat-' + datestamp + '.' + ext;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    overlay.remove();
                    showToast('Chat exported as ' + ext.toUpperCase() + '!', 2000, 'success');
                });
            });
        },

        destroy() {}
    };

    // =====================================================================
    //  CONTROL PANEL UI
    // =====================================================================
    const ControlPanel = {
        _panel: null,
        _visible: false,
        _usageData: null,
        _claudeSettings: null,
        _refreshTimer: null,
        _turnCursor: 0,

        FEATURES: [
            { key: 'enabled_monkeys_in_a_barrel', name: 'Code Execution', desc: 'Virtual code environment', exclusive: 'enabled_artifacts_attachments' },
            { key: 'enabled_artifacts_attachments', name: 'Repl Tool', desc: 'Additional Artifacts features', exclusive: 'enabled_monkeys_in_a_barrel' },
            { key: 'enabled_saffron', name: 'Memory', desc: 'Cross-conversation memory' },
            { key: 'enabled_saffron_search', name: 'Search Chats', desc: 'Chat history search' },
            { key: 'enabled_sourdough', name: 'Projects', desc: 'Project memory' },
        ],

        USAGE_PLANS: {
            pro: { name: 'Pro', multiplier: 1 },
            max5: { name: 'Max 5x', multiplier: 5 },
            max20: { name: 'Max 20x', multiplier: 20 },
        },
        LOCAL_USAGE_BASELINE: { session: 20, fiveHour: 45, sevenDay: 225 },

        show() {
            if (!this._panel) return;
            this._panel.classList.remove(PREFIX + '-panel-hidden');
            this._panel.style.pointerEvents = 'auto';
            this._visible = true;
        },
        hide(force = false) {
            if (!this._panel || (Settings.get('panelPinned') && !force)) return;
            this._panel.classList.add(PREFIX + '-panel-hidden');
            this._visible = false;
        },
        toggle() {
            if (!this._panel) return;
            if (this._panel.classList.contains(PREFIX + '-panel-hidden')) this.show();
            else this.hide(true);
        },

        async build() {
            if (this._panel) return;

            this._createStyles();
            this._panel = document.createElement('div');
            this._panel.id = PREFIX + '-panel';
            this._panel.className = PREFIX + '-panel-hidden';

            setHTML(this._panel, this._getHTML());
            document.body.appendChild(this._panel);
            this._applyPanelChrome();
            this._bindEvents();
            this._loadData();

            // Auto-refresh usage every 60s
            this._refreshTimer = setInterval(() => this._loadData(), 60000);
        },

        _createStyles() {
            injectCSS(PREFIX + '-panel-css', `
                /* Hover trigger strip - invisible 6px strip on right edge */
                #${PREFIX}-hover-strip {
                    position: fixed; top: 0; right: 0; width: 6px; height: 100vh;
                    z-index: 99998; cursor: pointer;
                }
                #${PREFIX}-hover-strip::after {
                    content: ''; position: absolute; top: 50%; right: 0;
                    transform: translateY(-50%); width: 3px; height: 60px;
                    background: rgba(88,166,255,0.2); border-radius: 2px;
                    transition: opacity 0.3s, background 0.3s;
                }
                #${PREFIX}-hover-strip:hover::after { background: rgba(88,166,255,0.5); width: 4px; }

                /* Panel container */
                #${PREFIX}-panel {
                    position: fixed; top: 0; right: 0; width: var(--cue-panel-width, 320px); height: 100vh;
                    min-width: 280px; max-width: min(640px, 90vw);
                    background: #0d0d14; border-left: 1px solid #2a2a3a;
                    z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    color: #c8c8d8; font-size: 11px; overflow-y: auto; overflow-x: hidden;
                    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
                    box-shadow: -4px 0 30px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column;
                }
                #${PREFIX}-panel.${PREFIX}-panel-hidden { transform: translateX(100%); pointer-events: none; }
                #${PREFIX}-panel.${PREFIX}-panel-pinned { transform: translateX(0); pointer-events: auto; }
                #${PREFIX}-panel::-webkit-scrollbar { width: 4px; }
                #${PREFIX}-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
                #${PREFIX}-panel-resize {
                    position: absolute; top: 0; left: -4px; width: 8px; height: 100%;
                    cursor: ew-resize; z-index: 1;
                }
                #${PREFIX}-panel-resize:hover { background: rgba(88,166,255,0.14); }

                /* Header - minimal */
                .${PREFIX}-hdr {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 4px 8px; background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid #2a2a3a; flex-shrink: 0;
                }
                .${PREFIX}-hdr h2 { margin: 0; font-size: 12px; font-weight: 600; color: #e8e8f0; }
                .${PREFIX}-hdr-ver { font-size: 9px; color: #555; margin-left: 4px; }
                .${PREFIX}-hdr-actions { display: flex; align-items: center; gap: 2px; }
                .${PREFIX}-icon-btn,
                .${PREFIX}-close {
                    background: none; border: none; color: #555; width: 20px; height: 20px;
                    cursor: pointer; font-size: 14px; display: flex; align-items: center;
                    justify-content: center; border-radius: 4px;
                }
                .${PREFIX}-icon-btn { font-size: 11px; font-weight: 700; }
                .${PREFIX}-icon-btn.active { color: #58a6ff; background: rgba(88,166,255,0.1); }
                .${PREFIX}-icon-btn:hover { color: #c8c8d8; background: rgba(255,255,255,0.06); }
                .${PREFIX}-close:hover { color: #f88; background: rgba(255,80,80,0.1); }

                /* Sections - ultra compact */
                .${PREFIX}-section { padding: 2px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .${PREFIX}-section-title {
                    font-size: 9px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 1px; color: #58a6ff; margin: 2px 0 1px;
                }

                /* Rows */
                .${PREFIX}-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 1px 0; min-height: 18px;
                }
                .${PREFIX}-row-label { color: #a8a8b8; font-size: 11px; }

                /* Toggle switch - compact */
                .${PREFIX}-toggle {
                    position: relative; width: 28px; height: 14px; cursor: pointer; display: inline-block; flex-shrink: 0;
                }
                .${PREFIX}-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
                .${PREFIX}-toggle-track {
                    position: absolute; inset: 0; background: #2a2a3a; border-radius: 7px;
                    transition: background 0.2s;
                }
                .${PREFIX}-toggle input:checked + .${PREFIX}-toggle-track { background: #3fb950; }
                .${PREFIX}-toggle-thumb {
                    position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
                    background: #d0d0d0; border-radius: 50%; transition: transform 0.2s;
                }
                .${PREFIX}-toggle input:checked ~ .${PREFIX}-toggle-thumb { transform: translateX(14px); background: #fff; }

                /* Slider - compact */
                .${PREFIX}-slider {
                    height: 3px; -webkit-appearance: none; appearance: none;
                    background: #2a2a3a; border-radius: 2px; outline: none; margin: 0;
                }
                .${PREFIX}-slider::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 12px; height: 12px;
                    background: #58a6ff; border-radius: 50%; cursor: pointer;
                }

                /* Select - compact */
                .${PREFIX}-select {
                    background: #1a1a2a; color: #c8c8d8; border: 1px solid #2a2a3a;
                    border-radius: 4px; padding: 1px 4px; font-size: 10px; cursor: pointer; outline: none;
                }

                /* Usage bars - compact */
                .${PREFIX}-usage-bar {
                    height: 5px; background: #1a1a2a; border-radius: 3px;
                    overflow: hidden; margin: 2px 0 1px;
                }
                .${PREFIX}-usage-fill {
                    height: 100%; border-radius: 3px; transition: width 0.5s;
                    background: linear-gradient(90deg, #3fb950, #58a6ff);
                }
                .${PREFIX}-usage-fill.warn { background: linear-gradient(90deg, #d29922, #e8a020); }
                .${PREFIX}-usage-fill.danger { background: linear-gradient(90deg, #f85149, #ff6b6b); }
                .${PREFIX}-usage-pct { font-size: 10px; color: #888; }
                .${PREFIX}-usage-local { color: #666; font-size: 9px; }

                /* Feature toggle rows - compact */
                .${PREFIX}-feat-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 1px 0;
                }
                .${PREFIX}-feat-name { font-size: 11px; color: #c8c8d8; }
                .${PREFIX}-feat-desc { display: none; }
                .${PREFIX}-feat-btn {
                    padding: 1px 8px; border-radius: 4px; border: 1px solid #2a2a3a;
                    cursor: pointer; font-size: 9px; font-weight: 600; transition: all 0.2s;
                    min-width: 32px; text-align: center;
                }
                .${PREFIX}-feat-btn.on { background: rgba(63,185,80,0.15); color: #3fb950; border-color: rgba(63,185,80,0.3); }
                .${PREFIX}-feat-btn.off { background: rgba(255,255,255,0.04); color: #888; }
                .${PREFIX}-feat-btn:hover { opacity: 0.8; }

                /* Context health */
                .${PREFIX}-ctx-fill {
                    height: 100%; border-radius: 3px; transition: width 0.5s, background 0.3s;
                }
                .${PREFIX}-ctx-fill.good { background: linear-gradient(90deg, #3fb950, #2ea043); }
                .${PREFIX}-ctx-fill.warn { background: linear-gradient(90deg, #d29922, #e8a020); }
                .${PREFIX}-ctx-fill.critical { background: linear-gradient(90deg, #f85149, #ff6b6b); }

                /* Status dot */
                .${PREFIX}-status-dot {
                    width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 4px;
                }
                .${PREFIX}-status-dot.idle { background: #555; }
                .${PREFIX}-status-dot.generating { background: #d29922; animation: ${PREFIX}-pulse 1.2s infinite; }
                .${PREFIX}-status-dot.complete { background: #3fb950; }
                .${PREFIX}-status-dot.stuck { background: #f85149; }
                .${PREFIX}-status-dot.truncated { background: #f85149; }
                @keyframes ${PREFIX}-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

                /* Prompt buttons - compact */
                .${PREFIX}-prompt-btn {
                    display: inline-flex; align-items: center;
                    padding: 2px 6px; border-radius: 4px; border: 1px solid #2a2a3a;
                    background: rgba(255,255,255,0.03); color: #c8c8d8;
                    cursor: pointer; font-size: 10px; transition: all 0.2s; margin: 1px;
                }
                .${PREFIX}-prompt-btn:hover { background: rgba(88,166,255,0.1); border-color: #58a6ff40; color: #fff; }
                .${PREFIX}-prompt-cat { display: none; }
                .${PREFIX}-tool-btn {
                    padding: 3px 8px; border-radius: 4px; border: 1px solid #2a2a3a;
                    background: rgba(255,255,255,0.03); color: #c8c8d8;
                    cursor: pointer; font-size: 10px; transition: all 0.2s;
                }
                .${PREFIX}-tool-btn:hover { background: rgba(88,166,255,0.1); border-color: #58a6ff40; color: #fff; }
                .${PREFIX}-tool-btn.primary { color: #58a6ff; }
                .${PREFIX}-tool-btn.warn { color: #d29922; }
                .${PREFIX}-tool-btn.success { color: #3fb950; }
                .${PREFIX}-search-input {
                    width: 100%; box-sizing: border-box; background: #1a1a2a; color: #c8c8d8;
                    border: 1px solid #2a2a3a; border-radius: 4px; padding: 4px 6px;
                    font-size: 10px; outline: none; margin: 3px 0;
                }
                .${PREFIX}-search-input:focus { border-color: #58a6ff; }
                .${PREFIX}-search-result {
                    display: flex; justify-content: space-between; align-items: center; gap: 4px;
                    padding: 3px 0; border-top: 1px solid rgba(255,255,255,0.04);
                }
                .${PREFIX}-search-title {
                    min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
                    font-size: 10px; color: #c8c8d8;
                }
                .${PREFIX}-search-date { color: #555; font-size: 9px; flex-shrink: 0; }

                /* Prompt editor modal */
                .${PREFIX}-modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    z-index: 100000; display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(4px);
                }
                .${PREFIX}-modal {
                    background: #0d0d14; border: 1px solid #2a2a3a; border-radius: 12px;
                    padding: 16px; width: 500px; max-width: 90vw; max-height: 80vh;
                    overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                }
                .${PREFIX}-modal h3 { margin: 0 0 12px; color: #e8e8f0; font-size: 14px; }
                .${PREFIX}-modal input, .${PREFIX}-modal textarea {
                    width: 100%; background: #1a1a2a; color: #c8c8d8; border: 1px solid #2a2a3a;
                    border-radius: 6px; padding: 8px 10px; font-size: 12px;
                    font-family: inherit; outline: none; box-sizing: border-box;
                }
                .${PREFIX}-modal input:focus, .${PREFIX}-modal textarea:focus { border-color: #58a6ff; }
                .${PREFIX}-modal textarea { min-height: 180px; resize: vertical; margin-top: 8px; }
                .${PREFIX}-modal-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 12px; }
                .${PREFIX}-modal-btn {
                    padding: 6px 14px; border-radius: 6px; border: 1px solid #2a2a3a;
                    cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;
                }
                .${PREFIX}-modal-btn.primary { background: #58a6ff; color: #000; border-color: #58a6ff; }
                .${PREFIX}-modal-btn.primary:hover { background: #79b8ff; }
                .${PREFIX}-modal-btn.secondary { background: transparent; color: #888; }
                .${PREFIX}-modal-btn.secondary:hover { color: #ccc; background: rgba(255,255,255,0.05); }
                .${PREFIX}-modal-btn.danger { background: transparent; color: #f85149; border-color: rgba(248,81,73,0.3); }
                .${PREFIX}-modal-btn.danger:hover { background: rgba(248,81,73,0.1); }

                /* Settings grid for two-column layout */
                .${PREFIX}-settings-grid {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 0 6px;
                }

                /* Turn navigator */
                .${PREFIX}-turn-item {
                    display: flex; align-items: center; gap: 4px;
                    padding: 1px 4px; cursor: pointer; border-radius: 3px;
                    font-size: 10px; color: #888; transition: background 0.15s;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .${PREFIX}-turn-item:hover { background: rgba(88,166,255,0.08); color: #c8c8d8; }
                .${PREFIX}-turn-item .turn-role {
                    font-size: 9px; font-weight: 600; min-width: 14px; text-align: center;
                }
                .${PREFIX}-turn-item .turn-role.human { color: #58a6ff; }
                .${PREFIX}-turn-item .turn-role.ai { color: #bc8cff; }
                .${PREFIX}-turn-item .turn-preview { overflow: hidden; text-overflow: ellipsis; flex: 1; }
                .${PREFIX}-turn-fork {
                    border: 0; background: transparent; color: #555; cursor: pointer;
                    font-size: 10px; padding: 0 2px; border-radius: 3px;
                }
                .${PREFIX}-turn-fork:hover { color: #58a6ff; background: rgba(88,166,255,0.08); }
            `);
        },

        _getHTML() {
            return `
                <div id="${PREFIX}-panel-resize"></div>
                <div class="${PREFIX}-hdr">
                    <h2>CUE <span class="${PREFIX}-hdr-ver">v${VERSION}</span></h2>
                    <div class="${PREFIX}-hdr-actions">
                        <button class="${PREFIX}-icon-btn" id="${PREFIX}-panel-pin" title="Pin panel">P</button>
                        <button class="${PREFIX}-close" id="${PREFIX}-panel-close">&times;</button>
                    </div>
                </div>

                <div class="${PREFIX}-section">
                    <div class="${PREFIX}-row"><span class="${PREFIX}-row-label">Response</span><span id="${PREFIX}-status"><span class="${PREFIX}-status-dot idle"></span>Idle</span></div>
                    <div class="${PREFIX}-row"><span class="${PREFIX}-row-label">Last</span><span id="${PREFIX}-last-resp" style="color:#666;font-size:10px">--</span></div>
                    <div class="${PREFIX}-row"><span class="${PREFIX}-row-label">Cost</span><span id="${PREFIX}-cost-display" style="color:#d29922;font-size:10px">$0.000</span></div>
                </div>

                <div class="${PREFIX}-section">
                    <div class="${PREFIX}-row">
                        <span class="${PREFIX}-row-label" style="font-size:10px">Usage Plan</span>
                        <select class="${PREFIX}-select" id="${PREFIX}-set-usagePlan">
                            <option value="pro">Pro</option>
                            <option value="max5">Max 5x</option>
                            <option value="max20">Max 20x</option>
                        </select>
                    </div>
                    <div id="${PREFIX}-usage-content"><span style="color:#555;font-size:10px">Loading usage...</span></div>
                </div>

                <div class="${PREFIX}-section" id="${PREFIX}-diagnostics-section">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span class="${PREFIX}-section-title" style="margin:0">Diagnostics</span>
                        <button class="${PREFIX}-tool-btn" id="${PREFIX}-diagnostics-refresh" aria-label="Refresh CUE diagnostics">Refresh</button>
                    </div>
                    <div id="${PREFIX}-diagnostics-content"><span style="color:#555;font-size:10px">Not checked</span></div>
                </div>

                <div class="${PREFIX}-section">
                    <div class="${PREFIX}-row"><span class="${PREFIX}-row-label">Context</span><span id="${PREFIX}-ctx-pct" style="color:#3fb950;font-weight:600;font-size:11px">0%</span></div>
                    <div class="${PREFIX}-usage-bar"><div id="${PREFIX}-ctx-bar" class="${PREFIX}-ctx-fill good" style="width:0%"></div></div>
                    <div style="display:flex;justify-content:space-between;font-size:9px;color:#555">
                        <span><span id="${PREFIX}-ctx-tokens">0</span> tok</span>
                        <span><span id="${PREFIX}-ctx-turns">0</span> turns</span>
                        <span><span id="${PREFIX}-ctx-burn">0</span>/min</span>
                    </div>
                    <div id="${PREFIX}-ctx-advice" style="font-size:9px;color:#3fb950"></div>
                    <div id="${PREFIX}-cache-indicator" style="font-size:9px;color:#555;margin-top:1px"></div>
                </div>

                <div class="${PREFIX}-section" id="${PREFIX}-features-section">
                    <div id="${PREFIX}-features-content"><span style="color:#555;font-size:10px">Loading features...</span></div>
                </div>

                <div class="${PREFIX}-section">
                    <div class="${PREFIX}-settings-grid">
                        ${this._makeToggle('themeEnabled', 'Theme')}
                        ${this._makeToggle('fontOverride', 'Sans Fonts')}
                        ${this._makeToggle('wideMode', 'Wide')}
                        ${this._makeToggle('coloredButtons', 'Btn Colors')}
                        ${this._makeToggle('coloredBoldItalic', 'Bold/Ital')}
                        ${this._makeToggle('smoothAnimations', 'Animate')}
                        ${this._makeToggle('customScrollbar', 'Scrollbar')}
                        ${this._makeToggle('pasteFix', 'Paste Fix')}
                        ${this._makeToggle('autoScroll', 'Auto-Scroll')}
                        ${this._makeToggle('autoApprove', 'Auto-Approve')}
                        ${this._makeToggle('contextTracker', 'Ctx Track')}
                        ${this._makeToggle('responseMonitor', 'Resp Mon')}
                        ${this._makeToggle('notifySound', 'Sound')}
                        ${this._makeToggle('notifyFlash', 'Tab Flash')}
                        ${this._makeToggle('codeFold', 'Code Fold')}
                        ${this._makeToggle('copyTurn', 'Copy Turn')}
                        ${this._makeToggle('snippetTrigger', 'Snippets')}
                        ${this._makeToggle('conversationSearch', 'Chat Search')}
                        ${this._makeToggle('forkConversation', 'Fork')}
                        ${this._makeToggle('voiceDictation', 'Voice')}
                        ${this._makeToggle('focusMode', 'Focus')}
                        ${this._makeToggle('domTrimmer', 'DOM Trim')}
                    </div>
                    <div class="${PREFIX}-row" style="margin-top:2px">
                        <span class="${PREFIX}-row-label" style="font-size:10px">Theme</span>
                        <select class="${PREFIX}-select" id="${PREFIX}-set-themeVariant">
                            <option value="oceanic">Oceanic</option>
                            <option value="midnight">Midnight</option>
                            <option value="mocha">Catppuccin Mocha</option>
                            <option value="macchiato">Catppuccin Macchiato</option>
                            <option value="frappe">Catppuccin Frappé</option>
                            <option value="latte">Catppuccin Latte</option>
                            <option value="none">None</option>
                        </select>
                    </div>
                    <div class="${PREFIX}-row" style="margin-top:2px">
                        <span class="${PREFIX}-row-label" style="font-size:10px">Density</span>
                        <select class="${PREFIX}-select" id="${PREFIX}-set-densityMode">
                            <option value="comfortable">Comfortable</option>
                            <option value="compact">Compact</option>
                            <option value="reading">Reading</option>
                        </select>
                    </div>
                    <div class="${PREFIX}-row">
                        <span class="${PREFIX}-row-label" style="font-size:10px">Width: <span id="${PREFIX}-width-val">${Settings.get('chatWidthPct')}</span>%</span>
                        <input type="range" class="${PREFIX}-slider" id="${PREFIX}-set-chatWidthPct" min="50" max="100" value="${Settings.get('chatWidthPct')}" style="width:100px">
                    </div>
                    <div class="${PREFIX}-row">
                        <span class="${PREFIX}-row-label" style="font-size:10px">Keep: <span id="${PREFIX}-trim-val">${Settings.get('domKeepVisible')}</span> msgs</span>
                        <input type="range" class="${PREFIX}-slider" id="${PREFIX}-set-domKeepVisible" min="5" max="100" value="${Settings.get('domKeepVisible')}" style="width:100px">
                    </div>
                    <div class="${PREFIX}-row">
                        <span class="${PREFIX}-row-label" style="font-size:10px">Panel: <span id="${PREFIX}-panel-width-val">${Settings.get('panelWidth')}</span>px</span>
                        <input type="range" class="${PREFIX}-slider" id="${PREFIX}-set-panelWidth" min="280" max="640" value="${Settings.get('panelWidth')}" style="width:100px">
                    </div>
                </div>

                <div class="${PREFIX}-section">
                    <div id="${PREFIX}-prompt-list"></div>
                    <button class="${PREFIX}-prompt-btn" id="${PREFIX}-prompt-add" style="width:100%;justify-content:center;color:#58a6ff;margin-top:1px">+ Add Prompt</button>
                </div>

                <div class="${PREFIX}-section">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span class="${PREFIX}-section-title" style="margin:0">Conversation Search</span>
                        <button class="${PREFIX}-tool-btn primary" id="${PREFIX}-search-refresh">Index</button>
                    </div>
                    <input class="${PREFIX}-search-input" id="${PREFIX}-search-query" placeholder="Search cached conversations">
                    <div id="${PREFIX}-search-meta" style="font-size:9px;color:#555"></div>
                    <div id="${PREFIX}-search-results"></div>
                </div>

                <div class="${PREFIX}-section">
                    <div class="${PREFIX}-section-title">Tools</div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap">
                        <button class="${PREFIX}-tool-btn primary" id="${PREFIX}-voice-toggle">Voice</button>
                        <button class="${PREFIX}-tool-btn primary" id="${PREFIX}-fork-latest">Fork Latest</button>
                        <button class="${PREFIX}-tool-btn" id="${PREFIX}-copy-last-code">Copy Code</button>
                        <button class="${PREFIX}-tool-btn" id="${PREFIX}-copy-last-response">Copy Response</button>
                        <button class="${PREFIX}-tool-btn" id="${PREFIX}-export-chat">Export Chat</button>
                    </div>
                    <div id="${PREFIX}-voice-status" style="font-size:9px;color:#555;margin-top:3px">Voice idle</div>
                </div>

                <div class="${PREFIX}-section">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span class="${PREFIX}-section-title" style="margin:0">Turn Navigator</span>
                        <span style="display:flex;gap:3px">
                            <button class="${PREFIX}-tool-btn" id="${PREFIX}-turn-prev">Prev</button>
                            <button class="${PREFIX}-tool-btn" id="${PREFIX}-turn-next">Next</button>
                        </span>
                    </div>
                    <div id="${PREFIX}-turn-nav" style="max-height:120px;overflow-y:auto"></div>
                </div>

                <div class="${PREFIX}-section">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span class="${PREFIX}-section-title" style="margin:0">Error Log</span>
                        <span style="cursor:pointer;color:#555;font-size:9px" id="${PREFIX}-clear-errors">Clear</span>
                    </div>
                    <div id="${PREFIX}-error-log"></div>
                </div>

                <div class="${PREFIX}-section" style="border-bottom:none">
                    <div style="display:flex;justify-content:center;gap:8px;margin-top:3px">
                        <span style="cursor:pointer;color:#58a6ff;font-size:9px" id="${PREFIX}-export-config">Export</span>
                        <span style="cursor:pointer;color:#58a6ff;font-size:9px" id="${PREFIX}-import-config">Import</span>
                        <span style="cursor:pointer;color:#f85149;font-size:9px" id="${PREFIX}-reset-settings">Reset All</span>
                    </div>
                </div>
            `;
        },

        _makeToggle(key, label) {
            const checked = Settings.get(key) ? 'checked' : '';
            return `<div class="${PREFIX}-row" style="min-height:16px">
                    <span class="${PREFIX}-row-label" style="font-size:10px">${label}</span>
                    <label class="${PREFIX}-toggle">
                        <input type="checkbox" data-setting="${key}" ${checked}>
                        <span class="${PREFIX}-toggle-track"></span>
                        <span class="${PREFIX}-toggle-thumb"></span>
                    </label>
                </div>`;
        },

        _bindEvents() {
            // Close button
            $(`#${PREFIX}-panel-close`).addEventListener('click', () => {
                if (Settings.get('panelPinned')) Settings.set('panelPinned', false);
                this.hide(true);
            });
            $(`#${PREFIX}-panel-pin`).addEventListener('click', () => Settings.toggle('panelPinned'));
            this._bindPanelResize();

            // Toggle switches
            this._panel.querySelectorAll(`input[data-setting]`).forEach(cb => {
                cb.addEventListener('change', () => Settings.set(cb.dataset.setting, cb.checked));
            });

            // Theme variant select
            const themeSelect = $(`#${PREFIX}-set-themeVariant`);
            themeSelect.value = Settings.get('themeVariant');
            themeSelect.addEventListener('change', () => Settings.set('themeVariant', themeSelect.value));

            // Density mode select
            const densitySelect = $(`#${PREFIX}-set-densityMode`);
            densitySelect.value = Settings.get('densityMode');
            densitySelect.addEventListener('change', () => Settings.set('densityMode', densitySelect.value));

            // Usage plan select
            const usagePlanSelect = $(`#${PREFIX}-set-usagePlan`);
            usagePlanSelect.value = Settings.get('usagePlan');
            usagePlanSelect.addEventListener('change', () => {
                Settings.set('usagePlan', usagePlanSelect.value);
                this._renderUsage(this._usageData);
            });

            // Width slider
            const widthSlider = $(`#${PREFIX}-set-chatWidthPct`);
            widthSlider.addEventListener('input', () => {
                $(`#${PREFIX}-width-val`).textContent = widthSlider.value;
                Settings.set('chatWidthPct', parseInt(widthSlider.value));
            });

            // DOM trimmer slider
            const trimSlider = $(`#${PREFIX}-set-domKeepVisible`);
            trimSlider.addEventListener('input', () => {
                $(`#${PREFIX}-trim-val`).textContent = trimSlider.value;
                Settings.set('domKeepVisible', parseInt(trimSlider.value));
            });

            // Panel width slider
            const panelWidthSlider = $(`#${PREFIX}-set-panelWidth`);
            panelWidthSlider.addEventListener('input', () => {
                const width = parseInt(panelWidthSlider.value);
                $(`#${PREFIX}-panel-width-val`).textContent = width;
                Settings.set('panelWidth', width);
            });

            // Reset settings
            $(`#${PREFIX}-reset-settings`).addEventListener('click', () => {
                Settings.reset();
                showToast('Settings reset', 1200, 'success');
                setTimeout(() => location.reload(), 600);
            });

            // Export config
            $(`#${PREFIX}-export-config`).addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(ConfigCodec.create(), null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'cue-config-' + new Date().toISOString().slice(0, 10) + '.json';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                showToast('Config exported!', 2000, 'success');
            });

            // Import config
            $(`#${PREFIX}-import-config`).addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.addEventListener('change', () => {
                    const file = input.files[0]; if (!file) return;
                    if (file.size > ConfigCodec.MAX_BYTES) { showToast('Config exceeds 512 KB', 3000, 'error'); return; }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const result = ConfigCodec.parse(String(e.target.result || ''));
                            let imported = 0;
                            Object.keys(Settings._defaults).forEach(k => {
                                if (Object.prototype.hasOwnProperty.call(result.settings, k) && Settings.set(k, result.settings[k])) imported++;
                            });
                            if (result.prompts.length) {
                                result.prompts.forEach(p => {
                                    const existing = PromptModule.prompts.find(x => x.id === p.id);
                                    if (existing) {
                                        existing.label = p.label; existing.prompt = p.prompt; existing.cat = p.cat;
                                        existing.history = p.history || existing.history || [];
                                    } else PromptModule.prompts.push(p);
                                });
                                PromptModule.save();
                            }
                            const rejected = result.rejected.length ? `; skipped ${result.rejected.length}` : '';
                            if (result.rejected.length) ErrorLogModule._add('warn', 'configImport', result.rejected.join(', '));
                            showToast(`Imported ${imported} settings${rejected}`, 3000, result.rejected.length ? 'warn' : 'success');
                            setTimeout(() => location.reload(), 1000);
                        } catch (err) { showToast('Invalid config file: ' + err.message, 3000, 'error'); }
                    };
                    reader.readAsText(file);
                });
                input.click();
            });

            // Add prompt button
            $(`#${PREFIX}-prompt-add`).addEventListener('click', () => this._showPromptEditor());

            // Conversation search
            const searchInput = $(`#${PREFIX}-search-query`);
            searchInput.addEventListener('input', () => this._renderConversationSearch(searchInput.value));
            $(`#${PREFIX}-search-refresh`).addEventListener('click', async () => {
                await ConversationSearchModule.refresh();
                this._renderConversationSearch(searchInput.value);
            });

            // Tools
            $(`#${PREFIX}-voice-toggle`).addEventListener('click', () => VoiceDictationModule.toggle());
            $(`#${PREFIX}-fork-latest`).addEventListener('click', () => ForkConversationModule.forkAt(null));
            $(`#${PREFIX}-copy-last-code`).addEventListener('click', () => PanelToolsModule._copyLastCode());
            $(`#${PREFIX}-copy-last-response`).addEventListener('click', () => PanelToolsModule._copyLastResponse());
            $(`#${PREFIX}-export-chat`).addEventListener('click', () => PanelToolsModule._showExportMenu());
            $(`#${PREFIX}-turn-prev`).addEventListener('click', () => this._jumpTurn(-1));
            $(`#${PREFIX}-turn-next`).addEventListener('click', () => this._jumpTurn(1));

            // Clear error log
            $(`#${PREFIX}-clear-errors`).addEventListener('click', () => {
                ErrorLogModule.clear();
                this._renderErrorLog();
            });

            // Listen for updates
            EventBus.on('response:status', (s) => this._updateStatus(s));
            EventBus.on('response:complete', (d) => this._updateLastResponse(d));
            EventBus.on('context:updated', (h) => { this._updateContext(h); this._updateTurnNav(); });
            EventBus.on('stream:messageLimit', (ml) => this._updateUsageFromStream(ml));
            EventBus.on('usage:localUpdated', () => this._renderUsage(this._usageData));
            EventBus.on('errorlog:updated', () => this._renderErrorLog());
            EventBus.on('cost:updated', (d) => this._updateCost(d));
            EventBus.on('cache:hit', () => this._updateCache('hit'));
            EventBus.on('cache:miss', () => this._updateCache('miss'));
            EventBus.on('cache:timer', (d) => this._updateCacheTimer(d));
            EventBus.on('cache:expired', () => this._updateCache('expired'));
            EventBus.on('conversationSearch:updated', () => this._renderConversationSearch(searchInput.value));
            EventBus.on('conversationSearch:loading', (loading) => this._setSearchLoading(loading));
            EventBus.on('voice:status', (status) => this._updateVoiceStatus(status));
            EventBus.on('diagnostics:updated', () => this._renderDiagnostics());
            EventBus.on('setting:panelPinned', () => this._applyPanelChrome());
            EventBus.on('setting:panelWidth', () => this._applyPanelChrome());

            $(`#${PREFIX}-diagnostics-refresh`).addEventListener('click', async (event) => {
                const button = event.currentTarget;
                button.disabled = true;
                button.textContent = 'Checking';
                await DiagnosticsModule.collect(true);
                button.disabled = false;
                button.textContent = 'Refresh';
            });

            this._renderPrompts();
            this._renderUsage(this._usageData);
            this._renderConversationSearch('');
            this._renderErrorLog();
            this._renderDiagnostics();
            this._updateTurnNav();
        },

        _applyPanelChrome() {
            if (!this._panel) return;
            const width = Math.max(280, Math.min(640, parseInt(Settings.get('panelWidth')) || 320));
            this._panel.style.setProperty('--cue-panel-width', width + 'px');
            const widthLabel = $(`#${PREFIX}-panel-width-val`);
            if (widthLabel) widthLabel.textContent = width;
            const widthSlider = $(`#${PREFIX}-set-panelWidth`);
            if (widthSlider) widthSlider.value = width;
            const pinned = Settings.get('panelPinned');
            this._panel.classList.toggle(PREFIX + '-panel-pinned', pinned);
            const pin = $(`#${PREFIX}-panel-pin`);
            if (pin) {
                pin.classList.toggle('active', pinned);
                pin.textContent = pinned ? 'U' : 'P';
                pin.title = pinned ? 'Unpin panel' : 'Pin panel';
            }
            if (pinned) this.show();
        },

        _bindPanelResize() {
            const handle = $(`#${PREFIX}-panel-resize`);
            if (!handle) return;
            let dragging = false;
            let nextWidth = Settings.get('panelWidth');
            const onMove = (e) => {
                if (!dragging) return;
                nextWidth = Math.max(280, Math.min(640, window.innerWidth - e.clientX));
                this._panel.style.setProperty('--cue-panel-width', nextWidth + 'px');
                const label = $(`#${PREFIX}-panel-width-val`);
                if (label) label.textContent = nextWidth;
                const slider = $(`#${PREFIX}-set-panelWidth`);
                if (slider) slider.value = nextWidth;
            };
            const onUp = () => {
                if (!dragging) return;
                dragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                Settings.set('panelWidth', Math.round(nextWidth));
            };
            handle.addEventListener('mousedown', (e) => {
                dragging = true;
                nextWidth = Settings.get('panelWidth');
                e.preventDefault();
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        },

        async _loadData() {
            // Load usage from API
            const usage = await ClaudeAPI.getUsage();
            if (usage) {
                this._usageData = usage;
                this._renderUsage(usage);
            }

            // Load Claude features
            const settings = await ClaudeAPI.getSettings();
            if (settings) {
                this._claudeSettings = settings;
                this._renderFeatures(settings);
            }
            await DiagnosticsModule.collect(false);
        },

        _renderDiagnostics() {
            const container = $(`#${PREFIX}-diagnostics-content`);
            if (!container) return;
            const summary = DiagnosticsModule.getSummary();
            if (!summary.checks.length) {
                setHTML(container, '<span style="color:#555;font-size:10px">Not checked</span>');
                return;
            }
            const colors = { pass: '#3fb950', fail: '#f85149', unknown: '#d29922' };
            setHTML(container, summary.checks.map(check => `<div style="display:flex;justify-content:space-between;gap:6px;font-size:9px;padding:1px 0"><span>${esc(check.label)}</span><span style="color:${colors[check.state] || colors.unknown}" title="${esc(check.detail)}">${check.state.toUpperCase()}</span></div>`).join('') +
                `<div style="font-size:8px;color:#555;margin-top:3px">Last checked: ${esc(summary.lastRun ? new Date(summary.lastRun).toLocaleTimeString() : 'never')}</div>`);
        },

        _renderUsage(data) {
            const container = $(`#${PREFIX}-usage-content`);
            if (!container) return;
            if (!Settings.get('usageMonitor')) {
                setHTML(container, '<span style="color:#555;font-size:10px">Usage monitor disabled</span>');
                return;
            }
            const plan = this.USAGE_PLANS[Settings.get('usagePlan')] || this.USAGE_PLANS.pro;
            const local = UsageTrackerModule.getStats();
            let html = `<div style="display:flex;justify-content:space-between;font-size:9px;color:#555;margin-bottom:2px">
                    <span>${plan.name} thresholds</span><span>${local.totalCached} cached sends</span>
                </div>`;
            const addBar = (label, info, source = 'server') => {
                if (!info) return;
                let util = info.utilization ?? info.used_percentage ?? info.percent ?? 0;
                if (typeof util === 'string') util = parseFloat(util);
                const pct = Math.max(0, Math.min(100, Math.round(util <= 1 ? util * 100 : util)));
                const cls = pct > 80 ? 'danger' : pct > 60 ? 'warn' : '';
                const reset = info.resets_at ? this._fmtReset(info.resets_at) : '';
                html += `<div style="margin-bottom:3px">
                        <div style="display:flex;justify-content:space-between;font-size:10px;color:#888">
                            <span>${label}</span><span>${pct}%${reset ? ' ' + reset : ''}</span>
                        </div>
                        <div class="${PREFIX}-usage-bar"><div class="${PREFIX}-usage-fill ${cls}" style="width:${pct}%"></div></div>
                        ${source !== 'server' ? `<div class="${PREFIX}-usage-local">${source}</div>` : ''}
                    </div>`;
            };
            const localPct = (count, key) => {
                const limit = (this.LOCAL_USAGE_BASELINE[key] || 1) * plan.multiplier;
                return Math.min(1, count / limit);
            };
            addBar('Tab Session', { utilization: localPct(local.session, 'session') }, `${local.session} sends this tab`);
            if (data) {
                addBar('5h Window', data.five_hour || data.fiveHour || data['5h']);
                addBar('7d Window', data.seven_day || data.sevenDay || data['7d']);
                addBar('Opus Weekly', data.seven_day_opus || data.opus || data.opus_weekly);
            } else {
                addBar('5h Window', { utilization: localPct(local.fiveHour, 'fiveHour') }, `${local.fiveHour} local sends`);
                addBar('7d Window', { utilization: localPct(local.sevenDay, 'sevenDay') }, `${local.sevenDay} local sends`);
            }
            setHTML(container, html);
        },

        _updateUsageFromStream(ml) {
            const container = $(`#${PREFIX}-usage-content`);
            if (!container) return;
            const windows = ml.windows;
            if (!windows) return;
            const plan = this.USAGE_PLANS[Settings.get('usagePlan')] || this.USAGE_PLANS.pro;
            const local = UsageTrackerModule.getStats();
            let html = `<div style="display:flex;justify-content:space-between;font-size:9px;color:#555;margin-bottom:2px">
                    <span>${plan.name} thresholds</span><span>${local.totalCached} cached sends</span>
                </div>`;
            const addBar = (label, info) => {
                if (!info) return;
                const pct = Math.round((info.utilization || 0) * 100);
                const cls = pct > 80 ? 'danger' : pct > 60 ? 'warn' : '';
                const reset = info.resets_at ? this._fmtResetUnix(info.resets_at) : '';
                html += `<div style="margin-bottom:3px">
                        <div style="display:flex;justify-content:space-between;font-size:10px;color:#888">
                            <span>${label}</span><span>${pct}%${reset ? ' ' + reset : ''}</span>
                        </div>
                        <div class="${PREFIX}-usage-bar"><div class="${PREFIX}-usage-fill ${cls}" style="width:${pct}%"></div></div>
                    </div>`;
            };
            const localLimit = this.LOCAL_USAGE_BASELINE.session * plan.multiplier;
            const localPct = Math.min(100, Math.round((local.session / localLimit) * 100));
            const localCls = localPct > 80 ? 'danger' : localPct > 60 ? 'warn' : '';
            html += `<div style="margin-bottom:3px">
                    <div style="display:flex;justify-content:space-between;font-size:10px;color:#888">
                        <span>Tab Session</span><span>${local.session} sends</span>
                    </div>
                    <div class="${PREFIX}-usage-bar"><div class="${PREFIX}-usage-fill ${localCls}" style="width:${localPct}%"></div></div>
                </div>`;
            addBar('5h Window', windows['5h'] || windows.five_hour);
            addBar('7d Window', windows['7d'] || windows.seven_day);
            if (html) setHTML(container, html);
            const session = windows['5h'] || windows.five_hour;
            if (session) this._updateGearBadge(Math.round((session.utilization || 0) * 100));
        },

        _renderFeatures(settings) {
            const container = $(`#${PREFIX}-features-content`);
            if (!container) return;
            setHTML(container, this.FEATURES.map(f => {
                const on = settings[f.key] === true;
                return `<div class="${PREFIX}-feat-row">
                        <span class="${PREFIX}-feat-name">${f.name}</span>
                        <button class="${PREFIX}-feat-btn ${on ? 'on' : 'off'}"
                                data-feat="${f.key}" data-exclusive="${f.exclusive || ''}">${on ? 'ON' : 'OFF'}</button>
                    </div>`;
            }).join(''));
            container.querySelectorAll(`.${PREFIX}-feat-btn`).forEach(btn => {
                btn.addEventListener('click', async () => {
                    const key = btn.dataset.feat;
                    const isOn = btn.classList.contains('on');
                    btn.textContent = '...';
                    btn.disabled = true;
                    const excl = btn.dataset.exclusive || null;
                    const result = await ClaudeAPI.toggleFeature(key, !isOn, excl);
                    if (result) {
                        btn.classList.toggle('on', !isOn);
                        btn.classList.toggle('off', isOn);
                        btn.textContent = !isOn ? 'ON' : 'OFF';
                        // Update exclusive partner
                        if (excl && !isOn) {
                            const partnerBtn = container.querySelector(`[data-feat="${excl}"]`);
                            if (partnerBtn) {
                                partnerBtn.classList.remove('on'); partnerBtn.classList.add('off');
                                partnerBtn.textContent = 'OFF';
                            }
                        }
                    } else {
                        btn.textContent = isOn ? 'ON' : 'OFF';
                    }
                    btn.disabled = false;
                });
            });
        },

        _renderConversationSearch(query = '') {
            const meta = $(`#${PREFIX}-search-meta`);
            const resultsEl = $(`#${PREFIX}-search-results`);
            if (!meta || !resultsEl) return;
            if (!Settings.get('conversationSearch')) {
                meta.textContent = 'Search disabled';
                setHTML(resultsEl, '');
                return;
            }
            const results = ConversationSearchModule.search(query, 8);
            const indexed = ConversationSearchModule.lastIndexed
                ? new Date(ConversationSearchModule.lastIndexed).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'never';
            meta.textContent = `${ConversationSearchModule.items.length} cached - indexed ${indexed}`;
            if (!results.length) {
                setHTML(resultsEl, `<div style="font-size:10px;color:#555;padding:3px 0">${query ? 'No matches' : 'No cached conversations'}</div>`);
                return;
            }
            setHTML(resultsEl, results.map(item => {
                const date = item.updated ? new Date(item.updated).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
                return `<div class="${PREFIX}-search-result">
                    <button class="${PREFIX}-tool-btn ${PREFIX}-search-open" data-chat-id="${esc(item.id)}" style="min-width:42px">Open</button>
                    <span class="${PREFIX}-search-title" title="${esc(item.title)}">${esc(item.title)}</span>
                    <span class="${PREFIX}-search-date">${esc(date)}</span>
                </div>`;
            }).join(''));
            resultsEl.querySelectorAll('.' + PREFIX + '-search-open').forEach(btn => {
                btn.addEventListener('click', () => ConversationSearchModule.open(btn.dataset.chatId));
            });
        },

        _setSearchLoading(loading) {
            const btn = $(`#${PREFIX}-search-refresh`);
            if (!btn) return;
            btn.disabled = !!loading;
            btn.textContent = loading ? 'Indexing' : 'Index';
        },

        _updateVoiceStatus(status) {
            const el = $(`#${PREFIX}-voice-status`);
            const btn = $(`#${PREFIX}-voice-toggle`);
            if (!el || !btn) return;
            if (status === 'listening') {
                el.textContent = 'Voice listening';
                el.style.color = '#3fb950';
                btn.classList.add('success');
            } else if (status === 'error') {
                el.textContent = 'Voice error';
                el.style.color = '#f85149';
                btn.classList.remove('success');
            } else {
                el.textContent = VoiceDictationModule.isSupported() ? 'Voice idle' : 'Voice unavailable';
                el.style.color = '#555';
                btn.classList.remove('success');
            }
        },

        _renderPrompts() {
            const container = $(`#${PREFIX}-prompt-list`);
            if (!container) return;
            setHTML(container, '');
            PromptModule.CATEGORIES.forEach(cat => {
                const prompts = PromptModule.prompts.filter(p => p.cat === cat.id && p.prompt);
                if (prompts.length === 0) return;
                const catEl = document.createElement('div');
                catEl.className = PREFIX + '-prompt-cat';
                catEl.style.color = cat.color;
                catEl.textContent = cat.label;
                container.appendChild(catEl);
                prompts.forEach(p => {
                    const btn = document.createElement('button');
                    btn.className = PREFIX + '-prompt-btn';
                    setHTML(btn, `<span>${esc(p.label)}</span>`);
                    btn.title = p.prompt.substring(0, 100) + '...';
                    btn.addEventListener('click', () => { PromptModule.send(p.prompt); this.toggle(); });
                    btn.addEventListener('contextmenu', (e) => { e.preventDefault(); this._showPromptEditor(p); });
                    container.appendChild(btn);
                });
            });
        },

        _showPromptEditor(existing = null) {
            const overlay = document.createElement('div');
            overlay.className = PREFIX + '-modal-overlay';
            const modal = document.createElement('div');
            modal.className = PREFIX + '-modal';
            const history = existing ? PromptModule.getHistory(existing.id) : [];
            const historyHTML = history.length > 0 ? `
                <div style="margin-top:10px;border-top:1px solid #2a2a3a;padding-top:8px">
                    <span style="font-size:10px;color:#888">Version history (${history.length})</span>
                    <div style="max-height:80px;overflow-y:auto;margin-top:4px">
                        ${history.map((h, i) => {
                            const date = new Date(h.time).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            const preview = (h.prompt || '').substring(0, 50).replace(/\n/g, ' ');
                            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;font-size:10px">
                                <span style="color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(date)}: ${esc(preview)}...</span>
                                <button class="${PREFIX}-modal-btn secondary ${PREFIX}-rollback-btn" data-idx="${i}" style="padding:1px 6px;font-size:9px;margin-left:4px;flex-shrink:0">Restore</button>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            ` : '';
            setHTML(modal, `
                <h3>${existing ? 'Edit' : 'Add'} Prompt</h3>
                <input id="${PREFIX}-pe-label" placeholder="Button label" value="${existing ? esc(existing.label) : ''}">
                <textarea id="${PREFIX}-pe-text" placeholder="Prompt template...">${existing ? esc(existing.prompt) : ''}</textarea>
                <div style="margin-top:10px">
                    <select class="${PREFIX}-select" id="${PREFIX}-pe-cat">
                        ${PromptModule.CATEGORIES.map(c => `<option value="${c.id}" ${existing?.cat === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
                    </select>
                </div>
                ${historyHTML}
                <div class="${PREFIX}-modal-actions">
                    ${existing && !existing.id.startsWith('spec') && !existing.id.startsWith('arch') ? `<button class="${PREFIX}-modal-btn danger" id="${PREFIX}-pe-delete">Delete</button>` : ''}
                    <button class="${PREFIX}-modal-btn secondary" id="${PREFIX}-pe-cancel">Cancel</button>
                    <button class="${PREFIX}-modal-btn primary" id="${PREFIX}-pe-save">Save</button>
                </div>
            `);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
            $(`#${PREFIX}-pe-cancel`, modal).addEventListener('click', () => overlay.remove());
            $(`#${PREFIX}-pe-save`, modal).addEventListener('click', () => {
                const label = $(`#${PREFIX}-pe-label`, modal).value.trim();
                const text = $(`#${PREFIX}-pe-text`, modal).value;
                const cat = $(`#${PREFIX}-pe-cat`, modal).value;
                if (!label) { showToast('Label is required', 2000, 'warn'); return; }
                if (existing) { PromptModule.update(existing.id, label, text); existing.cat = cat; PromptModule.save(); }
                else { PromptModule.add(label, text, cat); }
                this._renderPrompts();
                overlay.remove();
                showToast(`Prompt "${label}" saved!`, 2000, 'success');
            });
            const delBtn = $(`#${PREFIX}-pe-delete`, modal);
            if (delBtn) delBtn.addEventListener('click', () => {
                PromptModule.remove(existing.id);
                this._renderPrompts();
                overlay.remove();
                showToast('Prompt deleted', 2000, 'info');
            });
            // Rollback buttons
            modal.querySelectorAll('.' + PREFIX + '-rollback-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    if (existing && PromptModule.rollback(existing.id, idx)) {
                        this._renderPrompts();
                        overlay.remove();
                        showToast('Prompt restored from history', 2000, 'success');
                    }
                });
            });
        },

        _updateStatus(status) {
            const el = $(`#${PREFIX}-status`);
            if (!el) return;
            const labels = {
                idle: ['idle', 'Idle'],
                generating: ['generating', 'Generating...'],
                complete: ['complete', 'Complete'],
                stuck: ['stuck', 'Stuck!'],
                truncated: ['truncated', 'Truncated']
            };
            const [cls, txt] = labels[status] || labels.idle;
            setHTML(el, `<span class="${PREFIX}-status-dot ${cls}"></span>${txt}`);
        },

        _updateLastResponse(d) {
            const el = $(`#${PREFIX}-last-resp`);
            if (el) el.textContent = `${fmtDur(d.duration)} / ${fmtNum(d.words)} words`;
        },

        _updateContext(h) {
            const pctEl = $(`#${PREFIX}-ctx-pct`);
            const barEl = $(`#${PREFIX}-ctx-bar`);
            const tokEl = $(`#${PREFIX}-ctx-tokens`);
            const turnEl = $(`#${PREFIX}-ctx-turns`);
            const burnEl = $(`#${PREFIX}-ctx-burn`);
            const advEl = $(`#${PREFIX}-ctx-advice`);
            if (!pctEl) return;
            const pct = Math.round(h.fill * 100);
            pctEl.textContent = pct + '%';
            pctEl.style.color = { good: '#3fb950', warn: '#d29922', critical: '#f85149' }[h.level];
            barEl.style.width = pct + '%';
            barEl.className = `${PREFIX}-ctx-fill ${h.level}`;
            tokEl.textContent = fmtNum(h.tokens);
            turnEl.textContent = h.turns;
            burnEl.textContent = fmtNum(h.burnRate);
            advEl.textContent = h.advice;
            advEl.style.color = { good: '#3fb950', warn: '#d29922', critical: '#f85149' }[h.level];
        },

        _updateCache(status) {
            const el = $(`#${PREFIX}-cache-indicator`);
            if (!el) return;
            if (status === 'hit') {
                el.style.color = '#3fb950';
                el.textContent = 'Cache: HIT';
            } else if (status === 'miss') {
                el.style.color = '#555';
                el.textContent = 'Cache: miss';
            } else if (status === 'expired') {
                el.style.color = '#d29922';
                el.textContent = 'Cache: expired';
            }
        },

        _updateCacheTimer(d) {
            const el = $(`#${PREFIX}-cache-indicator`);
            if (!el) return;
            const mins = Math.floor(d.remaining / 60);
            const secs = Math.floor(d.remaining % 60);
            el.style.color = d.remaining < 60 ? '#d29922' : '#3fb950';
            el.textContent = `Cache: HIT (${mins}:${String(secs).padStart(2, '0')} left)`;
        },

        _updateCost(d) {
            const el = $(`#${PREFIX}-cost-display`);
            if (!el) return;
            const total = d.sessionCost;
            const fmt = total < 0.01 ? '$' + total.toFixed(4) : '$' + total.toFixed(3);
            el.textContent = fmt + ' (' + d.model + ')';
        },

        _renderErrorLog() {
            const el = $(`#${PREFIX}-error-log`);
            if (el) setHTML(el, ErrorLogModule.getHTML());
        },

        _updateTurnNav() {
            const container = $(`#${PREFIX}-turn-nav`);
            if (!container) return;
            const main = document.querySelector('main');
            if (!main) { setHTML(container, '<span style="color:#555;font-size:10px">No conversation</span>'); return; }
            const groups = $$(SEL.msgGroup, main);
            const messages = getConversationMessages();
            if (groups.length === 0 || messages.length === 0) { setHTML(container, '<span style="color:#555;font-size:10px">No messages</span>'); return; }
            let html = '';
            messages.forEach((m) => {
                const preview = m.text.substring(0, 40).replace(/\n/g, ' ');
                const role = m.role === 'human' ? 'H' : 'A';
                const roleClass = m.role === 'human' ? 'human' : 'ai';
                html += `<div class="${PREFIX}-turn-item" data-turn-idx="${m.index}">` +
                    `<span class="turn-role ${roleClass}">${role}</span>` +
                    `<span class="turn-preview">${esc(preview || '...')}</span>` +
                    `<button class="${PREFIX}-turn-fork" data-fork-idx="${m.index}" title="Fork through this turn">F</button></div>`;
            });
            setHTML(container, html);
            container.querySelectorAll('.' + PREFIX + '-turn-item').forEach(item => {
                item.addEventListener('click', () => {
                    const idx = parseInt(item.dataset.turnIdx);
                    const target = groups[idx];
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            });
            container.querySelectorAll('.' + PREFIX + '-turn-fork').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    ForkConversationModule.forkAt(parseInt(btn.dataset.forkIdx));
                });
            });
        },

        _jumpTurn(delta) {
            const groups = $$(SEL.msgGroup, document.querySelector('main') || document);
            if (!groups.length) return;
            this._turnCursor = Math.max(0, Math.min(groups.length - 1, this._turnCursor + delta));
            groups[this._turnCursor].scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        _updateGearBadge(pct) {
            // Update hover strip indicator color based on usage
            const strip = $(`#${PREFIX}-hover-strip`);
            if (!strip) return;
            const color = pct > 80 ? 'rgba(248,81,73,0.6)' : pct > 60 ? 'rgba(210,153,34,0.5)' : 'rgba(88,166,255,0.2)';
            strip.style.setProperty('--strip-color', color);
        },

        _fmtReset(iso) {
            if (!iso) return '';
            const d = new Date(iso), diff = d - new Date(), m = Math.floor(diff / 60000);
            if (m < 1) return 'soon';
            if (m < 60) return `in ${m}m`;
            const h = Math.floor(m / 60);
            return h < 24 ? `in ${h}h` : `in ${Math.floor(h / 24)}d`;
        },

        _fmtResetUnix(ts) {
            if (!ts) return '';
            return this._fmtReset(new Date(ts * 1000).toISOString());
        },

        buildGearButton() {
            if ($(`#${PREFIX}-hover-strip`)) return;
            const strip = document.createElement('div');
            strip.id = PREFIX + '-hover-strip';
            document.body.appendChild(strip);

            let hideTimeout = null;
            const showPanel = () => {
                clearTimeout(hideTimeout);
                this.show();
            };
            const scheduleHide = () => {
                if (Settings.get('panelPinned')) return;
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(() => {
                    if (Settings.get('panelPinned')) return;
                    if (this._panel && !this._panel.matches(':hover') && !strip.matches(':hover')) {
                        this.hide();
                    }
                }, 400);
            };

            strip.addEventListener('mouseenter', showPanel);
            strip.addEventListener('mouseleave', scheduleHide);
            if (this._panel) {
                this._panel.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
                this._panel.addEventListener('mouseleave', scheduleHide);
            }
        },

        destroy() { clearInterval(this._refreshTimer); }
    };

    // =====================================================================
    //  INITIALIZATION
    // =====================================================================
    const ALL_MODULES = [
        ThemeModule, FocusModule, DensityModule, LayoutModule, VisualModule, PasteFixModule,
        AutoScrollModule, AutoApproveModule, UsageTrackerModule, ContextModule, CacheModule, CostModule,
        ResponseModule, DomTrimmerModule, CodeFoldModule, CopyTurnModule,
        ErrorLogModule, DiagnosticsModule, RetitleModule, ConversationSearchModule, VoiceDictationModule,
        ForkConversationModule, SnippetModule, PromptModule, PanelToolsModule
    ];

    // Safe module initializer — isolates each module so one failure
    // doesn't take down the rest (graceful degradation).
    function safeInit(mod) {
        try {
            mod.init();
        } catch (e) {
            console.error(LOG_TAG, `Module "${mod.id}" failed to init:`, e);
            EventBus.emit('module:error', { module: mod.id, error: e });
        }
    }

    async function init() {
        console.log(`%c${LOG_TAG} Claude Ultimate Enhancer v${VERSION} initializing...`, 'color:#58a6ff;font-weight:bold;font-size:14px');

        // Install fetch interceptor early (before any fetches)
        StreamMonitor.install();

        // Error log must init first to capture other module errors
        safeInit(ErrorLogModule);
        safeInit(DiagnosticsModule);

        // Init modules that work at document-start
        safeInit(ThemeModule);
        safeInit(FocusModule);
        safeInit(DensityModule);
        safeInit(LayoutModule);
        safeInit(PasteFixModule);
        safeInit(UsageTrackerModule);

        // Wait for body to be available
        const waitBody = () => new Promise(r => {
            if (document.body) return r();
            const obs = new MutationObserver(() => { if (document.body) { obs.disconnect(); r(); } });
            obs.observe(document.documentElement, { childList: true });
        });
        await waitBody();

        // Init remaining modules with graceful degradation
        safeInit(VisualModule);
        safeInit(AutoScrollModule);
        safeInit(AutoApproveModule);
        safeInit(ContextModule);
        safeInit(CacheModule);
        safeInit(CostModule);
        safeInit(ResponseModule);
        safeInit(DomTrimmerModule);
        safeInit(CodeFoldModule);
        safeInit(CopyTurnModule);
        safeInit(RetitleModule);
        safeInit(ConversationSearchModule);
        safeInit(VoiceDictationModule);
        safeInit(ForkConversationModule);
        safeInit(SnippetModule);
        safeInit(PromptModule);
        safeInit(PanelToolsModule);

        // Build control panel
        ControlPanel.build();
        ControlPanel.buildGearButton();

        // URL change detection for SPA navigation
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                ContextModule.data = { turns: 0, userMsgs: 0, assistantMsgs: 0, estimatedTokens: 0, chatStartTime: null, sseUtilization: null, history: [] };
                ResponseModule.status = 'idle';
                ResponseModule.genStartTime = null;
                ResponseModule.lastDuration = 0;
                ResponseModule.lastWords = 0;
                ResponseModule.lastChars = 0;
                ResponseModule._stopTimer();
                EventBus.emit('response:status', 'idle');
                EventBus.emit('navigation', location.href);
            }
        }, 2000);

        console.log(`%c${LOG_TAG} Ready! Hover right edge to open the panel`, 'color:#3fb950;font-weight:bold');
    }

    // Small, opt-in seam for the local Node smoke/contract tests. It is never
    // populated for normal userscript execution and carries no page data.
    if (window.__CUE_TEST__) {
        window.__CUE_TEST_API = {
            VERSION, PREFIX, Settings, ConfigCodec, StorageRepository,
            ConversationSerializer, ClaudeAPI, StreamMonitor, DiagnosticsModule,
            EventBus, sanitizeMarkup, getConversationMessages, getSafeElementHTML
        };
        return;
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
