/*
 * GastroOS — Perfil de cocina / autoservicio.
 *
 * Una instalación de GastroOS representa una cocina concreta.
 * No hay usuarios, roles ni cuentas dentro de este perfil.
 */
(function () {
    const VERSION = 4;
    const DAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    const FISH_SPECIES = Object.freeze(['trucha','caella','bacalao','merluza','calamares','bacaladilla','panga','atun','perca','chicharro','cabracho','tintorera']);
    const MEAT_ANIMALS = Object.freeze(['carne_pollo','carne_pavo','carne_cerdo','carne_ternera','carne_conejo','carne_cordero']);

    const DEFAULT_RULES = Object.freeze({
        version: VERSION,
        nombre: 'Autoservicio',
        guisoDays: Object.freeze([0, 2, 4]),
        maxWeeklyFritos: 2,
        maxWeeklyCreams: 2,
        maxWeeklyPasta: 3,
        maxWeeklyLegumes: 2,
        maxWeeklyRice: 2,
        maxWeeklyVegetableWhole: 3,
        maxWeeklySoups: 2,
        permitirPastaConsecutiva: false,
        permitirLegumbresConsecutivas: false,
        permitirArrozConsecutivo: false,
        permitirSopasConsecutivas: false,
        primerosVerdura: 1,
        primerosCuchara: 1,
        primerosTenedor: 1,
        segundosCarne: 2,
        segundosPescado: 1,
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
        const previousProfile = Number(source.version || 0);
        // La estructura anterior siempre generaba 1 verdura + 1 cuchara + 1 tenedor
        // y 2 carnes + 1 pescado. Se conserva esa configuración al migrar.
        const firstDefaults = previousProfile >= 4 ? {
            primerosVerdura: source.primerosVerdura,
            primerosCuchara: source.primerosCuchara,
            primerosTenedor: source.primerosTenedor
        } : {};
        const secondDefaults = previousProfile >= 4 ? {
            segundosCarne: source.segundosCarne,
            segundosPescado: source.segundosPescado
        } : {};
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

        const normalizedFirsts = {
            verdura: clampInt(firstDefaults.primerosVerdura, 0, 5, DEFAULT_RULES.primerosVerdura),
            cuchara: clampInt(firstDefaults.primerosCuchara, 0, 5, DEFAULT_RULES.primerosCuchara),
            tenedor: clampInt(firstDefaults.primerosTenedor, 0, 5, DEFAULT_RULES.primerosTenedor)
        };
        const normalizedSeconds = {
            carne: clampInt(secondDefaults.segundosCarne, 0, 5, DEFAULT_RULES.segundosCarne),
            pescado: clampInt(secondDefaults.segundosPescado, 0, 5, DEFAULT_RULES.segundosPescado)
        };
        if (normalizedFirsts.verdura + normalizedFirsts.cuchara + normalizedFirsts.tenedor < 1) normalizedFirsts.cuchara = 1;
        if (normalizedSeconds.carne + normalizedSeconds.pescado < 1) normalizedSeconds.carne = 1;

        return {
            version: VERSION,
            nombre: String(source.nombre ?? DEFAULT_RULES.nombre).trim() || DEFAULT_RULES.nombre,
            guisoDays,
            maxWeeklyFritos: clampInt(source.maxWeeklyFritos, 0, 10, DEFAULT_RULES.maxWeeklyFritos),
            maxWeeklyCreams: clampInt(source.maxWeeklyCreams, 0, 5, DEFAULT_RULES.maxWeeklyCreams),
            maxWeeklyPasta: clampInt(previousProfile >= 4 ? source.maxWeeklyPasta : DEFAULT_RULES.maxWeeklyPasta, 0, 5, DEFAULT_RULES.maxWeeklyPasta),
            maxWeeklyLegumes: clampInt(source.maxWeeklyLegumes, 0, 5, DEFAULT_RULES.maxWeeklyLegumes),
            maxWeeklyRice: clampInt(source.maxWeeklyRice, 0, 5, DEFAULT_RULES.maxWeeklyRice),
            maxWeeklyVegetableWhole: clampInt(source.maxWeeklyVegetableWhole, 0, 5, DEFAULT_RULES.maxWeeklyVegetableWhole),
            maxWeeklySoups: clampInt(source.maxWeeklySoups, 0, 5, DEFAULT_RULES.maxWeeklySoups),
            permitirPastaConsecutiva: previousProfile >= 4 ? source.permitirPastaConsecutiva === true : DEFAULT_RULES.permitirPastaConsecutiva,
            permitirLegumbresConsecutivas: previousProfile >= 4 ? source.permitirLegumbresConsecutivas === true : DEFAULT_RULES.permitirLegumbresConsecutivas,
            permitirArrozConsecutivo: previousProfile >= 4 ? source.permitirArrozConsecutivo === true : DEFAULT_RULES.permitirArrozConsecutivo,
            permitirSopasConsecutivas: previousProfile >= 4 ? source.permitirSopasConsecutivas === true : DEFAULT_RULES.permitirSopasConsecutivas,
            primerosVerdura: normalizedFirsts.verdura,
            primerosCuchara: normalizedFirsts.cuchara,
            primerosTenedor: normalizedFirsts.tenedor,
            segundosCarne: normalizedSeconds.carne,
            segundosPescado: normalizedSeconds.pescado,
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
