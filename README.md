# GastroOS

**GastroOS** is a Progressive Web Application (PWA) to manage recipes, plan Monday-to-Friday menus by default, track inventory, calculate shopping lists, and apply the rules of a self-service kitchen.

It is built with HTML, CSS, and JavaScript without an application framework or its own backend. Working information is stored in the browser; synchronization with GitHub is optional.

## Main Features

- Recipe catalog: creation, editing, filters, batch editing, techniques, classifications, ingredients, and allergens.
- Generation and validation of weekly menus with configurable structure, daily and weekly rules, repetition limits, meat and fish restrictions, stews, and stock availability.
- Day regeneration and search for alternatives that respect the configured rules.
- Differentiated management of raw materials/pre-cooked products and prepared dishes.
- Stock and ingredient names are matched by whole words (tolerating simple plurals), so "pan" never matches "panga" and "jamón" never matches "jamoncitos de pollo".
- Shopping list calculation, grouping by supplier category, quantity adjustment, and TXT export.
- Editable catalogs of meat and fish species.
- Allergens per product, local history, diagnostics, backups, and restoration.
- Installable PWA, local storage, and optional synchronization of `recipes.json` with the GitHub Contents API.

## Current Architecture

```text
GastroOS-main/
├── index.html                  # Interface, views, and ordered module loading
├── css/
│   └── gastroos.css            # Visual design, layout, responsive rules, and app-specific styles
├── js/
│   ├── gastroos.js             # App state, interface, and main orchestration
│   ├── data-store-facade.js    # localStorage access and migrations
│   ├── kitchen-rules.js        # Kitchen rules profile and configuration
│   ├── stock-utils.js          # Normalization and validation of stock records
│   ├── shopping-engine.js      # Needs and shopping calculations
│   ├── menu-generation-engine.js # Weekly generation attempt orchestration
│   ├── menu-selection-rules.js # Structural rules for choosing dishes
│   ├── menu-structure-validator.js # Structural validation of the week
│   ├── menu-daily-rules.js     # Daily composition restrictions
│   ├── menu-frequency-rules.js # Weekly limits and frequencies
│   ├── menu-continuity-rules.js # Restrictions between consecutive days
│   ├── menu-engine-facade.js   # Facade over existing engine functions
│   ├── github-network.js       # Construction of paths and GitHub network timeout
│   └── github-facade.js        # Facade for synchronization operations
├── recipes.json                # Seed recipe book and shared catalog metadata
├── product-allergens.json      # Initial product-level allergen mapping
├── manifest.json               # PWA installation metadata
├── sw.js                       # Installation, update, and offline cache
├── icon-192.png
├── icon-512.png
├── apple-touch-icon.png
├── favicon-32.png
└── README.md
```

### Responsibilities and Limits

- `gastroos.js` remains the main module and contains important parts of the culinary engine and the interface. Facades are not duplicated engines: they expose existing functions to facilitate gradual separation.
- The `*-rules.js`, `menu-structure-validator.js`, `stock-utils.js`, and `shopping-engine.js` modules separate specific rules and calculations from the main interface logic. This is an architectural separation, not a claim that a test suite is included in the repository.
- `index.html` scripts are loaded in a deliberate order: utilities and rules first, then `gastroos.js`, and finally the facades that expose their functions.
- `css/gastroos.css` contains the application styles: layout, component appearance, responsive behavior, and theme-specific presentation. It is separate from the HTML so visual changes can be maintained without editing the application logic.
- `recipes.json` is used as an initial source when there is no usable local recipe book. Service Worker installation treats it as an essential resource along with the application modules.
- `product-allergens.json` provides initial product-level allergen data; user changes are stored locally by the application.

## Data and Persistence

- `localStorage` stores the working recipe book, configuration, inventory, current and historical menu, allergens, automatic backups, and synchronization metadata.
- `product-allergens.json` is an optional seed/data resource for product-level allergen metadata; it is included in the Service Worker app shell.
- Schema migrations are performed via `data-store-facade.js`. Do not manually delete `chefTrack_*` keys if you want to keep the data.
- Exported backups are the recommended way to move or recover data. Make an export before updating the application or restoring old data.
- The GitHub token is stored in this device's `localStorage` (key `gastroos_github_token`) so the installed PWA does not ask for it on every launch; a token left in `sessionStorage` by older versions is migrated automatically. Non-secret repository configuration is stored separately under `chefTrack_githubSettings`. The token is never included in exported backups. Anyone with access to the unlocked device/browser profile can read it, so use a fine-grained, read/write-Contents-only token and revoke it if the device is lost.

## GitHub Synchronization

Integration is optional and uses the GitHub Contents API to read and update the configured file (usually `recipes.json`). GitHub is not needed to use local features.

Security recommendations:

1. Use a fine-grained token with access only to the required repository and the minimum Contents permissions needed to read/write.
2. Do not include the token in repository files, screenshots, issues, or documentation.
3. The token is available to the application's JavaScript and persists in the browser's `localStorage`; a malicious script executed on the same origin could access it. Publish only trusted code and revoke the token if you suspect it has been exposed.
4. GitHub Pages does not provide a secret backend: authentication is done from the browser.

`github-network.js` validates the owner/repository/path format and applies a timeout to requests. This improves robustness, but does not eliminate network errors, API limits, or simultaneous write conflicts.

## PWA and Offline Operation

The Service Worker uses versioned caching and deletes old GastroOS caches upon activation. Static application resources use cache-first with background refresh; same-origin JSON data uses network-first and falls back to the last cached copy when offline. During installation, it preloads essential resources; if an essential resource is missing, it cancels the installation instead of leaving an incomplete shell. The Tailwind CDN is optional during installation and is attempted to be cached when available.

**Known limit:** `index.html` loads Tailwind from `https://cdn.tailwindcss.com`. The cached copy is best-effort and does not guarantee full styling on a first offline installation or against external provider changes. For predictable offline use, the next improvement would be to compile Tailwind as local CSS and test installation, updating, and use without a network in real browsers.

Existing data is in `localStorage`, but the availability of the interface and resources in an initial offline installation depends on having previously loaded the application and its essential resources successfully.

## Deployment

The application can be served as a static site with GitHub Pages. Publish the contents of this folder while keeping the file structure. It does not require a build process for its current operation.

## Design and Goal

GastroOS prioritizes clarity, compact controls, and explicit configuration. Its goal is to automate repetitive planning and shopping tasks without hiding the rules that condition dish selection or taking away the user's final control.