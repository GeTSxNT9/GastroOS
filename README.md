📖 GastroOS

Web Operating System for Recipe Management, Menu Planning, and Stock Control.
Progressive Web App with local persistence, offline caching, and optional GitHub synchronization.

⸻

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Architecture-PWA-000000?style=flat-square&logo=apple&logoColor=white" alt="Architecture"></a>
  <a href="#"><img src="https://img.shields.io/badge/Storage-localStorage%20%2B%20GitHub%20API-24292e?style=flat-square&logo=github&logoColor=white" alt="Storage"></a>
  <a href="#"><img src="https://img.shields.io/badge/Design-Apple%20Minimalist-000000?style=flat-square&logo=tailwindcss&logoColor=white" alt="Design"></a>
</p>

⸻

📸 Overview

GastroOS is a client-side Progressive Web App built with HTML5, CSS, and JavaScript for centralized recipe management, weekly menu planning, stock control, shopping lists, backups, diagnostics, and optional GitHub synchronization.

The core application runs without a dedicated backend. recipes.json provides the initial recipe collection when no local data or configured GitHub source is available.

⸻

🛠️ Core Modules

1. 🟩 Recipe Book

The recipe book is the foundation of the application and stores structured recipe data.

* Create, edit, delete, filter, and bulk-edit recipes.
* Store ingredients, quantities, units, allergens, classifications, demand, and cooking techniques.
* Preserve recipe identifiers during editing.
* Mark recipes independently as Precocinado and/or Plato elaborado.
* Run recipe-health diagnostics for incomplete tags, duplicate IDs, and missing quantities.
* Maintain a local recipe change history.
* Synchronize recipes with a configured GitHub repository.

⸻

2. 📅 Menu Planning Engine

GastroOS uses a constraint-based generation and validation engine.

The workflow is:

Recipe Collection
       ↓
Eligible Candidates
       ↓
Constraint Processing
       ↓
Full Menu Validation
       ↓
Valid Weekly Menu

The engine provides:

* Automatic weekly menu generation.
* Randomized candidate selection for greater variety.
* Full-menu validation before acceptance.
* Individual day regeneration and manual replacement.
* Historical-menu rotation to reduce repetitions.
* Retry-based generation when a combination is invalid.
* Duplicate-menu protection when saving history.
* Compatibility checks between dishes and menu slots.

Planning rules

The generator enforces the application’s hard planning constraints, including:

* Exactly 3 meat guisos per week.
* Guiso required on Monday, Wednesday, and Friday.
* No guiso on Tuesday or Thursday.
* Weekly and daily limits for cooking techniques.
* Fish-species rotation.
* Meat-animal compatibility within the same day.
* Restrictions on repeated preparation families.
* Protection against excessive consecutive repetition.
* Weekly repetition control using saved menu history.

demanda does not influence dish selection or menu priority. It is used later for production/purchase quantity calculations.

The current planning engine is:

menu-rules-v10-constraint-retry

⸻

3. 🍽️ Prepared Dishes

Recipes can be independently marked as Plato elaborado.

Being marked as a prepared dish does not automatically activate it in menu generation.

Recipe marked as Plato elaborado
              ↓
     Added to Prepared Stock
              ↓
       Available to Engine

Prepared dishes behave as follows:

* A prepared recipe outside stock is excluded from automatic generation.
* A prepared dish added to Platos elaborados en stock becomes available to the generator.
* Sin asignar allows the generator to place it wherever compatible.
* A specific day/slot assignment fixes the dish to that location while it remains in stock.
* Removing the dish from prepared stock removes its fixed assignment and its generator availability.
* Prepared dishes continue to participate in the same weekly planning constraints as other dishes.
* Manually assigned prepared dishes are validated against the complete weekly menu.

⸻

4. 🛒 Shopping & Production

The shopping system converts the generated menu into categorized ingredient requirements.

It supports:

* Automatic shopping-list generation.
* Ingredient grouping and aggregation.
* Supplier/category organization.
* Stock deduction and availability.
* Manually specified quantities.
* Ingredients without quantities remaining visible but excluded from numeric calculation.

demanda is applied here for quantity estimation and not during menu generation.

⸻

5. 📦 Stock Control

GastroOS separates stock into raw ingredients and prepared dishes.

Raw Stock

The ingredient selector is populated automatically from the recipe collection and only includes main ingredients belonging to Segundo recipes whose supplier category is:

* Carne
* Pescado

Duplicate normalized names are removed while preserving meaningful ingredient/cut differences.

Stock quantities use larger operational units such as kg and L.

Prepared Stock

Prepared stock contains only recipes marked as Plato elaborado.

Each entry can optionally have a menu assignment:

* Sin asignar
* Specific compatible day/slot

