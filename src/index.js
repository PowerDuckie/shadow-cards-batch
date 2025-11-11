import { generateUniqueId, Validator } from './utils.js';
import { DEFAULT_OPTIONS, EVENT_TYPES } from './constants.js';

/**
 * ShadowCard - Creates isolated card instances using Shadow DOM
 * Supports batch creation, dynamic updates to HTML, CSS, and content
 */
export class ShadowCard {
    constructor(options = {}) {
        try {
            this.options = { ...DEFAULT_OPTIONS, ...options };

            Validator.validateContainer(this.options.container);
            Validator.validateHtml(this.options.html);
            Validator.validateCss(this.options.css);
            Validator.validateData(this.options.data);
            Validator.validateTargetWidth(this.options.targetWidth);

            this.id = generateUniqueId();
            this.isDestroyed = false;
            this.data = { ...this.options.data };
            this.eventListeners = new Map();
            this.resizeTimer = null;

            // Create DOM and Shadow DOM
            this.element = this.createHostElement();
            this.shadow = this.element.shadowRoot;
            this.innerContainer = this.shadow.getElementById('inner-container');

            // Set initial content and styles
            this.setHTML(this.options.html);
            this.setStyle(this.options.css);
            this.setContent(this.options.data);

            this.options.container.appendChild(this.element);

            // Initial resize after DOM render
            this.resizeTimer = setTimeout(() => this.resize(), 0);
        } catch (error) {
            this.dispatchError(error.message);
            throw error;
        }
    }

