# 📖 GastroOS

**A client-side Progressive Web App for recipe management, menu planning, stock control, shopping, and day-to-day kitchen rules.**

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-PWA-000000?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Storage-localStorage%20%2B%20GitHub%20API-24292e?style=flat-square&logo=github&logoColor=white" alt="Storage">
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JavaScript-000000?style=flat-square" alt="Frontend">
</p>

---

## 🧭 Overview

GastroOS is a lightweight, backend-free application designed for **one concrete self-service kitchen/autoservice**. It centralizes recipes, menu planning, stock, shopping, production references, kitchen rules, allergens, backups, diagnostics, and optional GitHub recipe synchronization.

**Recipes · Weekly Menu · Stock · Shopping · Kitchen Rules · Allergens · History · Backups · Diagnostics · GitHub Sync**

The application runs primarily in the browser, with **local persistence, PWA installation, offline caching, and optional GitHub synchronization**. There is no user-management or multi-tenant layer.

---

## 🛠️ Features

### 📚 Recipe Management

- Create, edit, delete, filter, and bulk-edit recipes.
- Manage ingredients, quantities, units, supplier categories, allergens, classifications, demand, and cooking techniques.
- Classify recipes as **Precooked** and/or **Prepared Dish**. These status tags share the same rectangular shape, rounded corners, semantic colors, and typography across the recipe catalog and menu generator; they are smaller in the catalog and slightly larger in the menu generator.
- Product-level allergen mapping can be maintained separately; mapped allergens are automatically applied to recipes that use those products.
- Run recipe diagnostics and maintain local recipe history.

### 📅 Menu Planning

A **constraint-based engine** generates and validates Monday–Friday menus using a configurable self-service structure. The default offer is:

- **3 first courses:** 1 vegetable dish + 1 spoon dish (soup/stew/legumes) + 1 fork/carbohydrate dish.
- **3 main courses:** 2 meat dishes + 1 fish dish.

In the kitchen rules, **“Guiso” means “stew”**: selected stew days must contain exactly one stew among the two meat main courses. The default configuration selects Monday, Wednesday, and Friday; these days can be changed in Settings.

Both groups are configurable from Settings: a kitchen can, for example, offer 2 platos de cuchara + 1 tenedor, or 1 carne + 2 pescados, without changing the code.

The engine supports randomized generation, intelligent day alternatives, manual dish replacement, prepared-dish assignments, stock awareness, fish/meat allow-lists, guiso days, configurable weekly limits and repetition controls, consecutive-day rules by first-course subfamily, and menu validation.

**Current engine:** `menu-rules-v11-stock-prepared-guiso-rations` (with configurable offer structure and weekly-family repetition rules)

### 🍽️ Prepared Dishes & Precooked Products

GastroOS keeps these two recipe classifications separate in stock:

- **Prepared Dish** recipes are managed in **Prepared Dishes Stock** and can be assigned to compatible menu slots.
- **Precooked** products belong in **Raw Materials Stock** (the raw-stock area), not in Prepared Dishes Stock. They are available from the raw-stock product selector.

**Prepared Dish → Prepared Dishes Stock → Assignment → Menu Validation**

The generated menu visibly marks both **Prepared Dish** and **Precooked** when those recipe properties apply.

### 🛒 Stock & Shopping

Separate management of **raw ingredients and precooked products** versus **prepared dishes**, including:

- Automatic shopping-list generation.
- Ingredient aggregation by supplier category.
- Clear **Required / Stock / Buy** columns.
- Temporary **Stock** marks for products that are physically available but are not registered in stock. The mark remains visible in the current shopping list, does not modify real stock, and excludes the product from the TXT export.
- Demand-based quantity calculations.
- Purchase adjustment percentage.
- Prepared-dish planning assignments.
- Precooked products listed in Raw Materials Stock, separately from Prepared Dishes Stock.
- Legacy precooked records are migrated only when a physical quantity and unit are available. Records containing only a number of prepared portions are retained for manual review rather than being incorrectly converted into kilograms, litres, or product units.
- TXT export for both the weekly menu and the shopping list.

### 🧮 Kitchen Rules & Forecast

The local kitchen profile controls how the generator should behave without introducing users or roles. It includes:

- Guiso days.
- Allowed meat animals and fish species.
- Editable meat and fish catalogs directly from the application.
- Weekly limits for fried/reboiled dishes, creams, pasta, legumes, rice, whole vegetables, and soups/broths.
- Configurable number and composition of first and second courses.
- Consecutive-day switches for pasta, legumes, rice, and soups/broths. Pasta distinguishes dry pasta and filled pasta for consecutive-day rules while keeping a single weekly pasta limit.
- Stock priority and prepared-food availability.
- Menu variety rules.
- Estimated diners and safety margin for reference portions and shopping calculations.
- Preventive diagnostics for configurations that may make a complete week impossible.

