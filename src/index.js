import { generateUniqueId, calculateScaling, Validator } from './utils.js';
import { DEFAULT_OPTIONS, EVENT_TYPES } from './constants.js';

/**
 * ShadowCard class - Creates isolated card instances using Shadow DOM
 * Supports batch creation, dynamic updates to HTML, styles, and content
 */
export class ShadowCard {
    /**
     * Initialize a new ShadowCard instance
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Parent element to mount the card (defaults to document.body)
     * @param {string} options.html - HTML structure for the card content
     * @param {string} options.css - CSS styles scoped to the card
     * @param {Object} options.data - Initial content data ({ field: value } key-value pairs)
     * @param {number} options.targetWidth - Desired display width (defaults to 160)
     */
    constructor(options = {}) {
        try {
            // Merge user options with defaults
            this.options = { ...DEFAULT_OPTIONS, ...options };

            // Validate input parameters
            Validator.validateContainer(this.options.container);
            Validator.validateHtml(this.options.html);
            Validator.validateCss(this.options.css);
            Validator.validateData(this.options.data);
            Validator.validateTargetWidth(this.options.targetWidth);

            // Initialize instance state
            this.id = generateUniqueId();
            this.isDestroyed = false;
            this.data = { ...this.options.data };
            this.eventListeners = new Map(); // Track listeners for proper cleanup
            this.resizeTimer = null; // Timer ID for resize debouncing

            // Create core DOM structure
            this.element = this.createHostElement();
            this.shadow = this.element.shadowRoot;
            this.innerContainer = this.shadow.getElementById('inner-container');

            // Initialize content and styles
            this.setHTML(this.options.html);
            this.setStyle(this.options.css);
            this.setContent(this.options.data);

            // Mount to container
            this.options.container.appendChild(this.element);

            // Defer resize to ensure DOM rendering completes
            this.resizeTimer = setTimeout(async () => {
                await this.resize();
            }, 0);


        } catch (error) {
            this.dispatchError(error.message);
            throw error; // Propagate error for developer visibility
        }
    }

