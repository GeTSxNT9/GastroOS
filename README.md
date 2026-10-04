📖 GastroOS

A client-side Progressive Web App for recipe management, menu planning, stock control, and production workflows.

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-PWA-000000?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Storage-localStorage%20%2B%20GitHub%20API-24292e?style=flat-square&logo=github&logoColor=white" alt="Storage">
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JavaScript-000000?style=flat-square" alt="Frontend">
</p>

⸻

🧭 Overview

GastroOS is a lightweight, backend-free application designed to centralize kitchen operations in a single interface.

Recipes · Menu Planning · Prepared Dishes · Stock · Shopping · History · Backups · Diagnostics · GitHub Sync

The application runs primarily in the browser, with local persistence, PWA installation, offline caching, and optional GitHub synchronization.

⸻

🛠️ Features

📚 Recipe Management

* Create, edit, delete, filter, and bulk-edit recipes.
* Manage ingredients, quantities, units, allergens, classifications, and cooking techniques.
* Classify recipes as Precocinado and/or Plato elaborado.
* Run data diagnostics and maintain local recipe history.

📅 Menu Planning

A constraint-based engine generates and validates Monday–Friday menus.

Recipes → Eligible Candidates → Constraints → Validation → Weekly Menu

It supports randomized generation, menu rotation, day regeneration, manual replacements, prepared-dish assignments, and repetition control.

Current engine: menu-rules-v10-constraint-retry

🍽️ Prepared Dishes

Prepared dishes can be managed independently through stock and incorporated into compatible menu slots.

Plato elaborado → Prepared Stock → Assignment → Menu Validation

🛒 Stock & Shopping

Separate management of raw ingredients and prepared dishes, including:

* Automatic shopping-list generation.
* Ingredient aggregation.
* Supplier/category organization.
* Stock deduction and availability.
* Demand-based quantity calculations.
* Prepared-dish planning assignments.

💾 Persistence & Backup

Browser localStorage provides local persistence and supports:

* JSON export/import.
* Automatic backups.
* Restore and recovery.
* Saved menu history.

☁️ GitHub Integration

Optional synchronization of the recipe collection with a configured GitHub repository.

Supports repository configuration, recipe upload/download, and synchronization status.

📡 PWA & Offline

* Installable Progressive Web App.
* Service Worker caching.
* Offline fallback for cached application resources.
* No dedicated backend required.

⸻

🧩 Architecture

GastroOS is intentionally lightweight and can run entirely as a static application.

Component	Role
index.html	Application UI and core logic
recipes.json	Initial recipe collection
manifest.json	PWA configuration
sw.js	Service Worker and offline caching
localStorage	Local persistence and backups
GitHub API	Optional recipe synchronization

Stack: HTML5 · CSS · JavaScript · PWA · Web Storage · GitHub API

⸻

🎨 Design

GastroOS follows a restrained, Apple-inspired design focused on:

Clarity · Information Density · Consistency · Responsiveness · Minimal Visual Clutter

⸻

🚀 Deployment

GastroOS can be deployed as a static application through GitHub Pages.

Repository → GitHub Pages → PWA

No backend is required.

⸻

🔐 Security

GitHub tokens are sensitive credentials.

Use a fine-grained token with the minimum required permissions. Never commit credentials to the repository or expose them in documentation.

Because authentication is client-side, credentials stored in localStorage are accessible to JavaScript running on the same origin. Only trusted code should therefore be deployed.

⸻

🎯 Project Goal

GastroOS aims to automate repetitive weekly kitchen planning without hiding the logic behind it.

It combines structured recipes, constraint-based planning, stock awareness, production calculations, and local persistence while keeping final decisions under user control.