### 🐟 Editable Protein Catalog

Fish species and meat types are no longer limited to the values hard-coded in the application.

From **Settings → Proteins**, a new fish or meat can be added directly. The new entry becomes available in:

- Recipe creation and editing.
- Allowed-protein settings.
- Generator filtering.
- Protein labels and menu summaries.
- Weekly configuration diagnostics.
- Recipe normalization and migration.
- Backups and restoration.

The local installation remains functional without GitHub. When the existing GitHub connection is configured, adding a custom protein also updates the shared `recipes.json` catalog metadata so the new protein can be distributed to other installations using that shared repository.

`recipes.json` therefore contains both the recipe collection and the shared protein catalog metadata while remaining compatible with GastroOS's recipe parser.

### 🧾 Allergens by Product

Allergens can be assigned once per ingredient/product from a dedicated management window. GastroOS combines those product allergens with recipe-level allergens so the information follows the ingredient into the recipe automatically.

### 💾 Persistence & Backup

Browser `localStorage` provides local persistence and supports:

- Full JSON export/import.
- Recipe-only export, including the editable protein catalog.
- Automatic backups.
- Restore and recovery.
- Saved menu history.
- Product allergen mappings.
- Custom meat/fish catalog entries.

### ☁️ GitHub Integration

Optional synchronization of the recipe collection with a configured GitHub repository.

**Security note:** the personal access token is stored in this browser's `localStorage` so synchronization can persist across sessions. Use a fine-grained token restricted to this repository with only the required Contents permissions, do not share the browser profile, and revoke the token if the device or browser profile may have been exposed. The token is not written into the project files.

Supports repository configuration, recipe upload/download, bulk recipe synchronization, synchronization status, and shared protein-catalog metadata in `recipes.json`.

GitHub synchronization is optional: the core application does not require a backend or GitHub account.

### 📡 PWA & Offline

- Installable Progressive Web App.
- Versioned Service Worker caching.
- Network-first updates with offline fallback for cached same-origin resources.
- **Offline limitation:** the HTML still loads Tailwind's runtime from `cdn.tailwindcss.com`. The Service Worker caches same-origin app files, but does not cache that external runtime. Therefore, offline opening and full visual fidelity are not guaranteed. To claim reliable offline operation, Tailwind must be bundled locally and the complete offline flow tested in a real browser.
- No dedicated backend required for the core application.

---

## 🧩 Architecture

GastroOS is intentionally lightweight and can run entirely as a static application.

```text
GastroOS/
├── index.html
├── recipes.json
├── manifest.json
├── sw.js
├── css/
│   └── gastroos.css
├── js/
│   ├── gastroos.js
│   ├── kitchen-rules.js
│   ├── menu-engine-facade.js
│   ├── github-facade.js
│   └── data-store-facade.js
├── favicon-32.png
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
└── README.md
```

**Stack:** HTML5 · CSS · JavaScript · PWA · Web Storage · GitHub API

The application deliberately keeps the generator logic in the main client runtime while using small facades for storage, GitHub, and engine integration. `menu-engine-facade.js` is an integration layer; it does not duplicate the generator.

---

## 🎨 Design

GastroOS follows a restrained, Apple-inspired design focused on:

**Clarity · Information Hierarchy · Consistency · Responsiveness · Minimal Visual Clutter**

The interface keeps advanced configuration inside accordions and uses compact, cohesive modals for tasks such as intelligent day alternatives and product allergen management.

---

## 🚀 Deployment

GastroOS can be deployed as a static application through **GitHub Pages**.

**Repository → GitHub Pages → PWA**

No backend is required for the core application.

If a shared recipe repository is configured, the existing GitHub connection can also synchronize recipe changes and the editable protein catalog metadata.

---

## 🔐 Security

GitHub tokens are sensitive credentials.

Use a **fine-grained token** with the minimum required permissions. Never commit credentials to the repository or expose them in documentation.

Because authentication is client-side, credentials stored in `localStorage` are accessible to JavaScript running on the same origin. **Only trusted code should therefore be deployed to that origin.**

---

## 🎯 Project Goal

GastroOS aims to automate repetitive weekly kitchen planning **without hiding the logic behind it**.

It combines structured recipes, configurable kitchen rules, editable protein catalogs, stock awareness, production calculations, allergen mapping, shopping control, and local persistence while keeping final decisions under user control.