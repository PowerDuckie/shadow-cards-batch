import { generateUniqueId, Validator, sanitizeHtml } from './utils.js';
import { DEFAULT_OPTIONS, EVENT_TYPES, ALLOWED_TAGS_MARKDOWN, ALLOWED_ATTRS_MARKDOWN } from './constants.js';

/**
 * ShadowCard - Production-ready, non-editable card component
 * Features:
 * - Shadow DOM encapsulation
 * - Dynamic resizing with debounce
 * - Image load detection with timeout
 * - Event delegation (card, field, image clicks)
 * - Custom CSS variables
 * - Safe destruction
 */
export class ShadowCard {
    constructor(options = {}) {
        try {
            // Merge default options and validate
            this.options = { ...DEFAULT_OPTIONS, ...options };
            Validator.validateContainer(this.options.container);
            Validator.validateHtml(this.options.html);
            Validator.validateCss(this.options.css);
            Validator.validateData(this.options.data);
            Validator.validateTargetWidth(this.options.targetWidth);

            this.id = generateUniqueId();
            this.isDestroyed = false;
            this.data = this.options.data;
            this.eventListeners = new Map();
            this._isResizing = false;
            this._pendingResize = false;
            this._resizeDebounce = null;
            this._hideOverlayRaf = null;

            // Create host element and shadow DOM
            this.element = this._createHostElement();
            this.shadow = this.element.shadowRoot;
            this.innerContainer = this.shadow.getElementById('inner-container');

            // Set initial content, styles, and data
            this.setHTML(this.options.html);
            this.setStyle(this.options.css);
            this.setContent(this.options.data);

            this.options.container.appendChild(this.element);

            // Schedule initial resize
            this._scheduleResize();
        } catch (error) {
            this.dispatchError(error.message || String(error));
            throw error;
        }
    }

    // ---------- Image loader ----------
    /**
     * Wait until all images inside the card are loaded or timeout
     * @param {Object} options
     * @param {number} options.timeoutMs - Max wait in ms
     */
    waitForImages({ timeoutMs = 5000 } = {}) {
        return new Promise(resolve => {
            try {
                if (this.isDestroyed || !this.shadow) {
                    return resolve({ success: false, error: 'destroyed', errorCount: 0, total: 0 });
                }

                const images = Array.from(this.shadow.querySelectorAll('img'));
                if (!images.length) {
                    return resolve({ success: true, errorCount: 0, total: 0 });
                }

                let loadedCount = 0;
                let errorCount = 0;
                let resolved = false;
                const errors = [];
                let timer = null;

                const finish = (result) => {
                    if (resolved) return;
                    resolved = true;
                    if (timer) clearTimeout(timer);
                    // cleanup listeners
                    images.forEach(img => {
                        try {
                            img.removeEventListener('load', onLoad);
                            img.removeEventListener('error', onError);
                        } catch (e) { /* ignore */ }
                    });
                    resolve(result);
                };

                const checkDone = () => {
                    loadedCount++;
                    if (loadedCount >= images.length && !resolved) {
                        const success = errorCount === 0;
                        finish({ success, errorCount, total: images.length, errors: errors.length ? errors.slice() : undefined });
                    }
                };

                const onLoad = ev => {
                    const img = ev.currentTarget;
                    try {
                        img.removeEventListener('load', onLoad);
                        img.removeEventListener('error', onError);
                    } catch (e) { }
                    checkDone();
                };

                const onError = ev => {
                    const img = ev.currentTarget;
                    try {
                        img.removeEventListener('load', onLoad);
                        img.removeEventListener('error', onError);
                    } catch (e) { }
                    // avoid double-counting
                    if (img.dataset._scLoadError) return checkDone();
                    img.dataset._scLoadError = 'true';
                    errorCount++;
                    try { errors.push(img.currentSrc || img.src || '<unknown>'); } catch (e) { }
                    // visual feedback via class (prefer CSS class over inline styles)
                    try { img.classList.add('shadowcard-img-error'); } catch (e) { }
                    // notify once per failed image (string message to match existing dispatchError)
                    try { this.dispatchError(`Image failed to load: ${img.currentSrc || img.src || '<unknown>'}`); } catch (e) { }
                    checkDone();
                };

                // Attach listeners or handle already-complete images.
                images.forEach(img => {
                    try {
                        if (img.complete) {
                            // ensure handlers run after timer/listeners are set up
                            queueMicrotask(() => {
                                if (img.naturalWidth) onLoad({ currentTarget: img });
                                else onError({ currentTarget: img });
                            });
                        } else {
                            img.addEventListener('load', onLoad, { once: true });
                            img.addEventListener('error', onError, { once: true });
                        }
                    } catch (e) {
                        // treat access errors as image failures
                        if (!img.dataset?._scLoadError) {
                            img.dataset._scLoadError = 'true';
                            errorCount++;
                            try { errors.push('<access-error>'); } catch (e) { }
                        }
                        // still count as "processed"
                        checkDone();
                    }
                });

                // Start timeout after listeners are attached to avoid race.
                timer = setTimeout(() => {
                    if (!resolved) {
                        // mark unresolved images as errored (best-effort)
                        images.forEach(img => {
                            if (!img.dataset?._scLoadError && !(img.complete && img.naturalWidth)) {
                                try {
                                    img.dataset._scLoadError = 'true';
                                    img.classList.add('shadowcard-img-error');
                                } catch (e) { }
                            }
                        });
                        try { this.dispatchError(`Image load timeout after ${Number(timeoutMs) || 5000}ms`); } catch (e) { }
                        finish({ success: false, timeout: true, errorCount, total: images.length, errors: errors.length ? errors.slice() : undefined });
                    }
                }, Number(timeoutMs) || 5000);

            } catch (err) {
                resolve({ success: false, error: err?.message || String(err), errorCount: 0, total: 0 });
            }
        });
    }


