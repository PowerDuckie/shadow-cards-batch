// types/index.d.ts
/**
 * Type definitions for shadow-cards-batch
 * Comprehensive declaration based on actual runtime implementation.
 */

export type Nullable<T> = T | null | undefined;

/* ------------------------------------------------------
 * Default configuration and constants
 * ------------------------------------------------------ */

/** Default configuration options for ShadowCard instances */
export const DEFAULT_OPTIONS: {
    targetWidth: number;
    container: HTMLElement;
    editable: boolean;
    html: string;
    css: string;
    data: Record<string, any>;
    styles: {
        border: string;
        borderRadius: string;
        hoverBorderColor: string;
        loadingBg: string;
        loadingText: string;
        loadingSpinnerColor: string;
        [key: string]: string | number | boolean | null | undefined;
    };
};

/** Event type constants for consistent event handling */
export const EVENT_TYPES: {
    CONTENT_CHANGE: 'content-change';
    CARD_CLICK: 'card-click';
    FIELD_CLICK: 'field-click';
    IMG_CLICK: 'img-click';
    ERROR: 'error';
};

/** Error message constants for consistent error reporting */
export const ERROR_MESSAGES: {
    INVALID_CONTAINER: 'Container must be a valid DOM element';
    INVALID_HTML: 'HTML content must be a string';
    INVALID_CSS: 'Styles must be a string';
    INVALID_DATA: 'Data must be an object';
    INVALID_TARGET_WIDTH: 'Target width must be a positive number';
    ELEMENT_DESTROYED: 'Card has been destroyed and cannot perform operations';
};

/** HTML tags compatible with Markdown */
export const ALLOWED_TAGS_MARKDOWN: string[];

/** HTML attributes compatible with Markdown */
export const ALLOWED_ATTRS_MARKDOWN: string[];

/* ------------------------------------------------------
 * Utility functions
 * ------------------------------------------------------ */

/**
 * Sanitize HTML with allowed tags and attributes
 */
export function sanitizeHtml(
    html?: string,
    allowedTags?: string[],
    allowedAttrs?: string[]
): string;

/**
 * Escape plain text to HTML entities
 */
export function escapeHtml(str?: string): string;

/**
 * Generate a unique alphanumeric ID
 */
export function generateUniqueId(): string;

/**
 * Input validation utility
 * Throws descriptive Error if validation fails.
 */
export const Validator: {
    validateContainer(container: unknown): void;
    validateHtml(html: unknown): void;
    validateCss(css: unknown): void;
    validateData(data: unknown): void;
    validateTargetWidth(width: unknown): void;
    validateNotDestroyed(instance: { isDestroyed?: boolean }): void;
};

/* ------------------------------------------------------
 * ShadowCard core types
 * ------------------------------------------------------ */

/** CSS variables and visual style configuration */
export interface ShadowCardStyles {
    border?: string | null;
    borderRadius?: string | null;
    hoverBorderColor?: string | null;
    loadingBg?: string | null;
    loadingText?: string | null;
    loadingSpinnerColor?: string | null;
    loadingColor?: string | null;
    loadingFontSize?: string | null;
    loadingGap?: string | null;
    loadingIconSize?: string | null;
    loadingSpinnerBorder?: string | null;
    loadingSpinnerSpeed?: string | null;
    marginHeight?: string | number | null;
    marginWidth?: string | number | null;
    [key: string]: string | number | boolean | null | undefined;
}

/** Options for constructing a ShadowCard instance */
export interface ShadowCardOptions {
    container: HTMLElement;
    targetWidth?: number;
    editable?: boolean;
    html?: string;
    css?: string;
    data?: Record<string, any>;
    styles?: ShadowCardStyles;
    [key: string]: any;
}

/** Image loading wait result */
export interface ImageWaitResult {
    success: boolean;
    timeout?: boolean;
    errorCount?: number;
    total?: number;
    errors?: string[];
    error?: string;
}

/* ------------------------------------------------------
 * ShadowCard class
 * ------------------------------------------------------ */

/**
 * ShadowCard — Encapsulated, production-ready card component.
 * Provides safe HTML rendering, resizing, event handling, and destruction.
 */
export class ShadowCard {
    /** Unique card id (UUID-based) */
    id: string;

    /** Host element */
    element: Nullable<HTMLElement>;

    /** Shadow root */
    shadow: Nullable<ShadowRoot>;

    /** Container inside shadow root */
    innerContainer: Nullable<HTMLElement>;

    /** Whether card is destroyed */
    isDestroyed: boolean;

    /** Current options */
    options: ShadowCardOptions;

    /** Current data bound to fields */
    data: Nullable<Record<string, any>>;

    constructor(options: ShadowCardOptions);

    /**
     * Set or replace HTML content (auto-sanitized)
     */
    setHTML(html: string): this;

    /**
     * Apply CSS styles within shadow root.
     * If reset = true, replaces previous CSS.
     */
    setStyle(css: string, reset?: boolean): this;

    /**
     * Populate [data-field] elements with new data
     */
    setContent(data: Record<string, any>): this;

    /**
     * Resize card dynamically to target width
     */
    resize(targetWidth?: number): this;

    /**
     * Wait for images in the card to finish loading
     */
    waitForImages(opts?: { timeoutMs?: number }): Promise<ImageWaitResult>;

    /**
     * Set CSS custom properties (variables)
     */
    setCssVariables(vars: Partial<ShadowCardStyles>): this;

    /**
     * Add event listener for card-level events
     */
    on(
        type: keyof typeof EVENT_TYPES | string,
        handler: (event: CustomEvent<any>) => void
    ): this;

    /**
     * Remove listener for given event type
     */
    off(
        type: keyof typeof EVENT_TYPES | string,
        handler?: (event: CustomEvent<any>) => void
    ): this;

    /**
     * Destroy the card instance and release DOM resources
     */
    destroy(): void;

    /**
     * Create multiple ShadowCard instances in batch
     */
    static batchCreate(cards: ShadowCardOptions[]): ShadowCard[];
}

/** Default export */
export default ShadowCard;