    /**
     * Wait for all images in the card to load
     * @returns {Promise} Resolves when all images are loaded/failed
     */
    waitForImages() {
        return new Promise((resolve) => {
            const images = Array.from(this.shadow.querySelectorAll('img'));
            if (images.length === 0) {
                resolve();
                return;
            }

            let loadedCount = 0;
            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                    resolve();
                }
            };

            images.forEach(img => {
                // If already loaded/failed
                if (img.complete) {
                    checkComplete();
                    return;
                }
                // Listen for load events
                img.addEventListener('load', checkComplete, { once: true });
                // Listen for error events (still count as "processed")
                img.addEventListener('error', checkComplete, { once: true });
            });
        });
    }

    /**
     * Create the host element with Shadow DOM
     * @returns {HTMLElement} Custom element with shadow root
     */
    createHostElement() {
        const element = document.createElement('shadow-card');
        element.id = this.id;
        element.dataset.id = this.id;

        // Apply style options as CSS variables (from constructor options)
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
            margin: ${this.options?.styles?.marginHeight || "8px"} ${this.options?.styles?.marginWitdh || "auto"};
        }
        
        :host(:hover) {
            border-color: var(--shadow-card-hover-border-color, #3b82f6);
        }
        
        #inner-container {
            // width: 100%;
            width:640px;
            transform-origin: top left;
            transform: scale(1);
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
            <div class="loading-spinner"></div>
            <span class="loading-text">${this.options?.styles?.loadingText || 'Loading...'}</span>
        </div>
        <div id="inner-container"></div>
    `;

        this.boundInputHandler = (e) => this.handleInput(e);
        this.boundClickHandler = (e) => this.handleClick(e);
        shadow.addEventListener('input', this.boundInputHandler);
        shadow.addEventListener('click', this.boundClickHandler);
        this.boundPasteHandler = (e) => this.handlePaste(e);
        shadow.addEventListener('paste', this.boundPasteHandler);
        return element;
    }

    // Handles paste events for contenteditable elements to enforce plain text only
    handlePaste(e) {
        // Exit early if target isn't an editable element or event is already handled
        if (!e.target?.isContentEditable || e.defaultPrevented) return;

        // Prevent default paste behavior to block rich content
        e.preventDefault();

        try {
            // Get clipboard data source (standard Clipboard API or legacy IE support)
            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) throw new Error('Clipboard access unavailable');

            // Extract only plain text from clipboard (ignores HTML, images, etc.)
            const plainText = clipboardData.getData('text') || '';
            if (plainText.trim() === '') return; // Do nothing if clipboard is empty

            // Get current selection/cursor position
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                // Fallback: append to end if no valid selection
                e.target.textContent += plainText;
                return;
            }

            // Remove any currently selected content before pasting
            const range = selection.getRangeAt(0);
            range.deleteContents();

            // Create text node with clipboard content
            const textNode = document.createTextNode(plainText);

            // Insert text at cursor position
            range.insertNode(textNode);

            // Move cursor to end of pasted text for natural continuation
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);

            // Update selection to new cursor position
            selection.removeAllRanges();
            selection.addRange(range);

        } catch (error) {
            // Graceful fallback: append text to end if main logic fails
            console.warn('Plain text paste enforcement failed:', error);
            e.target.textContent += (e.clipboardData || window.clipboardData)?.getData('text') || '';
        }
    }

    /**
     * Applies initial style options as CSS variables to the host element
     * @param {HTMLElement} element - Host element to apply styles to
     * @private
     */
    applyStyleVariables(element) {
        // Guard clause: Validate element exists before proceeding
        if (!element || !(element instanceof HTMLElement)) {
            console.error('Invalid element passed to applyStyleVariables. Must be an HTMLElement.');
            return;
        }

        try {
            // Get style mappings from centralized method
            const styleMappings = this.getStyleMappings();

            // Only proceed if styles option exists and is an object
            if (this.options?.styles && typeof this.options.styles === 'object') {
                // Apply each valid style option as a CSS variable
                Object.entries(styleMappings).forEach(([optionKey, cssVar]) => {
                    // Check if the specific style property exists in options
                    if (this.options.styles[optionKey] !== undefined) {
                        // Use try/catch around setProperty for additional safety
                        try {
                            element.style.setProperty(cssVar, this.options.styles[optionKey]);
                        } catch (setPropertyError) {
                            console.error(`Failed to set CSS variable ${cssVar}:`, setPropertyError);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error in applyStyleVariables:', error);
        }
    }

    /**
     * Returns consistent style mapping between option keys and CSS variables
     * @returns {Object} Key-value pairs of style options to CSS variables
     * @private
     */
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
     * Public API to dynamically update CSS variables for the card
     * @param {Object} variables - Key-value pairs of style options to update
     * @returns {ShadowCard} Instance for method chaining
     * @public
     */
    setCssVariables(variables) {
        try {
            // Validate the card isn't destroyed
            Validator.validateNotDestroyed(this);

            // Validate input is a valid object
            if (typeof variables !== 'object' || variables === null) {
                throw new Error('Style variables must be a valid object');
            }

            // Reuse the same style mappings for consistency
            const styleMappings = this.getStyleMappings();

            // Apply each variable to the host element's style
            Object.entries(variables).forEach(([optionKey, value]) => {
                const cssVar = styleMappings[optionKey];
                if (cssVar && value !== undefined) {
                    this.element.style.setProperty(cssVar, value);
                }
            });

            // Special handling for loading text (updates DOM text content)
            if (variables.loadingText) {
                const loadingTextEl = this.shadow.querySelector('.loading-text');
                if (loadingTextEl) {
                    loadingTextEl.textContent = variables.loadingText;
                }
            }

            return this; // Enable method chaining
        } catch (error) {
            this.dispatchError(error.message);
            return this;
        }
    }

    /**
     * Handle content editing events
     * @param {Event} e - Input event object
     */
    handleInput(e) {
        if (this.isDestroyed) return;

        const target = e.target;
        if (target.isContentEditable && target.hasAttribute('data-field')) {
            try {
                const field = target.getAttribute('data-field');
                const value = target.innerText;
                this.data[field] = value;
                this.dispatchEvent(EVENT_TYPES.CONTENT_CHANGE, { field, value });
            } catch (error) {
                this.dispatchError(error.message);
            }
        }
    }

    /**
     * Handle image click events
     * @param {Event} e - Click event object
     */
    handleClick(e) {
        if (this.isDestroyed) return;

        const target = e.target;
        if (target.tagName === 'IMG' && target.hasAttribute('data-img')) {
            try {
                this.dispatchEvent(EVENT_TYPES.IMG_CLICK, {
                    imgKey: target.getAttribute('data-img'),
                    element: target
                });
            } catch (error) {
                this.dispatchError(error.message);
            }
        }
    }

    /**
     * Dispatch custom events
     * @param {string} type - Event type
     * @param {Object} detail - Event payload
     */
    dispatchEvent(type, detail) {
        if (this.isDestroyed) return;

        this.element.dispatchEvent(new CustomEvent(type, {
            detail: { ...detail, cardId: this.id },
            bubbles: true,
            cancelable: true
        }));
    }

    /**
     * Dispatch error events
     * @param {string} message - Error description
     */
    dispatchError(message) {
        this.dispatchEvent(EVENT_TYPES.ERROR, { message });
    }

    /**
     * Update card's HTML content
     * @param {string} html - New HTML content
     * @returns {ShadowCard} Instance for chaining
     */
    async setHTML(html) {
        try {
            Validator.validateNotDestroyed(this);
            Validator.validateHtml(html);

            this.innerContainer.innerHTML = html;
            this.innerContainer.offsetHeight; // Force reflow
            await this.resize(); // Wait for async resize to complete
            return this;
        } catch (error) {
            this.dispatchError(error.message);
            return this;
        }
    }

    /**
     * Update card's styles
     * @param {string} css - CSS rules
     * @param {boolean} [reset=false] - Replace existing styles if true
     * @returns {ShadowCard} Instance for chaining
     */
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
        } catch (error) {
            this.dispatchError(error.message);
            return this;
        }
    }

    /**
     * Update editable content fields
     * @param {Object} data - { field: value } updates
     * @returns {ShadowCard} Instance for chaining
     */
    setContent(data) {
        try {
            Validator.validateNotDestroyed(this);
            Validator.validateData(data);

            this.data = { ...this.data, ...data };
            Object.entries(data).forEach(([field, value]) => {
                const element = this.shadow.querySelector(`[data-field="${field}"]`);
                if (element?.isContentEditable) {
                    element.innerText = value == null ? '' : String(value);
                }
            });
            return this;
        } catch (error) {
            this.dispatchError(error.message);
            return this;
        }
    }

    /**
     * Resize card to target width
     * @param {number} [targetWidth] - New target width (uses initial if not provided)
     * @returns {ShadowCard} Instance for chaining
     */
    async resize(targetWidth) {
        try {
            Validator.validateNotDestroyed(this);
            const loadingOverlay = this.shadow.querySelector('#loading-overlay');
            loadingOverlay.classList.remove('hidden');

            // Update target width if provided
            if (targetWidth !== undefined) {
                Validator.validateTargetWidth(targetWidth);
                this.options.targetWidth = targetWidth;
            }

            // 1. Force setting of the width of the card container (the outer container)
            this.element.style.width = `${this.options.targetWidth}px`;
            this.element.style.height = 'auto'; // 先重置高度

            // 2. Wait for the image to load completely to obtain the accurate dimensions
            await this.waitForImages();

            // 3. Calculate the scaling ratio (based on the original width of the internal content)
            const originalContentWidth = this.innerContainer.offsetWidth;
            if (originalContentWidth === 0) {
                this.innerContainer.style.minWidth = '1px';
                this.innerContainer.style.minHeight = '1px';
                // Recalculate the width to avoid division by zero
                originalContentWidth = Math.max(1, this.innerContainer.offsetWidth);
            }

            // Core: Calculate the scaling ratio (target width / original content width)
            const scale = this.options.targetWidth / originalContentWidth;

            // 4. Apply scaling and adjust height
            this.innerContainer.style.transform = `scale(${scale})`;
            this.innerContainer.style.transformOrigin = 'top left'; // Ensure that the scaling starts from the top left corner

            // Calculate the actual height after scaling (original height * scaling ratio)
            const scaledHeight = Math.max(1, this.innerContainer.offsetHeight * scale);
            this.element.style.height = `${scaledHeight}px`;

            // 5. Ensure that the internal content does not overflow
            this.innerContainer.style.width = `${this.options.targetWidth / scale}px`; // Reverse the internal width of the scaling
            this.innerContainer.style.overflow = 'hidden';

            // 6. After the layout is completed, hide the loading status
            requestAnimationFrame(() => {
                loadingOverlay.classList.add('hidden');
            });

            return this;
        } catch (error) {
            this.dispatchError(error.message);
            this.shadow?.querySelector('#loading-overlay')?.classList.add('hidden');
            return this;
        }
    }

    /**
     * Add event listener
     * @param {string} type - Event type
     * @param {Function} handler - Event handler
     * @returns {ShadowCard} Instance for chaining
     */
    on(type, handler) {
        if (this.isDestroyed) return this;

        if (typeof handler !== 'function') {
            this.dispatchError('Event handler must be a function');
            return this;
        }

        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, new Set());
        }
        this.eventListeners.get(type).add(handler);
        this.element.addEventListener(type, handler);
        return this;
    }

    /**
     * Remove event listener
     * @param {string} type - Event type
     * @param {Function} [handler] - Specific handler to remove (removes all if omitted)
     * @returns {ShadowCard} Instance for chaining
     */
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

    /**
     * Destroy card and clean up resources
     */
    destroy() {
        if (this.isDestroyed) return;

        // Clean up timers and event listeners
        clearTimeout(this.resizeTimer);
        this.eventListeners.forEach((handlers, type) => {
            handlers.forEach(handler => this.element.removeEventListener(type, handler));
        });
        this.eventListeners.clear();

        // Remove shadow DOM event listeners
        this.shadow?.removeEventListener('input', this.boundInputHandler);
        this.shadow?.removeEventListener('click', this.boundClickHandler);
        this.shadow?.removeEventListener('paste', this.boundPasteHandler);

        // Remove from DOM
        this.element?.parentNode?.removeChild(this.element);

        // Mark as destroyed and nullify references
        this.isDestroyed = true;
        this.element = null;
        this.shadow = null;
        this.innerContainer = null;
        this.data = null;
        this.options = null;
    }

    /**
     * Batch create multiple ShadowCard instances
     * @param {Object[]} cards - Array of card configurations
     * @returns {ShadowCard[]} Array of created instances
     */
    static batchCreate(cards) {
        if (!Array.isArray(cards)) {
            throw new Error('batchCreate requires an array of card configurations');
        }

        return cards.map(options => new ShadowCard(options));
    }
}

export default ShadowCard;