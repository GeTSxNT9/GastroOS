# GastroOS

**GastroOS** is a Progressive Web Application (PWA) for managing recipes, planning Monday-to-Friday menus, tracking stock, calculating shopping lists, and applying the rules of a self-service kitchen.

It uses HTML, CSS, and JavaScript without an application framework or backend. The app works locally in the browser; GitHub synchronization is optional.

## Main Features

- Recipe catalog with creation, editing, search, filters, ingredients, classifications, and recipe allergens.
- Weekly menu generation, validation, day regeneration, and rule-based alternatives.
- Raw-material and pre-cooked stock, prepared dishes, and shopping lists with quantity adjustment and TXT export.
- Product and raw-material allergens, stored locally while editing and shared through `product-allergens.json` when synchronized.
- Editable meat and fish catalogs, local history, backups, and restore tools.
- Installable PWA with offline support after the app shell has been cached.

## Project Structure

```text
GastroOS-main/
├── index.html                    # Interface and ordered script loading
├── css/gastroos.css              # Application styles and themes
├── js/
│   ├── gastroos.js               # App state, UI, persistence, and orchestration
│   ├── data-store-facade.js       # localStorage access and migrations
│   ├── kitchen-rules.js           # Kitchen rule configuration
│   ├── stock-utils.js             # Stock normalization and validation
│   ├── shopping-engine.js         # Shopping calculations
│   ├── menu-generation-engine.js  # Weekly generation orchestration
│   ├── menu-selection-rules.js    # Dish selection constraints
│   ├── menu-structure-validator.js# Weekly structure validation
│   ├── menu-daily-rules.js        # Daily menu restrictions
│   ├── menu-frequency-rules.js    # Weekly frequencies and limits
│   ├── menu-continuity-rules.js   # Consecutive-day restrictions
│   ├── menu-engine-facade.js      # Menu engine facade
│   ├── github-network.js          # GitHub API URLs and request timeout
│   └── github-facade.js           # GitHub integration facade
├── recipes.json                  # Initial recipe catalog and shared recipe data
├── product-allergens.json        # Shared product/raw-material allergen catalog
├── manifest.json                 # PWA metadata
├── sw.js                         # Offline cache and application updates
└── icon-*.png, favicon-32.png, apple-touch-icon.png
```

`gastroos.js` remains the main application module; the smaller rule and utility modules isolate selected responsibilities. Scripts in `index.html` must remain in their current loading order.

## Data and Persistence

- `localStorage` holds the working recipe book, settings, stock, menus, history, product-allergen assignments, backups, and sync metadata.
- `recipes.json` provides the initial recipe catalog and is the shared GitHub recipe file when synchronization is configured.
- `product-allergens.json` is the shared GitHub catalog for allergens assigned to products and raw materials. Local changes are retained on the device and are uploaded when GitHub synchronization succeeds.
- The GitHub token is stored in this browser's `localStorage` so the connection can persist between app launches. It is not written to repository files. Anyone able to run script on the same origin may be able to access it.
- Export a backup before updating the app or restoring data. Do not delete `chefTrack_*` storage keys if you need to preserve local work.

## GitHub Synchronization

GitHub integration uses the Contents API directly from the browser and is optional. Local recipe editing does not require a connection. When connecting, GastroOS reads the remote recipe file and merges local recipes whose IDs are not present remotely; for matching IDs, the remote recipe currently takes precedence. Product allergens are merged into `product-allergens.json` during synchronization.

Use a fine-grained token restricted to the required repository, with only the necessary Contents permissions. GitHub Pages has no secret backend, so do not share the token or publish it in files, screenshots, or issues. Concurrent edits and same-ID recipe conflicts still require care; keep backups before synchronization.

## PWA and Offline Operation

The Service Worker caches essential application files and removes older GastroOS caches when a new version activates. `product-allergens.json` is included in the application cache. Tailwind is loaded from a CDN and its cache is best-effort, so a first offline installation or external CDN change may affect styling. Fully predictable offline styling would require a locally compiled stylesheet.

## Checks and Deployment

Serve the contents of this folder as a static site, for example with GitHub Pages. No build step is required. Before publishing changes, run:

```bash
node --check js/gastroos.js
node --check sw.js
```

Also verify that scripts referenced by `index.html` exist and that essential resources are listed in `sw.js`. Test recipe editing, menu generation, stock and shopping calculations, persistence after reload, and GitHub synchronization in the deployed app.

## Design Goal

GastroOS aims to keep kitchen planning and stock management clear, configurable, and under the user's control while automating repetitive work.
