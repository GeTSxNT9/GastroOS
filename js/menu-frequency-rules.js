/* GastroOS — validación pura de límites de frecuencia semanales. */
(function (root) {
    'use strict';

    function validateWeeklyLimits(metrics = {}, limits = {}) {
        const errors = [];
        const checks = [
            ['fritos', 'maxFritos', 'fritos o rebozados', 'máximo'],
            ['creams', 'maxCreams', 'días de crema', 'máximo'],
            ['pasta', 'maxPasta', 'días de pasta', 'máximo'],
            ['legumes', 'maxLegumes', 'días de legumbres', 'máximo'],
            ['rice', 'maxRice', 'días de arroz', 'máximo'],
            ['vegetableWhole', 'maxVegetableWhole', 'días de verdura entera', 'máximo'],
            ['soups', 'maxSoups', 'días de sopa o caldo', 'máximo']
        ];
        for (const [metricKey, limitKey, label] of checks) {
            const value = Number(metrics[metricKey]);
            const limit = Number(limits[limitKey]);
            if (Number.isFinite(value) && Number.isFinite(limit) && value > limit) {
                errors.push(`Semana: hay ${value} ${label}; el máximo es ${limit}.`);
            }
        }
        const guisos = Number(metrics.guisos);
        const expectedGuisos = Number(limits.guisos);
        if (Number.isFinite(guisos) && Number.isFinite(expectedGuisos) && guisos !== expectedGuisos) {
            errors.push(`Semana: debe haber exactamente ${expectedGuisos} guisos; hay ${guisos}.`);
        }
        return { valid: errors.length === 0, errors };
    }

    const api = Object.freeze({ validateWeeklyLimits });
    root.GastroOSMenuFrequencyRules = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
