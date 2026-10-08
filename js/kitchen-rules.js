/*
 * GastroOS — Perfil de cocina / autoservicio.
 *
 * Una instalación de GastroOS representa una cocina concreta.
 * No hay usuarios, roles ni cuentas dentro de este perfil.
 */
(function () {
    const VERSION = 5;
    const DAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    const FISH_SPECIES = Object.freeze(['trucha','caella','bacalao','merluza','calamares','bacaladilla','panga','atun','perca','chicharro','cabracho','tintorera']);
    const MEAT_ANIMALS = Object.freeze(['carne_pollo','carne_pavo','carne_cerdo','carne_ternera','carne_conejo','carne_cordero']);
    const FISH_LABELS = Object.freeze({ trucha:'Trucha', caella:'Caella', bacalao:'Bacalao', merluza:'Merluza', calamares:'Calamares', bacaladilla:'Bacaladilla', panga:'Panga', atun:'Atún', perca:'Perca', chicharro:'Chicharro', cabracho:'Cabracho', tintorera:'Tintorera' });
    const MEAT_LABELS = Object.freeze({ carne_pollo:'Pollo', carne_pavo:'Pavo', carne_cerdo:'Cerdo', carne_ternera:'Ternera', carne_conejo:'Conejo', carne_cordero:'Cordero' });

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
        especiesPescadoPersonalizadas: Object.freeze([]),
        animalesCarnePersonalizados: Object.freeze([]),
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


    function normalizeCustomCatalog(value, prefix) {
        const source = Array.isArray(value) ? value : [];
        const seen = new Set();
        return source.map(item => {
            if (typeof item === 'string') return { id: String(item).trim(), label: String(item).trim() };
            return { id: String(item?.id ?? '').trim(), label: String(item?.label ?? '').trim() };
        }).map(item => {
            const label = item.label.replace(/\s+/g, ' ').trim();
            const id = item.id || `${prefix}_${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}`;
            return { id, label };
        }).filter(item => item.id && item.label).filter(item => {
            if (seen.has(item.id.toLowerCase())) return false;
            seen.add(item.id.toLowerCase());
            return true;
        });
    }

    function getProteinCatalog(value = {}) {
        const profile = normalize(value);
        return {
            fish: [
                ...FISH_SPECIES.map(id => ({ id, label: FISH_LABELS[id] || id })),
                ...profile.especiesPescadoPersonalizadas
            ],
            meat: [
                ...MEAT_ANIMALS.map(id => ({ id, label: MEAT_LABELS[id] || id })),
                ...profile.animalesCarnePersonalizados
            ]
        };
    }

    function getProteinLabel(type, id, value = {}) {
        const catalog = getProteinCatalog(value)[type === 'Pescado' ? 'fish' : 'meat'];
        return catalog.find(item => item.id === id)?.label || id;
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
        const customFish = normalizeCustomCatalog(source.especiesPescadoPersonalizadas, 'custom_pescado');
        const customMeat = normalizeCustomCatalog(source.animalesCarnePersonalizados, 'custom_carne');
        const validFishIds = new Set([...FISH_SPECIES, ...customFish.map(item => item.id)]);
        const validMeatIds = new Set([...MEAT_ANIMALS, ...customMeat.map(item => item.id)]);
        const rawFish = normalizeList(source.especiesPescadoPermitidas).map(v => v.toLowerCase()).filter(v => validFishIds.has(v));
        const rawAnimals = normalizeList(source.animalesCarnePermitidos).map(v => v.toLowerCase()).filter(v => validMeatIds.has(v));
        const previousFish = ['trucha','caella','bacalao','merluza','calamares','bacaladilla','panga','atun','perca','chicharro'];
        if (source.version === 2 && previousFish.every(v => rawFish.includes(v))) {
            ['cabracho','tintorera'].forEach(v => { if (!rawFish.includes(v)) rawFish.push(v); });
        }
        const fish = isLegacyProfile && rawFish.length === 0 ? [...FISH_SPECIES, ...customFish.map(item => item.id)] : rawFish;
        const animals = isLegacyProfile && rawAnimals.length === 0 ? [...MEAT_ANIMALS, ...customMeat.map(item => item.id)] : rawAnimals;

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
            especiesPescadoPersonalizadas: customFish,
            animalesCarnePersonalizados: customMeat,
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
        VERSION, DEFAULT_RULES, DAYS, FISH_SPECIES, MEAT_ANIMALS, FISH_LABELS, MEAT_LABELS,
        normalize, getGuisoDays, normalizeDishName, isFishAllowed, isMeatAnimalAllowed, getProteinCatalog, getProteinLabel
    });
})();
