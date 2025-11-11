/**
 * Default configuration options for ShadowCard instances
 */
export const DEFAULT_OPTIONS = {
    targetWidth: 160,
    container: document.body,
    html: '',
    css: '',
    data: {}
};

/**
 * Event type constants for consistent event handling
 */
export const EVENT_TYPES = {
    CONTENT_CHANGE: 'content-change',
    IMG_CLICK: 'img-click',
    ERROR: 'error'
};

/**
 * Error message constants for consistent error reporting
 */
export const ERROR_MESSAGES = {
    INVALID_CONTAINER: 'Container must be a valid DOM element',
    INVALID_HTML: 'HTML content must be a string',
    INVALID_CSS: 'Styles must be a string',
    INVALID_DATA: 'Data must be an object',
    INVALID_TARGET_WIDTH: 'Target width must be a positive number',
    ELEMENT_DESTROYED: 'Card has been destroyed and cannot perform operations'
};