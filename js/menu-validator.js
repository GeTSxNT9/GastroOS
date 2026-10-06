(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GastroOSMenuValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function validateWeeklyMenu(menu, ctx) {
        const { daysList, GUISO_DAYS, LIQUID_FIRST_SUBTYPES, CONSECUTIVE_FIRST_SUBTYPES, FIRST_LABELS, MEAT_LABELS, getPrimaryVegetableKey, getSecondPreparationFamily, getWeeklyFirstSubtypeCount, getPreviousWeekHistoryMenu, getPreviousWeekPatternSignatures, dayPatternSignature } = ctx;

            const errors = [];
            const days = daysList.filter(day => menu?.days?.[day]);
            if (days.length !== daysList.length) {
                daysList.filter(day => !menu?.days?.[day]).forEach(day => errors.push(`${day}: falta el día completo.`));
            }
            const expectedLabels = [
                "1º Verdura",
                "1º Cuchara",
                "1º Tenedor / Hidratos",
                "2º Carne (Opción 1)",
                "2º Carne (Opción 2)",
                "2º Pescado"
            ];
            const usedIds = new Set();
            const vegetableKeys = new Set();
            let weeklyGuisos = 0;
            let weeklyFritos = 0;
            const fishSpecies = new Set();

            days.forEach((dayName, dayIndex) => {
                const slots = menu.days[dayName] || [];
                if (slots.length !== 6) {
                    errors.push(`${dayName}: deben existir exactamente 6 opciones.`);
                    return;
                }

                slots.forEach((slot, index) => {
                    if (slot.slotLabel !== expectedLabels[index]) {
                        errors.push(`${dayName}: slot ${index + 1} no respeta la estructura fija.`);
                    }
                    const id = slot.dish?.id;
                    if (id && id !== "none") {
                        const normalizedId = String(id);
                        if (usedIds.has(normalizedId)) errors.push(`${dayName}: el plato "${slot.dish?.nombre || ""}" se repite en la semana.`);
                        usedIds.add(normalizedId);
                    }
                });

                const verdura = slots[0]?.dish;
                const cuchara = slots[1]?.dish;
                const tenedor = slots[2]?.dish;
                if (verdura?.subcategoria_primero !== "Verdura") errors.push(`${dayName}: sin opción compatible de verdura.`);
                if (cuchara?.subcategoria_primero !== "Cuchara") errors.push(`${dayName}: sin opción compatible de cuchara.`);
                if (tenedor?.subcategoria_primero !== "Tenedor") errors.push(`${dayName}: sin opción compatible de tenedor.`);

                const firsts = [verdura, cuchara, tenedor].filter(Boolean);
                if (firsts.filter(d => LIQUID_FIRST_SUBTYPES.has(d?.subtipo_primero)).length > 1) {
                    errors.push(`${dayName}: no se pueden combinar crema de verduras y sopas o caldos en los primeros.`);
                }
                if (verdura?.subtipo_primero === "cremas" && ["guisos", "legumbres"].includes(cuchara?.subtipo_primero)) {
                    const goodStarch = ["arroces", "pastas", "pastas_rellenas"].includes(tenedor?.subtipo_primero);
                    if (!goodStarch) errors.push(`${dayName}: hay una crema y un plato de cuchara, debe ser un hidrato tipo arroz o pasta.`);
                }

                const vegetableKey = getPrimaryVegetableKey(verdura);
                if (vegetableKey) {
                    if (vegetableKeys.has(vegetableKey)) errors.push(`${dayName}: se repite la verdura principal durante la semana.`);
                    vegetableKeys.add(vegetableKey);
                }

                const meats = slots.slice(3, 5).map(s => s.dish).filter(Boolean);
                if (meats.length !== 2) errors.push(`${dayName}: deben existir 2 carnes.`);
                const meatAnimals = meats.map(m => m?.animal_carne).filter(Boolean);
                if (new Set(meatAnimals).size !== meatAnimals.length) errors.push(`${dayName}: las dos carnes usan el mismo animal.`);
                if (meats.some(m => m?.proteina_segundo !== "Carne")) errors.push(`${dayName}: una opción de carne no está marcada como Carne.`);

                const dayGuisos = meats.filter(m => m?.tecnica_cocina === "tecnica_guiso").length;
                const dayFritos = meats.filter(m => m?.tecnica_cocina === "tecnica_frito_rebozado").length;
                if (dayGuisos > 1) errors.push(`${dayName}: hay dos carnes guisadas.`);
                if (dayFritos > 1) errors.push(`${dayName}: hay dos fritos o rebozados.`);
                weeklyGuisos += dayGuisos;
                weeklyFritos += dayFritos;

                const fish = slots[5]?.dish;
                if (fish?.proteina_segundo !== "Pescado") errors.push(`${dayName}: falta el pescado obligatorio.`);
                if (fish && !fish.especie_pescado) errors.push(`${dayName}: el pescado no tiene especie exacta.`);
                if (fish?.especie_pescado) {
                    const fishKey = String(fish.especie_pescado).toLowerCase();
                    if (fishSpecies.has(fishKey)) errors.push(`${dayName}: la especie de pescado se repite en la semana.`);
                    fishSpecies.add(fishKey);
                }

                const secondFamilies = slots.slice(3, 6).map(s => getSecondPreparationFamily(s.dish)).filter(Boolean);
                if (new Set(secondFamilies).size !== secondFamilies.length) {
                    errors.push(`${dayName}: no se puede repetir la misma forma de preparación en los segundos.`);
                }

                if (dayIndex > 0) {
                    const prev = menu.days[days[dayIndex - 1]] || [];
                    const prevFirsts = prev.slice(0, 3).map(s => s.dish).filter(Boolean);
                    const currentFirsts = [verdura, cuchara, tenedor].filter(Boolean);
                    currentFirsts.forEach(first => {
                        const subtype = first?.subtipo_primero;
                        if (CONSECUTIVE_FIRST_SUBTYPES.has(subtype) &&
                            prevFirsts.some(d => d?.subtipo_primero === subtype)) {
                            errors.push(`${dayName}: ${FIRST_LABELS[subtype] || subtype} repetido en días consecutivos.`);
                        }
                    });

                    const previousDayFritos = prev.slice(3, 5).some(s => s.dish?.tecnica_cocina === "tecnica_frito_rebozado");
                    if (dayFritos > 0 && previousDayFritos) {
                        errors.push(`${dayName}: no puede haber frito en días consecutivos.`);
                    }
                }

                if (dayIndex >= 2) {
                    const previousTwoAnimals = [
                        ...(menu.days[days[dayIndex - 1]] || []).slice(3, 5).map(s => s.dish?.animal_carne),
                        ...(menu.days[days[dayIndex - 2]] || []).slice(3, 5).map(s => s.dish?.animal_carne)
                    ].filter(Boolean);

                    meats.forEach(m => {
                        if (m?.animal_carne && previousTwoAnimals.filter(a => a === m.animal_carne).length >= 2) {
                            errors.push(`${dayName}: ${MEAT_LABELS[m.animal_carne] || m.animal_carne} aparece 3 días consecutivos.`);
                        }
                    });
                }
            });

            if (weeklyFritos > 2) errors.push(`Semana: hay ${weeklyFritos} fritos o rebozados; el máximo es 2.`);
            const weeklyCreams = getWeeklyFirstSubtypeCount(menu.days, "cremas");
            if (weeklyCreams > 2) errors.push(`Semana: hay ${weeklyCreams} días de crema; el máximo es 2.`);
            if (weeklyGuisos !== 3) errors.push(`Semana: debe haber exactamente 3 guisos; hay ${weeklyGuisos}.`);

            days.forEach((dayName, dayIndex) => {
                const meats = (menu.days[dayName] || []).slice(3, 5).map(s => s.dish).filter(Boolean);
                const dayGuisos = meats.filter(m => m?.tecnica_cocina === "tecnica_guiso").length;
                const required = GUISO_DAYS.has(dayIndex);
                if (required && dayGuisos !== 1) errors.push(`${dayName}: debe haber exactamente 1 guiso.`);
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
    return { validateWeeklyMenu };
});
