/* GastroOS — Estado, catálogos, perfil de cocina y carga de datos.
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */


        // --- 1. DATOS Y MAPAS DE ESTADO ---
        const demandMap = {
            "Alta": { text: "🟢 Alta", class: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800" },
            "Media": { text: "🟡 Media", class: "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800" },
            "Baja": { text: "🔴 Baja", class: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800" }
        };

        // Porcentaje aproximado de las raciones previstas que se calcula para cada plato
        // en función de su demanda: Alta 70%, Media 50%, Baja 30%.
        const DEMAND_PORTION_FACTOR = {
            Alta: 0.70,
            Media: 0.50,
            Baja: 0.30
        };

        function getDemandPortionFactor(demand) {
            return DEMAND_PORTION_FACTOR[demand] ?? DEMAND_PORTION_FACTOR.Media;
        }


        const defaultSettings = {
            comensales: 100,
            margenActivo: true,
            margenSeguridadPorcentaje: 30,
            darkMode: false,
            kitchenProfile: { ...window.GastroOSKitchenRules.DEFAULT_RULES }
        };
        let productAllergenMap = {};
        let recipeProteinCatalog = { fish: [], meat: [] };
        // Marcas temporales de la lista de compra: no modifican el stock real ni se guardan.
        let shoppingManualStockKeys = new Set();
        const proveedorCategorias = ["Carne", "Pescado", "Lácteos", "Verduras", "Secos", "Congelados"];
        const daysList = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        const FIRST_SUBCATEGORIES = {
            cuchara: ["legumbres", "guisos", "sopas_o_caldos"],
            verdura: ["cremas", "verduras_enteras"],
            tenedor: ["pastas", "pastas_rellenas", "arroces", "otros_hidratos"]
        };
        const MEAT_ANIMALS = ["carne_pollo", "carne_pavo", "carne_cerdo", "carne_ternera", "carne_conejo", "carne_cordero"];
        const FISH_SPECIES = ["trucha", "caella", "bacalao", "merluza", "calamares", "bacaladilla", "panga", "atun", "perca", "chicharro", "cabracho", "tintorera"];
        const FISH_LABELS = {
            trucha: "Trucha", caella: "Caella", bacalao: "Bacalao", merluza: "Merluza",
            calamares: "Calamares", bacaladilla: "Bacaladilla", panga: "Panga", atun: "Atún",
            perca: "Perca", chicharro: "Chicharro", cabracho: "Cabracho", tintorera: "Tintorera"
        };
        const MEAT_LABELS = {
            carne_pollo: "Pollo", carne_pavo: "Pavo", carne_cerdo: "Cerdo",
            carne_ternera: "Ternera", carne_conejo: "Conejo", carne_cordero: "Cordero"
        };

        function normalizeRecipeProteinCatalog(value = {}) {
            const normalize = (list, prefix) => (Array.isArray(list) ? list : []).map(item => {
                const label = String(item?.label ?? item ?? '').replace(/\s+/g, ' ').trim();
                const rawId = String(item?.id ?? '').trim();
                const id = rawId || `${prefix}_${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
                return { id, label };
            }).filter(item => item.id && item.label);
            return { fish: normalize(value?.fish, 'custom_pescado'), meat: normalize(value?.meat, 'custom_carne') };
        }

        function getRecipeProteinCatalog() {
            return normalizeRecipeProteinCatalog(recipeProteinCatalog);
        }

        function mergeRecipeProteinCatalogIntoProfile(catalog = recipeProteinCatalog) {
            const normalized = normalizeRecipeProteinCatalog(catalog);
            recipeProteinCatalog = normalized;
            const profile = getKitchenProfile();
            const merge = (existing, incoming) => {
                const map = new Map((Array.isArray(existing) ? existing : []).map(item => [String(item.id), item]));
                incoming.forEach(item => map.set(item.id, item));
                return [...map.values()];
            };
            settings.kitchenProfile = window.GastroOSKitchenRules.normalize({
                ...profile,
                especiesPescadoPersonalizadas: merge(profile.especiesPescadoPersonalizadas, normalized.fish),
                animalesCarnePersonalizados: merge(profile.animalesCarnePersonalizados, normalized.meat)
            });
        }

        function getProteinCatalog(type) {
            const catalog = window.GastroOSKitchenRules.getProteinCatalog(getKitchenProfile());
            return type === 'fish' ? catalog.fish : catalog.meat;
        }

        function getProteinLabel(type, id) {
            return window.GastroOSKitchenRules.getProteinLabel(type === 'fish' ? 'Pescado' : 'Carne', id, getKitchenProfile());
        }

        function renderProteinFormOptions(selectedMeat = '', selectedFish = '') {
            const meatSelect = document.getElementById('dishSpecies');
            const fishSelect = document.getElementById('dishFishSpecies');
            if (meatSelect) meatSelect.innerHTML = '<option value="">Seleccionar...</option>' + getProteinCatalog('meat').map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedMeat ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
            if (fishSelect) fishSelect.innerHTML = '<option value="">Seleccionar...</option>' + getProteinCatalog('fish').map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedFish ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
        }

        function renderProteinCatalogSettings() {
            const profile = getKitchenProfile();
            const meatContainer = document.getElementById('kitchenMeatCatalog');
            const fishContainer = document.getElementById('kitchenFishCatalog');
            const uniqueCatalog = (items) => {
                const seenIds = new Set();
                const seenLabels = new Set();
                return (Array.isArray(items) ? items : []).filter(item => {
                    const id = String(item?.id ?? '').trim().toLowerCase();
                    const label = String(item?.label ?? '').replace(/\\s+/g, ' ').trim().toLowerCase();
                    if (!id || !label || seenIds.has(id) || seenLabels.has(label)) return false;
                    seenIds.add(id);
                    seenLabels.add(label);
                    return true;
                });
            };
            const meatCatalog = uniqueCatalog(getProteinCatalog('meat'));
            const fishCatalog = uniqueCatalog(getProteinCatalog('fish'));
            if (meatContainer) {
                meatContainer.innerHTML = meatCatalog.map(item => `<label title="${escapeHtml(item.label)}"><input type="checkbox" class="kitchen-meat-animal" value="${escapeHtml(item.id)}" ${profile.animalesCarnePermitidos.includes(item.id) ? 'checked' : ''}> ${escapeHtml(item.label)}${item.id.startsWith('custom_') ? ' <span class="text-[10px] text-gray-400">· añadida</span>' : ''}</label>`).join('');
            }
            if (fishContainer) {
                fishContainer.innerHTML = fishCatalog.map(item => `<label title="${escapeHtml(item.label)}"><input type="checkbox" class="kitchen-fish-species" value="${escapeHtml(item.id)}" ${profile.especiesPescadoPermitidas.includes(item.id) ? 'checked' : ''}> ${escapeHtml(item.label)}${item.id.startsWith('custom_') ? ' <span class="text-[10px] text-gray-400">· añadida</span>' : ''}</label>`).join('');
            }
        }

        async function addCustomProtein(type) {
            const inputId = type === 'fish' ? 'newKitchenFish' : 'newKitchenMeat';
            const input = document.getElementById(inputId);
            const label = String(input?.value || '').replace(/\s+/g, ' ').trim();
            if (!label) return;
            const profile = getKitchenProfile();
            const catalogKey = type === 'fish' ? 'especiesPescadoPersonalizadas' : 'animalesCarnePersonalizados';
            const allowedKey = type === 'fish' ? 'especiesPescadoPermitidas' : 'animalesCarnePermitidos';
            const existing = window.GastroOSKitchenRules.getProteinCatalog(profile).find(item => item.label.toLowerCase() === label.toLowerCase());
            if (existing) {
                alert(`“${label}” ya está registrada.`);
                return;
            }
            const base = type === 'fish' ? 'custom_pescado' : 'custom_carne';
            let id = `${base}_${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
            const used = new Set(window.GastroOSKitchenRules.getProteinCatalog(profile).map(item => item.id));
            let n = 2; const original = id; while (used.has(id)) id = `${original}_${n++}`;
            const next = window.GastroOSKitchenRules.normalize({ ...profile, [catalogKey]: [...(profile[catalogKey] || []), { id, label }], [allowedKey]: [...new Set([...(profile[allowedKey] || []), id])] });
            settings.kitchenProfile = next;
            saveAll();
            if (input) input.value = '';
            renderKitchenRules();
            renderProteinFormOptions();
            const synced = await syncProteinCatalogToGitHub();
            if (synced.skipped) {
                alert(`${label} se ha añadido y queda permitido para el generador. El catálogo se guardará en recipes.json cuando conectes/sincronices GitHub.`);
            } else if (synced.success) {
                alert(`${label} se ha añadido y se ha actualizado el catálogo compartido de recipes.json.`);
            } else {
                alert(`${label} se ha añadido localmente, pero no se pudo actualizar recipes.json en GitHub. El catálogo local sigue funcionando.`);
            }
        }
        const FIRST_LABELS = {
            legumbres: "Cuchara · Legumbres", guisos: "Cuchara · Guisos",
            sopas_o_caldos: "Cuchara · Sopas o caldos", cremas: "Verdura · Crema",
            verduras_enteras: "Verdura · Entera", pastas: "Pasta",
            pastas_rellenas: "Pasta rellena", arroces: "Arroz", otros_hidratos: "Otros hidratos"
        };

        const ALLERGEN_OPTIONS = [
            ["gluten", "Gluten"],
            ["crustaceos", "Crustáceos"],
            ["huevos", "Huevos"],
            ["pescado", "Pescado"],
            ["cacahuetes", "Cacahuetes"],
            ["soja", "Soja"],
            ["lacteo", "Lácteo"],
            ["frutos_cascara", "Frutos de cáscara"],
            ["apio", "Apio"],
            ["mostaza", "Mostaza"],
            ["sesamo", "Sésamo"],
            ["sulfitos", "Sulfitos"],
            ["altramuces", "Altramuces"],
            ["moluscos", "Moluscos"]
        ];
        const ALLERGEN_LABELS = Object.fromEntries(ALLERGEN_OPTIONS);

        function normalizeFirstParent(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const v = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Valores canónicos que utiliza el filtro visible del Recetario.
            if (v === "cuchara" || v.includes("cuchara")) return "Cuchara";
            if (v === "verdura" || v.includes("verdura")) return "Verdura";
            if (v === "tenedor" || v.includes("tenedor")) return "Tenedor";

            // Identificadores técnicos nuevos/anteriores.
            if (FIRST_SUBCATEGORIES.cuchara.includes(v)) return "Cuchara";
            if (FIRST_SUBCATEGORIES.verdura.includes(v)) return "Verdura";
            if (FIRST_SUBCATEGORIES.tenedor.includes(v)) return "Tenedor";

            // También acepta etiquetas completas como "Verdura · Entera".
            if (v.includes("crema") || v.includes("entera")) return "Verdura";
            if (v.includes("pasta") || v.includes("arroz") || v.includes("hidrato")) return "Tenedor";
            if (v.includes("legumbre") || v.includes("guiso") || v.includes("sopa") || v.includes("caldo")) return "Cuchara";
            return "";
        }

        function getProductAllergensForDish(dish) {
            const manual = Array.isArray(dish?.alergenosManuales) ? dish.alergenosManuales : (Array.isArray(dish?.alergenos) ? dish.alergenos : []);
            const result = new Set(manual.filter(a => ALLERGEN_LABELS[a]));
            (dish?.ingredientes || []).forEach(ing => {
                const key = normalizeFoodKey(ing?.nombre || '');
                (productAllergenMap[key] || []).forEach(a => { if (ALLERGEN_LABELS[a]) result.add(a); });
            });
            return [...result];
        }

        function applyProductAllergensToRecipes() {
            dishes = dishes.map(d => ({ ...d, alergenos: getProductAllergensForDish(d) }));
        }

        function collectAllergenProducts() {
            const names = new Map();
            dishes.forEach(d => (d.ingredientes || []).forEach(i => { const n = String(i?.nombre || '').trim(); if (n) names.set(normalizeFoodKey(n), n); }));
            rawStock.forEach(i => { const n = String(i?.nombre || '').trim(); if (n) names.set(normalizeFoodKey(n), n); });
            return [...names.entries()].sort((a,b) => a[1].localeCompare(b[1], 'es'));
        }

        function renderProductAllergenManager() {
            const container = document.getElementById('productAllergenList');
            if (!container) return;
            const query = normalizeFoodKey(document.getElementById('productAllergenSearch')?.value || '');
            const products = collectAllergenProducts().filter(([,name]) => !query || normalizeFoodKey(name).includes(query));
            if (!products.length) { container.innerHTML = '<p class="text-center text-gray-500 text-xs py-8">No hay productos que coincidan.</p>'; return; }
            container.innerHTML = products.map(([key,name]) => {
                const selected = new Set(productAllergenMap[key] || []);
                const checks = ALLERGEN_OPTIONS.map(([value,label]) => `<label class="product-allergen-chip ${selected.has(value) ? 'is-selected' : ''}"><input type="checkbox" data-product-key="${escapeHtml(key)}" value="${value}" ${selected.has(value) ? 'checked' : ''}><span>${label}</span></label>`).join('');
                return `<div class="product-allergen-row"><div class="product-allergen-name">${escapeHtml(name)}</div><div class="product-allergen-chips">${checks}</div></div>`;
            }).join('');
        }

        function openProductAllergenManager() {
            renderProductAllergenManager();
            document.getElementById('modalProductAllergens')?.classList.remove('hidden');
        }
        function closeProductAllergenManager() { document.getElementById('modalProductAllergens')?.classList.add('hidden'); }
        async function syncProductAllergensToGitHub() {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo) return { success: false, skipped: true };
            const path = 'product-allergens.json';
            const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl({ ...github, path });
            const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${github.token}`, 'X-GitHub-Api-Version': '2022-11-28' };
            try {
                const get = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'GET', headers });
                let data = await get.json().catch(() => ({}));
                let remote = {}, sha = null;
                if (get.status === 404) {
                    remote = {};
                } else {
                    if (!get.ok || typeof data.content !== 'string') throw new Error(data.message || `HTTP ${get.status}`);
                    sha = data.sha;
                    const parsed = JSON.parse(base64ToUtf8(data.content));
                    const products = parsed?.products && typeof parsed.products === 'object' ? parsed.products : parsed;
                    Object.entries(products || {}).forEach(([key, value]) => {
                        const arr = Array.isArray(value) ? value : (Array.isArray(value?.allergens) ? value.allergens : (Array.isArray(value?.alergenos) ? value.alergenos : []));
                        remote[normalizeFoodKey(key)] = arr.filter(a => ALLERGEN_LABELS[a]);
                    });
                }
                const merged = { ...remote };
                Object.entries(productAllergenMap || {}).forEach(([key, values]) => {
                    const normalizedKey = normalizeFoodKey(key);
                    const union = new Set([...(merged[normalizedKey] || []), ...(Array.isArray(values) ? values : [])].filter(a => ALLERGEN_LABELS[a]));
                    if (union.size) merged[normalizedKey] = [...union];
                });
                const names = new Map();
                collectAllergenProducts().forEach(([key, name]) => names.set(key, name));
                const products = {};
                Object.entries(merged).forEach(([key, allergens]) => {
                    if (allergens.length) products[key] = { name: names.get(key) || key, allergens };
                });
                const content = JSON.stringify({ app: 'GastroOS', schemaVersion: 1, updatedAt: new Date().toISOString(), products }, null, 2) + '\n';
                const payload = { message: 'Sincronizados alérgenos de productos desde GastroOS', content: utf8ToBase64(content) };
                if (sha) payload.sha = sha;
                const put = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await put.json().catch(() => ({}));
                if (!put.ok) throw new Error(result.message || `HTTP ${put.status}`);
                productAllergenMap = merged;
                window.GastroOSDataStore.set('chefTrack_productAllergens', JSON.stringify(productAllergenMap));
                return { success: true };
            } catch (error) {
                console.error('No se pudieron sincronizar los alérgenos de productos:', error);
                return { success: false, message: error?.message || 'Error desconocido' };
            }
        }

        async function saveProductAllergens() {
            const next = {};
            document.querySelectorAll('#productAllergenList input[data-product-key]').forEach(input => {
                if (!input.checked) return;
                const key = input.dataset.productKey;
                if (!next[key]) next[key] = [];
                next[key].push(input.value);
            });
            productAllergenMap = next;
            applyProductAllergensToRecipes();
            window.GastroOSDataStore.set('chefTrack_productAllergens', JSON.stringify(productAllergenMap));
            saveAll();
            renderDishes(); renderGeneratorView();
            const sync = await syncProductAllergensToGitHub();
            closeProductAllergenManager();
            const status = document.getElementById('productAllergenStatus');
            if (status) status.textContent = `${Object.keys(productAllergenMap).length} productos con alérgenos configurados${sync.success ? ' · sincronizados con GitHub' : (sync.skipped ? ' · guardados en este dispositivo' : ' · error al sincronizar con GitHub')}.`;
            if (!sync.success && !sync.skipped) alert(`Los alérgenos se guardaron localmente, pero no se pudieron subir a product-allergens.json.\n\n${sync.message}`);
        }

        function loadProductAllergens() {
            const stored = safeLoadJSON('chefTrack_productAllergens', {});
            productAllergenMap = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        }

        function normalizeDishData(d) {
            const dish = { ...d };
            dish.ingredientes = (Array.isArray(dish.ingredientes) ? dish.ingredientes : []).map(ing => ({ ...ing, categoria_proveedor: String(ing?.categoria_proveedor || "").trim() === "Verduras y frutas" ? "Verduras" : (ing?.categoria_proveedor || "Secos") }));
            dish.demanda = dish.demanda || "Media";
            dish.precocinado = !!dish.precocinado;
            dish.plato_elaborado = !!dish.plato_elaborado;
            dish.subcategoria_primero = dish.subcategoria_primero || "";
            dish.subtipo_primero = dish.subtipo_primero || "";
            dish.proteina_segundo = dish.proteina_segundo || "";
            dish.animal_carne = dish.animal_carne || "";
            dish.especie_pescado = dish.especie_pescado || "";
            dish.tecnica_cocina = dish.tecnica_cocina || "";
            const manualAllergens = Array.isArray(dish.alergenosManuales)
                ? dish.alergenosManuales
                : (Array.isArray(dish.alergenos) ? dish.alergenos : []);
            dish.alergenosManuales = [...new Set(manualAllergens.map(a => String(a).trim()).filter(a => ALLERGEN_LABELS[a]))];
            dish.alergenos = getProductAllergensForDish(dish);

            // Migración y normalización transparente de los formatos anteriores/importados.
            if (dish.categoria === "Primero") {
                const originalSub = dish.subcategoria_primero;
                const technicalSub = String(dish.subtipo_primero || "").trim();

                // Si llega un identificador técnico en cualquiera de los dos campos,
                // conservamos el identificador técnico y calculamos su grupo visible.
                if (!technicalSub && FIRST_LABELS[String(originalSub || "").toLowerCase()]) {
                    dish.subtipo_primero = String(originalSub).toLowerCase();
                }

                const canonicalParent = normalizeFirstParent(dish.subcategoria_primero) || normalizeFirstParent(dish.subtipo_primero);
                if (canonicalParent) dish.subcategoria_primero = canonicalParent;

                if (dish.subtipo_primero && !FIRST_LABELS[dish.subtipo_primero]) {
                    const technicalCandidate = String(dish.subtipo_primero).toLowerCase();
                    if (FIRST_LABELS[technicalCandidate]) dish.subtipo_primero = technicalCandidate;
                }
            }
            if (dish.categoria === "Segundo" && dish.proteina_segundo === "Carne") {
                const animalMap = {
                    pollo: "carne_pollo", pavo: "carne_pavo", cerdo: "carne_cerdo",
                    ternera: "carne_ternera", conejo: "carne_conejo", cordero: "carne_cordero"
                };
                const currentAnimal = String(dish.animal_carne || "").trim().toLowerCase();
                const oldAnimal = String(dish.especie_animal || "").trim().toLowerCase();
                if (animalMap[currentAnimal]) dish.animal_carne = animalMap[currentAnimal];
                else if (!dish.animal_carne) dish.animal_carne = animalMap[oldAnimal] || "";
            }
            if (dish.categoria === "Segundo" && dish.proteina_segundo === "Pescado") {
                dish.especie_pescado = normalizeFishSpecies(dish.especie_pescado || dish.especie_animal);
            }
            if (dish.categoria === "Segundo" && (dish.proteina_segundo === "Carne" || dish.proteina_segundo === "Pescado")) {
                // Las recetas antiguas/importadas pueden contener etiquetas visibles;
                // el runtime trabaja siempre con la técnica canónica.
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
            const raw = String(value || '').trim();
            const v = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const catalog = getProteinCatalog('fish');
            const match = catalog.find(item => v === String(item.id).toLowerCase() || v === item.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || v.includes(String(item.id).toLowerCase()));
            if (match) return match.id;
            if (!raw) return '';
            const slug = v.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            if (!slug) return '';
            // Debe ser idempotente: si ya lleva el prefijo (una o varias veces, por datos dañados
            // de versiones anteriores), se normaliza a un único prefijo en lugar de añadir otro.
            if (slug.startsWith('custom_pescado_')) return slug.replace(/^(?:custom_pescado_)+/, 'custom_pescado_');
            return `custom_pescado_${slug}`;
        }

        function hasCompleteTechnicalTags(d) {
            if (!d || !d.categoria) return false;
            if (d.categoria === "Primero") return !!d.subtipo_primero;
            if (d.proteina_segundo === "Carne") return getProteinCatalog('meat').some(item => item.id === d.animal_carne) && ["tecnica_guiso", "tecnica_seco_asado", "tecnica_frito_rebozado"].includes(d.tecnica_cocina);
            if (d.proteina_segundo === "Pescado") return !!d.especie_pescado;
            return false;
        }


        let dishes = [];
        let settings = { ...defaultSettings };
        let rawStock = [];
        let preparedStock = [];
        let currentMenu = null;
        let previousWeekMenu = null;
        let historyMenus = [];
        let recipeChangeHistory = [];
        let githubLastLoadIssue = "";
        let pendingImportData = null;

        let activeFilterLevel1 = 'all';
        let activeFilterLevel2 = 'all';
        let selectedGeneratorDay = 'Lunes';
        let swapTarget = null;
        let lastGenerationDiagnostics = null;
        let bulkEditMode = false;
        let bulkSelectedDishIds = new Set();

        // El perfil se normaliza muchas miles de veces al generar un menú; se reutiliza el resultado
        // mientras el perfil guardado no cambie (la clave es su contenido, así que cualquier cambio,
        // también en el sitio, invalida la copia). Los llamadores solo leen el perfil, nunca lo modifican.
        let kitchenProfileCacheKey = null;
        let kitchenProfileCacheValue = null;
        function getKitchenProfile() {
            const raw = settings.kitchenProfile;
            let key;
            try { key = JSON.stringify(raw ?? null); } catch { key = null; }
            if (key !== null && key === kitchenProfileCacheKey) return kitchenProfileCacheValue;
            const normalized = window.GastroOSKitchenRules.normalize(raw);
            kitchenProfileCacheKey = key;
            kitchenProfileCacheValue = key === null ? null : normalized;
            return normalized;
        }

        function getGuisoDays() {
            return window.GastroOSKitchenRules.getGuisoDays(getKitchenProfile());
        }

        function getMaxWeeklyFritos() {
            return getKitchenProfile().maxWeeklyFritos;
        }

        function getMaxWeeklyCreams() { return getKitchenProfile().maxWeeklyCreams; }
        function getMaxWeeklyPasta() { return getKitchenProfile().maxWeeklyPasta; }
        function getMaxWeeklyLegumes() { return getKitchenProfile().maxWeeklyLegumes; }
        function getMaxWeeklyRice() { return getKitchenProfile().maxWeeklyRice; }
        function getMaxWeeklyVegetableWhole() { return getKitchenProfile().maxWeeklyVegetableWhole; }
        function getMaxWeeklySoups() { return getKitchenProfile().maxWeeklySoups; }

        function getMenuStructure() {
            const p = getKitchenProfile();
            const firstSpecs = [];
            const addFirstSpecs = (count, parent, familyLabel) => {
                for (let i = 0; i < count; i++) firstSpecs.push({
                    slotLabel: `1º ${familyLabel}${count > 1 ? ` ${i + 1}` : ''}`,
                    cat: 'Primero',
                    allowedParents: [parent],
                    family: familyLabel.toLowerCase()
                });
            };
            addFirstSpecs(p.primerosVerdura, 'Verdura', 'Verdura');
            addFirstSpecs(p.primerosCuchara, 'Cuchara', 'Cuchara');
            addFirstSpecs(p.primerosTenedor, 'Tenedor', 'Tenedor / Hidratos');

            const secondSpecs = [];
            for (let i = 0; i < p.segundosCarne; i++) secondSpecs.push({ slotLabel: `2º Carne${p.segundosCarne > 1 ? ` ${i + 1}` : ''}`, cat: 'Segundo', protein: 'Carne' });
            for (let i = 0; i < p.segundosPescado; i++) secondSpecs.push({ slotLabel: `2º Pescado${p.segundosPescado > 1 ? ` ${i + 1}` : ''}`, cat: 'Segundo', protein: 'Pescado' });
            return { firstSpecs, secondSpecs, slotSpecs: [...firstSpecs, ...secondSpecs] };
        }

        function getFirstFamilyRule(family) {
            const p = getKitchenProfile();
            return ({
                pasta: { max: p.maxWeeklyPasta, consecutiveAllowed: p.permitirPastaConsecutiva },
                legumbres: { max: p.maxWeeklyLegumes, consecutiveAllowed: p.permitirLegumbresConsecutivas },
                arroz: { max: p.maxWeeklyRice, consecutiveAllowed: p.permitirArrozConsecutivo },
                sopas: { max: p.maxWeeklySoups, consecutiveAllowed: p.permitirSopasConsecutivas }
            })[family] || null;
        }

        function getKitchenRule(name, fallback = undefined) {
            const profile = getKitchenProfile();
            return Object.prototype.hasOwnProperty.call(profile, name) ? profile[name] : fallback;
        }


        function validateKitchenConfiguration(profile = getKitchenProfile()) {
            const errors = [];
            const warnings = [];
            const firstCounts = {
                Verdura: Number(profile.primerosVerdura) || 0,
                Cuchara: Number(profile.primerosCuchara) || 0,
                Tenedor: Number(profile.primerosTenedor) || 0
            };
            const meatSlots = Number(profile.segundosCarne) || 0;
            const fishSlots = Number(profile.segundosPescado) || 0;
            const allowedFish = new Set(profile.especiesPescadoPermitidas || []);
            const allowedMeat = new Set(profile.animalesCarnePermitidos || []);
            const availableFirsts = new Set(dishes.filter(d => d?.categoria === 'Primero').map(d => d?.subcategoria_primero).filter(Boolean));
            if (firstCounts.Verdura > 0 && !availableFirsts.has('Verdura')) errors.push('Hay primeros de verdura configurados, pero no hay recetas de verdura disponibles.');
            if (firstCounts.Cuchara > 0 && !availableFirsts.has('Cuchara')) errors.push('Hay primeros de cuchara configurados, pero no hay recetas de cuchara disponibles.');
            if (firstCounts.Tenedor > 0 && !availableFirsts.has('Tenedor')) errors.push('Hay primeros de tenedor/hidrato configurados, pero no hay recetas de esa familia disponibles.');

            const fishSpeciesInRecipes = new Set(dishes.filter(d => d?.categoria === 'Segundo' && d?.proteina_segundo === 'Pescado' && allowedFish.has(String(d?.especie_pescado || '').toLowerCase())).map(d => String(d.especie_pescado || '').toLowerCase()).filter(Boolean));
            const meatAnimalsInRecipes = new Set(dishes.filter(d => d?.categoria === 'Segundo' && d?.proteina_segundo === 'Carne' && allowedMeat.has(String(d?.animal_carne || '').toLowerCase())).map(d => String(d.animal_carne || '').toLowerCase()).filter(Boolean));
            if (fishSlots > fishSpeciesInRecipes.size) errors.push(`La oferta necesita ${fishSlots} pescados por día, pero solo hay ${fishSpeciesInRecipes.size} especies permitidas con recetas disponibles; cada especie solo puede aparecer una vez por semana.`);
            if (meatSlots > meatAnimalsInRecipes.size) errors.push(`La oferta necesita ${meatSlots} carnes por día, pero solo hay ${meatAnimalsInRecipes.size} tipos de carne permitidos con recetas disponibles; no se puede repetir animal dentro del mismo día.`);
            if (fishSlots * daysList.length > fishSpeciesInRecipes.size) errors.push(`Configuración imposible: se necesitan ${fishSlots * daysList.length} pescados por semana, pero solo hay ${fishSpeciesInRecipes.size} especies permitidas disponibles y no se permite repetir especie.`);

            // Un menú semanal nunca reutiliza IDs. Detectamos catálogos demasiado pequeños
            // antes de iniciar el generador para evitar semanas parcialmente vacías.
            const uniqueDishCount = list => new Set(list.map(d => String(d?.id ?? '')).filter(Boolean)).size;
            const firstRequirements = [
                ['Verdura', Number(profile.primerosVerdura) || 0],
                ['Cuchara', Number(profile.primerosCuchara) || 0],
                ['Tenedor', Number(profile.primerosTenedor) || 0]
            ];
            firstRequirements.forEach(([parent, perDay]) => {
                if (perDay <= 0) return;
                const available = uniqueDishCount(dishes.filter(d => d?.categoria === 'Primero' && d?.subcategoria_primero === parent));
                const required = perDay * daysList.length;
                if (available < required) errors.push(`Catálogo insuficiente: ${parent} tiene ${available} recetas únicas y la configuración necesita ${required} en la semana.`);
            });
            const secondRequirements = [
                ['Carne', Number(profile.segundosCarne) || 0],
                ['Pescado', Number(profile.segundosPescado) || 0]
            ];
            secondRequirements.forEach(([protein, perDay]) => {
                if (perDay <= 0) return;
                const available = uniqueDishCount(dishes.filter(d => d?.categoria === 'Segundo' && d?.proteina_segundo === protein && (protein !== 'Carne' || allowedMeat.has(String(d?.animal_carne || '').toLowerCase())) && (protein !== 'Pescado' || allowedFish.has(String(d?.especie_pescado || '').toLowerCase()))));
                const required = perDay * daysList.length;
                if (available < required) warnings.push(`Variedad limitada: hay ${available} recetas únicas de ${protein.toLowerCase()} y se necesitan ${required} selecciones semanales; algunas reglas pueden impedir generar un menú completo.`);
            });
            if (meatSlots > 1 && meatAnimalsInRecipes.size < meatSlots + 1) warnings.push('Hay poca variedad de animales de carne para la oferta configurada; puede ser difícil evitar repeticiones en días consecutivos.');

            return { valid: errors.length === 0, errors, warnings };
        }

        function renderKitchenRules() {
            const profile = getKitchenProfile();
            const name = document.getElementById('kitchenName');
            const headerName = document.getElementById('kitchenHeaderName');
            const fritos = document.getElementById('kitchenMaxFritos');
            const creams = document.getElementById('kitchenMaxCreams');
            const purchaseAdjust = document.getElementById('kitchenPurchaseAdjustPercent');
            const settingsComensales = document.getElementById('settingsComensales');
            const settingsMargen = document.getElementById('settingsMargenSeguridad');
            const maxPasta = document.getElementById('kitchenMaxPasta');
            const maxLegumes = document.getElementById('kitchenMaxLegumes');
            const maxRice = document.getElementById('kitchenMaxRice');
            const maxVegetableWhole = document.getElementById('kitchenMaxVegetableWhole');
            const maxSoups = document.getElementById('kitchenMaxSoups');
            const pastaConsecutive = document.getElementById('kitchenAllowPastaConsecutive');
            const legumesConsecutive = document.getElementById('kitchenAllowLegumesConsecutive');
            const riceConsecutive = document.getElementById('kitchenAllowRiceConsecutive');
            const soupsConsecutive = document.getElementById('kitchenAllowSoupsConsecutive');
            const firstVeg = document.getElementById('kitchenFirstVegetableCount');
            const firstSpoon = document.getElementById('kitchenFirstSpoonCount');
            const firstFork = document.getElementById('kitchenFirstForkCount');
            const secondMeat = document.getElementById('kitchenSecondMeatCount');
            const secondFish = document.getElementById('kitchenSecondFishCount');
            const allowPrecooked = document.getElementById('kitchenAllowPrecooked');
            const allowPrepared = document.getElementById('kitchenAllowPreparedWithoutStock');
            const stockPriority = document.getElementById('kitchenStockPriority');
            const liquidRule = document.getElementById('kitchenAvoidLiquidFirsts');
            const consecutiveRule = document.getElementById('kitchenAvoidConsecutiveFirsts');
            const vegetableRule = document.getElementById('kitchenAvoidRepeatedVegetable');
            const presentationRule = document.getElementById('kitchenAvoidRepeatedPresentation');
            if (name) name.value = profile.nombre;
            if (headerName) headerName.textContent = profile.nombre || 'Autoservicio';
            if (fritos) fritos.value = profile.maxWeeklyFritos;
            if (creams) creams.value = profile.maxWeeklyCreams;
            if (settingsComensales) settingsComensales.value = settings.comensales ?? 100;
            if (settingsMargen) settingsMargen.value = settings.margenSeguridadPorcentaje ?? 30;
            if (maxPasta) maxPasta.value = profile.maxWeeklyPasta;
            if (maxLegumes) maxLegumes.value = profile.maxWeeklyLegumes;
            if (maxRice) maxRice.value = profile.maxWeeklyRice;
            if (maxVegetableWhole) maxVegetableWhole.value = profile.maxWeeklyVegetableWhole;
            if (maxSoups) maxSoups.value = profile.maxWeeklySoups;
            if (pastaConsecutive) pastaConsecutive.checked = profile.permitirPastaConsecutiva;
            if (legumesConsecutive) legumesConsecutive.checked = profile.permitirLegumbresConsecutivas;
            if (riceConsecutive) riceConsecutive.checked = profile.permitirArrozConsecutivo;
            if (soupsConsecutive) soupsConsecutive.checked = profile.permitirSopasConsecutivas;
            if (firstVeg) firstVeg.value = profile.primerosVerdura;
            if (firstSpoon) firstSpoon.value = profile.primerosCuchara;
            if (firstFork) firstFork.value = profile.primerosTenedor;
            if (secondMeat) secondMeat.value = profile.segundosCarne;
            if (secondFish) secondFish.value = profile.segundosPescado;
            if (purchaseAdjust) purchaseAdjust.value = profile.ajusteCompraPorcentaje;
            if (allowPrecooked) allowPrecooked.checked = profile.permitirPrecocinados;
            if (allowPrepared) allowPrepared.checked = profile.permitirPlatosElaboradosSinStock;
            if (stockPriority) stockPriority.value = profile.prioridadStock;
            if (liquidRule) liquidRule.checked = profile.evitarLiquidosEnPrimeros;
            if (consecutiveRule) consecutiveRule.checked = profile.evitarRepeticionPrimeroConsecutivo;
            if (vegetableRule) vegetableRule.checked = profile.evitarVerduraRepetida;
            if (presentationRule) presentationRule.checked = profile.evitarPresentacionSegundoRepetida;
            document.querySelectorAll('.kitchen-guiso-day').forEach(cb => { cb.checked = profile.guisoDays.includes(Number(cb.dataset.dayIndex)); });
            renderProteinCatalogSettings();
        }

        function saveKitchenRules() {
            const selectedGuisoDays = [...document.querySelectorAll('.kitchen-guiso-day:checked')].map(cb => Number(cb.dataset.dayIndex));
            const selectedFish = [...document.querySelectorAll('.kitchen-fish-species:checked')].map(cb => cb.value);
            const selectedAnimals = [...document.querySelectorAll('.kitchen-meat-animal:checked')].map(cb => cb.value);
            if (!selectedFish.length || !selectedAnimals.length) {
                alert('Selecciona al menos una especie de pescado y un tipo de carne permitido.');
                return;
            }
            const firstTotal = ['kitchenFirstVegetableCount','kitchenFirstSpoonCount','kitchenFirstForkCount'].reduce((sum, id) => sum + Math.max(0, Number(document.getElementById(id)?.value) || 0), 0);
            const secondTotal = ['kitchenSecondMeatCount','kitchenSecondFishCount'].reduce((sum, id) => sum + Math.max(0, Number(document.getElementById(id)?.value) || 0), 0);
            if (firstTotal < 1 || secondTotal < 1) {
                alert('Debe existir al menos un plato de primero y un plato de segundo en la oferta diaria.');
                return;
            }
            settings.comensales = Math.max(1, Number(document.getElementById('settingsComensales')?.value) || 100);
            settings.margenSeguridadPorcentaje = Math.min(100, Math.max(0, Number(document.getElementById('settingsMargenSeguridad')?.value) || 0));
            settings.margenActivo = settings.margenSeguridadPorcentaje > 0;
            const candidateKitchenProfile = window.GastroOSKitchenRules.normalize({
                version: window.GastroOSKitchenRules.VERSION,
                ...getKitchenProfile(),
                nombre: document.getElementById('kitchenName')?.value,
                guisoDays: selectedGuisoDays,
                maxWeeklyFritos: document.getElementById('kitchenMaxFritos')?.value,
                maxWeeklyCreams: document.getElementById('kitchenMaxCreams')?.value,
                maxWeeklyPasta: document.getElementById('kitchenMaxPasta')?.value,
                maxWeeklyLegumes: document.getElementById('kitchenMaxLegumes')?.value,
                maxWeeklyRice: document.getElementById('kitchenMaxRice')?.value,
                maxWeeklyVegetableWhole: document.getElementById('kitchenMaxVegetableWhole')?.value,
                maxWeeklySoups: document.getElementById('kitchenMaxSoups')?.value,
                permitirPastaConsecutiva: document.getElementById('kitchenAllowPastaConsecutive')?.checked ?? getKitchenProfile().permitirPastaConsecutiva,
                permitirLegumbresConsecutivas: document.getElementById('kitchenAllowLegumesConsecutive')?.checked ?? getKitchenProfile().permitirLegumbresConsecutivas,
                permitirArrozConsecutivo: document.getElementById('kitchenAllowRiceConsecutive')?.checked ?? getKitchenProfile().permitirArrozConsecutivo,
                permitirSopasConsecutivas: document.getElementById('kitchenAllowSoupsConsecutive')?.checked ?? getKitchenProfile().permitirSopasConsecutivas,
                primerosVerdura: document.getElementById('kitchenFirstVegetableCount')?.value,
                primerosCuchara: document.getElementById('kitchenFirstSpoonCount')?.value,
                primerosTenedor: document.getElementById('kitchenFirstForkCount')?.value,
                segundosCarne: document.getElementById('kitchenSecondMeatCount')?.value,
                segundosPescado: document.getElementById('kitchenSecondFishCount')?.value,
                ajusteCompraPorcentaje: document.getElementById('kitchenPurchaseAdjustPercent')?.value,
                especiesPescadoPermitidas: selectedFish,
                animalesCarnePermitidos: selectedAnimals,
                especiesPescadoPersonalizadas: getKitchenProfile().especiesPescadoPersonalizadas,
                animalesCarnePersonalizados: getKitchenProfile().animalesCarnePersonalizados,
                permitirPrecocinados: document.getElementById('kitchenAllowPrecooked')?.checked ?? getKitchenProfile().permitirPrecocinados,
                permitirPlatosElaboradosSinStock: document.getElementById('kitchenAllowPreparedWithoutStock')?.checked ?? getKitchenProfile().permitirPlatosElaboradosSinStock,
                prioridadStock: document.getElementById('kitchenStockPriority')?.value,
                evitarLiquidosEnPrimeros: document.getElementById('kitchenAvoidLiquidFirsts')?.checked,
                evitarRepeticionPrimeroConsecutivo: document.getElementById('kitchenAvoidConsecutiveFirsts')?.checked,
                evitarVerduraRepetida: document.getElementById('kitchenAvoidRepeatedVegetable')?.checked,
                evitarPresentacionSegundoRepetida: document.getElementById('kitchenAvoidRepeatedPresentation')?.checked
            });
            const configurationCheck = validateKitchenConfiguration(candidateKitchenProfile);
            if (!configurationCheck.valid) {
                alert(`La configuración no se ha guardado porque puede impedir generar una semana completa.\n\n${configurationCheck.errors.join('\n')}`);
                return;
            } else if (configurationCheck.warnings.length) {
                const warning = configurationCheck.warnings.slice(0, 3).join('\n');
                console.warn('GastroOS: configuración exigente:', configurationCheck.warnings);
                if (confirm(`La configuración es posible, pero puede ser difícil de generar.\n\n${warning}\n\n¿Quieres guardarla igualmente?`)) {
                    settings.kitchenProfile = candidateKitchenProfile;
                    saveAll();
                } else {
                    return;
                }
            } else if (configurationCheck.valid) {
                settings.kitchenProfile = candidateKitchenProfile;
                saveAll();
            }
            renderKitchenRules();
            renderStockView();
            renderGeneratorView();
            const status = document.getElementById('kitchenRulesStatus');
            if (status) status.textContent = 'Normas guardadas. Se aplicarán al próximo menú generado.';
        }

        function safeLoadJSON(key, fallback) {
            try {
                const raw = window.GastroOSDataStore.get(key);
                if (!raw) return fallback;
                const parsed = JSON.parse(raw);
                return parsed ?? fallback;
            } catch (error) {
                console.warn(`No se pudo leer ${key}; se utilizará el valor predeterminado.`, error);
                try { window.GastroOSDataStore.remove(key); } catch {}
                return fallback;
            }
        }

        function canonicalRecipesSnapshot(list = dishes) {
            return JSON.stringify((list || []).map(normalizeDishData).sort((a,b) => String(a.id).localeCompare(String(b.id))));
        }

        const BACKUP_FORMAT_VERSION = 2;
        const BACKUP_SCHEMA_VERSION = 1;

        function buildBackupData(type, reason = "exportación") {
            return {
                app: "GastroOS",
                type,
                backupFormatVersion: BACKUP_FORMAT_VERSION,
                schemaVersion: BACKUP_SCHEMA_VERSION,
                exportedAt: new Date().toISOString(),
                reason,
                counts: {
                    recipes: Array.isArray(dishes) ? dishes.length : 0,
                    rawStock: Array.isArray(rawStock) ? rawStock.length : 0,
                    preparedStock: Array.isArray(preparedStock) ? preparedStock.length : 0,
                    historyMenus: Array.isArray(historyMenus) ? historyMenus.length : 0
                },
                dishes, settings: { ...settings }, proteinCatalog: getRecipeProteinCatalog(), productAllergenMap, rawStock, preparedStock, currentMenu, previousWeekMenu, historyMenus, recipeChangeHistory
            };
        }

        function createAutoBackup(reason = "guardado automático") {
            try {
                const backup = {
                    ...buildBackupData("automatic-backup", reason),
                    createdAt: new Date().toISOString()
                };
                const saved = window.GastroOSDataStore.setJSON('chefTrack_autoBackup', backup);
                const stampSaved = window.GastroOSDataStore.set('chefTrack_autoBackupAt', backup.createdAt);
                return saved && stampSaved ? backup : null;
            } catch (error) {
                console.warn("No se pudo crear la copia automática local.", error);
                return null;
            }
        }

        function updateAutoBackupStatus() {
            const el = document.getElementById('autoBackupStatus');
            if (!el) return;
            const stamp = window.GastroOSDataStore.get('chefTrack_autoBackupAt');
            el.textContent = stamp ? `Última copia automática local: ${new Date(stamp).toLocaleString('es-ES')}. Se crea antes de restauraciones o borrados.` : 'Todavía no hay una copia automática local.';
        }

        function downloadAutoBackup() {
            const backup = safeLoadJSON('chefTrack_autoBackup', null);
            if (!backup) { alert('Todavía no existe una copia automática local.'); return; }
            downloadJsonFile(backup, `gastroos_auto_backup_${new Date(backup.createdAt || Date.now()).toISOString().slice(0,10)}.json`);
        }

        function downloadJsonFile(data, filename) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function logRecipeChange(action, dish, details = "") {
            const entry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                at: new Date().toISOString(),
                action,
                recipeId: dish?.id ?? "",
                name: dish?.nombre || "Recetario",
                details
            };
            recipeChangeHistory.unshift(entry);
            recipeChangeHistory = recipeChangeHistory.slice(0, 100);
            try { window.GastroOSDataStore.set('chefTrack_recipeChangeHistory', JSON.stringify(recipeChangeHistory)); } catch {}
        }

        function renderRecipeChangeHistory() {
            const container = document.getElementById('recipeChangeHistory');
            if (!container) return;
            if (!recipeChangeHistory.length) {
                container.innerHTML = '<p class="text-center text-gray-400 dark:text-gray-500 py-2">Todavía no hay cambios registrados.</p>';
                return;
            }
            const labels = { create:'Creada', update:'Editada', delete:'Eliminada', bulk:'Edición múltiple', import:'Importación', migration:'Etiquetado', restore:'Restauración' };
            container.innerHTML = recipeChangeHistory.slice(0, 40).map(entry => `
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5">
                    <div class="flex justify-between gap-2">
                        <span class="font-bold text-gray-700 dark:text-gray-200">${escapeHtml(labels[entry.action] || entry.action)} · ${escapeHtml(entry.name)}</span>
                        <span class="text-[9px] text-gray-400 whitespace-nowrap">${new Date(entry.at).toLocaleString('es-ES')}</span>
                    </div>
                    ${entry.details ? `<div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(entry.details)}</div>` : ''}
                </div>`).join('');
        }

        function updateGitHubPendingState(github = getGitHubSettings()) {
            const status = document.getElementById('githubSyncStatus');
            if (!status) return;
            const configured = !!(github?.token && github?.owner && github?.repo && github?.path);
            if (!configured) return;
            const synced = window.GastroOSDataStore.get('chefTrack_githubLastSyncedRecipes');
            if (!synced) return;
            const pending = synced !== canonicalRecipesSnapshot();
            const suffix = pending ? ' · Hay cambios locales pendientes de sincronizar.' : ' · Todo sincronizado.';
            if (!status.textContent.includes('Error') && !status.textContent.includes('No se pudo')) {
                status.textContent = `${status.textContent.replace(/ · (Hay cambios locales pendientes de sincronizar\.|Todo sincronizado\.)$/, '')}${suffix}`;
            }
        }

        function markRecipesSnapshotSynced() {
            try { window.GastroOSDataStore.set('chefTrack_githubLastSyncedRecipes', canonicalRecipesSnapshot()); } catch {}
            updateGitHubPendingState();
        }

        function renderRecipeDiagnostics() {
            const cards = document.getElementById('recipeDiagnostics');
            const details = document.getElementById('recipeDiagnosticsDetails');
            if (!cards || !details) return;
            const ids = new Set(); let duplicateIds = 0; let incomplete = 0; let blankQuantities = 0; let ingredients = 0;
            const incompleteNames = [];
            const validDishes = dishes.filter(d => d && typeof d === 'object');
            validDishes.forEach(raw => {
                const d = normalizeDishData(raw); const id = String(d.id ?? '');
                if (ids.has(id)) duplicateIds++; else ids.add(id);
                if (!hasCompleteTechnicalTags(d)) { incomplete++; if (incompleteNames.length < 6) incompleteNames.push(d.nombre || `ID ${id}`); }
                (d.ingredientes || []).forEach(i => { ingredients++; if (i.cantidad === '' || i.cantidad === null || i.cantidad === undefined) blankQuantities++; });
            });
            const firsts = validDishes.filter(d => d.categoria === 'Primero').length;
            const seconds = validDishes.filter(d => d.categoria === 'Segundo').length;
            const backupStamp = window.GastroOSDataStore.get('chefTrack_autoBackupAt');
            const backupAge = backupStamp ? Math.max(0, Date.now() - new Date(backupStamp).getTime()) : null;
            const backupLabel = backupAge === null ? 'Sin copia' : backupAge < 86400000 ? 'Actual' : `${Math.floor(backupAge / 86400000)} d`;
            const backupTone = backupAge === null || backupAge > 7 * 86400000 ? 'text-amber-600' : 'text-emerald-600';
            const metric = (label, value, tone='') => `<div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5"><div class="text-[9px] uppercase font-bold text-gray-400">${label}</div><div class="text-lg font-black ${tone}">${value}</div></div>`;
            cards.innerHTML = metric('Recetas', validDishes.length) + metric('Etiquetas pendientes', incomplete, incomplete ? 'text-amber-600' : 'text-emerald-600') + metric('IDs duplicados', duplicateIds, duplicateIds ? 'text-red-600' : 'text-emerald-600') + metric('Sin cantidad (aviso)', blankQuantities);
            details.innerHTML = `<div class="space-y-1"><div>${firsts} primeros · ${seconds} segundos · ${ingredients} ingredientes registrados.</div>${incompleteNames.length ? `<div>Ejemplos pendientes: ${incompleteNames.map(escapeHtml).join(', ')}${incomplete > incompleteNames.length ? '…' : ''}</div>` : '<div class="text-emerald-600 dark:text-emerald-400 font-semibold">No se detectan etiquetas técnicas incompletas.</div>'}<div>Última copia automática: <span class="font-semibold ${backupTone}">${escapeHtml(backupLabel)}</span>${backupStamp ? ` · ${new Date(backupStamp).toLocaleString('es-ES')}` : ''}.</div></div>`;
        }

        // Botón «Actualizar» de Salud del recetario: recalcula y deja un aviso visible,
        // incluso si los números no cambian o si algo falla.
        function runRecipeDiagnostics() {
            const status = document.getElementById('recipeDiagnosticsStatus');
            const button = document.getElementById('btnRunDiagnostics');
            const setStatus = (text, tone) => {
                if (!status) return;
                status.textContent = text;
                status.style.color = tone === 'error' ? '#dc2626' : '';
            };
            if (button) { button.disabled = true; button.textContent = 'Actualizando…'; }
            setStatus('Recalculando…');
            // Se cede un instante al navegador para que se vea el cambio de estado en el móvil.
            window.setTimeout(() => {
                try {
                    renderRecipeDiagnostics();
                    setStatus(`Actualizado ✓ ${new Date().toLocaleTimeString('es-ES')} · ${dishes.length} recetas revisadas.`);
                } catch (error) {
                    console.error('No se pudo actualizar el diagnóstico', error);
                    setStatus('No se pudo actualizar el diagnóstico. Exporta una copia de seguridad y vuelve a intentarlo.', 'error');
                } finally {
                    if (button) { button.disabled = false; button.textContent = 'Actualizar'; }
                }
            }, 150);
        }

        const APP_SPLASH_MIN_MS = 1600;
        const APP_SPLASH_STARTED_AT = performance.now();

        function finishAppSplash() {
            const splash = document.getElementById('appSplash');
            if (!splash) return;
            const wait = Math.max(0, APP_SPLASH_MIN_MS - (performance.now() - APP_SPLASH_STARTED_AT));
            window.setTimeout(() => splash.classList.add('is-ready'), wait);
        }

        async function init() {
            const migration = window.GastroOSDataStore.migrateSchema?.();
            if (migration && !migration.ok) {
                const status = document.getElementById('appErrorStatus');
                if (status) {
                    status.textContent = migration.reason === 'future-version'
                        ? 'Los datos locales pertenecen a una versión más reciente. Actualiza GastroOS antes de continuar. No se han modificado.'
                        : 'No se pudieron migrar los datos locales. GastroOS se ha detenido para evitar sobrescribirlos. Exporta o recupera una copia de seguridad antes de reintentar.';
                    status.hidden = false;
                }
                // No continuar con saveAll() si la migración no se confirmó.
                return;
            }
            registerServiceWorker();
            loadProductAllergens();
            const storedDishesSafe = safeLoadJSON('chefTrack_dishes', []);
            dishes = (Array.isArray(storedDishesSafe) ? storedDishesSafe : []).map(normalizeDishData);
            const storedSettingsSafe = safeLoadJSON('chefTrack_settings', {});
            settings = { ...defaultSettings, ...(storedSettingsSafe && typeof storedSettingsSafe === 'object' && !Array.isArray(storedSettingsSafe) ? storedSettingsSafe : {}) };
            if (storedSettingsSafe?.margenSeguridadPorcentaje === undefined) {
                const legacyMargin = Number(settings.kitchenProfile?.margenCompraPorcentaje);
                settings.margenSeguridadPorcentaje = settings.margenActivo && Number.isFinite(legacyMargin) ? legacyMargin : (storedSettingsSafe && Object.keys(storedSettingsSafe).length ? 0 : 30);
            }
            settings.margenActivo = Number(settings.margenSeguridadPorcentaje) > 0;
            settings.kitchenProfile = window.GastroOSKitchenRules.normalize(settings.kitchenProfile);
            recipeProteinCatalog = normalizeRecipeProteinCatalog({ fish: settings.kitchenProfile.especiesPescadoPersonalizadas, meat: settings.kitchenProfile.animalesCarnePersonalizados });
            mergeRecipeProteinCatalogIntoProfile(recipeProteinCatalog);
            if (settings.darkMode === undefined) settings.darkMode = false;
            const storedRawSafe = safeLoadJSON('chefTrack_rawStock', []);
            rawStock = Array.isArray(storedRawSafe) ? storedRawSafe.map(item => {
                const conservation = String(item?.conservacion || "");
                return {
                    ...item,
                    categoria_proveedor: String(item?.categoria_proveedor || "").trim() === "Verduras y frutas" ? "Verduras" : item?.categoria_proveedor,
                    conservacion: /congel/i.test(conservation) ? "Congelado" : "Refrigerado"
                };
            }) : [];
            const storedPrepSafe = safeLoadJSON('chefTrack_preparedStock', []);
            preparedStock = Array.isArray(storedPrepSafe) ? storedPrepSafe.filter(item => item && typeof item === 'object') : [];
            currentMenu = safeLoadJSON('chefTrack_currentMenu', null);
            previousWeekMenu = safeLoadJSON('previousWeekMenu', safeLoadJSON('chefTrack_previousWeekMenu', null));
            const storedHistorySafe = safeLoadJSON('chefTrack_historyMenus', []);
            historyMenus = Array.isArray(storedHistorySafe) ? storedHistorySafe.filter(isValidHistoryItem) : [];
            const storedRecipeHistorySafe = safeLoadJSON('chefTrack_recipeChangeHistory', []);
            recipeChangeHistory = Array.isArray(storedRecipeHistorySafe) ? storedRecipeHistorySafe.filter(item => item && typeof item === 'object') : [];

            loadGitHubSettings();
            applyDarkMode();

            // Prioridad de carga: GitHub configurado > copia local existente > recipes.json.
            // Nunca sustituimos una copia local no vacía por el seed estático si GitHub falla.
            const hadLocalRecipes = dishes.length > 0;
            const githubConfigured = (() => {
                const gh = getGitHubSettings();
                return !!(gh?.token && gh?.owner && gh?.repo && gh?.path);
            })();
            const githubLoaded = githubConfigured ? await loadDishesFromGitHub() : false;

            if (!githubLoaded && !hadLocalRecipes && dishes.length === 0) {
                const seeded = await loadDishesFromLocalSeed();
                if (seeded) {
                    if (githubConfigured) {
                        setGitHubSyncStatus(`Recetario local cargado desde recipes.json · ${dishes.length} recetas. La copia de GitHub no está disponible ahora.`, 'warning');
                    } else {
                        setGitHubSyncStatus(`Recetario inicial cargado desde recipes.json · ${dishes.length} recetas.`, 'success');
                    }
                } else if (!dishes.length) {
                    console.warn('No hay recetas locales ni se pudo cargar recipes.json.');
                }
            }

            // Reubica registros antiguos: precocinados guardados en platos elaborados pasan a materia prima.
            migratePrecookedStockToRawStock();
            saveAll();
            setupEventListeners();
            renderProteinFormOptions();
            updateFormVisibility();
            renderDishes();
            renderStockView();
            renderGeneratorView();
            renderHistorySection();
            renderMigrationUI();
            renderRecipeDiagnostics();
            renderRecipeChangeHistory();
            renderKitchenRules();
            const productAllergenStatus = document.getElementById('productAllergenStatus');
            if (productAllergenStatus) productAllergenStatus.textContent = `${Object.keys(productAllergenMap).length} productos con alérgenos configurados.`;
            updateAutoBackupStatus();
            finishAppSplash();
        }

        function registerServiceWorker() {
            if (!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.register('./sw.js', { scope: './' })
                .catch(error => console.warn('No se pudo registrar el Service Worker:', error));
        }

        function saveAll() {
            settings.kitchenProfile = window.GastroOSKitchenRules.normalize(settings.kitchenProfile);
            recipeProteinCatalog = normalizeRecipeProteinCatalog({ fish: settings.kitchenProfile.especiesPescadoPersonalizadas, meat: settings.kitchenProfile.animalesCarnePersonalizados });
            mergeRecipeProteinCatalogIntoProfile(recipeProteinCatalog);
            try {
                const operations = [
                    { key: 'chefTrack_dishes', type: 'set', value: JSON.stringify(dishes) },
                    { key: 'chefTrack_settings', type: 'set', value: JSON.stringify(settings) },
                    { key: 'chefTrack_rawStock', type: 'set', value: JSON.stringify(rawStock) },
                    { key: 'chefTrack_preparedStock', type: 'set', value: JSON.stringify(preparedStock) },
                    { key: 'chefTrack_historyMenus', type: 'set', value: JSON.stringify(historyMenus) },
                    { key: 'chefTrack_recipeChangeHistory', type: 'set', value: JSON.stringify(recipeChangeHistory) },
                    { key: 'chefTrack_productAllergens', type: 'set', value: JSON.stringify(productAllergenMap) },
                    currentMenu ? { key: 'chefTrack_currentMenu', type: 'set', value: JSON.stringify(currentMenu) } : { key: 'chefTrack_currentMenu', type: 'remove' }
                ];
                if (previousWeekMenu) {
                    operations.push({ key: 'previousWeekMenu', type: 'set', value: JSON.stringify(previousWeekMenu) });
                    operations.push({ key: 'chefTrack_previousWeekMenu', type: 'set', value: JSON.stringify(previousWeekMenu) });
                } else {
                    operations.push({ key: 'previousWeekMenu', type: 'remove' });
                    operations.push({ key: 'chefTrack_previousWeekMenu', type: 'remove' });
                }
                const result = window.GastroOSDataStore.writeBatch(operations);
                if (!result.ok) throw new Error(`No se pudo confirmar el lote de persistencia (${result.reason || 'error desconocido'}).`);
            } catch (error) {
                console.error('No se pudieron guardar los datos locales:', error);
                alert('No se han podido guardar todos los datos en este navegador. La operación se ha detenido para proteger la información. Comprueba el espacio disponible y crea una copia de seguridad antes de continuar.');
                updateGitHubPendingState();
                updateAutoBackupStatus();
                return false;
            }
            updateGitHubPendingState();
            updateAutoBackupStatus();
            // La salud del recetario se mantiene al día sin tener que pulsar «Actualizar».
            try { renderRecipeDiagnostics(); } catch {}
            return true;
        }

        function toggleDarkMode() {
            settings.darkMode = !settings.darkMode;
            saveAll();
            applyDarkMode();
        }

        function applyDarkMode() {
            if (settings.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if (themeMeta) themeMeta.setAttribute('content', settings.darkMode ? '#0b0b0d' : '#F5F5F7');
        }
