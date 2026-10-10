# 📖 GastroOS

**A client-side Progressive Web App for recipe management, menu planning, stock control, shopping, and day-to-day kitchen rules.**

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-PWA-000000?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Storage-localStorage%20%2B%20GitHub%20API-24292e?style=flat-square&logo=github&logoColor=white" alt="Storage">
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JavaScript-000000?style=flat-square" alt="Frontend">
</p>

---

## 🧭 Overview

GastroOS is a lightweight, backend-free application designed for **a single self-service kitchen/autoservice**. It centralizes recipes, menu planning, stock, shopping, production references, kitchen rules, allergens, backups, diagnostics, and optional GitHub recipe synchronization.

**Recipes · Weekly Menu · Stock · Shopping · Kitchen Rules · Allergens · History · Backups · Diagnostics · GitHub Sync**

The application runs primarily in the browser, with local persistence, PWA installation, offline caching, and optional GitHub synchronization. It has no user-management or multi-tenant layer.

---

## 🛠️ Features

### 📚 Recipe Management

- Create, edit, delete, filter, and bulk-edit recipes.
- Manage ingredients, quantities, units, supplier categories, allergens, classifications, demand, and cooking techniques.
- Classify recipes as **Precooked** and/or **Prepared Dish**, with consistent rectangular badges, rounded corners, semantic colors, and typography across the catalog and menu generator.
- Maintain product-level allergen mappings that automatically apply to recipes using those products.
- Run recipe diagnostics and maintain local recipe history.

### 📅 Menu Planning

A **constraint-based engine** generates and validates Monday–Friday menus using a configurable self-service structure. The default offer is:

- **3 first courses:** 1 vegetable dish + 1 spoon dish (soup/stew/legumes) + 1 fork/carbohydrate dish.
- **3 main courses:** 2 meat dishes + 1 fish dish.

In the kitchen rules, **“Guiso” means “stew”**: selected stew days must contain exactly one stew among the two meat main courses. Monday, Wednesday, and Friday are selected by default, and these days can be changed in Settings.

Both course groups are configurable without changing the code. For example, a kitchen can offer 2 spoon dishes + 1 fork dish, or 1 meat dish + 2 fish dishes.

The engine supports randomized generation, intelligent day alternatives, manual dish replacement, prepared-dish assignments, stock awareness, meat/fish allow-lists, configurable weekly limits and repetition controls, consecutive-day rules by first-course subfamily, and menu validation.

**Current engine:** `menu-rules-v11-stock-prepared-guiso-rations` (with configurable offer structure and weekly-family repetition rules)

### 🍽️ Prepared Dishes & Precooked Products

GastroOS keeps these classifications separate in stock:

- **Prepared Dish** recipes are managed in **Prepared Dishes Stock** and can be assigned to compatible menu slots.
- **Precooked** products belong in **Raw Materials Stock**, not Prepared Dishes Stock. They are available from the raw-stock product selector.

**Prepared Dish → Prepared Dishes Stock → Assignment → Menu Validation**

The generated menu visibly marks both **Prepared Dish** and **Precooked** when those properties apply.

### 🛒 Stock & Shopping

Separate management of raw ingredients and precooked products versus prepared dishes, including:

- Automatic shopping-list generation and ingredient aggregation by supplier category.
- Clear **Required / Stock / Buy** columns.
- Temporary **Stock** marks for products physically available but not registered in stock. The item remains visible in the current list, its purchase quantity is excluded, and it is omitted from TXT export.
- Demand-based quantity calculations and purchase adjustment percentage.
- Prepared-dish planning assignments.
- Precooked products in Raw Materials Stock, separately from Prepared Dishes Stock.
- Safe migration of legacy precooked records: physical quantities with units can be migrated, while records containing only prepared portions are retained for manual review.
- TXT export for the weekly menu and shopping list.

### 🧮 Kitchen Rules & Forecast

The local kitchen profile configures generator behavior without introducing users or roles. It includes:

- Guiso days and allowed meat animals and fish species.
- Editable meat and fish catalogs.
- Weekly limits for fried/reboiled dishes, creams, pasta, legumes, rice, whole vegetables, and soups/broths.
- Configurable number and composition of first and second courses.
- Consecutive-day rules for pasta, legumes, rice, and soups/broths. Pasta distinguishes dry and filled pasta for consecutive-day rules while sharing one weekly pasta limit.
- Stock priority, prepared-food availability, and menu variety rules.
- Estimated diners and safety margin for portion references and shopping calculations.
- Preventive diagnostics for configurations that may make a complete week impossible.

### 🐟 Editable Protein Catalog

Fish species and meat types are not limited to values hard-coded in the application.

From **Settings → Proteins**, users can add meat or fish entries directly. Custom entries are integrated into recipe creation and editing, allowed-protein settings, generator filtering, menu summaries, weekly configuration diagnostics, normalization, migration, backups, and restoration.

The local installation remains functional without GitHub. When the existing GitHub connection is configured, custom proteins can also be synchronized through the shared `recipes.json` catalog metadata.

`recipes.json` therefore contains both the recipe collection and shared protein catalog metadata while remaining compatible with GastroOS's recipe parser.

### 🧾 Allergens by Product

Allergens can be assigned once per ingredient/product from a dedicated management window. GastroOS combines product-level allergens with recipe-level allergens so ingredient information is applied automatically to the relevant recipes.

### 💾 Persistence & Backup

Browser `localStorage` provides local persistence and supports:

- Full JSON export/import.
- Recipe-only export, including the editable protein catalog.
- Automatic backups, restore, and recovery.
- Saved menu history.
- Product allergen mappings and custom meat/fish catalog entries.

### ☁️ GitHub Integration

Optional synchronization of the recipe collection with a configured GitHub repository.

**Security note:** the personal access token is stored in this browser's `localStorage` so synchronization can persist across sessions. Use a fine-grained token restricted to this repository with only the required Contents permissions, do not share the browser profile, and revoke the token if the device or browser profile may have been exposed. The token is not written into the project files.

Supports repository configuration, recipe upload/download, bulk recipe synchronization, synchronization status, and shared protein-catalog metadata in `recipes.json`.

GitHub synchronization is optional: the core application does not require a backend or GitHub account.

### 📡 PWA & Offline

- Installable Progressive Web App.
- Versioned Service Worker caching.
- Network-first updates with offline fallback for cached same-origin resources.
- **Offline limitation:** the HTML still loads Tailwind's runtime from `cdn.tailwindcss.com`. The Service Worker caches same-origin app files, but does not cache that external runtime. Therefore, offline opening and full visual fidelity are not guaranteed. Reliable offline operation requires bundling Tailwind locally and testing the complete offline flow in a real browser.
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

The application keeps generator logic in the main client runtime while using small facades for storage, GitHub, and engine integration. `menu-engine-facade.js` is an integration layer; it does not duplicate the generator.

---

## 🎨 Design

GastroOS follows a restrained, Apple-inspired design focused on:

**Clarity · Information Hierarchy · Consistency · Responsiveness · Minimal Visual Clutter**

Advanced configuration is kept inside accordions, while compact, cohesive modals support tasks such as intelligent day alternatives and product allergen management.

---

## 🚀 Deployment

GastroOS can be deployed as a static application through **GitHub Pages**.

**Repository → GitHub Pages → PWA**

No backend is required for the core application. If a shared recipe repository is configured, the existing GitHub connection can also synchronize recipe changes and editable protein catalog metadata.

---

## 🔐 Security

GitHub tokens are sensitive credentials.

Use a **fine-grained token** with the minimum required permissions. Never commit credentials to the repository or expose them in documentation.

Because authentication is client-side, credentials stored in `localStorage` are accessible to JavaScript running on the same origin. **Only trusted code should therefore be deployed to that origin.**

---

## 🎯 Project Goal

GastroOS aims to automate repetitive weekly kitchen planning **without hiding the logic behind it**.

It combines structured recipes, configurable kitchen rules, editable protein catalogs, stock awareness, production calculations, allergen mapping, shopping control, and local persistence while keeping final decisions under user control.
