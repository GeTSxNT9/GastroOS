/*
 * GastroOS — Perfil de cocina / autoservicio.
 *
 * Una instalación de GastroOS representa una cocina concreta.
 * No hay usuarios, roles ni cuentas dentro de este perfil.
 */
(function () {
    const VERSION = 3;
    const DAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    const FISH_SPECIES = Object.freeze(['trucha','caella','bacalao','merluza','calamares','bacaladilla','panga','atun','perca','chicharro','cabracho','tintorera']);
    const MEAT_ANIMALS = Object.freeze(['carne_pollo','carne_pavo','carne_cerdo','carne_ternera','carne_conejo','carne_cordero']);

    const DEFAULT_RULES = Object.freeze({
        version: VERSION,
        nombre: 'Autoservicio',
        guisoDays: Object.freeze([0, 2, 4]),
        maxWeeklyFritos: 2,
        maxWeeklyCreams: 2,
        maxWeeklyPasta: 2,
        maxWeeklyLegumes: 2,
        maxWeeklyRice: 2,
        maxWeeklyVegetableWhole: 3,
        maxWeeklySoups: 2,
        ajusteCompraPorcentaje: 80,
        especiesPescadoPermitidas: Object.freeze([...FISH_SPECIES]),
        animalesCarnePermitidos: Object.freeze([...MEAT_ANIMALS]),
        prioridadStock: 'alta',
        permitirPrecocinados: true,
        permitirPlatosElaboradosSinStock: false,
        evitarLiquidosEnPrimeros: true,
        evitarRepeticionPrimeroConsecutivo: true,
        evitarVerduraRepetida: true,
        evitarPresentacionSegundoRepetida: true
    });

    function clampInt(value, min, max, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    }

    function normalizeList(value) {
        if (Array.isArray(value)) return [...new Set(value.map(v => String(v ?? '').trim()).filter(Boolean))];
        return String(value ?? '').split(/[,\n;]/).map(v => v.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    }

    function normalize(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        const rawDays = Array.isArray(source.guisoDays) ? source.guisoDays : DEFAULT_RULES.guisoDays;
        const guisoDays = [...new Set(rawDays.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < DAYS.length))].sort((a,b) => a-b);

        const isLegacyProfile = source.version !== VERSION;
        const rawFish = normalizeList(source.especiesPescadoPermitidas).map(v => v.toLowerCase()).filter(v => FISH_SPECIES.includes(v));
        const rawAnimals = normalizeList(source.animalesCarnePermitidos).map(v => v.toLowerCase()).filter(v => MEAT_ANIMALS.includes(v));
        const previousFish = ['trucha','caella','bacalao','merluza','calamares','bacaladilla','panga','atun','perca','chicharro'];
        if (source.version === 2 && previousFish.every(v => rawFish.includes(v))) {
            ['cabracho','tintorera'].forEach(v => { if (!rawFish.includes(v)) rawFish.push(v); });
        }
        const fish = isLegacyProfile && rawFish.length === 0 ? [...FISH_SPECIES] : rawFish;
        const animals = isLegacyProfile && rawAnimals.length === 0 ? [...MEAT_ANIMALS] : rawAnimals;

        let prioridadStock = String(source.prioridadStock || '').toLowerCase();
        if (!['alta', 'normal', 'ninguna'].includes(prioridadStock)) {
            prioridadStock = source.priorizarStock === false ? 'ninguna' : DEFAULT_RULES.prioridadStock;
        }

        return {
            version: VERSION,
            nombre: String(source.nombre ?? DEFAULT_RULES.nombre).trim() || DEFAULT_RULES.nombre,
            guisoDays,
            maxWeeklyFritos: clampInt(source.maxWeeklyFritos, 0, 10, DEFAULT_RULES.maxWeeklyFritos),
            maxWeeklyCreams: clampInt(source.maxWeeklyCreams, 0, 5, DEFAULT_RULES.maxWeeklyCreams),
            maxWeeklyPasta: clampInt(source.maxWeeklyPasta, 0, 5, DEFAULT_RULES.maxWeeklyPasta),
            maxWeeklyLegumes: clampInt(source.maxWeeklyLegumes, 0, 5, DEFAULT_RULES.maxWeeklyLegumes),
            maxWeeklyRice: clampInt(source.maxWeeklyRice, 0, 5, DEFAULT_RULES.maxWeeklyRice),
            maxWeeklyVegetableWhole: clampInt(source.maxWeeklyVegetableWhole, 0, 5, DEFAULT_RULES.maxWeeklyVegetableWhole),
            maxWeeklySoups: clampInt(source.maxWeeklySoups, 0, 5, DEFAULT_RULES.maxWeeklySoups),
            ajusteCompraPorcentaje: clampInt(source.ajusteCompraPorcentaje, 1, 150, DEFAULT_RULES.ajusteCompraPorcentaje),
            especiesPescadoPermitidas: fish,
            animalesCarnePermitidos: animals,
            prioridadStock,
            permitirPrecocinados: source.permitirPrecocinados !== false,
            permitirPlatosElaboradosSinStock: source.permitirPlatosElaboradosSinStock === true,
            evitarLiquidosEnPrimeros: source.evitarLiquidosEnPrimeros !== false,
            evitarRepeticionPrimeroConsecutivo: source.evitarRepeticionPrimeroConsecutivo !== false,
            evitarVerduraRepetida: source.evitarVerduraRepetida !== false,
            evitarPresentacionSegundoRepetida: source.evitarPresentacionSegundoRepetida !== false
        };
    }

    function getGuisoDays(value) { return new Set(normalize(value).guisoDays); }
    function normalizeDishName(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
    function isFishAllowed(dish, value) {
        const rules = normalize(value);
        if (dish?.proteina_segundo !== 'Pescado') return true;
        return rules.especiesPescadoPermitidas.includes(String(dish?.especie_pescado || '').toLowerCase());
    }
    function isMeatAnimalAllowed(dish, value) {
        const rules = normalize(value);
        if (dish?.proteina_segundo !== 'Carne') return true;
        return rules.animalesCarnePermitidos.includes(String(dish?.animal_carne || '').toLowerCase());
    }

    window.GastroOSKitchenRules = Object.freeze({
        VERSION, DEFAULT_RULES, DAYS, FISH_SPECIES, MEAT_ANIMALS,
        normalize, getGuisoDays, normalizeDishName, isFishAllowed, isMeatAnimalAllowed
    });
})();
