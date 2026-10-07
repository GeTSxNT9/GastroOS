/*
 * GastroOS — Fase 8
 * Fachada de la integración con GitHub.
 *
 * Esta capa no duplica la lógica de GitHub ni cambia su comportamiento.
 * Expone los puntos de integración existentes para poder separarlos
 * gradualmente en fases posteriores.
 */
(function () {
    const required = [
        'getGitHubSettings',
        'loadDishesFromGitHub',
        'saveGitHubSettings',
        'refreshDishesFromGitHub',
        'syncDishToGitHub',
        'syncImportedDishesToGitHub'
    ];

    const missing = required.filter(name => typeof window[name] !== 'function');

    if (missing.length) {
        console.error('GastroOS: no se pudo inicializar la fachada de GitHub. Faltan:', missing);
        return;
    }

    window.GastroOSGitHub = Object.freeze({
        getGitHubSettings: (...args) => window.getGitHubSettings(...args),
        loadDishesFromGitHub: (...args) => window.loadDishesFromGitHub(...args),
        saveGitHubSettings: (...args) => window.saveGitHubSettings(...args),
        refreshDishesFromGitHub: (...args) => window.refreshDishesFromGitHub(...args),
        syncDishToGitHub: (...args) => window.syncDishToGitHub(...args),
        syncImportedDishesToGitHub: (...args) => window.syncImportedDishesToGitHub(...args)
    });
})();
