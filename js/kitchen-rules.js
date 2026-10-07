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
        margenCompraPorcentaje: 30,
        ajusteCompraPorcentaje: 80,
        pescadoObligatorio: true,
        especiesPescadoPermitidas: Object.freeze([]),
        animalesCarnePermitidos: Object.freeze([]),
        recetasProhibidas: Object.freeze([]),
        recetasPreferidas: Object.freeze([]),
        recetasObligatorias: Object.freeze([]),
        permitirPrecocinados: true,
        permitirPlatosElaboradosSinStock: false,
        priorizarStock: true,
        evitarLiquidosEnPrimeros: true,
        evitarRepeticionPrimeroConsecutivo: true,
        evitarVerduraRepetida: true,
        evitarPresentacionSegundoRepetida: true
    });

    const DAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    const FISH_SPECIES = Object.freeze(['trucha','caella','bacalao','merluza','calamares','bacaladilla','panga','atun','perca','chicharro']);
    const MEAT_ANIMALS = Object.freeze(['carne_pollo','carne_pavo','carne_cerdo','carne_ternera','carne_conejo','carne_cordero']);

    function clampInt(value, min, max, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    }

    function normalizeList(value) {
        if (Array.isArray(value)) return [...new Set(value.map(v => String(v ?? '').trim()).filter(Boolean))];
        return String(value ?? '').split(/[,\n;]/).map(v => v.trim()).filter(Boolean).filter((v,i,a) => a.indexOf(v) === i);
    }

    function normalizeNameList(value) {
        return normalizeList(value);
    }

    function normalize(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        const rawDays = Array.isArray(source.guisoDays) ? source.guisoDays : DEFAULT_RULES.guisoDays;
        const guisoDays = [...new Set(rawDays.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < DAYS.length))].sort((a,b) => a-b);
        const fish = normalizeList(source.especiesPescadoPermitidas).map(v => v.toLowerCase()).filter(v => FISH_SPECIES.includes(v));
        const animals = normalizeList(source.animalesCarnePermitidos).map(v => v.toLowerCase()).filter(v => MEAT_ANIMALS.includes(v));
        return {
            nombre: String(source.nombre ?? DEFAULT_RULES.nombre).trim() || DEFAULT_RULES.nombre,
            guisoDays,
            maxWeeklyFritos: clampInt(source.maxWeeklyFritos, 0, 10, DEFAULT_RULES.maxWeeklyFritos),
            maxWeeklyCreams: clampInt(source.maxWeeklyCreams, 0, 10, DEFAULT_RULES.maxWeeklyCreams),
            margenCompraPorcentaje: clampInt(source.margenCompraPorcentaje, 0, 100, DEFAULT_RULES.margenCompraPorcentaje),
            ajusteCompraPorcentaje: clampInt(source.ajusteCompraPorcentaje, 1, 150, DEFAULT_RULES.ajusteCompraPorcentaje),
            pescadoObligatorio: source.pescadoObligatorio !== false,
            especiesPescadoPermitidas: fish,
            animalesCarnePermitidos: animals,
            recetasProhibidas: normalizeNameList(source.recetasProhibidas),
            recetasPreferidas: normalizeNameList(source.recetasPreferidas),
            recetasObligatorias: normalizeNameList(source.recetasObligatorias),
            permitirPrecocinados: source.permitirPrecocinados !== false,
            permitirPlatosElaboradosSinStock: source.permitirPlatosElaboradosSinStock === true,
            priorizarStock: source.priorizarStock !== false,
            evitarLiquidosEnPrimeros: source.evitarLiquidosEnPrimeros !== false,
            evitarRepeticionPrimeroConsecutivo: source.evitarRepeticionPrimeroConsecutivo !== false,
            evitarVerduraRepetida: source.evitarVerduraRepetida !== false,
            evitarPresentacionSegundoRepetida: source.evitarPresentacionSegundoRepetida !== false
        };
    }

    function getGuisoDays(value) { return new Set(normalize(value).guisoDays); }
    function normalizeDishName(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
    function listContainsDish(dish, list) {
        const name = normalizeDishName(dish?.nombre);
        if (!name) return false;
        return normalizeList(list).map(normalizeDishName).some(item => item === name);
    }
    function isDishForbidden(dish, value) { return listContainsDish(dish, normalize(value).recetasProhibidas); }
    function isDishPreferred(dish, value) { return listContainsDish(dish, normalize(value).recetasPreferidas); }
    function isDishMandatory(dish, value) { return listContainsDish(dish, normalize(value).recetasObligatorias); }
    function isFishAllowed(dish, value) {
        const rules = normalize(value);
        if (dish?.proteina_segundo !== 'Pescado') return true;
        if (!rules.especiesPescadoPermitidas.length) return true;
        return rules.especiesPescadoPermitidas.includes(String(dish?.especie_pescado || '').toLowerCase());
    }
    function isMeatAnimalAllowed(dish, value) {
        const rules = normalize(value);
        if (dish?.proteina_segundo !== 'Carne') return true;
        if (!rules.animalesCarnePermitidos.length) return true;
        return rules.animalesCarnePermitidos.includes(String(dish?.animal_carne || '').toLowerCase());
    }

    window.GastroOSKitchenRules = Object.freeze({
        DEFAULT_RULES, DAYS, FISH_SPECIES, MEAT_ANIMALS, normalize, getGuisoDays,
        normalizeDishName, isDishForbidden, isDishPreferred, isDishMandatory, isFishAllowed, isMeatAnimalAllowed
    });
})();
