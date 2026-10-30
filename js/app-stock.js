/* GastroOS — Stock y previsión.
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */
        // --- 5. STOCK Y PREVISIÓN ---

        function getSecondProteinIngredients() {
            const unique = new Map();
            dishes
                .map(normalizeDishData)
                .filter(d => d?.categoria === "Segundo")
                .forEach(d => {
                    (Array.isArray(d.ingredientes) ? d.ingredientes : []).forEach(ing => {
                        const providerCategory = String(ing?.categoria_proveedor || "").trim();
                        const name = String(ing?.nombre || "").trim();
                        if (!name || !["Carne", "Pescado"].includes(providerCategory)) return;
                        const key = normalizeFoodKey(name);
                        if (!unique.has(key)) unique.set(key, name);
                    });
                });
            return [...unique.values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
        }

        function getPrecookedRecipes() {
            const unique = new Map();
            dishes
                .map(normalizeDishData)
                .filter(d => d?.precocinado)
                .forEach(d => {
                    const baseIngredient = (Array.isArray(d.ingredientes) ? d.ingredientes : [])
                        .find(ing => String(ing?.categoria_proveedor || "").trim() === "Congelados" && String(ing?.nombre || "").trim());
                    const name = String(baseIngredient?.nombre || "").trim();
                    if (!name) return;
                    const key = normalizeFoodKey(name);
                    if (!unique.has(key)) unique.set(key, { ...d, nombreStock: name, nombreRecetaPrecocinada: String(d.nombre || "").trim() });
                });
            return [...unique.values()].sort((a, b) => String(a.nombreStock).localeCompare(String(b.nombreStock), "es", { sensitivity: "base" }));
        }

        function getPrecookedStockCategory(dish) {
            if (dish?.proteina_segundo === "Carne") return "Carne";
            if (dish?.proteina_segundo === "Pescado") return "Pescado";
            return "Congelados";
        }

        function renderRawIngredientOptions(selectedValue = "") {
            const select = document.getElementById("rawName");
            if (!select) return;
            const ingredients = getSecondProteinIngredients();
            const precooked = getPrecookedRecipes();
            const precookedKeys = new Set(precooked.map(d => normalizeFoodKey(d.nombreStock)));
            const current = String(selectedValue || select.value || "");
            select.innerHTML = '<option value="">Seleccionar...</option>';

            const ingredientGroup = document.createElement("optgroup");
            ingredientGroup.label = "Ingredientes de carne y pescado";
            ingredients.filter(name => !precookedKeys.has(normalizeFoodKey(name))).forEach(name => {
                const option = document.createElement("option");
                option.value = name;
                option.textContent = name;
                ingredientGroup.appendChild(option);
            });
            if (ingredientGroup.children.length) select.appendChild(ingredientGroup);

            if (precooked.length) {
                const precookedGroup = document.createElement("optgroup");
                precookedGroup.label = "Productos precocinados";
                precooked.forEach(dish => {
                    const option = document.createElement("option");
                    option.value = dish.nombreStock;
                    option.textContent = dish.nombreStock;
                    option.dataset.stockType = "precocinado";
                    precookedGroup.appendChild(option);
                });
                select.appendChild(precookedGroup);
            }
            if (current && [...select.options].some(option => option.value === current)) select.value = current;
        }

        function getPreparedDishRecipes() {
            const unique = new Map();
            dishes
                .map(normalizeDishData)
                // Este selector es exclusivamente para platos elaborados; si es precocinado, va a materia prima.
                .filter(d => d?.plato_elaborado && !d?.precocinado)
                .forEach(d => {
                    const name = String(d.nombre || "").trim();
                    if (!name) return;
                    const key = normalizeFoodKey(name);
                    if (!unique.has(key)) unique.set(key, d);
                });
            return [...unique.values()].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));
        }

        function migratePrecookedStockToRawStock() {
            const precookedRecipes = getPrecookedRecipes();
            const precookedByName = new Map();
            precookedRecipes.forEach(d => {
                precookedByName.set(normalizeFoodKey(d.nombreStock), d);
                if (d.nombreRecetaPrecocinada) precookedByName.set(normalizeFoodKey(d.nombreRecetaPrecocinada), d);
            });
            if (!precookedByName.size) return false;

            let changed = false;
            // Corrige también los nombres erróneos que una versión anterior pudo guardar
            // directamente en materia prima (p. ej. el plato completo en vez del congelado base).
            const normalizedRaw = [];
            rawStock.forEach(item => {
                const dish = precookedByName.get(normalizeFoodKey(item?.nombre || ""));
                if (!dish) {
                    normalizedRaw.push(item);
                    return;
                }
                const stockName = String(dish.nombreStock || item.nombre || "").trim();
                const unit = String(item?.unidad || "kg");
                const existing = normalizedRaw.find(stock => normalizeFoodKey(stock?.nombre || "") === normalizeFoodKey(stockName) && String(stock?.unidad || "kg") === unit);
                if (existing) {
                    existing.cantidad = (Number(existing.cantidad) || 0) + (Number(item?.cantidad) || 0);
                } else {
                    normalizedRaw.push({ ...item, nombre: stockName, categoria_proveedor: "Congelados", tipo_stock: "precocinado" });
                }
                changed = true;
            });
            rawStock = normalizedRaw;

            const keepPrepared = [];
            preparedStock.forEach(item => {
                const dish = precookedByName.get(normalizeFoodKey(item?.nombre || ""));
                if (!dish) {
                    keepPrepared.push(item);
                    return;
                }
                const hasTotal = item?.cantidadTotal !== undefined && item?.cantidadTotal !== null && item?.cantidadTotal !== "";
                // Las raciones de un plato elaborado no equivalen a kg/L/unidades del producto congelado.
                // Si no existe una cantidad física y una unidad explícita, se conserva el registro
                // para revisión manual en vez de contaminar el stock de materia prima con otra unidad.
                if (!hasTotal || !String(item?.unidad || "").trim()) {
                    keepPrepared.push({ ...item, requiereRevisionPrecocinado: true });
                    return;
                }
                const quantity = Number(item.cantidadTotal);
                const unit = String(item.unidad).trim();
                if (!Number.isFinite(quantity) || quantity < 0) {
                    keepPrepared.push(item);
                    return;
                }
                const stockName = String(dish.nombreStock || item.nombre || "").trim();
                const existing = rawStock.find(stock => normalizeFoodKey(stock?.nombre || "") === normalizeFoodKey(stockName) && String(stock?.unidad || "kg") === unit);
                if (existing) {
                    existing.cantidad = (Number(existing.cantidad) || 0) + quantity;
                    existing.categoria_proveedor = "Congelados";
                    existing.tipo_stock = "precocinado";
                } else {
                    rawStock.unshift({
                        id: String(item?.id || `precocinado-${Date.now()}-${rawStock.length}`),
                        nombre: stockName,
                        cantidad: quantity,
                        unidad: unit,
                        categoria_proveedor: "Congelados",
                        conservacion: "Congelado",
                        tipo_stock: "precocinado"
                    });
                }
                changed = true;
            });
            if (changed) preparedStock = keepPrepared;
            return changed;
        }

        function getPreparedDishByName(name) {
            const target = normalizeFoodKey(name);
            return getPreparedDishRecipes().find(d => normalizeFoodKey(d.nombre) === target) || null;
        }

        function getPreparedAssignmentOptions(dish) {
            const options = [{ value: "Sin asignar", label: "Sin asignar" }];
            if (!dish) return options;

            const normalized = normalizeDishData(dish);
            const isFirst = normalized.categoria === "Primero";
            const isSecond = normalized.categoria === "Segundo";
            const isMeat = normalized.proteina_segundo === "Carne";
            const isFish = normalized.proteina_segundo === "Pescado";
            const isGuiso = normalized.tecnica_cocina === "tecnica_guiso";
            const assignedWeeklyGuisos = preparedStock
                .map(item => getPreparedDishByName(item.nombre))
                .filter(Boolean)
                .filter(d => d.tecnica_cocina === "tecnica_guiso")
                .length;

            daysList.forEach((dayName, dayIndex) => {
                const slotCandidates = isFirst
                    ? [{ slot: "Primero", spec: { cat: "Primero", allowedParents: [normalized.subcategoria_primero] } }]
                    : isSecond
                        ? [{ slot: "Segundo", spec: { cat: "Segundo", protein: normalized.proteina_segundo } }]
                        : [];

                slotCandidates.forEach(({ slot, spec }) => {
                    let compatible = isStructuralMatch(normalized, spec);
                    if (compatible && isGuiso && (!isMeat || !getGuisoDays().has(dayIndex))) compatible = false;
                    if (compatible && isGuiso && assignedWeeklyGuisos >= getGuisoDays().size &&
                        !preparedStock.some(item => normalizeFoodKey(item.nombre) === normalizeFoodKey(normalized.nombre))) {
                        compatible = false;
                    }

                    // Una asignación manual de guiso ya consume el cupo de ese día.
                    // También contamos otros platos elaborados ya asignados para no
                    // ofrecer una combinación que haga imposible cumplir las reglas.
                    const sameDay = preparedStock
                        .filter(item => item.asignacion === `${dayName} - ${slot}` && normalizeFoodKey(item.nombre) !== normalizeFoodKey(normalized.nombre))
                        .map(item => getPreparedDishByName(item.nombre))
                        .filter(Boolean);

                    if (compatible && isSecond) {
                        const sameDaySeconds = preparedStock
                            .filter(item => item.asignacion === `${dayName} - Segundo` && normalizeFoodKey(item.nombre) !== normalizeFoodKey(normalized.nombre))
                            .map(item => getPreparedDishByName(item.nombre))
                            .filter(Boolean);

                        if (isMeat) {
                            const guisosAlready = sameDaySeconds.filter(d => d.tecnica_cocina === "tecnica_guiso").length;
                            const meatAlready = sameDaySeconds.filter(d => d.proteina_segundo === "Carne").length;
                            if (meatAlready >= 2) compatible = false;
                            if (isGuiso && guisosAlready >= 1) compatible = false;
                            // En L/M/V debe quedar exactamente un guiso entre las dos carnes.
                            // Por tanto, no permitimos dar de alta una segunda carne no-guiso
                            // si ya existe otra carne fija ese día y todavía no hay guiso.
                            if (!isGuiso && getGuisoDays().has(dayIndex) && guisosAlready === 0 && meatAlready >= 1) compatible = false;
                            if (!isGuiso && getGuisoDays().has(dayIndex) && guisosAlready >= 1 && sameDaySeconds.filter(d => d.proteina_segundo === "Carne").length >= 2) compatible = false;
                        } else if (isFish) {
                            const fishAlready = sameDaySeconds.filter(d => d.proteina_segundo === "Pescado").length;
                            if (fishAlready >= 1) compatible = false;
                        }
                    }

                    if (compatible) {
                        options.push({
                            value: `${dayName} - ${slot}`,
                            label: `${dayName} - ${slot}`
                        });
                    }
                });
            });

            return options;
        }

        function renderPreparedDishOptions(selectedValue = "") {
            const nameSelect = document.getElementById("prepName");
            const assignmentSelect = document.getElementById("prepAsignacion");
            if (!nameSelect || !assignmentSelect) return;

            const recipes = getPreparedDishRecipes();
            const currentName = String(selectedValue || nameSelect.value || "");
            nameSelect.innerHTML = '<option value="">Seleccionar...</option>';
            recipes.forEach(dish => {
                const option = document.createElement("option");
                option.value = dish.nombre;
                option.textContent = dish.nombre;
                nameSelect.appendChild(option);
            });
            if (currentName && recipes.some(d => d.nombre === currentName)) nameSelect.value = currentName;

            renderPreparedAssignmentOptions(nameSelect.value, assignmentSelect.value);
        }

        function renderPreparedAssignmentOptions(dishName = "", selectedValue = "") {
            const assignmentSelect = document.getElementById("prepAsignacion");
            if (!assignmentSelect) return;
            const dish = getPreparedDishByName(dishName);
            const options = getPreparedAssignmentOptions(dish);
            assignmentSelect.innerHTML = "";
            options.forEach(item => {
                const option = document.createElement("option");
                option.value = item.value;
                option.textContent = item.label;
                assignmentSelect.appendChild(option);
            });
            if (selectedValue && options.some(item => item.value === selectedValue)) {
                assignmentSelect.value = selectedValue;
            } else {
                assignmentSelect.value = "Sin asignar";
            }
        }

        function refreshStockReferenceSelectors() {
            renderRawIngredientOptions();
            renderPreparedDishOptions();
        }

        function renderStockView() {
            updateCalculatedRaciones(false);
            refreshStockReferenceSelectors();
            renderRawStock();
            renderPreparedStock();
        }

        function getTotalRaciones() {
            const base = Math.max(0, Number(settings.comensales) || 0);
            const margin = (Number(settings.margenSeguridadPorcentaje) || 0) / 100;
            return settings.margenActivo ? Math.ceil(base * (1 + margin)) : base;
        }

        function updateCalculatedRaciones(shouldSave = true) {
            const dinersInput = document.getElementById('settingsComensales');
            const marginInput = document.getElementById('settingsMargenSeguridad');
            const base = Math.max(1, parseInt(dinersInput?.value || settings.comensales, 10) || 1);
            const margin = marginInput ? Math.min(100, Math.max(0, Number(marginInput.value) || 0)) : (Number(settings.margenSeguridadPorcentaje) || 0);
            const margen = margin > 0;
            settings.comensales = base;
            settings.margenSeguridadPorcentaje = margin;
            settings.margenActivo = margen;
            if (shouldSave) saveAll();

        }

        function getRawStockServings(item) {
            if (!item) return null;
            const stockName = normalizeFoodKey(item.nombre);
            const stockUnit = String(item.unidad || '').trim().toLowerCase();
            const stockDimension = ['kg', 'g'].includes(stockUnit) ? 'weight' : (['l', 'ml'].includes(stockUnit) ? 'volume' : null);
            if (!stockName || !stockDimension || Number(item.cantidad) <= 0) return null;

            // Las cantidades del recetario son por ración. Para estimar las raciones
            // del stock buscamos únicamente recetas de SEGUNDOS de carne/pescado que
            // utilicen ese ingrediente principal y calculamos una media de sus
            // cantidades por ración. Es una estimación, no una cifra de producción.
            const perServingAmounts = [];
            dishes
                .map(normalizeDishData)
                .filter(d => d?.categoria === 'Segundo' && ['Carne', 'Pescado'].includes(d.proteina_segundo))
                .forEach(dish => {
                    (dish.ingredientes || []).forEach(ing => {
                        const ingredientName = normalizeFoodKey(ing?.nombre);
                        const ingredientUnit = String(ing?.unidad || '').trim().toLowerCase();
                        const ingredientDimension = ['kg', 'g'].includes(ingredientUnit) ? 'weight' : (['l', 'ml'].includes(ingredientUnit) ? 'volume' : null);
                        const quantity = Number(String(ing?.cantidad ?? '').replace(',', '.'));
                        if (!ingredientName || ingredientDimension !== stockDimension || !Number.isFinite(quantity) || quantity <= 0) return;
                        if (!(ingredientName === stockName || window.GastroOSStockUtils.foodNamesMatch(ingredientName, stockName))) return;
                        const basePerServing = (ingredientUnit === 'kg' || ingredientUnit === 'l') ? quantity * 1000 : quantity;
                        perServingAmounts.push(basePerServing);
                    });
                });

            if (!perServingAmounts.length) return null;
            const averagePerServing = perServingAmounts.reduce((sum, value) => sum + value, 0) / perServingAmounts.length;
            if (!Number.isFinite(averagePerServing) || averagePerServing <= 0) return null;

            const stockBase = (stockUnit === 'kg' || stockUnit === 'l') ? Number(item.cantidad) * 1000 : Number(item.cantidad);
            const servings = Math.floor(stockBase / averagePerServing);
            return Number.isFinite(servings) && servings > 0 ? servings : 0;
        }

        function handleAddRawStock(e) {
            e.preventDefault();
            const select = document.getElementById('rawName');
            const nombre = String(select?.value || '').trim();
            const cantidad = Number(String(document.getElementById('rawQty')?.value || '').replace(',', '.'));
            if (!nombre || !Number.isFinite(cantidad) || cantidad <= 0) {
                alert('Selecciona un producto e indica una cantidad mayor que cero.');
                return;
            }
            const precookedDish = getPrecookedRecipes().find(d => normalizeFoodKey(d.nombreStock) === normalizeFoodKey(nombre));
            const item = {
                id: Date.now().toString(),
                nombre: precookedDish ? precookedDish.nombreStock : nombre,
                cantidad,
                unidad: document.getElementById('rawUnit').value,
                categoria_proveedor: precookedDish ? "Congelados" : document.getElementById('rawCategory').value,
                conservacion: document.getElementById('rawConserv').value === 'Refrigerado' ? 'Refrigerado' : 'Congelado',
                ...(precookedDish ? { tipo_stock: 'precocinado' } : {})
            };
            rawStock.unshift(item);
            saveAll();
            renderRawStock();
            document.getElementById('rawStockForm').reset();
            refreshStockReferenceSelectors();
        }

        function renderRawStock() {
            const container = document.getElementById('rawStockList');
            container.innerHTML = '';
            if (rawStock.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 dark:text-gray-500 text-xs py-2">Sin materia prima en stock.</p>';
                return;
            }

            rawStock.forEach(item => {
                const isFresh = String(item.conservacion || "").includes("Refrigerado");
                const calculatedServings = getRawStockServings(item);
                const servingsLabel = calculatedServings !== null ? `≈ ${calculatedServings} raciones aprox.` : '';
                const badgeColor = isFresh ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800" : "bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";

                const card = document.createElement('div');
                card.className = "bg-white/80 p-3.5 rounded-2xl flex justify-between items-center transition-all";
                card.innerHTML = `
                    <div class="pr-2">
                        <div class="flex items-center gap-1.5 mb-1">
                            <h4 class="font-bold text-gray-800 dark:text-gray-100 text-xs">${escapeHtml(item.nombre)}</h4>
                            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold border ${badgeColor}">${isFresh ? 'Refrigerado' : 'Congelado'}</span>
                        </div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400">
                            <span class="font-bold text-indigo-700 dark:text-indigo-400">${escapeHtml(item.cantidad)} ${escapeHtml(item.unidad)}</span> • ${escapeHtml(item.categoria_proveedor)}
                        </div>
                        ${servingsLabel ? `<div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">${escapeHtml(servingsLabel)}</div>` : ''}
                    </div>
                    <div class="flex items-center gap-1">
                        <button type="button" aria-label="Disminuir cantidad" onclick="changeRawQty(decodeURIComponent('${escapeJsArg(item.id)}'), -1)" class="w-7 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">-</button>
                        <button type="button" aria-label="Aumentar cantidad" onclick="changeRawQty(decodeURIComponent('${escapeJsArg(item.id)}'), 1)" class="w-7 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
                        <button type="button" aria-label="Eliminar producto" onclick="deleteRaw(decodeURIComponent('${escapeJsArg(item.id)}'))" class="text-red-500 bg-red-50 dark:bg-red-950 p-1.5 rounded-lg ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function changeRawQty(id, delta) {
            const item = rawStock.find(r => r.id === id);
            if (item) {
                item.cantidad = Math.max(0, +(item.cantidad + delta).toFixed(2));
                saveAll();
                renderRawStock();
            }
        }

        function deleteRaw(id) {
            rawStock = rawStock.filter(r => r.id !== id);
            saveAll();
            renderRawStock();
        }

        function getPrepUnitDimension(unit) {
            const normalizedUnit = String(unit || '').trim().toLowerCase();
            return ['kg', 'g'].includes(normalizedUnit) ? 'weight' : (['l', 'ml'].includes(normalizedUnit) ? 'volume' : null);
        }

        function normalizePrepQuantity(quantity, unit) {
            const value = Number(quantity) || 0;
            const normalizedUnit = String(unit || '').trim().toLowerCase();
            if (normalizedUnit === 'kg' || normalizedUnit === 'l') return value * 1000;
            return value;
        }

        function getPreparedDishMainIngredientAmount(dish, dimension) {
            if (!dish || !Array.isArray(dish.ingredientes)) return null;
            const candidates = dish.ingredientes.filter(ing => {
                const category = String(ing?.categoria_proveedor || '').trim();
                const unitDimension = getPrepUnitDimension(ing?.unidad);
                const quantity = Number(String(ing?.cantidad ?? '').replace(',', '.'));
                return ['Carne', 'Pescado'].includes(category) &&
                    unitDimension === dimension &&
                    Number.isFinite(quantity) && quantity > 0;
            });
            if (!candidates.length) return null;

            // En segundos, el primer ingrediente de Carne/Pescado con cantidad es
            // la referencia del producto proteico principal y, por tanto, la base
            // para convertir kg/L de plato elaborado en raciones.
            const ing = candidates[0];
            return normalizePrepQuantity(ing.cantidad, ing.unidad);
        }

        function inferProteinFamilyFromName(name) {
            const value = normalizeFoodKey(name);
            const aliases = [
                [['cerdo', 'lomo', 'magro', 'longaniza', 'chorizo', 'costilla', 'secreto'], 'cerdo'],
                [['pollo', 'pechuga', 'jamoncito', 'jamoncitos'], 'pollo'],
                [['pavo'], 'pavo'],
                [['ternera', 'ternera'], 'ternera'],
                [['cordero', 'cordero'], 'cordero'],
                [['conejo'], 'conejo'],
                [['merluza'], 'merluza'],
                [['bacalao'], 'bacalao'],
                [['salmón', 'salmon'], 'salmon'],
                [['atún', 'atun'], 'atun'],
                [['caballa'], 'caballa'],
                [['sardina'], 'sardina'],
                [['dorada'], 'dorada'],
                [['lubina'], 'lubina']
            ];
            for (const [terms, family] of aliases) {
                if (terms.some(term => value.includes(normalizeFoodKey(term)))) return family;
            }
            return '';
        }

        function getDishProteinReferenceKey(dish) {
            if (!dish) return '';
            if (dish.proteina_segundo === 'Carne') return String(dish.animal_carne || '').replace(/^carne_/, '').toLowerCase();
            if (dish.proteina_segundo === 'Pescado') return normalizeFoodKey(dish.especie_pescado || '');
            return '';
        }

        function getPreparedServingsReference(item, preparedUnit) {
            const dimension = getPrepUnitDimension(preparedUnit);
            if (!dimension) return { amount: null, mode: 'none' };
            const targetName = normalizeFoodKey(item?.nombre);
            if (!targetName) return { amount: null, mode: 'none' };

            const normalizedDishes = dishes.map(normalizeDishData);
            const exact = normalizedDishes.find(d => normalizeFoodKey(d?.nombre) === targetName);
            const exactAmount = getPreparedDishMainIngredientAmount(exact, dimension);
            if (exactAmount !== null) return { amount: exactAmount, mode: 'receta' };

            // Si no existe una receta guía exacta, intentamos encontrar platos del
            // mismo animal/especie. Por ejemplo, "Guiso de cerdo" puede apoyarse
            // en cualquier segundo de cerdo del recetario.
            const inferred = inferProteinFamilyFromName(item.nombre);
            const similar = normalizedDishes.filter(d => {
                if (d?.categoria !== 'Segundo' || !['Carne', 'Pescado'].includes(d?.proteina_segundo)) return false;
                const key = getDishProteinReferenceKey(d);
                if (!inferred) return false;
                return key === inferred || normalizeFoodKey(key).includes(normalizeFoodKey(inferred));
            });
            const similarAmounts = similar
                .map(d => getPreparedDishMainIngredientAmount(d, dimension))
                .filter(v => Number.isFinite(v) && v > 0);
            if (similarAmounts.length) {
                const average = similarAmounts.reduce((sum, value) => sum + value, 0) / similarAmounts.length;
                return { amount: average, mode: 'similar' };
            }

            // Último recurso: media de todos los segundos con proteína principal
            // cuantificada. Es una estimación deliberadamente aproximada cuando
            // no existe una receta comparable en el recetario.
            const genericAmounts = normalizedDishes
                .filter(d => d?.categoria === 'Segundo' && ['Carne', 'Pescado'].includes(d?.proteina_segundo))
                .map(d => getPreparedDishMainIngredientAmount(d, dimension))
                .filter(v => Number.isFinite(v) && v > 0);
            if (genericAmounts.length) {
                const average = genericAmounts.reduce((sum, value) => sum + value, 0) / genericAmounts.length;
                return { amount: average, mode: 'aproximado' };
            }
            return { amount: null, mode: 'none' };
        }

        function getDishPerServingQuantity(dishName, preparedUnit) {
            const reference = getPreparedServingsReference({ nombre: dishName }, preparedUnit);
            return reference.amount;
        }

        function getPreparedServings(item) {
            if (item.cantidadTotal !== undefined && item.unidad) {
                const reference = getPreparedServingsReference(item, item.unidad);
                return reference.amount !== null
                    ? Math.floor(normalizePrepQuantity(item.cantidadTotal, item.unidad) / reference.amount)
                    : null;
            }
            return Number.isFinite(Number(item.raciones)) ? Number(item.raciones) : null;
        }

        function getPreparedServingsLabel(item) {
            if (item?.cantidadTotal === undefined || !item?.unidad) return '';
            const reference = getPreparedServingsReference(item, item.unidad);
            const servings = getPreparedServings(item);
            if (servings === null) return 'Raciones: sin referencia suficiente';
            return `≈ ${servings} raciones aprox.`;
        }

        function handleAddPrepStock(e) {
            e.preventDefault();
            const cantStr = document.getElementById('prepCantidad').value.toString().replace(',', '.');
            const item = {
                id: Date.now().toString(),
                nombre: document.getElementById('prepName').value.trim(),
                cantidadTotal: parseFloat(cantStr) || 0,
                unidad: document.getElementById('prepUnidad').value,
                asignacion: document.getElementById('prepAsignacion').value
            };
            preparedStock.unshift(item);
            saveAll();
            renderPreparedStock();
            document.getElementById('prepStockForm').reset();
            renderPreparedDishOptions();
        }

        function renderPreparedStock() {
            const container = document.getElementById('prepStockList');
            container.innerHTML = '';
            if (preparedStock.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 dark:text-gray-500 text-xs py-2">Sin platos elaborados en stock.</p>';
                return;
            }

            preparedStock.forEach(item => {
                const isAssigned = item.asignacion && item.asignacion !== "Sin asignar";
                const badgeColor = isAssigned ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700";
                const calculatedServings = getPreparedServings(item);
                const quantityLabel = item.cantidadTotal !== undefined ? `${item.cantidadTotal} ${item.unidad}` : `${item.raciones} rac.`;
                const servingsLabel = getPreparedServingsLabel(item) || (calculatedServings !== null ? `≈ ${calculatedServings} raciones` : '');

                const card = document.createElement('div');
                card.className = "bg-white/80 p-3.5 rounded-2xl flex justify-between items-center transition-all";
                card.innerHTML = `
                    <div class="pr-2">
                        <h4 class="font-bold text-gray-800 dark:text-gray-100 text-xs mb-1">${escapeHtml(item.nombre)}</h4>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">${escapeHtml(quantityLabel)}</span>
                            ${servingsLabel ? `<span class="text-[10px] text-gray-500 dark:text-gray-400">${escapeHtml(servingsLabel)}</span>` : ''}
                            <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold border ${badgeColor}">${escapeHtml(item.asignacion || "Sin asignar")}</span>
                            ${item.requiereRevisionPrecocinado ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-semibold border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">Revisar unidad del precocinado</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button type="button" aria-label="Disminuir cantidad" onclick="changePrepQty(decodeURIComponent('${escapeJsArg(item.id)}'), -1)" class="px-2 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">-</button>
                        <button type="button" aria-label="Aumentar cantidad" onclick="changePrepQty(decodeURIComponent('${escapeJsArg(item.id)}'), 1)" class="px-2 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
                        <button type="button" aria-label="Eliminar plato preparado" onclick="deletePrep(decodeURIComponent('${escapeJsArg(item.id)}'))" class="text-red-500 bg-red-50 dark:bg-red-950 p-1.5 rounded-lg ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function changePrepQty(id, delta) {
            const item = preparedStock.find(p => p.id === id);
            if (item) {
                if (item.cantidadTotal !== undefined) {
                    item.cantidadTotal = Math.max(0, +(Number(item.cantidadTotal) + delta).toFixed(2));
                } else {
                    item.raciones = Math.max(0, Number(item.raciones) + (delta * 10));
                }
                saveAll();
                renderPreparedStock();
            }
        }

        function deletePrep(id) {
            preparedStock = preparedStock.filter(p => p.id !== id);
            saveAll();
            renderPreparedStock();
        }