    /**
     * Wait for all images to load in the card
     * @returns {Promise<void>}
     */
    waitForImages() {
        return new Promise((resolve) => {
            const images = Array.from(this.shadow?.querySelectorAll('img') || []);
            if (!images.length) return resolve();

            let loadedCount = 0;
            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === images.length) resolve();
            };

            images.forEach(img => {
                if (img.complete) return checkComplete();
                img.addEventListener('load', checkComplete, { once: true });
                img.addEventListener('error', () => {
                    console.warn('Image failed to load:', img.src);
                    checkComplete();
                }, { once: true });
            });
        });
    }

    /**
     * Create host element with Shadow DOM
     */
    createHostElement() {
        const element = document.createElement('shadow-card');
        element.id = this.id;
        element.dataset.id = this.id;

        this.applyStyleVariables(element);

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
            margin: ${this.options?.styles?.marginHeight || "8px"} ${this.options?.styles?.marginWidth || "auto"};
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
        this.boundInputHandler = (e) => this.handleInput(e);
        this.boundClickHandler = (e) => this.handleClickDelegated(e);
        shadow.addEventListener('input', this.boundInputHandler);
        shadow.addEventListener('click', this.boundClickHandler);

        return element;
    }

    /**
     * Apply CSS variables from options
     */
    applyStyleVariables(element) {
        if (!element) return;
        const styleMappings = this.getStyleMappings();
        if (!this.options.styles) return;

        Object.entries(styleMappings).forEach(([key, cssVar]) => {
            if (this.options.styles[key] !== undefined) {
                try { element.style.setProperty(cssVar, this.options.styles[key]); }
                catch (err) { console.error(`Failed to set ${cssVar}:`, err); }
            }
        });
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

    /**
     * Dynamically update CSS variables
     */
    setCssVariables(vars) {
        try {
            Validator.validateNotDestroyed(this);
            if (!vars || typeof vars !== 'object') throw new Error('Style variables must be an object');
            const styleMappings = this.getStyleMappings();
            Object.entries(vars).forEach(([key, val]) => {
                const cssVar = styleMappings[key];
                if (cssVar && val !== undefined) this.element.style.setProperty(cssVar, val);
            });
            if (vars.loadingText) {
                const el = this.shadow.querySelector('.loading-text');
                if (el) el.textContent = vars.loadingText;
            }
            return this;
        } catch (err) { this.dispatchError(err.message); return this; }
    }

    /**
     * Handle editable content input
     */
    handleInput(e) {
        if (this.isDestroyed) return;
        const target = e.target;
        if (!target?.hasAttribute('data-field')) return;

        try {
            const field = target.getAttribute('data-field');
            const value = target.innerText;
            this.data[field] = value;
            this.dispatchEvent(EVENT_TYPES.CONTENT_CHANGE, { field, value });
        } catch (err) { this.dispatchError(err.message); }
    }

    /**
     * Delegated click handler - supports clicks on obscured images
     */
    handleClickDelegated(event) {
        if (this.isDestroyed) return;
        const shadow = this.shadow;
        if (!shadow) return;

        const x = event.clientX;
        const y = event.clientY;
        let target = shadow.elementFromPoint(x, y);
        let eventDispatched = false;

        while (target && target !== shadow && !eventDispatched) {
            if (target.tagName === 'IMG' && target.hasAttribute('data-img')) {
                this.dispatchEvent(EVENT_TYPES.IMG_CLICK, {
                    imgKey: target.getAttribute('data-img'),
                    element: target
                });
                eventDispatched = true;
            } else if (target.hasAttribute('data-field')) {
                this.dispatchEvent(EVENT_TYPES.FIELD_CLICK, {
                    fieldKey: target.getAttribute('data-field'),
                    element: target
                });
                eventDispatched = true;
            } else if (!eventDispatched) {
                this.dispatchEvent(EVENT_TYPES.CARD_CLICK, { element: target });
                eventDispatched = true;
            }
            target = target.parentNode;
        }
    }

    dispatchEvent(type, detail) {
        if (this.isDestroyed) return;
        this.element.dispatchEvent(new CustomEvent(type, { detail: { ...detail, cardId: this.id }, bubbles: true, cancelable: true }));
    }

    dispatchError(message) { this.dispatchEvent(EVENT_TYPES.ERROR, { message }); }

    async setHTML(html) {
        try {
            Validator.validateNotDestroyed(this);
            Validator.validateHtml(html);
            if (!this.innerContainer) throw new Error('Inner container not found');

            this.innerContainer.innerHTML = html;
            this.innerContainer.offsetHeight;
            await this.resize();
            return this;
        } catch (err) { this.dispatchError(err.message); return this; }
    }

    setStyle(css, reset = false) {
        try {
            Validator.validateNotDestroyed(this);
            Validator.validateCss(css);
            let styleEl = this.shadow.querySelector('#custom-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'custom-style';
                this.shadow.insertBefore(styleEl, this.innerContainer);
            }
            styleEl.textContent = reset ? css : `${styleEl.textContent}\n${css}`;
            return this;
        } catch (err) { this.dispatchError(err.message); return this; }
    }

    setContent(data) {
        try {
            Validator.validateNotDestroyed(this);
            Validator.validateData(data);
            this.data = { ...this.data, ...data };
            Object.entries(data).forEach(([field, val]) => {
                const el = this.shadow.querySelector(`[data-field="${field}"]`);
                if (el) el.innerText = val == null ? '' : String(val);
            });
            return this;
        } catch (err) { this.dispatchError(err.message); return this; }
    }

    async resize(targetWidth) {
        try {
            Validator.validateNotDestroyed(this);
            const overlay = this.shadow?.querySelector('#loading-overlay');
            overlay?.classList.remove('hidden');

            if (targetWidth !== undefined) {
                Validator.validateTargetWidth(targetWidth);
                this.options.targetWidth = targetWidth;
            }

            this.element.style.width = `${this.options.targetWidth}px`;
            this.element.style.height = 'auto';

            await this.waitForImages();

            let originalWidth = this.innerContainer?.offsetWidth || 1;
            const scale = Math.min(1, this.options.targetWidth / originalWidth);

            if (this.innerContainer) {
                this.innerContainer.style.transform = `scale(${scale})`;
                this.innerContainer.style.transformOrigin = 'top left';
                const scaledHeight = Math.max(1, (this.innerContainer.offsetHeight || 1) * scale);
                this.element.style.height = `${scaledHeight}px`;
                this.innerContainer.style.width = `${this.options.targetWidth / scale}px`;
                this.innerContainer.style.overflow = 'hidden';
            }

            requestAnimationFrame(() => overlay?.classList.add('hidden'));
            return this;
        } catch (err) {
            this.dispatchError(err.message);
            this.shadow?.querySelector('#loading-overlay')?.classList.add('hidden');
            return this;
        }
    }

    on(type, handler) {
        if (this.isDestroyed || typeof handler !== 'function') {
            if (typeof handler !== 'function') this.dispatchError('Event handler must be a function');
            return this;
        }
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

    destroy() {
        if (this.isDestroyed) return;
        clearTimeout(this.resizeTimer);

        this.shadow?.removeEventListener('input', this.boundInputHandler);
        this.shadow?.removeEventListener('click', this.boundClickHandler);

        this.eventListeners.forEach((handlers, type) => {
            handlers.forEach(h => this.element.removeEventListener(type, h));
        });
        this.eventListeners.clear();

        this.element?.remove();
        this.isDestroyed = true;

        this.element = this.shadow = this.innerContainer = this.data = this.options = null;
    }

    static batchCreate(cards) {
        if (!Array.isArray(cards)) throw new Error('batchCreate requires an array');
        return cards.map(opts => new ShadowCard(opts));
    }
}

export default ShadowCard;
