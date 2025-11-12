import { generateUniqueId, Validator } from './utils.js';
import { DEFAULT_OPTIONS, EVENT_TYPES } from './constants.js';

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
                const images = Array.from(this.shadow.querySelectorAll('img'));
                if (!images.length) return resolve();

                let loadedCount = 0;
                let resolved = false;

                const checkDone = () => {
                    loadedCount++;
                    if (loadedCount >= images.length && !resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        resolve();
                    }
                };

                const onLoadOrError = ev => {
                    ev.currentTarget.removeEventListener('load', onLoadOrError);
                    ev.currentTarget.removeEventListener('error', onLoadOrError);
                    checkDone();
                };

                images.forEach(img => {
                    if (img.complete && img.naturalWidth) checkDone();
                    else {
                        img.addEventListener('load', onLoadOrError, { once: true });
                        img.addEventListener('error', onLoadOrError, { once: true });
                    }
                });

                const timer = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        images.forEach(img => {
                            img.removeEventListener('load', onLoadOrError);
                            img.removeEventListener('error', onLoadOrError);
                        });
                        resolve();
                    }
                }, Number(timeoutMs) || 5000);
            } catch {
                resolve();
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
            <span class="loading-text">${this.options?.styles?.loadingText || 'Loading...'}</span>
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
                try { element.style.setProperty(cssVar, val); } catch { }
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
            if (cssVar && val !== undefined) this.element.style.setProperty(cssVar, val);
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

            this.innerContainer.innerHTML = html || '';
            this.innerContainer.offsetHeight; // Force reflow
            this._scheduleResize();
            return this;
        } catch (err) { this.dispatchError(err.message || String(err)); return this; }
    }

    setStyle(css, reset = false) {
        if (this.isDestroyed) return this;
        let styleEl = this.shadow.querySelector('#custom-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-style';
            this.shadow.insertBefore(styleEl, this.innerContainer);
        }
        styleEl.textContent = reset ? css : `${styleEl.textContent}\n${css}`;
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
        const overlay = this.shadow?.querySelector('#loading-overlay');
        overlay?.classList.remove('hidden');

        try {
            const targetW = Number(targetWidth ?? this.options.targetWidth) || 160;
            this.element.style.width = `${targetW}px`;
            this.element.style.height = 'auto';

            await Promise.race([
                this.waitForImages(),
                new Promise(res => setTimeout(res, 5000))
            ]);

            this.innerContainer.style.transform = 'scale(1)';
            const rect = this.innerContainer.getBoundingClientRect();
            const origW = Math.max(1, rect.width || this.innerContainer.offsetWidth || 1);
            const origH = Math.max(1, rect.height || this.innerContainer.offsetHeight || 1);

            const scale = Math.min(1, targetW / origW);
            const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

            this.innerContainer.style.transform = `scale(${safeScale})`;
            this.innerContainer.style.transformOrigin = 'top left';

            const scaledH = Math.max(1, Math.round(origH * safeScale));
            this.element.style.height = `${scaledH}px`;
            this.innerContainer.style.width = `${Math.round(targetW / safeScale)}px`;
            this.innerContainer.style.overflow = 'hidden';

            if (this._hideOverlayRaf) cancelAnimationFrame(this._hideOverlayRaf);
            this._hideOverlayRaf = requestAnimationFrame(() => {
                overlay?.classList.add('hidden');
                this._hideOverlayRaf = null;
            });
        } catch (err) {
            overlay?.classList.add('hidden');
            this.dispatchError(err?.message || String(err));
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
    _handleClickDelegated(event) {
        if (this.isDestroyed || !this.shadow) return;

        let target = this.shadow.elementFromPoint(event.clientX, event.clientY);
        let dispatched = false;

        while (target && target !== this.shadow && !dispatched) {
            if (target.tagName === 'IMG' && target.hasAttribute('data-img')) {
                this.dispatchEvent(EVENT_TYPES.IMG_CLICK, {
                    imgKey: target.getAttribute('data-img'),
                    element: target
                });
                dispatched = true;
            } else if (target.hasAttribute('data-field')) {
                this.dispatchEvent(EVENT_TYPES.FIELD_CLICK, {
                    fieldKey: target.getAttribute('data-field'),
                    element: target
                });
                dispatched = true;
            } else {
                this.dispatchEvent(EVENT_TYPES.CARD_CLICK, { element: target });
                dispatched = true;
            }
            target = target.parentNode;
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

    dispatchError(message) { this.dispatchEvent(EVENT_TYPES.ERROR, { message }); }

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

        this.shadow?.removeEventListener('click', this.boundClickHandler);
        this.eventListeners.forEach((handlers, type) => handlers.forEach(h => this.element.removeEventListener(type, h)));
        this.eventListeners.clear();

        this.element?.remove();
        this.isDestroyed = true;

        // Clear references
        this.element = this.shadow = this.innerContainer = this.data = this.options = null;
    }

    // ---------- Batch creation ----------
    static batchCreate(cards) {
        if (!Array.isArray(cards)) throw new Error('batchCreate requires an array');
        return cards.map(opts => new ShadowCard(opts));
    }
}

export default ShadowCard;
