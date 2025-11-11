# ShadowCards Batch

A robust JavaScript library for creating and managing isolated, style-encapsulated cards using Shadow DOM. Perfect for building dynamic dashboards, content grids, and interactive card-based interfaces with zero style conflicts.

## Features

- **Shadow DOM Isolation**: Styles are scoped to individual cards, eliminating global CSS conflicts
- **Batch Operations**: Create, update, and destroy multiple cards efficiently
- **Dynamic Customization**: Modify content, styles, and dimensions at runtime with chainable APIs
- **Style Theming**: Customize appearance through CSS variables or JSON configuration
- **Event System**: Listen for content changes, image interactions, and errors
- **Loading States**: Built-in animated spinners with full customization options
- **Responsive Scaling**: Automatically maintain proportions when resizing cards
- **Zero Dependencies**: Lightweight and self-contained

## Installation

```bash
# Using npm
npm install shadow-cards-batch

# Using yarn
yarn add shadow-cards-batch
```

## Quick Start

### Basic Usage

```javascript
import ShadowCard from 'shadow-cards-batch';

// Create a single card
const card = new ShadowCard({
  container: document.getElementById('card-container'),
  targetWidth: 300,
  html: `
    <div class="profile-card">
      <h3 data-field="name" contenteditable="true">Jane Doe</h3>
      <p data-field="title">Senior Developer</p>
      <img data-img="avatar" src="https://picsum.photos/id/64/400/400" alt="Profile">
    </div>
  `,
  css: `
    .profile-card {
      background: #f8fafc;
      padding: 1.5rem;
      border-radius: 8px;
    }
    h3 { color: #1e293b; margin: 0; }
    img { border-radius: 50%; margin-top: 1rem; }
  `,
  styles: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    hoverBorderColor: '#3b82f6',
    loadingSpinnerColor: '#3b82f6'
  }
});

// Listen for events
card.on('content-change', (e) => {
  console.log(`Card ${e.detail.cardId} updated:`, e.detail.field, '=', e.detail.value);
});
```

### Batch Creation

```javascript
// Create multiple cards at once
const cardConfigs = [
  {
    container: document.getElementById('dashboard'),
    targetWidth: 250,
    html: `<!-- Card 1 Content -->`,
    css: `/* Card 1 Styles */`
  },
  {
    container: document.getElementById('dashboard'),
    targetWidth: 250,
    html: `<!-- Card 2 Content -->`,
    css: `/* Card 2 Styles */`
  }
];

const cards = ShadowCard.batchCreate(cardConfigs);
```

## Configuration Options

| Option         | Type         | Default          | Description                                  |
|----------------|--------------|------------------|----------------------------------------------|
| `container`    | HTMLElement  | `document.body`  | Parent element to mount the card              |
| `targetWidth`  | number       | `160`            | Initial display width of the card             |
| `html`         | string       | `''`             | HTML content structure for the card           |
| `css`          | string       | `''`             | Scoped CSS styles for the card content        |
| `data`         | object       | `{}`             | Initial data for `data-field` elements        |
| `styles`       | object       | `{}`             | Style configuration for the card container    |
| `editable`     | boolean      | `false`          | Enable/disable editing capabilities           |

### Style Configuration (`styles` option)

Customize the card's container appearance through these properties:

| Property               | CSS Variable Equivalent         | Default Value          |
|------------------------|---------------------------------|------------------------|
| `border`               | `--shadow-card-border`          | `2px solid #e2e8f0`    |
| `borderColor`          | `--shadow-card-border-color`    | `#e2e8f0`              |
| `borderRadius`         | `--shadow-card-border-radius`   | `6px`                  |
| `hoverBorderColor`     | `--shadow-card-hover-border-color` | `#3b82f6`          |
| `loadingBg`            | `--shadow-card-loading-bg`      | `#ffffff`              |
| `loadingColor`         | `--shadow-card-loading-color`   | `#4b5563`              |
| `loadingFontSize`      | `--shadow-card-loading-font-size` | `0.8rem`            |
| `loadingGap`           | `--shadow-card-loading-gap`     | `8px`                  |
| `loadingIconSize`      | `--shadow-card-loading-icon-size` | `20px`             |
| `loadingSpinnerBorder` | `--shadow-card-loading-spinner-border` | `rgba(0,0,0,0.1)` |
| `loadingSpinnerColor`  | `--shadow-card-loading-spinner-color` | `#3b82f6`        |
| `loadingSpinnerSpeed`  | `--shadow-card-loading-spinner-speed` | `1s`             |
| `loadingText`          | `--shadow-card-loading-text`    | `Loading...`           |
| `marginWidth`          | N/A                             | `auto`                 | Horizontal margin for card positioning       |
| `marginHeight`         | N/A                             | `8px`                  | Vertical margin for card spacing             |

## API Reference

### Instance Methods

| Method               | Parameters                                  | Return Value   | Description                                  |
|----------------------|---------------------------------------------|----------------|----------------------------------------------|
| `setHTML(html)`      | `html`: New HTML content string             | `ShadowCard`   | Update card's content structure (chainable)  |
| `setStyle(css, reset)` | `css`: Styles string, `reset`: Boolean (default: false) | `ShadowCard` | Add/replace scoped CSS styles (chainable) |
| `setContent(data)`   | `data`: `{ field: value }` object           | `ShadowCard`   | Update text in `data-field` elements (chainable) |
| `setCssVariables(vars)` | `vars`: Style variables object            | `ShadowCard`   | Update container styles dynamically (chainable) |
| `resize(width)`      | `width`: New target width                   | `ShadowCard`   | Rescale card to specified width (chainable)  |
| `waitForImages()`    | None                                        | `Promise<void>`| Wait for all images in card to load          |
| `on(type, handler)`  | `type`: Event type, `handler`: Callback     | `ShadowCard`   | Register event listener (chainable)          |
| `off(type, handler)` | `type`: Event type, `handler`: Callback     | `ShadowCard`   | Remove event listener (chainable)            |
| `destroy()`          | None                                        | `void`         | Clean up and remove card from DOM            |

### Static Methods

| Method               | Parameters                                  | Return Value   | Description                                  |
|----------------------|---------------------------------------------|----------------|----------------------------------------------|
| `batchCreate(configs)` | `configs`: Array of card configurations    | `ShadowCard[]` | Create multiple cards efficiently            |

## Events

| Event Name       | Detail Properties                          | Description                                  |
|------------------|---------------------------------------------|----------------------------------------------|
| `content-change` | `cardId`, `field`, `value`, `element`       | Triggered when editable content changes       |
| `img-click`      | `cardId`, `imgKey`, `element`               | Triggered when images with `data-img` are clicked |
| `field-click`    | `cardId`, `fieldKey`, `element`             | Triggered when elements with `data-field` are clicked |
| `card-click`     | `cardId`, `element`                         | Triggered when card background is clicked     |
| `error`          | `cardId`, `message`                         | Triggered when an error occurs                |

## Theming

Customize cards globally using CSS variables in your main stylesheet:

```css
/* Global theme for all cards */
shadow-card {
  --shadow-card-border: 1px solid #e2e8f0;
  --shadow-card-border-radius: 8px;
  --shadow-card-hover-border-color: #6366f1;
  --shadow-card-loading-spinner-color: #6366f1;
}

/* Theme for cards in a specific container */
.dark-mode shadow-card {
  --shadow-card-border-color: #374151;
  --shadow-card-loading-bg: #1f2937;
  --shadow-card-loading-color: #f9fafb;
}
```

## Best Practices

1. **Clean Up Resources**: Always call `destroy()` when cards are no longer needed to prevent memory leaks
2. **Sanitize Inputs**: Validate and sanitize user-provided HTML/CSS before passing to card configurations
3. **Debounce Resizes**: When responding to window resize events, debounce calls to `resize()`
4. **Handle Errors**: Listen to the `error` event to gracefully handle issues like operations on destroyed cards
5. **Batch Updates**: For multiple changes, use method chaining to minimize reflows:
   ```javascript
   card.setHTML(newHtml).setStyle(newCss).resize(300);
   ```
6. **Wait for Images**: Use `waitForImages()` when you need to ensure images are loaded before measurements:
   ```javascript
   await card.setHTML(htmlWithImages).waitForImages();
   card.resize(400); // Now accurate after images loaded
   ```

## Error Handling

The library includes comprehensive validation and error handling:

- All methods validate that the card hasn't been destroyed before executing
- Input validation for all configuration options
- Meaningful error messages dispatched through the `error` event
- Graceful degradation when invalid operations are attempted

## Browser Support

- Chrome 63+
- Firefox 69+
- Safari 12.1+
- Edge 79+
- All modern browsers supporting Shadow DOM v1

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © PowerDuckie

---

Built with focus on performance, encapsulation, and developer experience. Perfect for building complex card-based interfaces without style conflicts.