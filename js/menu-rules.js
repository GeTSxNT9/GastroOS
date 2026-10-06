(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GastroOSMenuRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const ENGINE_VERSION = "menu-rules-v11-stock-prepared-guiso-rations";
    const FIRST_SLOT_LABELS = { vegetable: "1º Verdura", spoon: "1º Cuchara", starch: "1º Tenedor / Hidratos" };
    const MEAT_TECHNIQUES = ["tecnica_guiso", "tecnica_seco_asado", "tecnica_frito_rebozado"];
    const MIN_WEEKLY_GUISOS = 3;
    const MAX_WEEKLY_GUISOS = 3;
    const GUISO_DAYS = new Set([0, 2, 4]);
    const CONSECUTIVE_FIRST_SUBTYPES = new Set(["legumbres", "guisos", "sopas_o_caldos", "cremas", "arroces", "otros_hidratos", "pastas", "pastas_rellenas"]);
    const LIQUID_FIRST_SUBTYPES = new Set(["cremas", "sopas_o_caldos"]);
    const SECOND_PREPARATION_FAMILIES = [
        ["albondigas", /\balbondigas\b/], ["croquetas", /\bcroquetas\b/], ["hamburguesas", /\bhamburgues(?:a|as)\b/],
        ["brochetas", /\bbrochetas?\b/], ["nuggets", /\bnuggets?\b/], ["fingers", /\bfingers?\b/]
    ];
    const VEGETABLE_ALIASES = {
        "judias verdes": "judias verdes", "judia verde": "judias verdes", "habichuela": "judias verdes", "habichuelas": "judias verdes",
        "calabacin": "calabacin", "calabacín": "calabacin", "berenjena": "berenjena", "espinaca": "espinacas", "espinacas": "espinacas",
        "acelga": "acelgas", "acelgas": "acelgas", "brocoli": "brocoli", "brócoli": "brocoli", "coliflor": "coliflor", "zanahoria": "zanahoria",
        "puerro": "puerro", "pimiento": "pimiento", "pimientos": "pimiento", "tomate": "tomate", "calabaza": "calabaza", "cebolla": "cebolla",
        "patata": "patata", "patatas": "patata", "alcachofa": "alcachofa", "alcachofas": "alcachofa", "guisante": "guisantes", "guisantes": "guisantes",
        "judion": "judias", "judiones": "judias", "champiñon": "champiñones", "champiñones": "champiñones", "seta": "champiñones", "setas": "champiñones",
        "col": "col", "repollo": "col"
    };
    const VEGETABLE_DISH_OVERRIDES = {
        "crema de verduras variadas": "verduras variadas",
        "crema de champinones y patata": "champinones",
        "menestra de verduras": "menestra",
        "vichyssoise": "puerro"
    };

    function normalizeFoodKey(value) {
        return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    }
    function canonicalVegetable(value) {
        const normalized = normalizeFoodKey(value);
        if (!normalized) return "";
        const direct = VEGETABLE_ALIASES[normalized];
        if (direct) return normalizeFoodKey(direct);
        const keys = Object.keys(VEGETABLE_ALIASES).sort((a, b) => b.length - a.length);
        const match = keys.find(k => normalized.includes(normalizeFoodKey(k)));
        return match ? normalizeFoodKey(VEGETABLE_ALIASES[match]) : normalized;
    }
    function getSecondPreparationFamily(dish) {
        const name = normalizeFoodKey(dish?.nombre || "");
        if (!name) return "";
        const match = SECOND_PREPARATION_FAMILIES.find(([, pattern]) => pattern.test(name));
        return match ? match[0] : "";
    }
    function conflictsWithSecondPreparationFamily(dish, chosenSecondFamilies) {
        const family = getSecondPreparationFamily(dish);
        return !!family && chosenSecondFamilies.includes(family);
    }
    function conflictsWithSecondSpecies(dishAnimal, chosenAnimals) {
        return !!dishAnimal && chosenAnimals.includes(dishAnimal);
    }
    function getPrimaryVegetableKey(dish) {
        if (!dish || dish.categoria !== "Primero" || dish.subcategoria_primero !== "Verdura") return "";
        const dishName = normalizeFoodKey(dish.nombre);
        const override = VEGETABLE_DISH_OVERRIDES[dishName];
        if (override) return canonicalVegetable(override);
        const vegetableNames = Object.keys(VEGETABLE_ALIASES).map(normalizeFoodKey).filter(Boolean).sort((a, b) => b.length - a.length);
        const nameMatch = vegetableNames.find(name => {
            const re = new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")}(?=\\s|$)`, "i");
            return re.test(dishName);
        });
        if (nameMatch) return canonicalVegetable(nameMatch);
        const ingredients = Array.isArray(dish.ingredientes) ? dish.ingredientes : [];
        const vegetableIngredients = ingredients.filter(ing => {
            const category = String(ing?.categoria_proveedor || "").toLowerCase();
            return category.includes("verduras") || category.includes("frutas");
        });
        vegetableIngredients.sort((a, b) => {
            const qa = Number(String(a?.cantidad ?? "").replace(",", "."));
            const qb = Number(String(b?.cantidad ?? "").replace(",", "."));
            return (Number.isFinite(qb) ? qb : -1) - (Number.isFinite(qa) ? qa : -1);
        });
        if (vegetableIngredients[0]?.nombre) return canonicalVegetable(vegetableIngredients[0].nombre);
        return canonicalVegetable(String(dish.nombre || "").split(/[,/()-]/)[0]);
    }

    return { ENGINE_VERSION, FIRST_SLOT_LABELS, MEAT_TECHNIQUES, MIN_WEEKLY_GUISOS, MAX_WEEKLY_GUISOS, GUISO_DAYS, CONSECUTIVE_FIRST_SUBTYPES, LIQUID_FIRST_SUBTYPES, SECOND_PREPARATION_FAMILIES, VEGETABLE_ALIASES, VEGETABLE_DISH_OVERRIDES, normalizeFoodKey, canonicalVegetable, getSecondPreparationFamily, conflictsWithSecondPreparationFamily, conflictsWithSecondSpecies, getPrimaryVegetableKey };
});
