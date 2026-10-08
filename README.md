# 📖 GastroOS

**A client-side Progressive Web App for recipe management, menu planning, stock control, shopping, and day-to-day kitchen rules.**

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-PWA-000000?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Storage-localStorage%20%2B%20GitHub%20API-24292e?style=flat-square&logo=github&logoColor=white" alt="Storage">
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JavaScript-000000?style=flat-square" alt="Frontend">
</p>

---

## 🧭 Overview

GastroOS is a lightweight, backend-free application designed for **one concrete self-service kitchen/autoservice**. It centralizes recipes, menu planning, stock, shopping, production references, kitchen rules, backups, diagnostics, and optional GitHub recipe synchronization.

**Recipes · Weekly Menu · Stock · Shopping · Kitchen Rules · Allergens · History · Backups · Diagnostics · GitHub Sync**

The application runs primarily in the browser, with **local persistence, PWA installation, offline caching, and optional GitHub synchronization**. There is no user-management or multi-tenant layer.

---

## 🛠️ Features

### 📚 Recipe Management

- Create, edit, delete, filter, and bulk-edit recipes.
- Manage ingredients, quantities, units, supplier categories, allergens, classifications, demand, and cooking techniques.
- Classify recipes as **Precooked** and/or **Prepared Dish**.
- Product-level allergen mapping can be maintained separately; mapped allergens are automatically applied to recipes that use those products.
- Run recipe diagnostics and maintain local recipe history.

### 📅 Menu Planning

A **constraint-based engine** generates and validates Monday–Friday menus using a configurable self-service structure. The default offer is:

- 3 primeros: 1 verdura + 1 cuchara + 1 tenedor/hidrato.
- 3 segundos: 2 carnes + 1 pescado.

Both groups are configurable from Settings: a kitchen can, for example, offer 2 platos de cuchara + 1 tenedor, or 1 carne + 2 pescados, without changing the code.

The engine supports randomized generation, day regeneration, manual dish replacement, prepared-dish assignments, stock awareness, fish/meat allow-lists, guiso days, configurable weekly limits, consecutive-day rules by first-course subfamily, and menu validation.

**Current engine:** `menu-rules-v11-stock-prepared-guiso-rations` (with configurable offer structure and weekly-family repetition rules)

### 🍽️ Prepared Dishes

Prepared dishes can be managed independently through stock and incorporated into compatible menu slots.

**Prepared Dish → Prepared Stock → Assignment → Menu Validation**

### 🛒 Stock & Shopping

Separate management of **raw ingredients** and **prepared dishes**, including:

- Automatic shopping-list generation.
- Ingredient aggregation by supplier category.
- Clear **Required / Stock / Buy** columns.
- Stock deduction and availability.
- Temporary **Ya tengo** marks for products that are physically available but are not registered in stock; these marks affect only the current shopping list and are excluded from the TXT export. 
- Demand-based quantity calculations.
- Purchase adjustment percentage.
- Prepared-dish planning assignments.

### 🧮 Kitchen Rules & Forecast

The local kitchen profile controls how the generator should behave without introducing users or roles. It includes:

- Guiso days.
- Allowed meat animals and fish species.
- Weekly limits for fried/reboiled dishes, creams, pasta, legumes, rice, whole vegetables, and soups/broths.
- Configurable number and composition of first and second courses.
- Consecutive-day switches for pasta, legumes, rice, and soups/broths. Pasta distinguishes dry pasta and filled pasta for consecutive-day rules while keeping a single weekly pasta limit.
- Stock priority and prepared-food availability.
- Menu variety rules.
- Estimated diners and safety margin for reference portions and shopping calculations.

### 🧾 Allergens by Product

Allergens can be assigned once per ingredient/product from a dedicated management window. GastroOS combines those product allergens with recipe-level allergens so the information follows the ingredient into the recipe automatically.

### 💾 Persistence & Backup

Browser `localStorage` provides local persistence and supports:

- Full JSON export/import.
- Recipe-only export.
- Automatic backups.
- Restore and recovery.
- Saved menu history.
- Product allergen mappings.

### ☁️ GitHub Integration

Optional synchronization of the recipe collection with a configured GitHub repository.

Supports repository configuration, recipe upload/download, bulk recipe synchronization, and synchronization status.

### 📡 PWA & Offline

- Installable Progressive Web App.
- Versioned Service Worker caching.
- Network-first updates with offline fallback for cached resources.
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

The application deliberately keeps the generator logic in the main client runtime while using small facades for storage, GitHub, and engine integration.

---

## 🎨 Design

GastroOS follows a restrained, Apple-inspired design focused on:

**Clarity · Information Hierarchy · Consistency · Responsiveness · Minimal Visual Clutter**

The interface keeps advanced configuration inside accordions and prioritizes the information needed for the current task.

---

## 🚀 Deployment

GastroOS can be deployed as a static application through **GitHub Pages**.

**Repository → GitHub Pages → PWA**

No backend is required for the core application.

---

## 🔐 Security

GitHub tokens are sensitive credentials.

Use a **fine-grained token** with the minimum required permissions. Never commit credentials to the repository or expose them in documentation.

Because authentication is client-side, credentials stored in `localStorage` are accessible to JavaScript running on the same origin. **Only trusted code should therefore be deployed to that origin.**

---

## 🎯 Project Goal

GastroOS aims to automate repetitive weekly kitchen planning **without hiding the logic behind it**.

It combines structured recipes, configurable kitchen rules, stock awareness, production calculations, allergen mapping, and local persistence while keeping final decisions under user control.


### Regeneración inteligente y diagnóstico de configuración

La generación semanal incluye regeneración inteligente de un día: en lugar de sustituirlo a ciegas, GastroOS busca varias alternativas de día completo y solo ofrece opciones que mantienen las reglas activas. También comprueba configuraciones potencialmente imposibles antes de guardar los ajustes, especialmente por disponibilidad de especies de pescado, animales de carne y familias de primeros.
