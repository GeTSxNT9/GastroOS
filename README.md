# 📖 GastroOS

**A client-side Progressive Web App for recipe management, menu planning, stock control, shopping, and day-to-day kitchen rules.**

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-PWA-000000?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Storage-localStorage%20%2B%20GitHub%20API-24292e?style=flat-square&logo=github&logoColor=white" alt="Storage">
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JavaScript-000000?style=flat-square" alt="Frontend">
</p>

---

## 🧭 Overview

GastroOS is a lightweight, backend-free application designed for a single self-service kitchen. It centralizes recipes, menu planning, stock, shopping, kitchen rules, allergens, backups, diagnostics, and optional GitHub synchronization.

**Recipes · Weekly Menu · Stock · Shopping · Kitchen Rules · Allergens · History · Backups · Diagnostics · GitHub Sync**

Runs entirely in the browser with local persistence, PWA offline support, and no multi-tenant layer.

---

## 🛠️ Features

### 📚 Recipe Management

- Create, edit, delete, filter, and bulk-edit recipes with ingredients, units, supplier categories, allergens, and cooking techniques.
- Classify recipes as **Precooked** and/or **Prepared Dish** with standardized tag aesthetics.
- Product-level allergen mapping automatically syncs with recipes.
- Includes recipe diagnostics and local history tracking.

### 📅 Menu Planning

Constraint-based engine generating Monday–Friday menus for a configurable offer structure (default: 3 first courses + 3 main courses).

- **Guiso (stew) rules:** Specific days enforce exactly one stew among meat courses.
- Configurable offer composition without code changes.
- Features random generation, smart day alternatives, manual dish swaps, stock integration, repetition controls, and validation.

**Current engine:** `menu-rules-v11-stock-prepared-guiso-rations`

### 🍽️ Prepared Dishes & Precooked Products

Strict stock separation:

- **Prepared Dish:** Managed in Prepared Dishes Stock for direct menu assignment.
- **Precooked:** Managed in Raw Materials Stock.

Both properties are highlighted in generated menus.

### 🛒 Stock & Shopping

- Automatic shopping lists aggregated by supplier category with **Required / Stock / Buy** columns.
- Temporary stock markings exclude items from TXT export without affecting real stock.
- Supports demand calculations, purchase adjustments, and TXT export.

### 🧮 Kitchen Rules & Forecast

Local profile configuration controls:

- Guiso days, allowed meats/fish, and weekly category limits (pasta, legumes, rice, etc.).
- Diners estimation, safety margins, and preventive configuration diagnostics.

### 🐟 Editable Protein Catalog

Dynamically add custom meat and fish species via **Settings → Proteins**, updating creation forms, generator filters, summaries, and shared `recipes.json` metadata when synced.

### 🧾 Allergens by Product

Manage allergens per product and auto-propagate them to associated recipes.

### 💾 Persistence & Backup

Browser `localStorage` handles full/recipe-only JSON exports, automated backups, restoration, menu history, and custom catalog data.

### ☁️ GitHub Integration

Optional recipe sync via a fine-grained GitHub access token saved in `localStorage`. Core features remain fully operational without a GitHub account.

### 📡 PWA & Offline

Installable PWA with Service Worker caching and network-first strategy. *(Requires bundling Tailwind CSS locally for full offline styling).*

---

## 🧩 Architecture

Lightweight static structure:

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

**Stack:** HTML5 · CSS · JavaScript · PWA · Web Storage · GitHub API

---

## 🎨 Design

Apple-inspired interface focused on clarity, responsive design, and minimal visual clutter.

---

## 🚀 Deployment

Deploy as a static site via **GitHub Pages**.

---

## 🔐 Security

Client-side GitHub token storage in `localStorage`. Use fine-grained permissions and trust deployed origin code.

---

## 🎯 Project Goal

Automate kitchen planning while keeping structured rules, stock awareness, and final decisions under user control.
