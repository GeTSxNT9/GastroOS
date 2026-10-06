/*
 * GastroOS — Fase 5
 * Fachada del motor de generación de menús.
 *
 * IMPORTANTE: esta capa NO contiene una copia de la lógica del generador.
 * Expone las funciones que ya existen en gastroos.js bajo un único namespace,
 * para poder desacoplarlas gradualmente en fases posteriores sin duplicar
 * ni modificar el motor que ya funciona.
 */
(function () {
    const required = [
        'pickDishForSlot',
        'generateDayMenu',
        'buildWeeklyMenuCandidate',
        'generateWeeklyMenu',
        'regenerateSingleDay',
        'validateWeeklyMenu'
    ];

    const missing = required.filter(name => typeof window[name] !== 'function');

    if (missing.length) {
        console.error('GastroOS: no se pudo inicializar la fachada del motor. Faltan:', missing);
        return;
    }

    window.GastroOSMenuEngine = Object.freeze({
        pickDishForSlot: (...args) => window.pickDishForSlot(...args),
        generateDayMenu: (...args) => window.generateDayMenu(...args),
        buildWeeklyMenuCandidate: (...args) => window.buildWeeklyMenuCandidate(...args),
        generateWeeklyMenu: (...args) => window.generateWeeklyMenu(...args),
        regenerateSingleDay: (...args) => window.regenerateSingleDay(...args),
        validateWeeklyMenu: (...args) => window.validateWeeklyMenu(...args)
    });
})();
