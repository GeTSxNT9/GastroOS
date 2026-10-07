/*
 * GastroOS — Perfil de cocina / autoservicio.
 *
 * Configuración LOCAL de las normas que utiliza el generador.
 * No representa usuarios, cuentas ni permisos.
 */
(function () {
    const DEFAULT_RULES = Object.freeze({
        nombre: 'Autoservicio',
        guisoDays: Object.freeze([0, 2, 4]),
        maxWeeklyFritos: 2,
        maxWeeklyCreams: 2,
        margenCompraPorcentaje: 30
    });

    const DAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);

    function clampInt(value, min, max, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    }

    function normalize(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        const rawDays = Array.isArray(source.guisoDays) ? source.guisoDays : DEFAULT_RULES.guisoDays;
        const guisoDays = [...new Set(rawDays.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < DAYS.length))].sort((a,b) => a-b);
        return {
            nombre: String(source.nombre ?? DEFAULT_RULES.nombre).trim() || DEFAULT_RULES.nombre,
            guisoDays,
            maxWeeklyFritos: clampInt(source.maxWeeklyFritos, 0, 10, DEFAULT_RULES.maxWeeklyFritos),
            maxWeeklyCreams: clampInt(source.maxWeeklyCreams, 0, 10, DEFAULT_RULES.maxWeeklyCreams),
            margenCompraPorcentaje: clampInt(source.margenCompraPorcentaje, 0, 100, DEFAULT_RULES.margenCompraPorcentaje)
        };
    }

    function getGuisoDays(value) {
        return new Set(normalize(value).guisoDays);
    }

    window.GastroOSKitchenRules = Object.freeze({
        DEFAULT_RULES,
        DAYS,
        normalize,
        getGuisoDays
    });
})();
