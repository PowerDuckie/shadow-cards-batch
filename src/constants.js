/**
 * Default configuration options for ShadowCard instances
 */
export const DEFAULT_OPTIONS = {
    targetWidth: 160,
    container: document.body,
    editable: false,
    html: '',
    css: '',
    data: {},
    styles: {
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        hoverBorderColor: '#3b82f6',
        loadingBg: '#ffffff',
        loadingText: 'Processing...',
        loadingSpinnerColor: '#3b82f6'
    }
};

/**
 * Event type constants for consistent event handling
 */
export const EVENT_TYPES = {
    CONTENT_CHANGE: 'content-change',
    CARD_CLICK: 'card-click',
    FIELD_CLICK: 'field-click',
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

// HTML tags compatible with MARKDOWN
export const ALLOWED_TAGS_MARKDOWN = [
    // block-level
    'p', 'div', 'blockquote', 'pre', 'code', 'hr',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',

    // inline text
    'span', 'a', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'sub', 'sup',

    // heading
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',

    // image/media
    'img', 'figure', 'figcaption',

    // table (common in GitHub Markdown)
    'table', 'thead', 'tbody', 'tr', 'th', 'td',

    // code-related
    'code', 'kbd', 'samp',

    // misc
    'details', 'summary'
];

// HTML ATTRS compatible with MARKDOWN
export const ALLOWED_ATTRS_MARKDOWN = [
    'href', 'title', 'src', 'alt', 'width', 'height',
    'class', 'id', 'name', 'style',
    'data-field', 'data-img', 'data-*',
    'align', 'valign', 'colspan', 'rowspan', 'target', 'rel'
];