    // ---------- Host element creation ----------
    _createHostElement() {
        const element = document.createElement('shadow-card');
        element.id = this.id;
        element.dataset.id = this.id;

        this._applyStyleVariables(element);

        const shadow = element.attachShadow({ mode: 'open' });
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
                margin: ${this.options?.styles?.marginHeight || '8px'} ${this.options?.styles?.marginWidth || 'auto'};
            }
            :host(:hover) {
                border-color: var(--shadow-card-hover-border-color, #3b82f6);
            }
            #inner-container {
                width: 640px;
                transform-origin: top left;
                transform: scale(1);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: ${!this.options?.editable ? 'auto' : 'none'};
            }
            #inner-container [data-editable="open"] {
                pointer-events: ${!this.options?.editable ? 'none' : 'auto'};
            }
            #inner-container [data-img] {
                pointer-events: ${!this.options?.editable ? 'none' : 'auto'};
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
                pointer-events: none;
            }
            .loading-spinner {
                width: var(--shadow-card-loading-icon-size, 20px);
                height: var(--shadow-card-loading-icon-size, 20px);
                border: 2px solid var(--shadow-card-loading-spinner-border, rgba(0,0,0,0.1));
                border-top-color: var(--shadow-card-loading-spinner-color, #3b82f6);
                border-radius: 50%;
                animation: spin var(--shadow-card-loading-spinner-speed, 1s) linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            #loading-overlay.hidden { opacity: 0; }
        </style>
        <div id="loading-overlay">
            <div class="loading-spinner"></div>
            <span class="loading-text">${this.options?.styles?.loadingText || ''}</span>
        </div>
        <div id="inner-container"></div>
        `;

        // Event delegation
        this.boundClickHandler = e => this._handleClickDelegated(e);
        shadow.addEventListener('click', this.boundClickHandler);

        return element;
    }

    // ---------- CSS variables ----------
    _applyStyleVariables(element) {
        if (!element || !this.options.styles) return;
        Object.entries(this._getStyleMappings()).forEach(([key, cssVar]) => {
            const val = this.options.styles[key];
            if (val !== undefined) {
                try {
                    if (val == null) {
                        element.style.removeProperty(cssVar);
                    } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                        element.style.setProperty(cssVar, String(val));
                    }
                    // ignore complex objects
                } catch (e) { /* swallow */ }
            }
        });
    }

    _getStyleMappings() {
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

    setCssVariables(vars) {
        if (this.isDestroyed || !vars) return this;
        Object.entries(vars).forEach(([key, val]) => {
            const cssVar = this._getStyleMappings()[key];
            if (cssVar && val !== undefined) {
                try {
                    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                        this.element.style.setProperty(cssVar, String(val));
                    } else if (val == null) {
                        this.element.style.removeProperty(cssVar);
                    } else {
                        // ignore complex objects
                    }
                } catch (e) {
                    // ignore invalid CSS values
                }
            }
        });
        if (vars.loadingText) {
            const el = this.shadow.querySelector('.loading-text');
            if (el) el.textContent = vars.loadingText;
        }
        return this;
    }


    // ---------- Content / HTML / CSS ----------
    setHTML(html) {
        try {
            Validator.validateNotDestroyed(this);
            Validator.validateHtml(html);
            if (!this.innerContainer) throw new Error('Inner container not found');

            // ---------- sanitize user HTML ----------
            const safeHtml = sanitizeHtml(html, ALLOWED_TAGS_MARKDOWN, ALLOWED_ATTRS_MARKDOWN);

            this.innerContainer.innerHTML = safeHtml || '';
            this.innerContainer.offsetHeight; // Force reflow
            this._scheduleResize();
            return this;
        } catch (err) { this.dispatchError(err.message || String(err)); return this; }
    }


    setStyle(css, reset = false) {
        if (this.isDestroyed) return this;
        try {
            // prefer constructable stylesheet if supported
            if (typeof CSSStyleSheet !== 'undefined' && this.shadow?.adoptedStyleSheets !== undefined) {
                if (!this._adoptedSheet || reset) {
                    this._adoptedSheet = new CSSStyleSheet();
                    this._adoptedSheet.replaceSync(css || '');
                } else {
                    // append new rules (simple concat)
                    const combined = reset ? (css || '') : `${this._adoptedSheet.cssText}\n${css || ''}`;
                    this._adoptedSheet.replaceSync(combined);
                }
                // assign once
                this.shadow.adoptedStyleSheets = [this._adoptedSheet];
                return this;
            }
        } catch (e) {
            // fallthrough to style element fallback
        }

        // fallback: style element
        let styleEl = this.shadow.querySelector('#custom-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-style';
            this.shadow.insertBefore(styleEl, this.innerContainer);
            this._styleEl = styleEl;
        }
        styleEl.textContent = reset ? (css || '') : `${styleEl.textContent || ''}\n${css || ''}`;
        return this;
    }


    setContent(data) {
        if (this.isDestroyed || !data) return this;
        this.data = { ...this.data, ...data };
        Object.entries(data).forEach(([field, val]) => {
            const el = this.shadow.querySelector(`[data-field="${field}"]`);
            if (el) el.textContent = val == null ? '' : String(val);
        });
        this._scheduleResize();
        return this;
    }

    resize(targetWidth) {
        this._scheduleResize(targetWidth);
        return this;
    }

    // ---------- Resize ----------
    async _doResize(targetWidth) {
        if (this.isDestroyed) return;

        // --- Merge pending resize if currently resizing ---
        if (this._isResizing) {
            const explicitTarget = (targetWidth !== undefined && Number.isFinite(Number(targetWidth)))
                ? Number(targetWidth)
                : undefined;

            if (explicitTarget !== undefined) {
                this._pendingTargetWidth = explicitTarget;
            }
            this._pendingResize = true;
            return;
        }

        // --- Validate target width ---
        const requestedWidth = Number(targetWidth ?? this.options.targetWidth);
        if (!Number.isFinite(requestedWidth) || requestedWidth < 160) return;
        const targetW = Math.min(1200, requestedWidth);

        this._isResizing = true;
        this._pendingResize = false;
        this._pendingTargetWidth = null;

        const overlay = this.shadow?.querySelector('#loading-overlay');

        try {
            // --- Step 1: Show overlay and set target width immediately ---
            this.element.style.width = `${targetW}px`;
            overlay?.classList.remove('hidden');

            // --- Step 2: Wait for images to load before measuring ---
            const imgResult = await Promise.race([
                this.waitForImages({ timeoutMs: 5000 }),
                new Promise(resolve => setTimeout(
                    () => resolve({ success: false, timeout: true, errorCount: 0 }),
                    5000
                ))
            ]);

            if (!imgResult.success) {
                const errorMsg = imgResult.timeout
                    ? `Image load timed out after 5s`
                    : `Images failed to load (${imgResult.errorCount || 0} errors)`;
                this.dispatchError(errorMsg);
            }

            // --- Step 3: Measure original content dimensions ---
            if (!this._originalWidth || !this._originalHeight) {
                try {
                    this.innerContainer.style.transform = 'scale(1)';
                    const rect = this.innerContainer.getBoundingClientRect();
                    this._originalWidth = Math.max(1, rect.width || this.innerContainer.offsetWidth || 1);
                    this._originalHeight = Math.max(1, rect.height || this.innerContainer.offsetHeight || 1);
                } catch (err) {
                    this.dispatchError(`Failed to measure container: ${err.message}`);
                    this._originalWidth = targetW;
                    this._originalHeight = 100;
                }
            }

            // --- Step 4: Calculate scale ---
            const rawScale = targetW / this._originalWidth;
            const clampedScale = Math.min(1, Math.max(0.2, rawScale));
            const finalScale = Number.isFinite(clampedScale) && clampedScale > 0 ? clampedScale : 1;

            // --- Step 5: Set final container height immediately ---
            const scaledH = Math.round(this._originalHeight * finalScale) + 0.5;
            this.element.style.height = `${scaledH}px`;

            // --- Step 6: Apply inner content scaling ---
            requestAnimationFrame(() => {
                this.innerContainer.style.transform = `scale(${finalScale})`;
                this.innerContainer.style.transformOrigin = 'top left';
                const adjustedWidth = Math.round(targetW / finalScale) + 0.5;
                this.innerContainer.style.width = `${adjustedWidth}px`;
                this.innerContainer.style.overflow = 'hidden';
            });

            // --- Step 7: Hide overlay after render ---
            if (this._hideOverlayRaf) cancelAnimationFrame(this._hideOverlayRaf);
            this._hideOverlayRaf = requestAnimationFrame(() => {
                overlay?.classList.add('hidden');
                this._hideOverlayRaf = null;
            });

        } catch (err) {
            overlay?.classList.add('hidden');
            this.dispatchError(`Resize failed: ${err.message || String(err)}`);
        } finally {
            this._isResizing = false;

            // --- Step 8: Handle pending resize ---
            if (this._pendingResize) {
                const pendingTarget = this._pendingTargetWidth;
                this._pendingResize = false;
                this._pendingTargetWidth = null;
                setTimeout(() => {
                    try { this._doResize(pendingTarget); } catch (e) {
                        this.dispatchError(`Failed to process pending resize: ${e.message}`);
                    }
                }, 0);
            }
        }
    }

    _scheduleResize(targetWidth) {
        if (this._resizeDebounce) clearTimeout(this._resizeDebounce);
        this._resizeDebounce = setTimeout(() => {
            this._doResize(targetWidth);
            this._resizeDebounce = null;
        }, 50);
    }

    // ---------- Event delegation ----------
    // Delegated click handler inside the shadow root.
    // Uses composedPath when available, falls back to manual path traversal.
    // Passes a stopPropagation helper in the event detail so consumers can stop outer handling.
    _handleClickDelegated(event) {
        if (this.isDestroyed || !this.shadow) return;

        // helper exposed to consumers so they can stop propagation if they want
        const stopPropagation = () => {
            try { event.stopPropagation(); } catch (e) { /* ignore */ }
        };

        // Build path: prefer composedPath() (works across Shadow DOM)
        let path = [];
        if (typeof event.composedPath === 'function') {
            path = event.composedPath();
        } else {
            // fallback: walk up DOM until shadow host
            let el = event.target;
            while (el) {
                path.push(el);
                if (el === this.shadow.host) break;
                el = el.assignedSlot || el.parentNode;
            }
        }

        // pick first relevant node from path as the initial target
        let target = (path && path.length) ? path[0] : event.target;

        // final fallback to elementFromPoint if target missing
        if (!target) {
            try {
                target = this.shadow.elementFromPoint(event.clientX, event.clientY) || null;
            } catch {
                target = event.target;
            }
        }

        let found = false;
        while (target && target !== this.shadow) {
            // guard target methods existence (could be text node)
            const hasAttr = typeof target.hasAttribute === 'function';
            const tagName = target && target.tagName ? target.tagName.toUpperCase() : '';

            if (tagName === 'IMG' && hasAttr && target.hasAttribute('data-img')) {
                this.dispatchEvent(EVENT_TYPES.IMG_CLICK, {
                    imgKey: target.getAttribute('data-img'),
                    element: target,
                    stopPropagation
                });
                found = true;
                break;
            } else if (hasAttr && target.hasAttribute('data-field')) {
                this.dispatchEvent(EVENT_TYPES.FIELD_CLICK, {
                    fieldKey: target.getAttribute('data-field'),
                    element: target,
                    stopPropagation
                });
                found = true;
                break;
            }
            target = target.assignedSlot || target.parentNode;
        }

        if (!found) {
            this.dispatchEvent(EVENT_TYPES.CARD_CLICK, {
                element: this.element,
                stopPropagation
            });
        }
    }




    dispatchEvent(type, detail) {
        if (this.isDestroyed || !this.element) return;
        this.element.dispatchEvent(new CustomEvent(type, {
            detail: { ...detail, cardId: this.id },
            bubbles: true,
            cancelable: true
        }));
    }

    dispatchError(err) {
        const payload = typeof err === 'string' ? { message: err } : { message: err.message, stack: err.stack };
        this.dispatchEvent(EVENT_TYPES.ERROR, payload);
    }

    // ---------- Event binding ----------
    on(type, handler) {
        if (this.isDestroyed || typeof handler !== 'function') return this;
        if (!this.eventListeners.has(type)) this.eventListeners.set(type, new Set());
        const handlers = this.eventListeners.get(type);
        if (!handlers.has(handler)) {
            handlers.add(handler);
            this.element.addEventListener(type, handler);
        }
        return this;
    }

    off(type, handler) {
        if (this.isDestroyed) return this;
        const handlers = this.eventListeners.get(type);
        if (!handlers) return this;

        if (handler) {
            handlers.delete(handler);
            this.element.removeEventListener(type, handler);
        } else {
            handlers.forEach(h => this.element.removeEventListener(type, h));
            handlers.clear();
        }
        return this;
    }

    // ---------- Destroy ----------
    destroy() {
        if (this.isDestroyed) return;

        clearTimeout(this._resizeDebounce);
        if (this._hideOverlayRaf) cancelAnimationFrame(this._hideOverlayRaf);
        if (this.resizeObserver) this.resizeObserver.disconnect();

        // remove shadow listeners
        this.shadow?.removeEventListener('click', this.boundClickHandler);

        // remove bound custom event listeners
        this.eventListeners.forEach((handlers, type) =>
            handlers.forEach(h => this.element.removeEventListener(type, h))
        );
        this.eventListeners.clear();

        // replace node in DOM to break references in document
        try {
            if (this.element && this.element.parentNode) {
                this.element.replaceWith(document.createComment('ShadowCard destroyed'));
            } else if (this.element) {
                // element not attached; still remove
                this.element.remove();
            }
        } catch (e) {
            // fallback: remove
            try { this.element?.remove(); } catch { }
        }

        // clear internal references for GC
        this.element = this.shadow = this.innerContainer = this.data = this.options = null;
        this.boundClickHandler = null;
        this.isDestroyed = true;
    }

    // ---------- Batch creation ----------
    static batchCreate(cards) {
        if (!Array.isArray(cards)) throw new Error('batchCreate requires an array');
        return cards.map(opts => new ShadowCard(opts));
    }
}

export default ShadowCard;
