(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GastroOSRecipeSchema = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const FIRST_SUBCATEGORIES = {
        cuchara: ["legumbres", "guisos", "sopas_o_caldos"],
        verdura: ["cremas", "verduras_enteras"],
        tenedor: ["pastas", "pastas_rellenas", "arroces", "otros_hidratos"]
    };
    const MEAT_ANIMALS = ["carne_pollo", "carne_pavo", "carne_cerdo", "carne_ternera", "carne_conejo", "carne_cordero"];
    const FISH_SPECIES = ["trucha", "caella", "bacalao", "merluza", "calamares", "bacaladilla", "panga", "atun", "perca", "chicharro"];
    const FISH_LABELS = {
        trucha: "Trucha", caella: "Caella", bacalao: "Bacalao", merluza: "Merluza",
        calamares: "Calamares", bacaladilla: "Bacaladilla", panga: "Panga", atun: "Atún",
        perca: "Perca", chicharro: "Chicharro"
    };
    const MEAT_LABELS = {
        carne_pollo: "Pollo", carne_pavo: "Pavo", carne_cerdo: "Cerdo",
        carne_ternera: "Ternera", carne_conejo: "Conejo", carne_cordero: "Cordero"
    };
    const FIRST_LABELS = {
        legumbres: "Cuchara · Legumbres", guisos: "Cuchara · Guisos",
        sopas_o_caldos: "Cuchara · Sopas o caldos", cremas: "Verdura · Crema",
        verduras_enteras: "Verdura · Entera", pastas: "Pasta",
        pastas_rellenas: "Pasta rellena", arroces: "Arroz", otros_hidratos: "Otros hidratos"
    };
    const ALLERGEN_OPTIONS = [
        ["gluten", "Gluten"], ["crustaceos", "Crustáceos"], ["huevos", "Huevos"], ["pescado", "Pescado"],
        ["cacahuetes", "Cacahuetes"], ["soja", "Soja"], ["lacteo", "Lácteo"], ["frutos_cascara", "Frutos de cáscara"],
        ["apio", "Apio"], ["mostaza", "Mostaza"], ["sesamo", "Sésamo"], ["sulfitos", "Sulfitos"],
        ["altramuces", "Altramuces"], ["moluscos", "Moluscos"]
    ];
    const ALLERGEN_LABELS = Object.fromEntries(ALLERGEN_OPTIONS);

    function normalizeFirstParent(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        const v = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (v === "cuchara" || v.includes("cuchara")) return "Cuchara";
        if (v === "verdura" || v.includes("verdura")) return "Verdura";
        if (v === "tenedor" || v.includes("tenedor")) return "Tenedor";
        if (FIRST_SUBCATEGORIES.cuchara.includes(v)) return "Cuchara";
        if (FIRST_SUBCATEGORIES.verdura.includes(v)) return "Verdura";
        if (FIRST_SUBCATEGORIES.tenedor.includes(v)) return "Tenedor";
        if (v.includes("crema") || v.includes("entera")) return "Verdura";
        if (v.includes("pasta") || v.includes("arroz") || v.includes("hidrato")) return "Tenedor";
        if (v.includes("legumbre") || v.includes("guiso") || v.includes("sopa") || v.includes("caldo")) return "Cuchara";
        return "";
    }

    function normalizeTechnique(value) {
        const raw = String(value || "").trim();
        const v = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (raw === "tecnica_guiso" || v.includes("guis") || v.includes("salsa") || v.includes("estof")) return "tecnica_guiso";
        if (raw === "tecnica_frito_rebozado" || v.includes("frit") || v.includes("reboz") || v.includes("empan") || v.includes("milanes") || v.includes("san jacobo") || v.includes("croquet")) return "tecnica_frito_rebozado";
        if (raw === "tecnica_seco_asado" || v.includes("seco") || v.includes("asado") || v.includes("brasa") || v.includes("parrilla") || v.includes("plancha")) return "tecnica_seco_asado";
        if (raw === "tecnica_seco") return "tecnica_seco";
        return raw;
    }

    function normalizeFishSpecies(value) {
        const v = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = FISH_SPECIES.find(x => v.includes(x));
        return match || "";
    }

    function normalizeDishData(d) {
        const dish = { ...d };
        dish.demanda = dish.demanda || "Media";
        dish.precocinado = !!dish.precocinado;
        dish.plato_elaborado = !!dish.plato_elaborado;
        dish.subcategoria_primero = dish.subcategoria_primero || "";
        dish.subtipo_primero = dish.subtipo_primero || "";
        dish.proteina_segundo = dish.proteina_segundo || "";
        dish.animal_carne = dish.animal_carne || "";
        dish.especie_pescado = dish.especie_pescado || "";
        dish.tecnica_cocina = dish.tecnica_cocina || "";
        dish.alergenos = Array.isArray(dish.alergenos)
            ? [...new Set(dish.alergenos.map(a => String(a).trim()).filter(a => ALLERGEN_LABELS[a]))]
            : [];

        if (dish.categoria === "Primero") {
            const originalSub = dish.subcategoria_primero;
            const technicalSub = String(dish.subtipo_primero || "").trim();
            if (!technicalSub && FIRST_LABELS[String(originalSub || "").toLowerCase()]) dish.subtipo_primero = String(originalSub).toLowerCase();
            const canonicalParent = normalizeFirstParent(dish.subcategoria_primero) || normalizeFirstParent(dish.subtipo_primero);
            if (canonicalParent) dish.subcategoria_primero = canonicalParent;
            if (dish.subtipo_primero && !FIRST_LABELS[dish.subtipo_primero]) {
                const technicalCandidate = String(dish.subtipo_primero).toLowerCase();
                if (FIRST_LABELS[technicalCandidate]) dish.subtipo_primero = technicalCandidate;
            }
        }
        if (dish.categoria === "Segundo" && dish.proteina_segundo === "Carne") {
            const animalMap = { pollo: "carne_pollo", pavo: "carne_pavo", cerdo: "carne_cerdo", ternera: "carne_ternera", conejo: "carne_conejo", cordero: "carne_cordero" };
            const currentAnimal = String(dish.animal_carne || "").trim().toLowerCase();
            const oldAnimal = String(dish.especie_animal || "").trim().toLowerCase();
            if (animalMap[currentAnimal]) dish.animal_carne = animalMap[currentAnimal];
            else if (!dish.animal_carne) dish.animal_carne = animalMap[oldAnimal] || "";
        }
        if (dish.categoria === "Segundo" && dish.proteina_segundo === "Pescado") dish.especie_pescado = normalizeFishSpecies(dish.especie_pescado || dish.especie_animal);
        if (dish.categoria === "Segundo" && (dish.proteina_segundo === "Carne" || dish.proteina_segundo === "Pescado")) {
            dish.tecnica_cocina = normalizeTechnique(dish.tecnica_cocina || dish.tecnica);
            if (dish.tecnica_cocina) dish.tecnica = dish.tecnica_cocina;
        }
        if (!dish.tecnica && dish.tecnica_cocina) dish.tecnica = dish.tecnica_cocina;
        if (!dish.especie_animal && dish.animal_carne) dish.especie_animal = dish.animal_carne;
        return dish;
    }

    function firstParentFromTechnical(subtype) {
        if (FIRST_SUBCATEGORIES.cuchara.includes(subtype)) return "Cuchara";
        if (FIRST_SUBCATEGORIES.verdura.includes(subtype)) return "Verdura";
        if (FIRST_SUBCATEGORIES.tenedor.includes(subtype)) return "Tenedor";
        return "";
    }

    function hasCompleteTechnicalTags(d) {
        if (!d || !d.categoria) return false;
        if (d.categoria === "Primero") return !!d.subtipo_primero;
        if (d.proteina_segundo === "Carne") return MEAT_ANIMALS.includes(d.animal_carne) && ["tecnica_guiso", "tecnica_seco_asado", "tecnica_frito_rebozado"].includes(d.tecnica_cocina);
        if (d.proteina_segundo === "Pescado") return !!d.especie_pescado;
        return false;
    }

    return { FIRST_SUBCATEGORIES, MEAT_ANIMALS, FISH_SPECIES, FISH_LABELS, MEAT_LABELS, FIRST_LABELS, ALLERGEN_OPTIONS, ALLERGEN_LABELS, normalizeFirstParent, normalizeDishData, firstParentFromTechnical, normalizeTechnique, normalizeFishSpecies, hasCompleteTechnicalTags };
});
