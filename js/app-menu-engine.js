/* GastroOS — Motor de generación de menús y validación.
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */
        // --- 6. MOTOR DE GENERACIÓN Y EXPORTACIÓN LIMPIA ---
        // --- 6. MOTOR DE MENÚ: REGLAS PROFESIONALES + FALLBACK DETERMINISTA ---

        const ENGINE_VERSION = "menu-rules-v11-stock-prepared-guiso-rations";
        const MEAT_TECHNIQUES = ["tecnica_guiso", "tecnica_seco_asado", "tecnica_frito_rebozado"];
        const CONSECUTIVE_FIRST_SUBTYPES = new Set([
            "legumbres", "guisos", "sopas_o_caldos", "cremas",
            "arroces", "otros_hidratos",
            "pastas", "pastas_rellenas"
        ]);
        const LIQUID_FIRST_SUBTYPES = new Set(["cremas", "sopas_o_caldos"]);
        // Familias de presentación que no queremos duplicar dentro del mismo día,
        // aunque una receta sea de carne y la otra de pescado.
        const SECOND_PREPARATION_FAMILIES = [
            ["albondigas", /\balbondigas\b/],
            ["croquetas", /\bcroquetas\b/],
            ["hamburguesas", /\bhamburgues(?:a|as)\b/],
            ["brochetas", /\bbrochetas?\b/],
            ["nuggets", /\bnuggets?\b/],
            ["fingers", /\bfingers?\b/]
        ];
        const VEGETABLE_ALIASES = {
            "judias verdes": "judias verdes", "judia verde": "judias verdes",
            "habichuela": "judias verdes", "habichuelas": "judias verdes",
            "calabacin": "calabacin", "calabacín": "calabacin",
            "berenjena": "berenjena", "espinaca": "espinacas", "espinacas": "espinacas",
            "acelga": "acelgas", "acelgas": "acelgas", "brocoli": "brocoli", "brócoli": "brocoli",
            "coliflor": "coliflor", "zanahoria": "zanahoria", "puerro": "puerro",
            "pimiento": "pimiento", "pimientos": "pimiento", "tomate": "tomate",
            "calabaza": "calabaza", "cebolla": "cebolla", "patata": "patata",
            "patatas": "patata", "alcachofa": "alcachofa", "alcachofas": "alcachofa",
            "guisante": "guisantes", "guisantes": "guisantes", "judion": "judias",
            "judiones": "judias", "champiñon": "champiñones", "champiñones": "champiñones", "seta": "champiñones", "setas": "champiñones", "col": "col", "repollo": "col"
        };

        function getDayDishList(menuDays, dayIndex, cat, protein) {
            if (dayIndex < 0) return [];
            const day = menuDays?.[daysList[dayIndex]] || [];
            return day
                .filter(s => s.cat === cat && (!protein || s.dish?.proteina_segundo === protein))
                .map(s => s.dish)
                .filter(Boolean);
        }



        function previousDayHasSubtype(menuDays, dayIndex, subtype) {
            return getDayDishList(menuDays, dayIndex - 1, "Primero").some(d => d.subtipo_primero === subtype);
        }

        function getWeeklyFishSpecies(menuDays, exceptDayIndex = -1) {
            const used = new Set();
            daysList.forEach((dayName, index) => {
                if (index === exceptDayIndex) return;
                getDayDishList(menuDays, index, "Segundo", "Pescado").forEach(dish => {
                    const species = dish?.especie_pescado;
                    if (species) used.add(String(species).toLowerCase());
                });
            });
            return used;
        }

        function animalAppearedOnDay(menuDays, dayIndex, animal) {
            return getDayDishList(menuDays, dayIndex, "Segundo", "Carne").some(d => d.animal_carne === animal);
        }

        function animalHasThreeDayStreak(menuDays, dayIndex, animal) {
            if (dayIndex < 2) return false;
            return animalAppearedOnDay(menuDays, dayIndex - 1, animal) &&
                   animalAppearedOnDay(menuDays, dayIndex - 2, animal);
        }

        function getWeeklyFirstFamilyCount(menuDays, family, exceptDayIndex = -1) {
            const subtypes = {
                pasta: new Set(['pastas','pastas_rellenas']),
                legumbres: new Set(['legumbres']),
                arroz: new Set(['arroces']),
                verdura_entera: new Set(['verduras_enteras']),
                sopas: new Set(['sopas_o_caldos'])
            }[family] || new Set();
            return daysList.reduce((total, dayName, index) => {
                if (index === exceptDayIndex) return total;
                const hasFamily = getDayDishList(menuDays, index, 'Primero').some(d => subtypes.has(d?.subtipo_primero));
                return total + (hasFamily ? 1 : 0);
            }, 0);
        }

        function previousDayHasFirstFamily(menuDays, dayIndex, family) {
            if (dayIndex <= 0) return false;
            const previous = getDayDishList(menuDays, dayIndex - 1, 'Primero');
            if (family === 'pasta') return previous.some(d => ['pastas','pastas_rellenas'].includes(d?.subtipo_primero));
            if (family === 'legumbres') return previous.some(d => d?.subtipo_primero === 'legumbres');
            if (family === 'arroz') return previous.some(d => d?.subtipo_primero === 'arroces');
            if (family === 'sopas') return previous.some(d => d?.subtipo_primero === 'sopas_o_caldos');
            return false;
        }

        function previousDayHasSameFirstSubtype(menuDays, dayIndex, subtype) {
            if (dayIndex <= 0) return false;
            return getDayDishList(menuDays, dayIndex - 1, 'Primero').some(d => d?.subtipo_primero === subtype);
        }

        function getWeeklyFirstSubtypeCount(menuDays, subtype, exceptDayIndex = -1) {
            return daysList.reduce((total, dayName, index) => {
                if (index === exceptDayIndex) return total;
                return total + getDayDishList(menuDays, index, "Primero")
                    .filter(d => d?.subtipo_primero === subtype).length;
            }, 0);
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

        // Protege los guisos de los días futuros. En concreto, cuando estamos
        // generando jueves, no permitimos gastar el último animal que todavía
        // puede servir para un guiso del viernes. Así la regla de "3 días" no
        // termina dejando al viernes sin su guiso obligatorio.
        function violatesFutureGuisoProtection(dish, dayIndex, menuDays, usedDishIdsThisWeek = new Set()) {
            if (dayIndex !== 3 || !dish?.animal_carne || getKitchenProfile().segundosCarne <= 0) return false; // solo jueves -> viernes cuando existe oferta de carne

            const fridayGuisos = getUniqueNormalizedDishes()
                .filter(candidate => candidate.categoria === "Segundo" &&
                    candidate.proteina_segundo === "Carne" &&
                    candidate.tecnica_cocina === "tecnica_guiso")
                .filter(candidate => !usedDishIdsThisWeek.has(String(candidate.id)));

            if (!fridayGuisos.length) return false;

            // Un guiso del viernes sigue siendo viable si el animal del guiso
            // no coincide a la vez con miércoles y con el animal que estamos
            // considerando para jueves. Repetir miércoles + viernes sí está
            // permitido; lo prohibido es formar la misma especie tres días seguidos.
            const viableAnimals = new Set();
            fridayGuisos.forEach(candidate => {
                const animal = candidate.animal_carne;
                if (!animal) return;
                if (!(animalAppearedOnDay(menuDays, 2, animal) && animal === dish.animal_carne)) {
                    viableAnimals.add(animal);
                }
            });

            // Si el jueves consume el último animal viable, el viernes queda
            // sin ningún guiso compatible con la regla de 3 días.
            return viableAnimals.size === 1 && viableAnimals.has(dish.animal_carne);
        }

        function countWeeklyTechnique(menuDays, technique) {
            return daysList.reduce((total, dayName) =>
                total + (menuDays?.[dayName] || [])
                    .filter(s => s.cat === "Segundo" && s.dish?.tecnica_cocina === technique).length, 0);
        }

        function getWeeklyTechniqueCount(menuDays, technique, chosenTechniques = []) {
            return countWeeklyTechnique(menuDays, technique) +
                chosenTechniques.filter(t => t === technique).length;
        }

        function normalizeFoodKey(value) {
            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
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

        const VEGETABLE_DISH_OVERRIDES = {
            "crema de verduras variadas": "verduras variadas",
            "crema de champinones y patata": "champinones",
            "menestra de verduras": "menestra",
            "vichyssoise": "puerro"
        };

        function getPrimaryVegetableKey(dish) {
            if (!dish || dish.categoria !== "Primero" || dish.subcategoria_primero !== "Verdura") return "";

            const dishName = normalizeFoodKey(dish.nombre);
            const override = VEGETABLE_DISH_OVERRIDES[dishName];
            if (override) return canonicalVegetable(override);
            const vegetableNames = Object.keys(VEGETABLE_ALIASES)
                .map(normalizeFoodKey)
                .filter(Boolean)
                .sort((a, b) => b.length - a.length);

            // Primero intentamos identificar la verdura principal por el propio nombre
            // del plato. Esto evita que ingredientes auxiliares como cebolla o puerro
            // bloqueen todas las cremas/verduras que los utilizan como base.
            const nameMatch = vegetableNames.find(name => {
                const re = new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
                return re.test(dishName);
            });
            if (nameMatch) return canonicalVegetable(nameMatch);

            const ingredients = Array.isArray(dish.ingredientes) ? dish.ingredientes : [];
            const vegetableIngredients = ingredients.filter(ing => {
                const category = String(ing?.categoria_proveedor || "").toLowerCase();
                return category.includes("verduras") || category.includes("frutas");
            });

            // Si el nombre no identifica una verdura concreta, usamos el ingrediente
            // vegetal con mayor cantidad conocida, no simplemente el primero de la lista.
            vegetableIngredients.sort((a, b) => {
                const qa = Number(String(a?.cantidad ?? "").replace(",", "."));
                const qb = Number(String(b?.cantidad ?? "").replace(",", "."));
                return (Number.isFinite(qb) ? qb : -1) - (Number.isFinite(qa) ? qa : -1);
            });
            if (vegetableIngredients[0]?.nombre) {
                return canonicalVegetable(vegetableIngredients[0].nombre);
            }

            return canonicalVegetable(String(dish.nombre || "").split(/[,/()-]/)[0]);
        }

        function getWeeklyUsedVegetableKeys(menuDays, exceptDayName = "") {
            const used = new Set();
            daysList.forEach(dayName => {
                if (dayName === exceptDayName) return;
                const dish = (menuDays?.[dayName] || [])[0]?.dish;
                const key = getPrimaryVegetableKey(dish);
                if (key) used.add(key);
            });
            return used;
        }

        function hasLiquidFirstConflict(candidate, chosenFirsts) {
            return window.GastroOSMenuSelectionRules.hasLiquidFirstConflict(candidate, chosenFirsts, LIQUID_FIRST_SUBTYPES);
        }

        function isStructuralMatch(dish, spec) {
            return window.GastroOSMenuSelectionRules.isStructuralMatch(dish, spec, {
                meatAnimals: MEAT_ANIMALS,
                meatTechniques: MEAT_TECHNIQUES
            });
        }

        function dayPatternSignature(slots) {
            return (slots || []).map(slot => {
                const d = slot?.dish || {};
                return [
                    slot?.cat || "",
                    d.subtipo_primero || "",
                    d.proteina_segundo || "",
                    d.animal_carne || "",
                    d.tecnica_cocina || "",
                    d.especie_pescado || "",
                    getPrimaryVegetableKey(d)
                ].join("~");
            }).join("|");
        }

        function getPreviousWeekPatternSignatures(previousMenu) {
            const signatures = new Set();
            daysList.forEach(dayName => {
                const slots = previousMenu?.days?.[dayName] || [];
                if (slots.length === getMenuStructure().slotSpecs.length) signatures.add(dayPatternSignature(slots));
            });
            return signatures;
        }

        function getPreviousWeekSlotDishIds(previousMenu, slotIndex) {
            const ids = new Set();
            daysList.forEach(dayName => {
                const id = previousMenu?.days?.[dayName]?.[slotIndex]?.dish?.id;
                if (id && id !== "none") ids.add(String(id));
            });
            return ids;
        }

        function violatesPreviousWeekTemplate(dish, slotIndex, previousMenu) {
            if (!previousMenu?.days) return false;

            // Nunca copiar el mismo plato en la misma posición de la semana anterior.
            const previousIds = getPreviousWeekSlotDishIds(previousMenu, slotIndex);
            if (dish?.id && previousIds.has(String(dish.id))) return true;

            // No se copia el mismo plato en la misma posición de la semana anterior.
            // La variedad de verduras entre semanas no es un veto: la regla de unicidad
            // de verdura es strictly intraseñana y así se evita bloquear bases de datos pequeñas.
            return false;
        }

        function violatesDayFirstRule(dish, spec, menuDays, dayIndex, chosenFirsts = [], usedVegetableKeys = new Set(), previousMenu = null, slotIndex = 0, ignorePreviousTemplate = false) {
            if (spec.cat !== "Primero") return false;

            if (getKitchenRule('evitarLiquidosEnPrimeros', true) && hasLiquidFirstConflict(dish, chosenFirsts)) return true;

            if (dish.subtipo_primero === "cremas" && getWeeklyFirstSubtypeCount(menuDays, "cremas", dayIndex) >= getMaxWeeklyCreams()) return true;
            if (["pastas","pastas_rellenas"].includes(dish.subtipo_primero) && getWeeklyFirstFamilyCount(menuDays, "pasta", dayIndex) >= getMaxWeeklyPasta()) return true;
            if (dish.subtipo_primero === "legumbres" && getWeeklyFirstFamilyCount(menuDays, "legumbres", dayIndex) >= getMaxWeeklyLegumes()) return true;
            if (dish.subtipo_primero === "arroces" && getWeeklyFirstFamilyCount(menuDays, "arroz", dayIndex) >= getMaxWeeklyRice()) return true;
            if (dish.subtipo_primero === "verduras_enteras" && getWeeklyFirstFamilyCount(menuDays, "verdura_entera", dayIndex) >= getMaxWeeklyVegetableWhole()) return true;
            if (dish.subtipo_primero === "sopas_o_caldos" && getWeeklyFirstFamilyCount(menuDays, "sopas", dayIndex) >= getMaxWeeklySoups()) return true;

            const consecutiveFamily = ['pastas','pastas_rellenas'].includes(dish.subtipo_primero) ? 'pasta'
                : dish.subtipo_primero === 'legumbres' ? 'legumbres'
                : dish.subtipo_primero === 'arroces' ? 'arroz'
                : dish.subtipo_primero === 'sopas_o_caldos' ? 'sopas' : '';
            const familyRule = consecutiveFamily ? getFirstFamilyRule(consecutiveFamily) : null;
            if (familyRule && !familyRule.consecutiveAllowed && previousDayHasSameFirstSubtype(menuDays, dayIndex, dish.subtipo_primero)) return true;

            // Regla intocable: una verdura principal solo puede aparecer una vez de lunes a viernes.
            if (getKitchenRule('evitarVerduraRepetida', true) && spec.allowedParents?.includes("Verdura")) {
                const vegetableKey = getPrimaryVegetableKey(dish);
                if (vegetableKey && usedVegetableKeys.has(vegetableKey)) return true;
            }

            // Regla general: una misma familia/subtipo de primero no puede aparecer
            // en días consecutivos. Las verduras enteras NO entran en esta regla:
            // todos los platos de verdura_entera comparten subtipo técnico, pero son
            // verduras distintas y además la semana exige una verdura cada día.
            // La variedad vegetal ya se controla por getPrimaryVegetableKey().
            // Las pastas normales y las rellenas son familias distintas, por lo que
            // pueden alternarse (pasta -> pasta rellena).
            const subtype = dish.subtipo_primero;
            const managedByFamilyRule = ['pastas','pastas_rellenas','legumbres','arroces','sopas_o_caldos'].includes(subtype);
            if (getKitchenRule('evitarRepeticionPrimeroConsecutivo', true) && !managedByFamilyRule && CONSECUTIVE_FIRST_SUBTYPES.has(subtype) && previousDayHasSubtype(menuDays, dayIndex, subtype)) return true;

            // Anti-plantilla inter-semanal: no repetir platos/verduras en la misma estructura.
            return !ignorePreviousTemplate && violatesPreviousWeekTemplate(dish, slotIndex, previousMenu);
        }

        function violatesDaySecondRule(dish, spec, menuDays, dayIndex, chosenAnimals, chosenTechniques, chosenSecondFamilies = [], chosenFishSpecies = []) {
            if (spec.cat !== "Segundo") return false;

            if (spec.protein === "Pescado") {
                // Regla absoluta: una especie de pescado solo puede aparecer una vez en toda la semana.
                const species = String(dish?.especie_pescado || "").toLowerCase();
                if (!species) return true;
                if (getWeeklyFishSpecies(menuDays, dayIndex).has(species)) return true;
                if (chosenFishSpecies.includes(species)) return true;
            }

            // REGLA INTOMABLE: las dos carnes del mismo día nunca pueden compartir animal.
            if (spec.protein === "Carne" && conflictsWithSecondSpecies(dish.animal_carne, chosenAnimals)) return true;

            // Tampoco combinamos dos segundos con la misma forma de elaboración/presentación
            // (por ejemplo, albóndigas de carne + albóndigas de merluza).
            if (getKitchenRule('evitarPresentacionSegundoRepetida', true) && conflictsWithSecondPreparationFamily(dish, chosenSecondFamilies)) return true;

            // Máximo un frito/rebozado por día.
            if (dish.tecnica_cocina === "tecnica_frito_rebozado" &&
                chosenTechniques.includes("tecnica_frito_rebozado")) return true;

            // Fritos: máximo 2 en la semana y nunca en días consecutivos.
            if (dish.tecnica_cocina === "tecnica_frito_rebozado") {
                if (getWeeklyTechniqueCount(menuDays, "tecnica_frito_rebozado", chosenTechniques) >= getMaxWeeklyFritos()) return true;
                const previousDayFritos = dayIndex > 0 && getDayDishList(menuDays, dayIndex - 1, "Segundo")
                    .some(d => d?.tecnica_cocina === "tecnica_frito_rebozado");
                if (previousDayFritos) return true;
            }

            // Guisos: exactamente uno en Lunes/Miércoles/Viernes y ninguno
            // en Martes/Jueves. Nunca puede haber dos guisos el mismo día.
            if (dish.tecnica_cocina === "tecnica_guiso") {
                if (!getGuisoDays().has(dayIndex)) return true;
                if (getWeeklyTechniqueCount(menuDays, "tecnica_guiso", chosenTechniques) >= getGuisoDays().size) return true;
            } else if (getGuisoDays().has(dayIndex) && chosenTechniques.length >= 1 &&
                       chosenTechniques.every(t => t !== "tecnica_guiso") &&
                       chosenTechniques.length >= 1) {
                // En el segundo hueco de carne de un día de guiso, si el primero
                // no fue guiso, el segundo queda reservado para el guiso.
                if (chosenTechniques.length === 1) return true;
            }

            // Regla heredada: evitar el mismo animal durante tres días consecutivos.
            if (animalHasThreeDayStreak(menuDays, dayIndex, dish.animal_carne)) return true;

            // Máximo un guiso por día.
            if (dish.tecnica_cocina === "tecnica_guiso" &&
                chosenTechniques.includes("tecnica_guiso")) return true;

            return false;
        }

        function usesFreshStock(dish) {
            if (!dish?.ingredientes || !Array.isArray(dish.ingredientes)) return false;
            const freshNames = rawStock
                .filter(r => {
                    const conservation = String(r?.conservacion || "");
                    return conservation.includes("Refrigerado") &&
                        Number(r?.cantidad) > 0;
                })
                .map(r => normalizeFoodKey(r?.nombre))
                .filter(Boolean);

            return dish.ingredientes.some(ing => {
                const ingredientName = normalizeFoodKey(ing?.nombre);
                return ingredientName && freshNames.some(raw => window.GastroOSStockUtils.foodNamesMatch(ingredientName, raw));
            });
        }

        function shuffleInPlace(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        function candidateScore(dish, spec, dayIndex, previousMenu = null, slotIndex = 0, menuDays = {}, chosenTechniques = []) {
            // "demanda" solo se utiliza para calcular cantidades de producción.
            // Nunca interviene en la prioridad de generación del menú.
            let score = 0;
            // Un plato elaborado en stock pero sin día fijo puede entrar en la
            // generación normal. Le damos una ligera ventaja para aprovechar el
            // stock disponible, pero NO lo fijamos a ningún día.
            if (preparedStock.some(item => normalizeFoodKey(item?.nombre) === normalizeFoodKey(dish?.nombre) &&
                (!item.asignacion || item.asignacion === 'Sin asignar'))) {
                const stockPriority = getKitchenRule('prioridadStock', 'alta');
                if (stockPriority === 'alta') score += 8;
                else if (stockPriority === 'normal') score += 3;
            }
            if (usesFreshStock(dish)) score += dayIndex < 2 ? 3 : 0;
            if (spec.cat === "Segundo" && spec.protein === "Pescado" && dayIndex === 0) score += 1;

            if (spec.cat === "Primero") {
                const subtype = dish.subtipo_primero;
                const family = ['pastas','pastas_rellenas'].includes(subtype) ? 'pasta'
                    : subtype === 'legumbres' ? 'legumbres'
                    : subtype === 'arroces' ? 'arroz'
                    : subtype === 'sopas_o_caldos' ? 'sopas' : '';
                const familyRule = family ? getFirstFamilyRule(family) : null;
                if (familyRule && !familyRule.consecutiveAllowed && previousDayHasSameFirstSubtype(menuDays, dayIndex, subtype)) score -= 80;
                if (familyRule && familyRule.consecutiveAllowed && previousDayHasFirstFamily(menuDays, dayIndex, family)) score -= 12;
            }

            if (spec.cat === "Segundo" && spec.protein === "Carne") {
                const isGuisoDay = getGuisoDays().has(dayIndex);
                if (dish.tecnica_cocina === "tecnica_guiso") score += isGuisoDay ? 30 : -100;
                else if (isGuisoDay && chosenTechniques.length === 0) score += 3;
                else if (!isGuisoDay && dish.tecnica_cocina !== "tecnica_frito_rebozado") score += 1;
            }

            // Penaliza coincidencias con la semana anterior para reforzar el cambio de estructura.
            if (previousMenu?.days) {
                const previousIds = getPreviousWeekSlotDishIds(previousMenu, slotIndex);
                if (previousIds.has(dish.id)) score -= 1000;
            }

            return score + Math.random();
        }

        function isDishActiveForGenerator(dish) {
            if (!dish) return false;
            const profile = getKitchenProfile();
            if (!profile.permitirPrecocinados && dish.precocinado) return false;
            if (!window.GastroOSKitchenRules.isFishAllowed(dish, profile)) return false;
            if (!window.GastroOSKitchenRules.isMeatAnimalAllowed(dish, profile)) return false;
            // Un plato elaborado solo entra si existe físicamente en stock, salvo que
            // la cocina haya decidido expresamente permitirlos sin stock.
            if (!dish.plato_elaborado || profile.permitirPlatosElaboradosSinStock) return true;
            const key = normalizeFoodKey(dish.nombre);
            return !!key && preparedStock.some(item => normalizeFoodKey(item?.nombre) === key);
        }

        function getUniqueNormalizedDishes() {
            const seen = new Set();
            return dishes
                .map(normalizeDishData)
                .filter(d => d && d.id !== undefined && d.id !== null && d.id !== "")
                .filter(isDishActiveForGenerator)
                .filter(d => {
                    const id = String(d.id);
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
        }

        function pickDishForSlot(spec, usedDishIdsThisWeek, menuDays, dayIndex, chosenAnimals, chosenTechniques, options = {}) {
            const previousMenu = options.previousMenu || null;
            const chosenFirsts = options.chosenFirsts || [];
            const usedVegetableKeys = options.usedVegetableKeys || new Set();
            const slotIndex = options.slotIndex ?? 0;
            const chosenSecondFamilies = options.chosenSecondFamilies || [];
            const chosenFishSpecies = options.chosenFishSpecies || [];

            // El fallback es estricto: ninguna regla de negocio se relaja. Los niveles se conservan
            // solo por compatibilidad con el formato existente de los slots y para evitar bucles infinitos.
            {
                let candidates = getUniqueNormalizedDishes()
                    .filter(d => isStructuralMatch(d, spec))
                    .filter(d => !usedDishIdsThisWeek.has(String(d.id)))
                    .filter(d => window.GastroOSKitchenRules.isFishAllowed(d, getKitchenProfile()))
                    .filter(d => window.GastroOSKitchenRules.isMeatAnimalAllowed(d, getKitchenProfile()))
                    .filter(d => !violatesDayFirstRule(d, spec, menuDays, dayIndex, chosenFirsts, usedVegetableKeys, previousMenu, slotIndex))
                    .filter(d => !violatesDaySecondRule(d, spec, menuDays, dayIndex, chosenAnimals, chosenTechniques, chosenSecondFamilies, chosenFishSpecies))
                    .filter(d => !violatesFutureGuisoProtection(d, dayIndex, menuDays, usedDishIdsThisWeek));

                // El segundo hueco de carne de L/M/V debe cerrar obligatoriamente
                // el día con un guiso si el primer hueco no lo ha elegido ya.
                if (spec.cat === "Segundo" && spec.protein === "Carne" &&
                    getGuisoDays().has(dayIndex) && chosenTechniques.length === 1 &&
                    !chosenTechniques.includes("tecnica_guiso")) {
                    candidates = candidates.filter(d => d.tecnica_cocina === "tecnica_guiso");
                }

                // Si el primer plato ya combina una crema con un plato de cuchara
                // contundente (como Rancho), el tercer primero debe buscar un hidrato
                // más apropiado. Priorizamos arroz y, si no existe, pasta/pasta rellena.
                if (spec.cat === "Primero" && spec.allowedParents?.includes("Tenedor")) {
                    const hasCream = chosenFirsts.some(d => d?.subtipo_primero === "cremas");
                    const hasHeavySpoon = chosenFirsts.some(d => ["guisos", "legumbres"].includes(d?.subtipo_primero));
                    if (hasCream && hasHeavySpoon) {
                        const rice = candidates.filter(d => d.subtipo_primero === "arroces");
                        const pasta = candidates.filter(d => ["pastas", "pastas_rellenas"].includes(d.subtipo_primero));
                        if (rice.length) candidates = rice;
                        else if (pasta.length) candidates = pasta;
                    }
                }

                // En Lunes/Miércoles/Viernes el guiso no es solo una preferencia:
                // si existe un guiso compatible, reservamos uno de los dos segundos
                // de carne para él desde el primer hueco.
                if (spec.cat === "Segundo" && spec.protein === "Carne" &&
                    getGuisoDays().has(dayIndex) && !chosenTechniques.includes("tecnica_guiso")) {
                    let guisoCandidates = candidates.filter(d => d.tecnica_cocina === "tecnica_guiso");

                    // El guiso de L/M/V es una obligación, no una preferencia.
                    // Si el anti-patrón semanal ha descartado todos los guisos,
                    // recuperamos candidatos compatibles ignorando únicamente esa
                    // preferencia inter-semanal; las demás reglas siguen siendo duras.
                    if (!guisoCandidates.length) {
                        guisoCandidates = getUniqueNormalizedDishes()
                            .filter(d => isStructuralMatch(d, spec))
                            .filter(d => !usedDishIdsThisWeek.has(String(d.id)))
                            .filter(d => d.tecnica_cocina === "tecnica_guiso")
                            .filter(d => !violatesDayFirstRule(d, spec, menuDays, dayIndex, chosenFirsts, usedVegetableKeys, previousMenu, slotIndex, true))
                            .filter(d => !violatesDaySecondRule(d, spec, menuDays, dayIndex, chosenAnimals, chosenTechniques, chosenSecondFamilies, chosenFishSpecies))
                            .filter(d => !violatesFutureGuisoProtection(d, dayIndex, menuDays, usedDishIdsThisWeek));
                    }

                    if (guisoCandidates.length) candidates = guisoCandidates;
                }

                if (candidates.length) {
                    // Fisher-Yates elimina por completo el orden de inserción/alfabético.
                    // En un pool de guisos compatibles no existe ninguna prioridad por demanda:
                    // todos los candidatos tienen la misma probabilidad de ser elegidos.
                    shuffleInPlace(candidates);

                    const isMeatGuisoPool =
                        spec.cat === "Segundo" &&
                        spec.protein === "Carne" &&
                        getGuisoDays().has(dayIndex) &&
                        candidates.every(d => d.tecnica_cocina === "tecnica_guiso");

                    const selectedDish = isMeatGuisoPool
                        ? candidates[0]
                        : (candidates.sort((a, b) =>
                            candidateScore(b, spec, dayIndex, previousMenu, slotIndex, menuDays, chosenTechniques) -
                            candidateScore(a, spec, dayIndex, previousMenu, slotIndex, menuDays, chosenTechniques)
                        )[0]);

                    return {
                        dish: selectedDish,
                        relaxed: false,
                        relaxationLevel: 0,
                        warning: ""
                    };
                }
            }

            return {
                dish: { id: "none", nombre: "Sin plato disponible", categoria: spec.cat, proteina_segundo: spec.protein || "", ingredientes: [] },
                relaxed: true,
                relaxationLevel: 3,
                warning: "⚠️ Sin candidato compatible"
            };
        }





        function getPreparedMap() {
            const prepMap = {};
            preparedStock.forEach(prep => {
                if (prep.asignacion && prep.asignacion !== "Sin asignar") {
                    const key = prep.asignacion.replace(/\s+/g, "");
                    if (!prepMap[key]) prepMap[key] = [];
                    prepMap[key].push(prep);
                }
            });
            return prepMap;
        }

        function isPreparedStockDish(dish) {
            const key = normalizeFoodKey(dish?.nombre);
            if (!key) return false;
            return preparedStock.some(item => {
                if (!item || !String(item.asignacion || '').trim() || item.asignacion === 'Sin asignar') return false;
                return normalizeFoodKey(item.nombre) === key;
            }) || preparedStock.some(item => normalizeFoodKey(item?.nombre) === key);
        }

        function getPreparedCandidate(prep, spec, dayName, slotIndex) {
            const name = String(prep?.nombre || "").trim();
            const found = dishes.find(d => String(d?.nombre || "").toLowerCase() === name.toLowerCase());
            if (found) return normalizeDishData(found);

            const safeName = normalizeFoodKey(name).replace(/\s+/g, "-") || `slot-${slotIndex}`;
            return normalizeDishData({
                id: prep?.id || `prepared-${dayName}-${slotIndex}-${safeName}`,
                nombre: name,
                categoria: spec.cat,
                subcategoria_primero: spec.allowedParents?.[0] || "",
                subtipo_primero: "",
                proteina_segundo: spec.protein || "",
                animal_carne: "",
                especie_pescado: "",
                tecnica_cocina: "",
                ingredientes: []
            });
        }



        function generateDayMenu(dayName, dayIndex, menuDays, usedDishIdsThisWeek, prepMap, options = {}) {
            const { slotSpecs } = getMenuStructure();

            const daySlots = [];
            const chosenAnimals = [];
            const chosenTechniques = [];
            const chosenSecondFamilies = [];
            const chosenFishSpecies = [];
            const chosenFirsts = [];
            const assignedPrimero = [...(prepMap[`${dayName}-Primero`] || [])];
            const assignedSegundo = [...(prepMap[`${dayName}-Segundo`] || [])];
            const previousMenu = options.previousMenu || previousWeekMenu || null;
            const usedVegetableKeys = options.usedVegetableKeys || getWeeklyUsedVegetableKeys(menuDays, dayName);

            for (let index = 0; index < slotSpecs.length; index++) {
                const spec = slotSpecs[index];
                const assignedList = spec.cat === "Primero" ? assignedPrimero : assignedSegundo;
                let lockedDish = null;

                // No consumimos una asignación manual incompatible con este slot:
                // un pescado asignado a "Segundo", por ejemplo, debe poder llegar al
                // slot de pescado aunque primero se evalúen los dos slots de carne.
                for (let assignedIndex = 0; assignedIndex < assignedList.length; assignedIndex++) {
                    const prep = assignedList[assignedIndex];
                    const candidate = getPreparedCandidate(prep, spec, dayName, index);
                    // Una asignación explícita de STOCK manda sobre la selección aleatoria:
                    // si el plato sigue dado de alta en PLATOS ELABORADOS y está asignado
                    // a este día/categoría, debe ocupar este hueco siempre. Las reglas
                    // globales ya se validan al construir el menú y en validateWeeklyMenu;
                    // aquí no dejamos que un criterio blando (ni la semana anterior, ni
                    // la puntuación, ni el orden de candidatos) lo sustituya.
                    if (isStructuralMatch(candidate, spec) && window.GastroOSKitchenRules.isFishAllowed(candidate, getKitchenProfile()) && window.GastroOSKitchenRules.isMeatAnimalAllowed(candidate, getKitchenProfile()) && (getKitchenProfile().permitirPrecocinados || !candidate.precocinado)) {
                        const isGuisoDay = getGuisoDays().has(dayIndex);
                        if (spec.cat === 'Segundo' && spec.protein === 'Pescado' && candidate.especie_pescado && chosenFishSpecies.includes(String(candidate.especie_pescado).toLowerCase())) continue;
                        const isMeatSecond = spec.cat === "Segundo" && spec.protein === "Carne";
                        const alreadyHasGuiso = chosenTechniques.includes("tecnica_guiso");
                        const alreadyHasMeat = chosenTechniques.length > 0;
                        const wouldBreakMandatoryGuiso = isMeatSecond && isGuisoDay && !alreadyHasGuiso && alreadyHasMeat && candidate.tecnica_cocina !== "tecnica_guiso";
                        if (wouldBreakMandatoryGuiso) continue;

                        lockedDish = candidate;
                        assignedList.splice(assignedIndex, 1);
                        break;
                    }
                }

                const result = lockedDish
                    ? { dish: lockedDish, relaxed: false, relaxationLevel: 0, warning: "" }
                    : pickDishForSlot(
                        spec,
                        usedDishIdsThisWeek,
                        menuDays,
                        dayIndex,
                        chosenAnimals,
                        chosenTechniques,
                        {
                            previousMenu,
                            chosenFirsts,
                            usedVegetableKeys,
                            chosenSecondFamilies,
                            chosenFishSpecies,
                            slotIndex: index
                        }
                    );

                const dish = result.dish;
                if (dish && dish.id !== "none") {
                    const id = String(dish.id);
                    usedDishIdsThisWeek.add(id);
                    if (spec.cat === "Segundo") {
                        if (spec.protein === "Carne") chosenAnimals.push(dish.animal_carne);
                        if (dish.tecnica_cocina) chosenTechniques.push(dish.tecnica_cocina);
                        if (spec.protein === "Pescado" && dish.especie_pescado) chosenFishSpecies.push(String(dish.especie_pescado).toLowerCase());
                        const family = getSecondPreparationFamily(dish);
                        if (family) chosenSecondFamilies.push(family);
                    }
                    if (spec.cat === "Primero") chosenFirsts.push(dish);
                    if (spec.allowedParents?.includes("Verdura")) {
                        const vegetableKey = getPrimaryVegetableKey(dish);
                        if (vegetableKey) usedVegetableKeys.add(vegetableKey);
                    }
                }

                daySlots.push({
                    slotLabel: spec.slotLabel,
                    cat: spec.cat,
                    dish,
                    relaxed: result.relaxed,
                    relaxationLevel: result.relaxationLevel,
                    warning: result.warning,
                    isPreparedStock: !!lockedDish || isPreparedStockDish(dish)
                });
            }

            return daySlots;
        }

        function getISOWeekKey(date) {
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) return "";
            d.setHours(0, 0, 0, 0);
            const day = d.getDay() || 7;
            d.setDate(d.getDate() + 4 - day);
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
        }

        function getPreviousWeekKey(currentWeekKey) {
            const match = String(currentWeekKey || "").match(/^(\d{4})-W(\d{2})$/);
            if (!match) return "";
            const d = new Date(Number(match[1]), 0, 4);
            d.setDate(d.getDate() - ((d.getDay() || 7) - 1) + (Number(match[2]) - 1) * 7 - 7);
            return getISOWeekKey(d);
        }

        function getLatestHistoryMenu() {
            // La referencia de variación es exclusivamente el último menú que el
            // usuario haya guardado de forma explícita en el historial, incluso si
            // pertenece a la semana actual. Un menú generado pero no guardado no cuenta.
            return [...(historyMenus || [])]
                .filter(item => {
                    const menu = item?.menu;
                    if (!menu?.days || !menu?.generatedAt) return false;
                    const menuDate = new Date(menu.generatedAt);
                    return !Number.isNaN(menuDate.getTime());
                })
                .sort((a, b) => new Date(b.savedAt || b.menu?.generatedAt) - new Date(a.savedAt || a.menu?.generatedAt))
                .map(item => item.menu)[0] || null;
        }

        function getPreviousWeekHistoryMenu() {
            const currentWeek = getISOWeekKey(new Date());
            const previousWeek = getPreviousWeekKey(currentWeek);
            return [...(historyMenus || [])]
                .map(item => item?.menu)
                .filter(menu => {
                    if (!menu?.days || !menu?.generatedAt) return false;
                    const menuDate = new Date(menu.generatedAt);
                    return !Number.isNaN(menuDate.getTime()) && getISOWeekKey(menuDate) === previousWeek;
                })
                .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))[0] || null;
        }

        function getPreviousWeekCandidateMenu() {
            // Solo los menús guardados explícitamente en el historial pueden actuar
            // como referencia. Los menús generados durante pruebas y aún no guardados
            // nunca contaminan la generación siguiente.
            return getLatestHistoryMenu();
        }

        function buildWeeklyMenuCandidate(previousForAntiTemplate) {
            const newMenu = {
                generatedAt: new Date().toISOString(),
                days: {},
                engineVersion: ENGINE_VERSION,
                weekKey: getISOWeekKey(new Date())
            };
            const usedDishIdsThisWeek = new Set();
            const prepMap = getPreparedMap();
            const usedVegetableKeys = new Set();

            daysList.forEach((dayName, dayIndex) => {
                newMenu.days[dayName] = generateDayMenu(
                    dayName,
                    dayIndex,
                    newMenu.days,
                    usedDishIdsThisWeek,
                    prepMap,
                    { previousMenu: previousForAntiTemplate, usedVegetableKeys }
                );
            });
            return newMenu;
        }

        // Un hueco («Sin plato disponible») no incumple ninguna regla, pero es peor que otra
        // combinación válida. Se reintenta mientras queden intentos de sobra; si el recetario
        // no permite completar la semana, se acepta el menú con hueco (aviso rojo en el slot).
        const EMPTY_SLOT_SOFT_LIMIT = 60;
        function slotsHaveEmptyDish(slots) {
            return (slots || []).some(slot => !slot?.dish || slot.dish.id === 'none');
        }
        function menuHasEmptySlot(menu) {
            return Object.values(menu?.days || {}).some(slotsHaveEmptyDish);
        }

        function generateWeeklyMenu() {
            let attemptNumber = 0;
            return window.GastroOSMenuGenerationEngine.generateWeeklyMenu({
                getCurrentMenu: () => currentMenu,
                setCurrentMenu: menu => { currentMenu = menu; },
                getPreviousCandidate: () => getPreviousWeekCandidateMenu(),
                buildCandidate: previousMenu => { attemptNumber++; return buildWeeklyMenuCandidate(previousMenu); },
                validateCandidate: menu => {
                    const validation = validateWeeklyMenu(menu);
                    if (validation.valid && attemptNumber < EMPTY_SLOT_SOFT_LIMIT && menuHasEmptySlot(menu)) {
                        return { ...validation, valid: false, errors: [...validation.errors, 'Hay un hueco sin plato; se prueba otra combinación.'] };
                    }
                    return validation;
                },
                clearManualStockMarks: () => shoppingManualStockKeys.clear(),
                setDiagnostics: value => { lastGenerationDiagnostics = value; },
                save: () => saveAll(),
                render: () => renderGeneratorView(),
                alert: message => alert(message),
                logError: (...args) => console.error(...args)
            });
        }
        function buildDayRegenerationContext(dayName) {
            const originalMenu = JSON.parse(JSON.stringify(currentMenu));
            const usedDishIdsInOtherDays = new Set();
            const rebuilt = {};
            daysList.forEach(d => {
                if (d !== dayName) {
                    rebuilt[d] = currentMenu.days[d] || [];
                    rebuilt[d].forEach(slot => {
                        if (slot.dish?.id && slot.dish.id !== 'none') usedDishIdsInOtherDays.add(String(slot.dish.id));
                    });
                }
            });
            return {
                originalMenu,
                rebuilt,
                usedDishIdsInOtherDays,
                dayIndex: daysList.indexOf(dayName),
                usedVegetableKeys: getWeeklyUsedVegetableKeys(rebuilt, dayName),
                previousMenu: getLatestHistoryMenu()
            };
        }

        function getIntelligentDayAlternatives(dayName, maxAlternatives = 3) {
            if (!currentMenu?.days?.[dayName] || !daysList.includes(dayName)) return [];
            const ctx = buildDayRegenerationContext(dayName);
            const signatures = new Set();
            const alternatives = [];
            const MAX_ATTEMPTS = 140;

            for (let attempt = 1; attempt <= MAX_ATTEMPTS && alternatives.length < maxAlternatives; attempt++) {
                const candidateDay = generateDayMenu(
                    dayName,
                    ctx.dayIndex,
                    ctx.rebuilt,
                    new Set(ctx.usedDishIdsInOtherDays),
                    getPreparedMap(),
                    { previousMenu: ctx.previousMenu, usedVegetableKeys: new Set(ctx.usedVegetableKeys) }
                );
                if (slotsHaveEmptyDish(candidateDay)) continue;
                const signature = candidateDay.map(slot => String(slot?.dish?.id || 'none')).join('|');
                if (signatures.has(signature)) continue;
                signatures.add(signature);
                const testMenu = JSON.parse(JSON.stringify(ctx.originalMenu));
                testMenu.days[dayName] = candidateDay;
                const validation = validateWeeklyMenu(testMenu);
                if (!validation.valid) continue;
                alternatives.push({ day: candidateDay, validation, attempt });
            }
            return alternatives;
        }

        function openIntelligentDayRegeneration(dayName) {
            const modal = document.getElementById('modalDayRegeneration');
            if (!modal) return regenerateSingleDay(dayName);
            modal.dataset.dayName = dayName;
            document.getElementById('modalDayRegenerationTitle').textContent = `Alternativas para ${dayName}`;
            const list = document.getElementById('dayRegenerationList');
            list.innerHTML = '<div class="day-regeneration-loading">Buscando alternativas que cumplan todas las normas…</div>';
            modal.classList.remove('hidden');
            window.setTimeout(() => {
                const alternatives = getIntelligentDayAlternatives(dayName, 3);
                if (!alternatives.length) {
                    list.innerHTML = '<div class="day-regeneration-empty">No he encontrado una alternativa completa que mantenga todas las reglas actuales. El día original no se modifica.</div>';
                    return;
                }
                list.innerHTML = alternatives.map((alternative, index) => {
                    const primeros = alternative.day.filter(s => s.cat === 'Primero');
                    const segundos = alternative.day.filter(s => s.cat === 'Segundo');
                    const renderGroup = (label, slots) => `<div class="day-regeneration-group"><div class="day-regeneration-group-label">${label}</div>${slots.map(s => { const status = getMenuDishStatusFlags(s.dish, s); const badges = [status.platoElaborado ? '<span class="menu-status-badge prepared">Plato elaborado</span>' : '', status.precocinado ? '<span class="menu-status-badge precooked">Precocinado</span>' : ''].filter(Boolean).join(''); return `<div class="day-regeneration-dish"><span>${escapeHtml(s.slotLabel)}</span><div class="day-regeneration-dish-content"><strong>${escapeHtml(s.dish?.nombre || 'Sin asignar')}</strong>${badges ? `<div class="menu-status-badges">${badges}</div>` : ''}</div></div>`; }).join('')}</div>`;
                    return `<div class="day-regeneration-option"><div class="day-regeneration-option-head"><div><span class="day-regeneration-option-number">OPCIÓN ${index + 1}</span><span class="day-regeneration-option-note">Cumple todas las normas</span></div><button type="button" class="primary-action day-regeneration-select" onclick="confirmIntelligentDayRegeneration(${index})">Elegir esta alternativa</button></div>${renderGroup('PRIMEROS', primeros)}${renderGroup('SEGUNDOS', segundos)}</div>`;
                }).join('');
                modal._alternatives = alternatives;
            }, 30);
        }

        function closeIntelligentDayRegeneration() {
            const modal = document.getElementById('modalDayRegeneration');
            if (!modal) return;
            modal.classList.add('hidden');
            modal._alternatives = [];
            modal.dataset.dayName = '';
        }

        function confirmIntelligentDayRegeneration(index) {
            const modal = document.getElementById('modalDayRegeneration');
            const dayName = modal?.dataset?.dayName;
            const alternative = modal?._alternatives?.[index];
            if (!dayName || !alternative || !currentMenu?.days?.[dayName]) return;
            currentMenu.days[dayName] = JSON.parse(JSON.stringify(alternative.day));
            shoppingManualStockKeys.clear();
            lastGenerationDiagnostics = { valid: true, errors: [], attempts: alternative.attempts || alternative.attempt || 1, dayName, intelligent: true };
            saveAll();
            closeIntelligentDayRegeneration();
            renderGeneratorView();
        }

        function regenerateSingleDay(dayName) {
            openIntelligentDayRegeneration(dayName);
        }

        function validateWeeklyMenu(menu) {
            const errors = [];
            if (!menu || typeof menu !== 'object' || Array.isArray(menu) || !menu.days || typeof menu.days !== 'object' || Array.isArray(menu.days)) {
                return { valid: false, errors: ['El menú está vacío o tiene una estructura inválida.'] };
            }
            const structure = getMenuStructure();
            const structuralCheck = window.GastroOSMenuStructureValidator.validateMenuStructure(menu, daysList, structure);
            errors.push(...structuralCheck.errors);
            const days = structuralCheck.days;
            const vegetableKeys = new Set();
            let weeklyGuisos = 0;
            let weeklyFritos = 0;
            const fishSpecies = new Set();

            days.forEach((dayName, dayIndex) => {
                const slots = menu.days[dayName] || [];
                if (!Array.isArray(slots) || slots.length !== structure.slotSpecs.length) return;

                const firsts = slots.filter(s => s.cat === 'Primero').map(s => s.dish).filter(Boolean);
                const seconds = slots.filter(s => s.cat === 'Segundo').map(s => s.dish).filter(Boolean);
                const dailyRules = window.GastroOSMenuDailyRules.validateDayComposition({
                    dayName, firsts, seconds, structure,
                    avoidLiquidFirsts: getKitchenRule('evitarLiquidosEnPrimeros', true),
                    liquidFirstSubtypes: Array.from(LIQUID_FIRST_SUBTYPES),
                    avoidRepeatedSecondPreparation: getKitchenRule('evitarPresentacionSegundoRepetida', true),
                    getSecondPreparationFamily
                });
                errors.push(...dailyRules.errors);

                firsts.filter(d => d?.subcategoria_primero === 'Verdura').forEach(vegetableDish => {
                    const vegetableKey = getPrimaryVegetableKey(vegetableDish);
                    if (vegetableKey) {
                        if (getKitchenRule('evitarVerduraRepetida', true) && vegetableKeys.has(vegetableKey)) errors.push(`${dayName}: se repite la verdura principal durante la semana.`);
                        vegetableKeys.add(vegetableKey);
                    }
                });

                const meats = seconds.filter(m => m?.proteina_segundo === 'Carne');
                const fishOptions = seconds.filter(m => m?.proteina_segundo === 'Pescado');
                const dayGuisos = dailyRules.guisos;
                const dayFritos = dailyRules.fritos;
                weeklyGuisos += dayGuisos;
                weeklyFritos += dayFritos;

                fishOptions.forEach(fish => {
                    if (!fish.especie_pescado) errors.push(`${dayName}: un pescado no tiene especie exacta.`);
                    if (fish.especie_pescado) {
                        const fishKey = String(fish.especie_pescado).toLowerCase();
                        if (fishSpecies.has(fishKey)) errors.push(`${dayName}: la especie de pescado se repite en la semana.`);
                        fishSpecies.add(fishKey);
                    }
                });

                errors.push(...window.GastroOSMenuContinuityRules.validateDayContinuity({
                    dayName,
                    dayIndex,
                    days,
                    menuDays: menu.days,
                    firsts,
                    meats,
                    dayFritos,
                    avoidConsecutiveFirsts: getKitchenRule('evitarRepeticionPrimeroConsecutivo', true),
                    avoidConsecutiveFritos: true,
                    avoidThreeConsecutiveMeatAnimals: true,
                    consecutiveFirstSubtypes: Array.from(CONSECUTIVE_FIRST_SUBTYPES),
                    liquidFirstLabels: FIRST_LABELS,
                    getProteinLabel
                }));
            });

            const weeklyCreams = getWeeklyFirstSubtypeCount(menu.days, "cremas");
            const weeklyLimitsCheck = window.GastroOSMenuFrequencyRules.validateWeeklyLimits(
                {
                    fritos: weeklyFritos,
                    creams: weeklyCreams,
                    pasta: getWeeklyFirstFamilyCount(menu.days, 'pasta'),
                    legumes: getWeeklyFirstFamilyCount(menu.days, 'legumbres'),
                    rice: getWeeklyFirstFamilyCount(menu.days, 'arroz'),
                    vegetableWhole: getWeeklyFirstFamilyCount(menu.days, 'verdura_entera'),
                    soups: getWeeklyFirstFamilyCount(menu.days, 'sopas'),
                    guisos: weeklyGuisos
                },
                {
                    maxFritos: getMaxWeeklyFritos(),
                    maxCreams: getMaxWeeklyCreams(),
                    maxPasta: getMaxWeeklyPasta(),
                    maxLegumes: getMaxWeeklyLegumes(),
                    maxRice: getMaxWeeklyRice(),
                    maxVegetableWhole: getMaxWeeklyVegetableWhole(),
                    maxSoups: getMaxWeeklySoups(),
                    guisos: getGuisoDays().size
                }
            );
            errors.push(...weeklyLimitsCheck.errors);

            days.forEach((dayName, dayIndex) => {
                const meats = (menu.days[dayName] || []).filter(s => s.cat === 'Segundo' && s.dish?.proteina_segundo === 'Carne').map(s => s.dish).filter(Boolean);
                const dayGuisos = meats.filter(m => m?.tecnica_cocina === "tecnica_guiso").length;
                const required = getGuisoDays().has(dayIndex);
                if (meats.length > 0 && required && dayGuisos !== 1) errors.push(`${dayName}: debe haber exactamente 1 guiso.`);
                if (!required && dayGuisos !== 0) errors.push(`${dayName}: no debe haber guiso.`);
            });

            const previousWeekHistoryMenu = getPreviousWeekHistoryMenu();
            if (previousWeekHistoryMenu?.days && menu?.generatedAt) {
                const previousSerialized = JSON.stringify(daysList.map(day => (previousWeekHistoryMenu.days[day] || []).map(slot => slot?.dish?.id || "none")));
                const currentSerialized = JSON.stringify(daysList.map(day => (menu.days[day] || []).map(slot => slot?.dish?.id || "none")));
                if (previousSerialized === currentSerialized) errors.push('Semana: el menú completo coincide exactamente con la semana anterior.');
                const previousSignatures = getPreviousWeekPatternSignatures(previousWeekHistoryMenu);
                daysList.forEach(dayName => {
                    const currentSignature = dayPatternSignature(menu.days[dayName] || []);
                    if (currentSignature && previousSignatures.has(currentSignature)) {
                        errors.push(`${dayName}: el patrón estructural coincide con un día de la semana anterior.`);
                    }
                });
            }

            return { valid: errors.length === 0, errors };
        }

        function getKitchenRulesSummary() {
            const p = getKitchenProfile();
            const guiso = p.guisoDays.map(i => window.GastroOSKitchenRules.DAYS[i]).join(', ') || 'ningún día';
            const fish = p.especiesPescadoPermitidas.map(v => getProteinLabel('fish', v)).join(', ') || 'ninguna seleccionada';
            const meats = p.animalesCarnePermitidos.map(v => getProteinLabel('meat', v)).join(', ') || 'ninguno seleccionado';
            return { p, guiso, fish, meats };
        }

        function renderGeneratorView() {
            const container = document.getElementById('generatedMenuContainer');
            container.innerHTML = '';

            if (!currentMenu || !currentMenu.days || Object.keys(currentMenu.days).length === 0) {
                container.innerHTML = `
                    <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 text-center space-y-3">
                        <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">📋</div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-sm">Menú no generado todavía</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">Primero genera un menú semanal.</p>
                    </div>
                `;
                return;
            }

            const { p, guiso, fish, meats } = getKitchenRulesSummary();
            const rulesBox = document.createElement('div');
            rulesBox.className = 'generator-rules-card';
            const diagnostics = lastGenerationDiagnostics?.valid === false
                ? `<div class="generator-diagnostic"><strong>Revisión:</strong> ${lastGenerationDiagnostics.errors.slice(0, 4).map(escapeHtml).join(' · ')}</div>`
                : '';
            const stockPriorityLabels = { alta: 'Alta · Aprovechar stock si es compatible', normal: 'Normal · Aprovechar stock cuando encaje', ninguna: 'Ninguna · Priorizar variedad' };
            const guisoText = guiso === 'ningún día' ? 'Sin días de guiso' : guiso;
            const structure = getMenuStructure();
            const firstSummary = `Verdura ${p.primerosVerdura} · Cuchara ${p.primerosCuchara} · Tenedor ${p.primerosTenedor}`;
            const secondSummary = `Carne ${p.segundosCarne} · Pescado ${p.segundosPescado}`;
            const consecutiveLabel = (value) => value ? 'Sí' : 'No';
            rulesBox.innerHTML = `<details class="generator-rules-details"><summary><span><b>NORMAS APLICADAS</b><small>Ver configuración de esta cocina</small></span><span class="accordion-chevron">⌄</span></summary><div class="generator-rules-body"><div class="generator-rule-grid"><div><b>Primeros</b><span>${escapeHtml(firstSummary)} · ${structure.firstSpecs.length} total</span></div><div><b>Segundos</b><span>${escapeHtml(secondSummary)} · ${structure.secondSpecs.length} total</span></div><div><b>Guisos</b><span>${escapeHtml(guisoText)}</span></div><div><b>Fritos</b><span>Máx. ${p.maxWeeklyFritos} por semana</span></div><div><b>Cremas</b><span>Máx. ${p.maxWeeklyCreams} por semana</span></div><div><b>Pasta</b><span>Máx. ${p.maxWeeklyPasta} días · consecutiva: ${consecutiveLabel(p.permitirPastaConsecutiva)}</span></div><div><b>Legumbres</b><span>Máx. ${p.maxWeeklyLegumes} días · consecutiva: ${consecutiveLabel(p.permitirLegumbresConsecutivas)}</span></div><div><b>Arroz</b><span>Máx. ${p.maxWeeklyRice} días · consecutivo: ${consecutiveLabel(p.permitirArrozConsecutivo)}</span></div><div><b>Verdura entera</b><span>Máx. ${p.maxWeeklyVegetableWhole} días</span></div><div><b>Sopas y caldos</b><span>Máx. ${p.maxWeeklySoups} días · consecutivos: ${consecutiveLabel(p.permitirSopasConsecutivas)}</span></div><div><b>Carnes</b><span>${escapeHtml(meats)}</span></div><div><b>Pescados</b><span>${escapeHtml(fish)}</span></div><div><b>Stock</b><span>${escapeHtml(stockPriorityLabels[p.prioridadStock] || p.prioridadStock)}</span></div></div></div></details>${diagnostics}`;
            container.appendChild(rulesBox);

            const daysToRender = [selectedGeneratorDay].filter(day => daysList.includes(day));

            daysToRender.forEach(dayName => {
                const slots = currentMenu.days[dayName] || [];
                const dayCard = document.createElement('div');
                dayCard.className = "bg-white/80 p-4 rounded-2xl space-y-4 transition-all";
                const primeros = slots.filter(s => s.cat === 'Primero');
                const segundos = slots.filter(s => s.cat === 'Segundo');

                dayCard.innerHTML = `
                    <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            <h3 class="font-bold text-gray-800 dark:text-gray-100 text-base">${dayName}</h3>
                        </div>
                        <button onclick="openIntelligentDayRegeneration('${dayName}')" class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                            Buscar alternativas ↻
                        </button>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">1. Primeros Platos</h4>
                        <div class="space-y-2">${primeros.map((s, idx) => renderSlotCard(dayName, idx, s)).join('')}</div>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">2. Segundos Platos</h4>
                        <div class="space-y-2">${segundos.map((s, idx) => renderSlotCard(dayName, idx+primeros.length, s)).join('')}</div>
                    </div>
                `;
                container.appendChild(dayCard);
            });
        }

        function getMenuDishStatusFlags(dish, slot = null) {
            const id = dish?.id != null ? String(dish.id) : '';
            const nameKey = normalizeFoodKey(dish?.nombre);
            const source = dishes.find(d => String(d?.id ?? '') === id)
                || dishes.find(d => normalizeFoodKey(d?.nombre) === nameKey);
            const preparedByStock = !!(dish && isPreparedStockDish(dish));
            return {
                platoElaborado: !!(dish?.plato_elaborado || source?.plato_elaborado || preparedByStock || slot?.isPreparedStock),
                precocinado: !!(dish?.precocinado || source?.precocinado)
            };
        }

        function renderSlotCard(dayName, index, slot) {
            const isPrimero = slot.cat === 'Primero';
            let dishName = slot.dish ? slot.dish.nombre : "Sin asignar";
            const warningBadge = slot.warning ? `<span class="text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-bold ml-2">${escapeHtml(slot.warning)}</span>` : '';
            const allergenNames = slot.dish && Array.isArray(slot.dish.alergenos)
                ? slot.dish.alergenos.map(a => ALLERGEN_LABELS[a]).filter(Boolean)
                : [];
            const allergenLine = allergenNames.length
                ? `<div class="text-[9px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">Alérgenos: ${allergenNames.map(escapeHtml).join(' · ')}</div>`
                : '';
            const menuStatus = getMenuDishStatusFlags(slot.dish, slot);
            const proteinBadges = [
                menuStatus.platoElaborado ? '<span class="menu-status-badge prepared">Plato elaborado</span>' : '',
                menuStatus.precocinado ? '<span class="menu-status-badge precooked">Precocinado</span>' : ''
            ].filter(Boolean).join('');

            const safeDay = escapeJsArg(dayName);
            const safeCat = escapeJsArg(slot.cat);
            const safeFirstSubtype = escapeJsArg(isPrimero ? (slot.dish?.subcategoria_primero || '') : '');
            const safeProtein = escapeJsArg(!isPrimero ? (slot.dish?.proteina_segundo || '') : '');
            return `
                <div class="gastro-slot flex items-center justify-between p-3">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <div class="min-w-0 w-full">
                            <div class="text-[10px] font-bold text-gray-500 uppercase">${escapeHtml(slot.slotLabel)}</div>
                            <div class="gastro-slot-title-row ${proteinBadges ? 'has-badges' : 'no-badges'}">
                                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight min-w-0">${escapeHtml(dishName)}${warningBadge ? ` ${warningBadge}` : ''}</div>
                                ${proteinBadges ? `<div class="menu-status-badges-inline">${proteinBadges}</div>` : ''}
                            </div>
                            ${allergenLine}
                        </div>
                    </div>
                    <button onclick="openSwapModal(decodeURIComponent('${safeDay}'), ${index}, decodeURIComponent('${safeCat}'), decodeURIComponent('${safeFirstSubtype}'), decodeURIComponent('${safeProtein}'))" class="gastro-slot-action flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                </div>
            `;
        }