Stock availability and assignments are taken into account by the planning engine.

Stock serving estimates are displayed in the simplified format:

≈ X raciones aprox.

The estimate uses recipe information when a suitable reference exists and falls back to an approximate recipe-based calculation when necessary.

⸻

6. 🔄 History & Menu Rotation

Saved weekly menus are stored locally and used as historical references for future generation.

Only explicitly saved menus become part of the planning history. An unsaved generated menu does not affect future rotation.

This prevents the generator from repeatedly reproducing recent saved combinations while still allowing valid recipes to be reused when appropriate.

⸻

7. 💾 Persistence & Backup

GastroOS uses browser LocalStorage for local persistence.

Available operations include:

* Full JSON export.
* Recipe-only export.
* Automatic backup snapshots.
* Download of the latest automatic backup.
* Import and restore with preview.
* Safe loading of stored data.
* Destructive-operation recovery through local backups.

The application can therefore operate without a dedicated database or backend.

⸻

8. ☁️ GitHub Integration

GastroOS can synchronize the recipe collection with a configured GitHub repository.

The settings interface supports:

* Repository configuration.
* Fine-grained personal access token.
* Recipe-file path configuration.
* Upload/update of recipe data.
* Download/update from GitHub.
* Synchronization status.

Authentication credentials must be treated as sensitive information and should never be committed to the repository.

⸻

9. 📡 PWA & Offline Support

GastroOS uses:

* manifest.json for PWA installation.
* sw.js for Service Worker caching.
* Local browser persistence for application data.

The Service Worker caches the application shell, recipe data, manifest, and icon assets and provides cached fallback for same-origin resources.

External services such as the GitHub API and CDN resources are not cached.

Because styling depends on the external Tailwind CDN, offline mode should be understood as an offline fallback, not guaranteed fully self-contained rendering.

⸻

🧩 Application Structure

GastroOS/
├── index.html
├── recipes.json
├── manifest.json
├── sw.js
├── favicon-32.png
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
└── README.md

index.html

Contains the main application interface, styling, recipe management, planning engine, stock control, shopping calculations, persistence, diagnostics, backup/restore, and GitHub integration.

recipes.json

Contains the recipe collection and acts as the initial recipe seed when no local or GitHub recipe collection is available.

manifest.json

Contains the Progressive Web App configuration and application metadata.

sw.js

Contains the Service Worker responsible for application-shell caching and offline fallback.

Icons

favicon-32.png
apple-touch-icon.png
icon-192.png
icon-512.png

⸻

⚙️ Planning Workflow

Automatic generation:

Recipe Collection
       ↓
Filter Eligible Recipes
       │
       ├── Plato elaborado + not in stock → excluded
       │
       └── Eligible recipes
                 ↓
        Randomized Candidates
                 ↓
        Hard Constraints
                 ↓
        Full Validation
                 ↓
             Valid Menu

Prepared stock:

Plato elaborado
       ↓
Prepared Stock
       ↓
Sin asignar / Fixed Assignment
       ↓
Compatible Menu Slot
       ↓
Full Menu Validation

Manual changes and individual day regeneration use the same validation system as complete menu generation.

Menu exports always refer to the following Monday–Friday period relative to the export date.

⸻

🎨 Design Philosophy

GastroOS follows an Apple-inspired minimalist interface focused on:

* Clear visual hierarchy.
* Compact information density.
* Consistent controls.
* Responsive layouts.
* Minimal visual clutter.
* Unified recipe, planning, stock, and shopping workflows.

⸻

🚀 Deployment

GastroOS can be deployed as a static application through GitHub Pages.

Source Files
     ↓
Git Repository
     ↓
GitHub Pages
     ↓
Published PWA

No dedicated backend is required for the core application.

For Service Workers, the application must run over HTTPS or in a supported local development environment.

⸻

🔐 Security

GitHub tokens and other credentials are sensitive.

They should never be:

* Committed to the repository.
* Embedded in public source code.
* Published in the README.
* Shared through screenshots or documentation.

Use a least-privilege fine-grained GitHub token limited to the required repository and permissions.

Because authentication is client-side, a token stored in browser LocalStorage remains accessible to JavaScript running on the same origin. Only trusted code should therefore be deployed to that origin.

⸻

📌 Project Summary

GastroOS combines:

Recipe Management · Menu Planning · Prepared Dishes · Stock Control · Shopping Lists · History · Diagnostics · Backup/Restore · GitHub Synchronization

in a single client-side Progressive Web App.

Recipes can be independently classified as Precocinado and Plato elaborado, while the planning engine applies the same weekly constraints to automatically generated and manually assigned dishes.

Its goal is to automate repetitive weekly planning while keeping recipe management, stock, production, and menu decisions transparent and manually controllable.