import { generateUniqueId, Validator } from './utils.js';
import { DEFAULT_OPTIONS, EVENT_TYPES } from './constants.js';

/**
 * ShadowCard class - Creates isolated card instances using Shadow DOM
 */
export class ShadowCard {
    constructor(options = {}) {
        try {
            // Merge defaults and ensure object shape
            this.options = { ...(DEFAULT_OPTIONS || {}), ...(options || {}) };
            // ensure container fallback
            this.options.container = this.options.container || document.body;
            // basic init
            this.id = generateUniqueId ? generateUniqueId() : `shadow-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            this.isDestroyed = false;
            this.data = { ...this.options.data };
            this.eventListeners = new Map();
            this.resizeTimer = null;

            // Validate using Validator if available (defensive)
            try {
                if (Validator && typeof Validator.validateContainer === 'function') {
                    Validator.validateContainer(this.options.container);
                }
                if (Validator && typeof Validator.validateHtml === 'function') {
                    Validator.validateHtml(this.options.html);
                }
                if (Validator && typeof Validator.validateCss === 'function') {
                    Validator.validateCss(this.options.css);
                }
                if (Validator && typeof Validator.validateData === 'function') {
                    Validator.validateData(this.options.data);
                }
                if (Validator && typeof Validator.validateTargetWidth === 'function') {
                    Validator.validateTargetWidth(this.options.targetWidth);
                }
            } catch (validationErr) {
                // Emit and rethrow - keep stack for developer
                this.dispatchError(validationErr?.message || String(validationErr));
                throw validationErr;
            }

            // Build DOM
            this.element = this.createHostElement();
            this.shadow = this.element.shadowRoot;
            this.innerContainer = this.shadow && this.shadow.getElementById('inner-container');

            // Initialize content and styles (use safe calls)
            this.setHTML(this.options.html || '');
            if (this.options.css) this.setStyle(this.options.css);
            if (this.options.data) this.setContent(this.options.data);

            // Append to container
            this.options.container.appendChild(this.element);

            // Defer resize to next tick
            this.resizeTimer = setTimeout(() => {
                // ignore errors here; resize handles its own errors and dispatches them
                this.resize().catch(() => { });
            }, 0);

        } catch (error) {
            // if constructor fails, attempt to dispatch error (guarded)
            try { this.dispatchError(error?.message || String(error)); } catch (_) { }
            throw error;
        }
    }

    /**
     * Wait for all images in the card to load, optional timeout in ms.
     * @param {Object} [opts] - { timeoutMs: number }
     * @returns {Promise}
     */
    waitForImages(opts = {}) {
        const timeoutMs = (opts && Number(opts.timeoutMs)) || 0;
        return new Promise((resolve) => {
            try {
                const imgs = this.shadow ? Array.from(this.shadow.querySelectorAll('img')) : [];
                if (!imgs.length) {
                    resolve();
                    return;
                }
                let processed = 0;
                const total = imgs.length;
                const done = () => {
                    processed++;
                    if (processed >= total) resolve();
                };

                imgs.forEach(img => {
                    // already processed
                    if (img.complete) {
                        done();
                        return;
                    }
                    // add listeners once
                    const onDone = () => {
                        img.removeEventListener('load', onDone);
                        img.removeEventListener('error', onDone);
                        done();
                    };
                    img.addEventListener('load', onDone, { once: true });
                    img.addEventListener('error', onDone, { once: true });
                });

                if (timeoutMs > 0) {
                    setTimeout(() => {
                        // timeout: resolve even if not all images loaded
                        resolve();
                    }, timeoutMs);
                }
            } catch (err) {
                // on unexpected errors, resolve to avoid blocking
                resolve();
            }
        });
    }

    createHostElement() {
        const element = document.createElement('shadow-card');
        element.id = this.id;
        element.dataset.id = this.id;

        // Apply style variables based on options
        this.applyStyleVariables(element);

        const shadow = element.attachShadow({ mode: 'open' });

        // NOTE: use /* */ style comments, avoid '//' inside CSS
        shadow.innerHTML = `
        <style>
        :host {
            all: initial;
            display: block;
            border: var(--shadow-card-border, 2px solid var(--shadow-card-border-color));
            border-radius: var(--shadow-card-border-radius, 6px);
            cursor: pointer;
            overflow: hidden;
            box-sizing: border-box;
            transition: border 0.3s ease;
            user-select: none;
            position: relative;
            margin: ${this.options?.styles?.margin || '8px auto'};
            width: ${this.options?.targetWidth ? `${Number(this.options.targetWidth)}px` : 'auto'};
        }
        
        :host(:hover) {
            border-color: var(--shadow-card-hover-border-color, #3b82f6);
        }
        
        #inner-container {
            /* width: 100%; */
            width:640px;
            transform-origin: top left;
            transform: scale(1);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #loading-overlay {
            position: absolute;
            inset: 0;
            background: var(--shadow-card-loading-bg, #ffffff);
            color: var(--shadow-card-loading-color, #4b5563);
            font-size: var(--shadow-card-loading-font-size, 0.8rem);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--shadow-card-loading-gap, 8px);
            z-index: 10;
            opacity: 1;
            transition: opacity 0.3s ease;
        }
        
        .loading-spinner {
            width: var(--shadow-card-loading-icon-size, 20px);
            height: var(--shadow-card-loading-icon-size, 20px);
            border: 2px solid var(--shadow-card-loading-spinner-border, rgba(0, 0, 0, 0.1));
            border-top-color: var(--shadow-card-loading-spinner-color, #3b82f6);
            border-radius: 50%;
            animation: spin var(--shadow-card-loading-spinner-speed, 1s) linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        #loading-overlay.hidden {
            opacity: 0;
            pointer-events: none;
        }
        </style>
        <div id="loading-overlay">
            <div class="loading-spinner" aria-hidden="true"></div>
            <span class="loading-text">${this.options?.styles?.loadingText || 'Loading...'}</span>
        </div>
        <div id="inner-container" role="region" aria-label="shadow-card-content"></div>
    `;

        // bind handlers so they can be removed later
        this.boundInputHandler = (e) => this.handleInput(e);
        this.boundClickHandler = (e) => this.handleClick(e);
        this.boundPasteHandler = (e) => this.handlePaste(e);

        // events attached to shadow root so they are scoped
        shadow.addEventListener('input', this.boundInputHandler);
        shadow.addEventListener('click', this.boundClickHandler);
        shadow.addEventListener('paste', this.boundPasteHandler);

        return element;
    }

    /**
     * Improved paste handler:
     * - preventDefault early
     * - sanitize HTML
     * - try document.execCommand('insertHTML') for undo support
     * - fallback to Range.insertNode if needed
     */
    handlePaste(e) {
        if (this.isDestroyed) return;
        if (!e) return;

        // de-dupe
        if (e.__shadowCardHandled) return;
        try {
            Object.defineProperty(e, '__shadowCardHandled', { value: true, configurable: true });
        } catch (err) {
            e.__shadowCardHandled = true;
        }

        // try to prevent native paste behavior
        try {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
        } catch (_) { }

        let editableEl = e.target;
        while (editableEl && editableEl.nodeType === Node.ELEMENT_NODE && !editableEl.isContentEditable) {
            editableEl = editableEl.parentElement;
        }
        if (!editableEl || !editableEl.isContentEditable) {
            return;
        }

        // Get clipboard data (defensive)
        const clipboard = (e.clipboardData || window.clipboardData);
        if (!clipboard) {
            // nothing we can do
            return;
        }

        const rawHtml = clipboard.getData('text/html') || '';
        const plainText = clipboard.getData('text') || '';

        // choose html if present, otherwise plain text
        const htmlToSanitize = rawHtml.trim() !== '' ? rawHtml : (plainText ? this.escapeHtml(plainText).replace(/\n/g, '<br/>') : '');

        if (!htmlToSanitize) return;

        // sanitize
        const sanitized = (typeof this.sanitizeHtmlContent === 'function') ? this.sanitizeHtmlContent(htmlToSanitize) : htmlToSanitize;

        // Obtain selection in a shadow-aware way
        let selection = null;
        try {
            const rootNode = editableEl.getRootNode && editableEl.getRootNode();
            if (rootNode && typeof rootNode.getSelection === 'function') {
                selection = rootNode.getSelection();
            }
            if (!selection) selection = window.getSelection();
        } catch (_) {
            selection = window.getSelection();
        }

        // ensure focus so execCommand works with correct target
        try { editableEl.focus(); } catch (_) { }

        // Attempt to use execCommand('insertHTML') for undo integration (best effort)
        if (typeof document.execCommand === 'function') {
            try {
                // set selection range if possible
                if (selection && selection.rangeCount > 0) {
                    // If range not inside editableEl, collapse to end of editableEl
                    let range = selection.getRangeAt(0);
                    if (!editableEl.contains(range.startContainer)) {
                        range = document.createRange();
                        range.selectNodeContents(editableEl);
                        range.collapse(false);
                        try { selection.removeAllRanges(); selection.addRange(range); } catch (_) { }
                    }
                } else if (selection) {
                    try {
                        const range = document.createRange();
                        range.selectNodeContents(editableEl);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } catch (_) { }
                }

                // execCommand will insert the HTML at current selection and create undo snapshot
                const ok = document.execCommand('insertHTML', false, sanitized);
                if (ok) {
                    return;
                }
                // fallthrough to manual insertion if execCommand returned falsy
            } catch (execErr) {
                // ignore and fallback to manual insertion
            }
        }

        // Fallback: manual insertion using Range (try to preserve selection)
        try {
            let range = (selection && selection.rangeCount > 0) ? selection.getRangeAt(0).cloneRange() : null;
            if (!range || !editableEl.contains(range.startContainer)) {
                range = document.createRange();
                range.selectNodeContents(editableEl);
                range.collapse(false);
            } else {
                // remove currently selected contents so paste replaces them
                range.deleteContents();
            }

            // Create fragment from sanitized HTML
            const temp = document.createElement('div');
            temp.innerHTML = sanitized;
            const frag = document.createDocumentFragment();
            let lastNode = null;
            while (temp.firstChild) {
                lastNode = frag.appendChild(temp.firstChild);
            }

            range.insertNode(frag);

            // restore selection after inserted content
            if (lastNode) {
                try {
                    const newRange = document.createRange();
                    newRange.setStartAfter(lastNode);
                    newRange.collapse(true);
                    if (selection) {
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                } catch (_) { /* ignore */ }
            }
        } catch (err) {
            // Final fallback: append plain text node
            try {
                const fallbackText = plainText || '';
                const tn = document.createTextNode(fallbackText);
                editableEl.appendChild(tn);
            } catch (innerErr) {
                console.error('Paste fallback failed:', innerErr);
            }
        }
    }

    /**
     * Escape plain text -> safe html (used when only plain text available)
     */
    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Sanitizes HTML to allow only basic formatting tags & allowed attributes.
     * More defensive: removes style/class/on* handlers and strips unknown tags.
     */
    sanitizeHtmlContent(html = '') {
        if (!html || typeof html !== 'string') return '';

        const ALLOWED_TAGS = new Set(['b', 'i', 'strong', 'em', 'u', 's', 'sub', 'sup', 'span', 'br', 'p', 'div']);
        const ALLOWED_ATTRS = new Set(['data-field', 'data-img']); // permit only these data attrs

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const container = doc.body.firstChild;
        if (!container) return '';

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT, null, false);
        const toRemove = [];

        // collect nodes to examine (can't mutate while walking directly)
        const nodes = [];
        let node = walker.nextNode();
        while (node) {
            nodes.push(node);
            node = walker.nextNode();
        }

        nodes.forEach(n => {
            if (n.nodeType === Node.COMMENT_NODE) {
                toRemove.push(n);
                return;
            }
            if (n.nodeType === Node.ELEMENT_NODE) {
                const tag = n.tagName.toLowerCase();
                if (!ALLOWED_TAGS.has(tag)) {
                    // replace node by its children (preserve text)
                    const parent = n.parentNode;
                    while (n.firstChild) parent.insertBefore(n.firstChild, n);
                    toRemove.push(n);
                    return;
                }
                // sanitize attributes: remove any attr not explicitly allowed
                for (let i = n.attributes.length - 1; i >= 0; i--) {
                    const attr = n.attributes[i];
                    const name = attr.name.toLowerCase();
                    // remove event handlers, style, class, id, etc
                    if (!ALLOWED_ATTRS.has(name)) {
                        n.removeAttribute(attr.name);
                    } else {
                        // allowed data- attributes: ensure value simple
                        const v = String(attr.value || '');
                        // disallow javascript: urls etc in case someone put them on data attr (unlikely but defensive)
                        if (/^\s*javascript:/i.test(v)) {
                            n.removeAttribute(attr.name);
                        }
                    }
                }
            }
        });

        toRemove.forEach(r => r.parentNode && r.parentNode.removeChild(r));
        // return innerHTML of sanitized container
        return container.innerHTML;
    }

    applyStyleVariables(element) {
        if (!element || !(element instanceof HTMLElement)) return;
        try {
            const styleMappings = this.getStyleMappings();
            if (this.options?.styles && typeof this.options.styles === 'object') {
                Object.entries(styleMappings).forEach(([optionKey, cssVar]) => {
                    if (this.options.styles[optionKey] !== undefined) {
                        try {
                            element.style.setProperty(cssVar, this.options.styles[optionKey]);
                        } catch (_) { }
                    }
                });
            }
        } catch (err) {
            console.error('applyStyleVariables error', err);
        }
    }

    getStyleMappings() {
        return {
            border: '--shadow-card-border',
            borderColor: '--shadow-card-border-color',
            borderRadius: '--shadow-card-border-radius',
            hoverBorderColor: '--shadow-card-hover-border-color',
            loadingBg: '--shadow-card-loading-bg',
            loadingColor: '--shadow-card-loading-color',
            loadingFontSize: '--shadow-card-loading-font-size',
            loadingGap: '--shadow-card-loading-gap',
            loadingIconSize: '--shadow-card-loading-icon-size',
            loadingSpinnerBorder: '--shadow-card-loading-spinner-border',
            loadingSpinnerColor: '--shadow-card-loading-spinner-color',
            loadingSpinnerSpeed: '--shadow-card-loading-spinner-speed',
            loadingText: '--shadow-card-loading-text'
        };
    }

    setCssVariables(variables) {
        try {
            if (this.isDestroyed) return this;
            if (!variables || typeof variables !== 'object') throw new Error('Style variables must be an object');
            const styleMappings = this.getStyleMappings();
            Object.entries(variables).forEach(([optionKey, value]) => {
                const cssVar = styleMappings[optionKey];
                if (cssVar && value !== undefined) {
                    try { this.element.style.setProperty(cssVar, value); } catch (_) { }
                }
            });
            if (variables.loadingText && this.shadow) {
                const loadingTextEl = this.shadow.querySelector('.loading-text');
                if (loadingTextEl) loadingTextEl.textContent = variables.loadingText;
            }
            return this;
        } catch (err) {
            this.dispatchError(err?.message || String(err));
            return this;
        }
    }

    handleInput(e) {
        if (this.isDestroyed) return;
        try {
            const target = e.target;
            if (!target) return;
            if (target.isContentEditable && target.hasAttribute('data-field')) {
                const field = target.getAttribute('data-field');
                const value = target.innerText;
                this.data = this.data || {};
                this.data[field] = value;
                this.dispatchEvent(EVENT_TYPES.CONTENT_CHANGE, { field, value });
            }
        } catch (err) {
            this.dispatchError(err?.message || String(err));
        }
    }

    handleClick(e) {
        if (this.isDestroyed) return;
        try {
            const target = e.target;
            if (!target) return;
            if (target.tagName === 'IMG' && target.hasAttribute('data-img')) {
                this.dispatchEvent(EVENT_TYPES.IMG_CLICK, {
                    imgKey: target.getAttribute('data-img'),
                    element: target
                });
            }
        } catch (err) {
            this.dispatchError(err?.message || String(err));
        }
    }

    dispatchEvent(type, detail = {}) {
        if (this.isDestroyed || !this.element) return;
        try {
            const evt = new CustomEvent(type, {
                detail: { ...detail, cardId: this.id },
                bubbles: true,
                cancelable: true
            });
            this.element.dispatchEvent(evt);
            // also call any listeners added via on()
            const handlers = this.eventListeners.get(type);
            if (handlers && handlers.size) {
                handlers.forEach(h => {
                    try { h(evt); } catch (_) { }
                });
            }
        } catch (err) {
            // swallow errors from event dispatch but log
            console.error('dispatchEvent error', err);
        }
    }

    dispatchError(message) {
        try {
            this.dispatchEvent(EVENT_TYPES.ERROR, { message });
        } catch (_) { }
    }

    async setHTML(html = '') {
        try {
            if (this.isDestroyed) return this;
            if (Validator && typeof Validator.validateHtml === 'function') Validator.validateHtml(html);
            if (this.innerContainer) {
                this.innerContainer.innerHTML = html || '';
                // force reflow
                void this.innerContainer.offsetHeight;
                await this.resize();
            }
            return this;
        } catch (err) {
            this.dispatchError(err?.message || String(err));
            return this;
        }
    }

    setStyle(css = '', reset = false) {
        try {
            if (this.isDestroyed) return this;
            if (Validator && typeof Validator.validateCss === 'function') Validator.validateCss(css);
            if (!this.shadow) return this;
            let styleEl = this.shadow.querySelector('#custom-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'custom-style';
                // insert before inner container
                const ref = this.shadow.getElementById('inner-container');
                this.shadow.insertBefore(styleEl, ref);
            }
            styleEl.textContent = reset ? (css || '') : `${styleEl.textContent || ''}\n${css || ''}`;
            return this;
        } catch (err) {
            this.dispatchError(err?.message || String(err));
            return this;
        }
    }

    setContent(data = {}) {
        try {
            if (this.isDestroyed) return this;
            if (Validator && typeof Validator.validateData === 'function') Validator.validateData(data);
            this.data = { ...(this.data || {}), ...(data || {}) };
            if (!this.shadow) return this;
            Object.entries(data || {}).forEach(([field, value]) => {
                const el = this.shadow.querySelector(`[data-field="${field}"]`);
                if (el && el.isContentEditable) {
                    el.innerText = value == null ? '' : String(value);
                }
            });
            return this;
        } catch (err) {
            this.dispatchError(err?.message || String(err));
            return this;
        }
    }

    async resize(targetWidth) {
        try {
            if (this.isDestroyed) return this;
            if (Validator && typeof Validator.validateNotDestroyed === 'function') Validator.validateNotDestroyed(this);

            const loadingOverlay = this.shadow && this.shadow.querySelector('#loading-overlay');
            if (loadingOverlay) loadingOverlay.classList.remove('hidden');

            if (targetWidth !== undefined && Validator && typeof Validator.validateTargetWidth === 'function') {
                Validator.validateTargetWidth(targetWidth);
                this.options.targetWidth = Number(targetWidth);
            }
            const targetW = Number(this.options.targetWidth) || 160;

            if (!this.element || !this.innerContainer) {
                if (loadingOverlay) loadingOverlay.classList.add('hidden');
                return this;
            }

            // set host width to target width for measurement
            this.element.style.width = `${targetW}px`;
            this.element.style.height = 'auto';

            // wait for images with a sensible timeout
            await this.waitForImages({ timeoutMs: 5000 });

            // measure original size (temporarily reset transform)
            const prevTransform = this.innerContainer.style.transform || '';
            this.innerContainer.style.transform = 'scale(1)';
            this.innerContainer.style.transformOrigin = 'top left';
            // trigger reflow & measure
            void this.innerContainer.offsetHeight;
            const rect = this.innerContainer.getBoundingClientRect();
            const originalContentWidth = Math.max(1, rect.width || 1);
            const originalContentHeight = Math.max(1, rect.height || 1);

            const scale = Math.min(1, targetW / originalContentWidth);

            // set width for inner container (reverse-engineered) before scaling to preserve layout
            const innerWidth = Math.round(targetW / Math.max(scale, 0.0001));
            this.innerContainer.style.width = `${innerWidth}px`;
            this.innerContainer.style.overflow = 'hidden';

            // apply scale
            this.innerContainer.style.transform = `scale(${scale})`;
            this.innerContainer.style.transformOrigin = 'top left';

            const scaledHeight = Math.max(1, Math.round(originalContentHeight * scale));
            this.element.style.height = `${scaledHeight}px`;

            // hide loading after paint
            requestAnimationFrame(() => {
                loadingOverlay?.classList.add('hidden');
            });

            return this;
        } catch (err) {
            try { this.shadow?.querySelector('#loading-overlay')?.classList.add('hidden'); } catch (_) { }
            this.dispatchError(err?.message || String(err));
            return this;
        }
    }

    on(type, handler) {
        if (this.isDestroyed) return this;
        if (typeof handler !== 'function') {
            this.dispatchError('Event handler must be a function');
            return this;
        }
        if (!this.eventListeners.has(type)) this.eventListeners.set(type, new Set());
        const set = this.eventListeners.get(type);
        set.add(handler);
        // add DOM listener so event can be captured normally
        try { this.element.addEventListener(type, handler); } catch (_) { }
        return this;
    }

    off(type, handler) {
        if (this.isDestroyed) return this;
        const handlers = this.eventListeners.get(type);
        if (!handlers) return this;
        if (handler) {
            handlers.delete(handler);
            try { this.element.removeEventListener(type, handler); } catch (_) { }
        } else {
            handlers.forEach(h => {
                try { this.element.removeEventListener(type, h); } catch (_) { }
            });
            handlers.clear();
        }
        // if empty, remove the key
        if (handlers.size === 0) this.eventListeners.delete(type);
        return this;
    }

    destroy() {
        if (this.isDestroyed) return;
        clearTimeout(this.resizeTimer);

        // remove custom event listeners
        this.eventListeners.forEach((handlers, type) => {
            handlers.forEach(handler => {
                try { this.element.removeEventListener(type, handler); } catch (_) { }
            });
        });
        this.eventListeners.clear();

        // remove shadow-scoped listeners
        try {
            this.shadow?.removeEventListener('input', this.boundInputHandler);
            this.shadow?.removeEventListener('click', this.boundClickHandler);
            this.shadow?.removeEventListener('paste', this.boundPasteHandler);
        } catch (_) { }

        // remove DOM element
        try { this.element?.parentNode?.removeChild(this.element); } catch (_) { }

        // nullify references
        this.isDestroyed = true;
        this.element = null;
        this.shadow = null;
        this.innerContainer = null;
        this.data = null;
        this.options = null;
        this.boundInputHandler = null;
        this.boundClickHandler = null;
        this.boundPasteHandler = null;
    }

    static batchCreate(cards) {
        if (!Array.isArray(cards)) throw new Error('batchCreate requires an array of card configurations');
        return cards.map(options => new ShadowCard(options));
    }
}

export default ShadowCard;
