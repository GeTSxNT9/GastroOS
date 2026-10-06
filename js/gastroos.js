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

        // Factor global de ajuste de compra: permite calibrar las cantidades
        // calculadas con la experiencia real de compra sin modificar las recetas.
        // Se aplica solo a ingredientes con cantidad calculable.
        const PURCHASE_ADJUSTMENT_FACTOR = 0.80;

        const defaultSettings = { comensales: 100, margenActivo: false, darkMode: false };
        const proveedorCategorias = ["Carne", "Pescado", "Lácteos", "Verduras y frutas", "Secos", "Congelados"];
        const daysList = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        // Esquema canónico de recetas y compatibilidad con datos antiguos/importados.
        const {
            FIRST_SUBCATEGORIES, MEAT_ANIMALS, FISH_SPECIES, FISH_LABELS, MEAT_LABELS,
            FIRST_LABELS, ALLERGEN_OPTIONS, ALLERGEN_LABELS, normalizeFirstParent,
            normalizeDishData, firstParentFromTechnical, normalizeTechnique,
            normalizeFishSpecies, hasCompleteTechnicalTags
        } = window.GastroOSRecipeSchema;

        // Reglas del motor de menús separadas del resto de la aplicación.
        // Se mantienen como constantes locales para que el código existente
        // del generador siga funcionando sin cambios de comportamiento.
        const {
            ENGINE_VERSION, FIRST_SLOT_LABELS, MEAT_TECHNIQUES,
            MIN_WEEKLY_GUISOS, MAX_WEEKLY_GUISOS, GUISO_DAYS,
            CONSECUTIVE_FIRST_SUBTYPES, LIQUID_FIRST_SUBTYPES,
            getSecondPreparationFamily, conflictsWithSecondPreparationFamily,
            conflictsWithSecondSpecies, getPrimaryVegetableKey, normalizeFoodKey,
            canonicalVegetable
        } = window.GastroOSMenuRules;

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
        let bulkEditMode = false;
        let bulkSelectedDishIds = new Set();

        // --- 2. INICIALIZACIÓN ---
        function safeLoadJSON(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return fallback;
                const parsed = JSON.parse(raw);
                return parsed ?? fallback;
            } catch (error) {
                console.warn(`No se pudo leer ${key}; se utilizará el valor predeterminado.`, error);
                try { localStorage.removeItem(key); } catch {}
                return fallback;
            }
        }

        function canonicalRecipesSnapshot(list = dishes) {
            return JSON.stringify((list || []).map(normalizeDishData).sort((a,b) => String(a.id).localeCompare(String(b.id))));
        }

        function createAutoBackup(reason = "guardado automático") {
            try {
                const backup = {
                    app: "GastroOS",
                    type: "automatic-backup",
                    reason,
                    createdAt: new Date().toISOString(),
                    dishes, settings: { ...settings }, rawStock, preparedStock, currentMenu, previousWeekMenu, historyMenus, recipeChangeHistory
                };
                localStorage.setItem('chefTrack_autoBackup', JSON.stringify(backup));
                localStorage.setItem('chefTrack_autoBackupAt', backup.createdAt);
                return backup;
            } catch (error) {
                console.warn("No se pudo crear la copia automática local.", error);
                return null;
            }
        }

        function updateAutoBackupStatus() {
            const el = document.getElementById('autoBackupStatus');
            if (!el) return;
            const stamp = localStorage.getItem('chefTrack_autoBackupAt');
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
            try { localStorage.setItem('chefTrack_recipeChangeHistory', JSON.stringify(recipeChangeHistory)); } catch {}
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
            const synced = localStorage.getItem('chefTrack_githubLastSyncedRecipes');
            if (!synced) return;
            const pending = synced !== canonicalRecipesSnapshot();
            const suffix = pending ? ' · Hay cambios locales pendientes de sincronizar.' : ' · Todo sincronizado.';
            if (!status.textContent.includes('Error') && !status.textContent.includes('No se pudo')) {
                status.textContent = `${status.textContent.replace(/ · (Hay cambios locales pendientes de sincronizar\.|Todo sincronizado\.)$/, '')}${suffix}`;
            }
        }

        function markRecipesSnapshotSynced() {
            try { localStorage.setItem('chefTrack_githubLastSyncedRecipes', canonicalRecipesSnapshot()); } catch {}
            updateGitHubPendingState();
        }

        function renderRecipeDiagnostics() {
            const cards = document.getElementById('recipeDiagnostics');
            const details = document.getElementById('recipeDiagnosticsDetails');
            if (!cards || !details) return;
            const ids = new Set(); let duplicateIds = 0; let incomplete = 0; let blankQuantities = 0; let ingredients = 0;
            const incompleteNames = [];
            dishes.forEach(raw => {
                const d = normalizeDishData(raw); const id = String(d.id ?? '');
                if (ids.has(id)) duplicateIds++; else ids.add(id);
                if (!hasCompleteTechnicalTags(d)) { incomplete++; if (incompleteNames.length < 6) incompleteNames.push(d.nombre || `ID ${id}`); }
                (d.ingredientes || []).forEach(i => { ingredients++; if (i.cantidad === '' || i.cantidad === null || i.cantidad === undefined) blankQuantities++; });
            });
            const firsts = dishes.filter(d => d.categoria === 'Primero').length;
            const seconds = dishes.filter(d => d.categoria === 'Segundo').length;
            const metric = (label, value, tone='') => `<div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5"><div class="text-[9px] uppercase font-bold text-gray-400">${label}</div><div class="text-lg font-black ${tone}">${value}</div></div>`;
            cards.innerHTML = metric('Recetas', dishes.length) + metric('Etiquetas pendientes', incomplete, incomplete ? 'text-amber-600' : 'text-emerald-600') + metric('IDs duplicados', duplicateIds, duplicateIds ? 'text-red-600' : 'text-emerald-600') + metric('Cantidades en blanco', blankQuantities, blankQuantities ? 'text-amber-600' : 'text-emerald-600');
            details.innerHTML = `<div class="space-y-1"><div>${firsts} primeros · ${seconds} segundos · ${ingredients} ingredientes registrados.</div>${incompleteNames.length ? `<div>Ejemplos pendientes: ${incompleteNames.map(escapeHtml).join(', ')}${incomplete > incompleteNames.length ? '…' : ''}</div>` : '<div class="text-emerald-600 dark:text-emerald-400 font-semibold">No se detectan etiquetas técnicas incompletas.</div>'}</div>`;
        }

        async function init() {
            registerServiceWorker();
            const storedDishesSafe = safeLoadJSON('chefTrack_dishes', []);
            dishes = (Array.isArray(storedDishesSafe) ? storedDishesSafe : []).map(normalizeDishData);
            const storedSettingsSafe = safeLoadJSON('chefTrack_settings', {});
            settings = { ...defaultSettings, ...(storedSettingsSafe && typeof storedSettingsSafe === 'object' && !Array.isArray(storedSettingsSafe) ? storedSettingsSafe : {}) };
            if (settings.darkMode === undefined) settings.darkMode = false;
            const storedRawSafe = safeLoadJSON('chefTrack_rawStock', []);
            rawStock = Array.isArray(storedRawSafe) ? storedRawSafe.map(item => {
                const conservation = String(item?.conservacion || "");
                return {
                    ...item,
                    conservacion: /congel/i.test(conservation) ? "Congelado" : "Refrigerado"
                };
            }) : [];
            const storedPrepSafe = safeLoadJSON('chefTrack_preparedStock', []);
            preparedStock = Array.isArray(storedPrepSafe) ? storedPrepSafe : [];
            currentMenu = safeLoadJSON('chefTrack_currentMenu', null);
            previousWeekMenu = safeLoadJSON('previousWeekMenu', safeLoadJSON('chefTrack_previousWeekMenu', null));
            const storedHistorySafe = safeLoadJSON('chefTrack_historyMenus', []);
            historyMenus = Array.isArray(storedHistorySafe) ? storedHistorySafe : [];
            const storedRecipeHistorySafe = safeLoadJSON('chefTrack_recipeChangeHistory', []);
            recipeChangeHistory = Array.isArray(storedRecipeHistorySafe) ? storedRecipeHistorySafe : [];

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

            saveAll();
            setupEventListeners();
            updateFormVisibility();
            renderDishes();
            renderStockView();
            renderGeneratorView();
            renderHistorySection();
            renderMigrationUI();
            renderRecipeDiagnostics();
            renderRecipeChangeHistory();
            updateAutoBackupStatus();
        }

        function registerServiceWorker() {
            if (!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.register('./sw.js', { scope: './' })
                .catch(error => console.warn('No se pudo registrar el Service Worker:', error));
        }

        function saveAll() {
            try {
                localStorage.setItem('chefTrack_dishes', JSON.stringify(dishes));
                localStorage.setItem('chefTrack_settings', JSON.stringify(settings));
                localStorage.setItem('chefTrack_rawStock', JSON.stringify(rawStock));
                localStorage.setItem('chefTrack_preparedStock', JSON.stringify(preparedStock));
                localStorage.setItem('chefTrack_historyMenus', JSON.stringify(historyMenus));
                localStorage.setItem('chefTrack_recipeChangeHistory', JSON.stringify(recipeChangeHistory));
                if (currentMenu) localStorage.setItem('chefTrack_currentMenu', JSON.stringify(currentMenu));
                else localStorage.removeItem('chefTrack_currentMenu');
                if (previousWeekMenu) {
                    localStorage.setItem('previousWeekMenu', JSON.stringify(previousWeekMenu));
                    localStorage.setItem('chefTrack_previousWeekMenu', JSON.stringify(previousWeekMenu));
                } else {
                    localStorage.removeItem('previousWeekMenu');
                    localStorage.removeItem('chefTrack_previousWeekMenu');
                }
            } catch (error) {
                console.error('No se pudieron guardar los datos locales:', error);
                alert('No se han podido guardar los datos en este navegador. Comprueba el espacio disponible.');
            }
            updateGitHubPendingState();
            updateAutoBackupStatus();
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

        // --- 3. EVENTOS Y VISTAS ---
        function setupEventListeners() {
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetId = e.currentTarget.getAttribute('data-target');
                    switchView(targetId);
                    document.querySelectorAll('.nav-btn').forEach(b => {
                        b.classList.remove('text-indigo-600', 'dark:text-indigo-400', 'active');
                        b.classList.add('text-gray-400', 'dark:text-gray-500');
                    });
                    e.currentTarget.classList.remove('text-gray-400', 'dark:text-gray-500');
                    e.currentTarget.classList.add('text-indigo-600', 'dark:text-indigo-400', 'active');
                    if (targetId === 'view-form' && !document.getElementById('dishId').value) resetForm();
                });
            });

            document.querySelectorAll('.filter-lvl1').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filter-lvl1').forEach(b => {
                        b.classList.remove('bg-indigo-600', 'text-white', 'border-transparent', 'active');
                        b.classList.add('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-700');
                    });
                    e.currentTarget.classList.remove('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-700');
                    e.currentTarget.classList.add('bg-indigo-600', 'text-white', 'border-transparent', 'active');
                    activeFilterLevel1 = e.currentTarget.getAttribute('data-filter');
                    activeFilterLevel2 = 'all';
                    
                    document.getElementById('filters-primeros').classList.add('hidden');
                    document.getElementById('filters-segundos').classList.add('hidden');
                    if (activeFilterLevel1 === 'Primero') {
                        document.getElementById('filters-primeros').classList.remove('hidden');
                        resetLevel2UI('#filters-primeros');
                    } else if (activeFilterLevel1 === 'Segundo') {
                        document.getElementById('filters-segundos').classList.remove('hidden');
                        resetLevel2UI('#filters-segundos');
                    }
                    renderDishes();
                });
            });

            document.querySelectorAll('.filter-lvl2').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const parentContainer = e.currentTarget.parentElement;
                    parentContainer.querySelectorAll('.filter-lvl2').forEach(b => {
                        b.classList.remove('bg-indigo-100', 'dark:bg-indigo-950', 'text-indigo-700', 'dark:text-indigo-300', 'border-indigo-200', 'dark:border-indigo-800', 'font-bold', 'active');
                        b.classList.add('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-700', 'font-semibold');
                    });
                    e.currentTarget.classList.remove('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-700', 'font-semibold');
                    e.currentTarget.classList.add('bg-indigo-100', 'dark:bg-indigo-950', 'text-indigo-700', 'dark:text-indigo-300', 'border-indigo-200', 'dark:border-indigo-800', 'font-bold', 'active');
                    activeFilterLevel2 = e.currentTarget.getAttribute('data-filter');
                    renderDishes();
                });
            });

            document.getElementById('btnBulkEdit').addEventListener('click', () => toggleBulkEditMode(!bulkEditMode));
            document.getElementById('btnExitBulkEdit').addEventListener('click', () => toggleBulkEditMode(false));
            document.getElementById('btnBulkSelectAll').addEventListener('click', () => {
                getVisibleFilteredDishes().forEach(d => bulkSelectedDishIds.add(String(d.id)));
                renderDishes(); updateBulkSelectedCount();
            });
            document.getElementById('btnBulkClear').addEventListener('click', () => { bulkSelectedDishIds.clear(); renderDishes(); updateBulkSelectedCount(); });
            document.getElementById('bulkField').addEventListener('change', e => { populateBulkValueOptions(e.target.value); });
            document.getElementById('btnApplyBulkEdit').addEventListener('click', handleBulkEdit);
            document.getElementById('searchInput').addEventListener('input', renderDishes);
            document.getElementById('dishCategory').addEventListener('change', updateFormVisibility);
            document.getElementById('dishProtein').addEventListener('change', updateFormVisibility);
            document.getElementById('dishFishSpecies').addEventListener('change', updateFormVisibility);
            document.getElementById('addIngredientBtn').addEventListener('click', () => addIngredientRow());
            document.getElementById('dishForm').addEventListener('submit', handleFormSubmit);
            document.getElementById('btnCancel').addEventListener('click', () => {
                resetForm();
                document.querySelector('.nav-btn[data-target="view-banco"]').click();
                restoreRecipeListScroll();
            });

            document.getElementById('inputComensales').addEventListener('input', updateCalculatedRaciones);
            document.getElementById('checkMargen').addEventListener('change', updateCalculatedRaciones);
            document.getElementById('rawStockForm').addEventListener('submit', handleAddRawStock);
            document.getElementById('prepStockForm').addEventListener('submit', handleAddPrepStock);
            document.getElementById('prepName').addEventListener('change', () => {
                renderPreparedAssignmentOptions(document.getElementById('prepName').value);
            });

            document.getElementById('btnSubTabMenu').addEventListener('click', () => switchGeneratorSubTab('menu'));
            document.getElementById('btnSubTabShopping').addEventListener('click', () => switchGeneratorSubTab('shopping'));
            document.getElementById('btnGenerateMenu').addEventListener('click', generateWeeklyMenu);
            document.getElementById('btnSaveToHistory').addEventListener('click', saveMenuToHistory);
            document.getElementById('btnDownloadMenuTxt').addEventListener('click', downloadWeeklyMenuTxt);
            document.getElementById('btnDownloadShoppingTxt').addEventListener('click', downloadShoppingListTxt);

            document.querySelectorAll('.generator-day-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    document.querySelectorAll('.generator-day-tab').forEach(t => {
                        t.classList.remove('bg-indigo-600', 'text-white', 'active');
                        t.classList.add('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border', 'border-gray-300', 'dark:border-gray-700');
                    });
                    e.currentTarget.classList.remove('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border', 'border-gray-300', 'dark:border-gray-700');
                    e.currentTarget.classList.add('bg-indigo-600', 'text-white', 'active');
                    selectedGeneratorDay = e.currentTarget.getAttribute('data-day');
                    renderGeneratorView();
                });
            });

            document.getElementById('modalSearchInput').addEventListener('input', renderModalDishList);
            document.getElementById('btnExport').addEventListener('click', exportData);
            document.getElementById('fileImport').addEventListener('change', importData);
            document.getElementById('btnWipeData').addEventListener('click', wipeData);
            document.getElementById('btnSaveGithubSettings').addEventListener('click', saveGitHubSettings);
            document.getElementById('btnRefreshGitHub').addEventListener('click', refreshDishesFromGitHub);
            document.getElementById('btnExportRecipes').addEventListener('click', exportRecipesOnly);
            document.getElementById('btnDownloadAutoBackup').addEventListener('click', downloadAutoBackup);
            document.getElementById('btnRunDiagnostics').addEventListener('click', renderRecipeDiagnostics);
            document.getElementById('btnClearRecipeHistory').addEventListener('click', () => {
                if (!recipeChangeHistory.length || !confirm('¿Vaciar el historial local de cambios del recetario?')) return;
                recipeChangeHistory = []; saveAll(); renderRecipeChangeHistory();
            });
            document.getElementById('btnCloseImportPreview').addEventListener('click', closeImportPreview);
            document.getElementById('btnCancelImportPreview').addEventListener('click', closeImportPreview);
            document.getElementById('btnConfirmImportPreview').addEventListener('click', confirmPendingImport);
        }

        function updateFormVisibility() {
            const cat = document.getElementById('dishCategory').value;
            const prot = document.getElementById('dishProtein').value;
            const fish = document.getElementById('dishFishSpecies')?.value || "";
            const isPrimero = cat === 'Primero';
            const isSegundo = cat === 'Segundo';
            const isCarne = isSegundo && prot === 'Carne';
            const isPescado = isSegundo && prot === 'Pescado';

            document.getElementById('subcatPrimeroContainer').classList.toggle('hidden', !isPrimero);
            document.getElementById('protSegundoContainer').classList.toggle('hidden', !isSegundo);
            document.getElementById('speciesContainer').classList.toggle('hidden', !isCarne);
            document.getElementById('fishSpeciesContainer').classList.toggle('hidden', !isPescado);
            document.getElementById('techniqueContainer').classList.toggle('hidden', !(isSegundo && (isCarne || isPescado)));

        }

        let recipeListScrollTop = null;

        function restoreRecipeListScroll() {
            if (recipeListScrollTop === null) return;
            const scrollContainer = document.getElementById('main-container');
            const savedScrollTop = recipeListScrollTop;
            recipeListScrollTop = null;
            if (!scrollContainer) return;
            requestAnimationFrame(() => {
                scrollContainer.scrollTop = savedScrollTop;
                requestAnimationFrame(() => {
                    scrollContainer.scrollTop = savedScrollTop;
                });
            });
        }

        function switchView(viewId) {
            ['view-banco', 'view-form', 'view-stock', 'view-generator', 'view-settings'].forEach(id => {
                const el = document.getElementById(id);
                if (id === viewId) { el.classList.remove('hidden'); el.classList.add('block'); }
                else { el.classList.remove('block'); el.classList.add('hidden'); }
            });
        }

        function switchGeneratorSubTab(tab) {
            const btnMenu = document.getElementById('btnSubTabMenu');
            const btnShop = document.getElementById('btnSubTabShopping');
            const contentMenu = document.getElementById('subtab-menu-content');
            const contentShop = document.getElementById('subtab-shopping-content');

            if (tab === 'menu') {
                btnMenu.className = "flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-sm";
                btnShop.className = "flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all text-gray-600 dark:text-gray-400";
                contentMenu.classList.remove('hidden'); contentShop.classList.add('hidden');
            } else {
                btnShop.className = "flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-sm";
                btnMenu.className = "flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all text-gray-600 dark:text-gray-400";
                contentShop.classList.remove('hidden'); contentMenu.classList.add('hidden');
                renderShoppingListUI();
            }
        }

        function resetLevel2UI(containerSelector) {
            const container = document.querySelector(containerSelector);
            container.querySelectorAll('.filter-lvl2').forEach(b => {
                b.classList.remove('bg-indigo-100', 'dark:bg-indigo-950', 'text-indigo-700', 'dark:text-indigo-300', 'border-indigo-200', 'dark:border-indigo-800', 'font-bold', 'active');
                b.classList.add('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-700', 'font-semibold');
            });
            const allBtn = container.querySelector('[data-filter="all"]');
            if (allBtn) {
                allBtn.classList.remove('bg-white', 'dark:bg-gray-900', 'text-gray-600', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-700', 'font-semibold');
                allBtn.classList.add('bg-indigo-100', 'dark:bg-indigo-950', 'text-indigo-700', 'dark:text-indigo-300', 'border-indigo-200', 'dark:border-indigo-800', 'font-bold', 'active');
            }
        }

        // --- 4. BANCO DE PLATOS Y FORMULARIO ---
        function renderDishes() {
            const list = document.getElementById('dishesList');
            const searchVal = document.getElementById('searchInput').value.toLowerCase();
            list.innerHTML = '';

            const filtered = dishes.filter(d => {
                const nd = normalizeDishData(d);
                if (searchVal && !String(nd.nombre || '').toLowerCase().includes(searchVal)) return false;
                if (activeFilterLevel1 !== 'all' && nd.categoria !== activeFilterLevel1) return false;
                if (activeFilterLevel2 !== 'all') {
                    if (activeFilterLevel1 === 'Primero' && nd.subcategoria_primero !== activeFilterLevel2) return false;
                    if (activeFilterLevel1 === 'Segundo' && nd.proteina_segundo !== activeFilterLevel2) return false;
                }
                return true;
            });

            if (!filtered.length) {
                list.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 mt-10 text-sm">No hay resultados.</p>';
                return;
            }

            filtered.forEach(raw => {
                const d = normalizeDishData(raw);
                const tagType = d.categoria === 'Primero'
                    ? (FIRST_LABELS[d.subtipo_primero] || d.subcategoria_primero || "Sin subcategoría")
                    : d.proteina_segundo;
                const demObj = demandMap[d.demanda || "Media"];
                const missing = !hasCompleteTechnicalTags(d);
                const missingBadge = missing ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">Etiquetado pendiente ☓</span>' : '';
                const precookedBadge = d.precocinado ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">Precocinado</span>' : '';
                const preparedDishBadge = d.plato_elaborado ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Plato elaborado</span>' : '';

                const card = document.createElement('div');
                card.className = "bg-white/80 p-4 rounded-2xl relative transition-all";
                const bulkCheckbox = bulkEditMode ? `<label class="bulk-dish-select-label absolute top-3 left-3 z-10 flex items-center"><input type="checkbox" class="bulk-dish-checkbox w-4 h-4 accent-indigo-600" data-id="${escapeHtml(d.id)}" ${bulkSelectedDishIds.has(String(d.id)) ? 'checked' : ''}></label>` : '';
                card.innerHTML = `
                    ${bulkCheckbox}
                    <div class="${bulkEditMode ? 'pl-7' : ''} pr-12">
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight mb-1.5">${escapeHtml(d.nombre)}</h3>
                        <div class="flex flex-wrap gap-1.5 mt-2 items-center">
                            ${activeFilterLevel1 === 'all' ? `<span class="gastro-category-badge px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">${escapeHtml(d.categoria)}</span>` : ''}
                            <span class="gastro-technical-badge px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300">${escapeHtml(tagType)}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${demObj.class}">${demObj.text}</span>
                            ${missingBadge}${precookedBadge}${preparedDishBadge}
                        </div>
                    </div>
                    <div class="absolute top-3 right-3 flex flex-col gap-2">
                        <button onclick="editDish(decodeURIComponent('${escapeJsArg(d.id)}'))" class="text-blue-500 bg-blue-50 dark:bg-blue-950 p-1.5 rounded-full"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                        <button onclick="deleteDish(decodeURIComponent('${escapeJsArg(d.id)}'))" class="text-red-500 bg-red-50 dark:bg-red-950 p-1.5 rounded-full"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </div>`;
                list.appendChild(card);
            });
        }

        function toggleBulkEditMode(enabled) {
            bulkEditMode = enabled;
            if (!enabled) bulkSelectedDishIds.clear();
            document.getElementById('bulkToolbar')?.classList.toggle('hidden', !enabled);
            document.getElementById('bulkSelectedCount')?.classList.toggle('hidden', !enabled);
            const btn = document.getElementById('btnBulkEdit');
            if (btn) btn.textContent = enabled ? 'Edición múltiple activa ✓' : 'Edición múltiple ✓';
            renderDishes();
            updateBulkSelectedCount();
        }

        function getVisibleFilteredDishes() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase();
            return dishes.filter(d => {
                const nd = normalizeDishData(d);
                if (searchVal && !String(nd.nombre || '').toLowerCase().includes(searchVal)) return false;
                if (activeFilterLevel1 !== 'all' && nd.categoria !== activeFilterLevel1) return false;
                if (activeFilterLevel2 !== 'all') {
                    if (activeFilterLevel1 === 'Primero' && nd.subcategoria_primero !== activeFilterLevel2) return false;
                    if (activeFilterLevel1 === 'Segundo' && nd.proteina_segundo !== activeFilterLevel2) return false;
                }
                return true;
            });
        }

        function updateBulkSelectedCount() {
            const count = document.getElementById('bulkSelectedCount');
            if (count) count.textContent = `${bulkSelectedDishIds.size} seleccionadas`;
        }

        function populateBulkValueOptions(field) {
            const select = document.getElementById('bulkValue');
            if (!select) return;
            const options = {
                categoria: [['Primero','Primero'],['Segundo','Segundo']],
                subcategoria_primero: [['legumbres','Legumbres'],['guisos','Guisos'],['sopas_o_caldos','Sopas o caldos'],['cremas','Cremas'],['verduras_enteras','Verduras enteras'],['pastas','Pastas'],['pastas_rellenas','Pastas rellenas'],['arroces','Arroces'],['otros_hidratos','Otros hidratos']],
                proteina_segundo: [['Carne','Carne'],['Pescado','Pescado']],
                animal_carne: [['carne_pollo','Pollo'],['carne_pavo','Pavo'],['carne_cerdo','Cerdo'],['carne_ternera','Ternera'],['carne_conejo','Conejo'],['carne_cordero','Cordero']],
                especie_pescado: FISH_SPECIES.map(v => [v, FISH_LABELS[v] || v]),
                tecnica_cocina: [['tecnica_guiso','Guiso o en salsa'],['tecnica_seco_asado','Plancha, Asado o Brasa'],['tecnica_frito_rebozado','Frito, Rebozado o Empanado']],
                demanda: [['Alta','🟢 Alta'],['Media','🟡 Media'],['Baja','🔴 Baja']],
                precocinado: [['true','Sí'],['false','No']]
            };
            select.innerHTML = '<option value="">Seleccionar...</option>';
            (options[field] || []).forEach(([value,label]) => {
                const opt = document.createElement('option'); opt.value = value; opt.textContent = label; select.appendChild(opt);
            });
            select.disabled = !(options[field] && options[field].length);
            select.classList.toggle('bg-gray-100', select.disabled);
            select.classList.toggle('dark:bg-gray-800', select.disabled);
        }

        function applyBulkFieldToDish(dish, field, value) {
            const d = normalizeDishData(dish);
            if (field === 'categoria') {
                d.categoria = value;
                if (value === 'Primero') {
                    d.subtipo_primero = d.subtipo_primero || 'legumbres';
                    d.subcategoria_primero = FIRST_LABELS[d.subtipo_primero] || d.subcategoria_primero || 'Cuchara';
                    d.proteina_segundo = '';
                    d.animal_carne = '';
                    d.especie_pescado = '';
                    d.tecnica_cocina = '';
                    d.tecnica = '';
                } else {
                    d.proteina_segundo = d.proteina_segundo || 'Carne';
                    d.subtipo_primero = '';
                    d.subcategoria_primero = '';
                }
            } else if (field === 'subcategoria_primero') {
                d.categoria = 'Primero';
                d.subtipo_primero = value;
                d.subcategoria_primero = FIRST_LABELS[value] || ({legumbres:'Cuchara',guisos:'Cuchara',sopas_o_caldos:'Cuchara',cremas:'Verdura',verduras_enteras:'Verdura',pastas:'Tenedor',pastas_rellenas:'Tenedor',arroces:'Tenedor',otros_hidratos:'Tenedor'}[value] || '');
            } else if (field === 'proteina_segundo') {
                d.categoria = 'Segundo'; d.proteina_segundo = value;
                if (value === 'Carne') d.especie_pescado = '';
                if (value === 'Pescado') d.animal_carne = '';
            } else if (field === 'animal_carne') {
                d.categoria = 'Segundo'; d.proteina_segundo = 'Carne'; d.animal_carne = value; d.especie_animal = value; d.especie_pescado = '';
            } else if (field === 'especie_pescado') {
                d.categoria = 'Segundo'; d.proteina_segundo = 'Pescado'; d.especie_pescado = value === 'otro' ? '' : value; d.animal_carne = '';
            } else if (field === 'tecnica_cocina') {
                d.tecnica_cocina = value; d.tecnica = value;
            } else if (field === 'demanda') {
                d.demanda = value;
            } else if (field === 'precocinado') {
                d.precocinado = value === 'true';
            }
            return normalizeDishData(d);
        }

        async function syncBulkDishesToGitHub(updatedLocalDishes) {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo || !github.path) {
                alert("Configura primero la conexión con GitHub desde Ajustes.");
                document.querySelector('.nav-btn[data-target="view-settings"]')?.click();
                return false;
            }
            setGitHubSyncStatus("Guardando cambios múltiples en GitHub…", 'loading');
            try {
                const apiUrl = `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/contents/${github.path.split('/').map(encodeURIComponent).join('/')}`;
                const headers = {"Accept":"application/vnd.github+json","Authorization":`Bearer ${github.token}`,"X-GitHub-Api-Version":"2022-11-28"};
                const response = await fetch(apiUrl, {method:'GET', headers});
                let data = {}; try { data = await response.json(); } catch {}
                if (!response.ok || typeof data.content !== 'string' || !data.sha) throw new Error(data.message || `GitHub respondió con HTTP ${response.status}.`);
                const parsedFile = parseGitHubRecipeFile(base64ToUtf8(data.content), github.path);
                const updates = new Map(updatedLocalDishes.map(d => [String(d.id), normalizeDishData(d)]));
                const updatedRecipes = parsedFile.recipes.map(recipe => updates.has(String(recipe?.id ?? '')) ? updates.get(String(recipe.id)) : recipe);
                if (updates.size !== updatedRecipes.filter(r => updates.has(String(r?.id ?? ''))).length) throw new Error('No se encontraron todas las recetas seleccionadas en GitHub.');
                const updatedContent = buildGitHubRecipeFile({...parsedFile, recipes: updatedRecipes}, null);
                const putResponse = await fetch(apiUrl, {method:'PUT', headers:{...headers,"Content-Type":"application/json"}, body:JSON.stringify({message:"Actualizadas varias recetas desde GastroOS",content:utf8ToBase64(updatedContent),sha:data.sha})});
                let putData = {}; try { putData = await putResponse.json(); } catch {}
                if (!putResponse.ok || ![200,201].includes(putResponse.status)) throw new Error(putData.message || `GitHub respondió con HTTP ${putResponse.status}.`);
                markGitHubSyncSuccess(`${updates.size} recetas actualizadas en GitHub.`);
                return true;
            } catch (error) {
                setGitHubSyncStatus("No se pudieron guardar los cambios múltiples en GitHub.", 'error');
                console.error("Error de sincronización múltiple con GitHub:", error);
                alert(error?.message || "No se pudieron guardar los cambios en GitHub.");
                return false;
            }
        }

        async function handleBulkEdit() {
            const field = document.getElementById('bulkField').value;
            const value = document.getElementById('bulkValue').value;
            if (!bulkSelectedDishIds.size) { alert('Selecciona al menos una receta.'); return; }
            if (!field || value === '') { alert('Selecciona qué quieres cambiar y su valor.'); return; }
            const selected = dishes.filter(d => bulkSelectedDishIds.has(String(d.id))).map(normalizeDishData);
            const fieldLabel = document.querySelector(`#bulkField option[value="${field}"]`)?.textContent || field;
            const valueLabel = document.querySelector('#bulkValue option:checked')?.textContent || value;
            if (!confirm(`Vas a cambiar ${fieldLabel} → ${valueLabel} en ${selected.length} recetas. Los demás datos permanecerán sin cambios.\n\n¿Continuar?`)) return;
            const updated = selected.map(d => applyBulkFieldToDish(d, field, value));
            createAutoBackup(`antes de editar ${updated.length} recetas mediante edición múltiple`);
            const synced = await syncBulkDishesToGitHub(updated);
            if (!synced) return;
            const updates = new Map(updated.map(d => [String(d.id), d]));
            dishes = dishes.map(d => updates.get(String(d.id)) || d);
            logRecipeChange('bulk', null, `${updated.length} recetas actualizadas mediante edición múltiple`);
            saveAll();
            bulkSelectedDishIds.clear();
            document.getElementById('bulkField').value = '';
            document.getElementById('bulkValue').innerHTML = '<option value="">Seleccionar...</option>';
            document.getElementById('bulkValue').disabled = true;
            renderDishes(); renderMigrationUI(); updateBulkSelectedCount();
            alert(`${updated.length} recetas actualizadas correctamente.`);
        }

        document.addEventListener('change', (event) => {
            if (!event.target.classList.contains('bulk-dish-checkbox')) return;
            const id = String(event.target.dataset.id);
            if (event.target.checked) bulkSelectedDishIds.add(id);
            else bulkSelectedDishIds.delete(id);
            updateBulkSelectedCount();
        });

        function escapeHtml(value) {
            return String(value ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
        }

        // Codifica valores controlados por datos/importaciones antes de incrustarlos en
        // handlers inline. Se decodifican en el propio handler y no contienen comillas.
        function escapeJsArg(value) {
            return encodeURIComponent(String(value ?? '')).replace(/'/g, '%27');
        }


        function addIngredientRow(nombre = '', cantidad = '', unidad = 'g', categoria = 'Secos') {
            const container = document.getElementById('ingredientsContainer');
            const row = document.createElement('div');
            row.className = 'ingredient-row flex gap-2 items-center';
            const legacyUnit = ['kg', 'L'].includes(String(unidad)) ? String(unidad) : '';
            row.dataset.originalUnidad = unidad ?? '';
            row.dataset.originalCategoria = categoria ?? '';
            row.dataset.unidadTouched = 'false';
            row.dataset.categoriaTouched = 'false';
            row.innerHTML = `
                <input type="text" placeholder="Ingrediente..." value="${escapeHtml(nombre)}" required class="flex-[3] min-w-0 w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                <input type="text" inputmode="decimal" placeholder="Cant." value="${cantidad !== '' && cantidad !== undefined ? cantidad : ''}" class="w-16 min-w-[4rem] flex-[0_0_4rem] p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                <select class="w-14 min-w-[3.5rem] flex-[0_0_3.5rem] p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                    ${legacyUnit ? `<option value="${legacyUnit}" selected>${legacyUnit}</option>` : ''}
                    <option value="g" ${unidad==='g'?'selected':''}>g</option>
                    <option value="ml" ${unidad==='ml'?'selected':''}>ml</option>
                </select>
                <select class="flex-2 p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                    ${proveedorCategorias.map(c => `<option value="${c}" ${categoria===c?'selected':''}>${c}</option>`).join('')}
                </select>
                <button type="button" class="text-red-500 font-bold px-1" onclick="this.parentElement.remove()">×</button>
            `;
            const selects = row.querySelectorAll('select');
            selects[0].addEventListener('change', () => { row.dataset.unidadTouched = 'true'; });
            selects[1].addEventListener('change', () => { row.dataset.categoriaTouched = 'true'; });
            container.appendChild(row);
        }

        function loadGitHubSettings() {
            try {
                const stored = localStorage.getItem('chefTrack_githubSettings');
                const github = stored ? JSON.parse(stored) : {};
                const token = document.getElementById('githubToken');
                const owner = document.getElementById('githubOwner');
                const repo = document.getElementById('githubRepo');
                const path = document.getElementById('githubPath');
                // No volvemos a mostrar el token guardado en el campo; se conserva si se deja vacío al guardar.
                if (token) token.value = "";
                if (owner) owner.value = github.owner || "";
                if (repo) repo.value = github.repo || "";
                if (path) path.value = github.path || "";
                updateGitHubSettingsStatus(github);
            } catch {
                console.warn("No se pudieron cargar las credenciales de GitHub.");
            }
        }

        function getGitHubSettings() {
            try {
                const stored = localStorage.getItem('chefTrack_githubSettings');
                return stored ? JSON.parse(stored) : {};
            } catch (error) {
                return {};
            }
        }

        async function loadDishesFromLocalSeed() {
            try {
                const response = await fetch('./recipes.json', { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const content = await response.text();
                const parsedFile = parseGitHubRecipeFile(content, 'recipes.json');
                if (!Array.isArray(parsedFile.recipes) || !parsedFile.recipes.length) {
                    throw new Error('recipes.json no contiene recetas.');
                }
                dishes = parsedFile.recipes.map(normalizeDishData);
                localStorage.setItem('chefTrack_dishes', JSON.stringify(dishes));
                refreshStockReferenceSelectors();
                githubLastLoadIssue = 'local-seed';
                return true;
            } catch (error) {
                console.warn('No se pudo cargar recipes.json como recetario inicial:', error);
                return false;
            }
        }

        async function loadDishesFromGitHub() {
            const github = getGitHubSettings();
            githubLastLoadIssue = "";
            if (!github.token || !github.owner || !github.repo || !github.path) {
                githubLastLoadIssue = "not-configured";
                renderGitHubSyncStatus(github);
                return false;
            }
            setGitHubSyncStatus("Leyendo recetario desde GitHub…", 'loading');

            try {
                const apiUrl = `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/contents/${github.path.split('/').map(encodeURIComponent).join('/')}`;
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const response = await fetch(apiUrl, { method: 'GET', headers });
                let data = {};
                try { data = await response.json(); } catch {}

                if (!response.ok) {
                    const reason = data.message || `HTTP ${response.status}`;
                    if (response.status !== 404) {
                        console.warn("No se pudo cargar el recetario desde GitHub:", reason);
                        setGitHubSyncStatus(`GitHub no permitió cargar las recetas (${reason}). Se conserva la copia local.`, 'error');
                    } else {
                        githubLastLoadIssue = "missing-file";
                        setGitHubSyncStatus("No se encontró el archivo del recetario en GitHub. Comprueba la ruta o crea el archivo guardando/importando recetas.", 'warning');
                    }
                    if (response.status !== 404) githubLastLoadIssue = "error";
                    return false;
                }

                if (typeof data.content !== 'string') {
                    console.warn("GitHub no devolvió contenido para el recetario.");
                    return false;
                }

                const content = base64ToUtf8(data.content);
                const parsedFile = parseGitHubRecipeFile(content, github.path);

                // La copia remota pasa a ser la copia de trabajo de este navegador.
                // Al cargar, también migramos los antiguos identificadores técnicos
                // para que el archivo compartido quede alineado con los textos visibles.
                const originalSerialized = JSON.stringify(parsedFile.recipes);
                dishes = parsedFile.recipes.map(normalizeDishData);
                const normalizedSerialized = JSON.stringify(dishes);

                if (originalSerialized !== normalizedSerialized) {
                    try {
                        const updatedContent = buildGitHubRecipeFile(parsedFile, null, dishes);
                        const putPayload = {
                            message: "Actualizados datos y etiquetas del recetario desde GastroOS",
                            content: utf8ToBase64(updatedContent),
                            sha: data.sha
                        };
                        const putResponse = await fetch(apiUrl, {
                            method: 'PUT',
                            headers: { ...headers, "Content-Type": "application/json" },
                            body: JSON.stringify(putPayload)
                        });
                        if (!putResponse.ok) {
                            console.warn("Las recetas se cargaron, pero no se pudo guardar en GitHub la migración de identificadores.");
                        }
                    } catch (migrationError) {
                        console.warn("Las recetas se cargaron, pero falló la migración remota de identificadores:", migrationError);
                    }
                }

                localStorage.setItem('chefTrack_dishes', JSON.stringify(dishes));
                refreshStockReferenceSelectors();
                githubLastLoadIssue = "success";
                localStorage.removeItem('chefTrack_githubFileMissing');
                localStorage.setItem('chefTrack_githubLastSync', new Date().toISOString());
                markRecipesSnapshotSynced();
                setGitHubSyncStatus(`Recetario cargado desde GitHub · ${dishes.length} recetas.`, 'success');
                return true;
            } catch (error) {
                githubLastLoadIssue = "error";
                console.warn("No se pudo cargar el recetario desde GitHub. Se mantiene la copia local.", error);
                setGitHubSyncStatus("No se pudo leer GitHub. Se mantiene la última copia local disponible.", 'error');
                return false;
            }
        }

        function updateGitHubSettingsStatus(github) {
            const status = document.getElementById('githubSettingsStatus');
            if (!status) return;
            if (github?.token && github?.owner && github?.repo && github?.path) {
                status.textContent = "Conexión configurada ✓ Al guardar, GastroOS comprobará GitHub y cargará el recetario.";
                status.className = "text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold";
            } else {
                status.textContent = "Configura los cuatro campos para activar la sincronización remota de recetas.";
                status.className = "text-[11px] text-gray-500 dark:text-gray-400";
            }
            renderGitHubSyncStatus(github);
        }

        function renderGitHubSyncStatus(github = getGitHubSettings()) {
            const status = document.getElementById('githubSyncStatus');
            if (!status) return;
            const configured = !!(github?.token && github?.owner && github?.repo && github?.path);
            if (!configured) {
                status.textContent = "GitHub no está configurado en este navegador. Las recetas locales seguirán disponibles.";
                status.className = "text-xs text-gray-600 dark:text-gray-300";
                return;
            }
            const last = localStorage.getItem('chefTrack_githubLastSync');
            const lastText = last ? new Date(last).toLocaleString('es-ES') : "sin sincronización confirmada todavía";
            status.textContent = `Conexión configurada · Última sincronización correcta: ${lastText}. Recetas en esta copia: ${dishes.length}.`;
            status.className = "text-xs text-gray-600 dark:text-gray-300";
        }

        function setGitHubSyncStatus(message, kind = 'info') {
            const status = document.getElementById('githubSyncStatus');
            if (!status) return;
            status.textContent = message;
            const classes = {
                info: "text-xs text-gray-600 dark:text-gray-300",
                loading: "text-xs text-indigo-600 dark:text-indigo-300 font-semibold",
                success: "text-xs text-emerald-600 dark:text-emerald-300 font-semibold",
                warning: "text-xs text-amber-700 dark:text-amber-300 font-semibold",
                error: "text-xs text-red-600 dark:text-red-300 font-semibold"
            };
            status.className = classes[kind] || classes.info;
        }

        function markGitHubSyncSuccess(message = "Sincronización completada.") {
            const now = new Date().toISOString();
            localStorage.setItem('chefTrack_githubLastSync', now);
            markRecipesSnapshotSynced();
            setGitHubSyncStatus(`${message} ${new Date(now).toLocaleString('es-ES')} · ${dishes.length} recetas.`, 'success');
        }

        async function saveGitHubSettings() {
            const existing = getGitHubSettings();
            const tokenInput = document.getElementById('githubToken');
            const github = {
                token: tokenInput.value.trim() || existing.token || "",
                owner: document.getElementById('githubOwner').value.trim(),
                repo: document.getElementById('githubRepo').value.trim(),
                path: document.getElementById('githubPath').value.trim().replace(/^\/+/, "")
            };

            if (!github.token || !github.owner || !github.repo || !github.path) {
                alert("Completa el propietario, el repositorio y la ruta, e introduce un token si aún no hay uno guardado.");
                return;
            }

            const repositoryChanged = existing.owner !== github.owner || existing.repo !== github.repo || existing.path !== github.path;
            if (repositoryChanged) localStorage.removeItem('chefTrack_githubLastSync');
            localStorage.setItem('chefTrack_githubSettings', JSON.stringify(github));
            tokenInput.value = "";
            updateGitHubSettingsStatus(github);
            setGitHubSyncStatus("Comprobando conexión y cargando recetas desde GitHub…", 'loading');
            const loaded = await loadDishesFromGitHub();
            if (loaded) {
                saveAll();
                renderDishes();
                renderMigrationUI();
                renderStockView();
                renderGeneratorView();
                renderHistorySection();
                markGitHubSyncSuccess("Conexión comprobada y recetario actualizado desde GitHub.");
                alert("Conexión con GitHub comprobada y recetas cargadas correctamente.");
            } else if (githubLastLoadIssue === "missing-file") {
                setGitHubSyncStatus("Conexión guardada. Aún no existe el archivo del recetario; se creará al guardar la primera receta o importar un JSON.", 'warning');
                alert("La configuración se ha guardado, pero todavía no existe el archivo del recetario en esa ruta. GastroOS lo creará automáticamente al guardar la primera receta o importar un JSON.");
            } else {
                setGitHubSyncStatus("No se pudo confirmar la lectura de GitHub. Se conserva la copia local; revisa token, permisos, ruta y conexión.", 'error');
                alert("La configuración se ha guardado, pero no se pudo cargar el recetario desde GitHub. Revisa el token, los permisos y la ruta del archivo.");
            }
        }

        async function refreshDishesFromGitHub() {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo || !github.path) {
                setGitHubSyncStatus("Configura primero la conexión con GitHub.", 'warning');
                alert("Configura primero la conexión con GitHub.");
                return;
            }
            setGitHubSyncStatus("Actualizando recetas desde GitHub…", 'loading');
            const loaded = await loadDishesFromGitHub();
            if (!loaded) {
                if (githubLastLoadIssue === "missing-file") {
                    setGitHubSyncStatus("El archivo de recetas todavía no existe en la ruta configurada. Se creará al guardar o importar recetas.", 'warning');
                    alert("El archivo de recetas todavía no existe en GitHub. Se creará al guardar la primera receta o importar un JSON.");
                } else {
                    setGitHubSyncStatus("No se pudo actualizar. Se mantiene la última copia local disponible.", 'error');
                    alert("No se pudo actualizar desde GitHub. Se mantiene la copia local.");
                }
                return;
            }
            saveAll();
            renderDishes();
            renderMigrationUI();
            renderStockView();
            renderGeneratorView();
            renderHistorySection();
            markGitHubSyncSuccess("Recetario actualizado desde GitHub.");
        }

        function setDishSaveState(isSaving) {
            const button = document.getElementById('btnSaveDish');
            if (!button) return;
            button.disabled = isSaving;
            button.setAttribute('aria-busy', isSaving ? 'true' : 'false');
            button.classList.toggle('opacity-60', isSaving);
            button.classList.toggle('cursor-not-allowed', isSaving);
            button.textContent = isSaving ? "Guardando en GitHub..." : "GUARDAR";
        }

        function base64ToUtf8(base64) {
            const binary = atob(String(base64 || "").replace(/\s/g, ""));
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        }

        function utf8ToBase64(value) {
            const bytes = new TextEncoder().encode(String(value));
            let binary = "";
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            return btoa(binary);
        }

        function findMatchingArrayEnd(text, startIndex) {
            let depth = 0;
            let quote = null;
            let escaped = false;
            for (let i = startIndex; i < text.length; i++) {
                const ch = text[i];
                if (quote) {
                    if (escaped) {
                        escaped = false;
                    } else if (ch === "\\") {
                        escaped = true;
                    } else if (ch === quote) {
                        quote = null;
                    }
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    quote = ch;
                    continue;
                }
                if (ch === '[') depth++;
                if (ch === ']') {
                    depth--;
                    if (depth === 0) return i;
                }
            }
            return -1;
        }

        function parseGitHubRecipeFile(content, path) {
            const trimmed = content.trim();
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return { recipes: parsed, format: 'json-array' };
                }
                if (parsed && Array.isArray(parsed.dishes)) {
                    return { recipes: parsed.dishes, format: 'json-dishes', wrapper: parsed };
                }
                if (parsed && Array.isArray(parsed.recipes)) {
                    return { recipes: parsed.recipes, format: 'json-recipes', wrapper: parsed };
                }
                throw new Error("El JSON del recetario no contiene un listado de recetas válido.");
            } catch {
                if (!/\.js$/i.test(path)) throw new Error("El archivo del recetario no contiene un JSON válido.");

                const markers = [
                    /(?:const|let|var)\s+dishes\s*=\s*/i,
                    /(?:const|let|var)\s+recipes\s*=\s*/i,
                    /export\s+(?:const|let|var)\s+dishes\s*=\s*/i,
                    /export\s+(?:const|let|var)\s+recipes\s*=\s*/i,
                    /export\s+default\s*/i
                ];
                let markerMatch = null;
                for (const marker of markers) {
                    const match = marker.exec(content);
                    if (match && (!markerMatch || match.index < markerMatch.index)) markerMatch = match;
                }
                if (!markerMatch) throw new Error("No se encontró un listado de recetas reconocible dentro del archivo .js.");

                const arrayStart = content.indexOf('[', markerMatch.index + markerMatch[0].length);
                if (arrayStart < 0) throw new Error("No se encontró el listado de recetas dentro del archivo .js.");
                const arrayEnd = findMatchingArrayEnd(content, arrayStart);
                if (arrayEnd < 0) throw new Error("El listado de recetas del archivo .js no está correctamente cerrado.");
                const arrayText = content.slice(arrayStart, arrayEnd + 1);
                let recipes;
                try {
                    recipes = JSON.parse(arrayText);
                } catch {
                    throw new Error("El listado del archivo .js no está en un formato JSON compatible.");
                }
                if (!Array.isArray(recipes)) throw new Error("El listado del recetario no es un array válido.");
                return { recipes, format: 'js-array', arrayStart, arrayEnd, originalContent: content };
            }
        }

        function buildGitHubRecipeFile(parsedFile, newDish = null, recipesOverride = null) {
            const updatedRecipes = Array.isArray(recipesOverride)
                ? [...recipesOverride]
                : (newDish === null
                    ? [...parsedFile.recipes]
                    : [...parsedFile.recipes, newDish]);
            if (parsedFile.format === 'json-array') {
                return JSON.stringify(updatedRecipes, null, 2) + "\n";
            }
            if (parsedFile.format === 'json-dishes' || parsedFile.format === 'json-recipes') {
                const wrapper = JSON.parse(JSON.stringify(parsedFile.wrapper));
                if (parsedFile.format === 'json-dishes') wrapper.dishes = updatedRecipes;
                else wrapper.recipes = updatedRecipes;
                return JSON.stringify(wrapper, null, 2) + "\n";
            }
            if (parsedFile.format === 'js-array') {
                const replacement = JSON.stringify(updatedRecipes, null, 2);
                return parsedFile.originalContent.slice(0, parsedFile.arrayStart) + replacement + parsedFile.originalContent.slice(parsedFile.arrayEnd + 1);
            }
            throw new Error("Formato de recetario no compatible.");
        }

        async function syncDishToGitHub(dish, isNewDish) {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo || !github.path) {
                alert("Configura primero la conexión con GitHub desde Ajustes.");
                document.querySelector('.nav-btn[data-target="view-settings"]')?.click();
                return false;
            }

            setDishSaveState(true);
            try {
                const apiUrl = `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/contents/${github.path.split('/').map(encodeURIComponent).join('/')}`;
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const getResponse = await fetch(apiUrl, { method: 'GET', headers });
                let getData = {};
                try { getData = await getResponse.json(); } catch {}
                const normalizedDish = normalizeDishData(dish);
                let parsedFile;
                let fileSha = null;
                let creatingFile = false;

                if (getResponse.status === 404 && isNewDish) {
                    // Primera receta: si el archivo todavía no existe, lo creamos automáticamente.
                    parsedFile = { type: 'array', recipes: [] };
                    creatingFile = true;
                } else {
                    if (!getResponse.ok) {
                        const reason = getData.message || `GitHub respondió con HTTP ${getResponse.status}.`;
                        throw new Error(`No se pudo leer el recetario: ${reason}`);
                    }
                    if (!getData.sha || typeof getData.content !== 'string') {
                        throw new Error("GitHub no devolvió el SHA o el contenido del archivo del recetario.");
                    }

                    fileSha = getData.sha;
                    const currentContent = base64ToUtf8(getData.content);
                    parsedFile = parseGitHubRecipeFile(currentContent, github.path);
                }

                let updatedRecipes;

                if (isNewDish) {
                    updatedRecipes = [...parsedFile.recipes, normalizedDish];
                } else {
                    const existingIndex = parsedFile.recipes.findIndex(recipe => String(recipe?.id ?? '') === String(normalizedDish.id));
                    if (existingIndex < 0) {
                        throw new Error("No se encontró en GitHub la receta que estás editando. No se ha realizado ningún cambio para evitar duplicados.");
                    }
                    updatedRecipes = parsedFile.recipes.map((recipe, index) => index === existingIndex ? normalizedDish : recipe);
                }

                const updatedFile = { ...parsedFile, recipes: updatedRecipes };
                const updatedContent = buildGitHubRecipeFile(updatedFile, null);

                const putPayload = {
                    message: creatingFile ? "Creado recetario y añadida primera receta desde GastroOS" : (isNewDish ? "Añadida nueva receta desde GastroOS" : "Actualizada receta desde GastroOS"),
                    content: utf8ToBase64(updatedContent)
                };
                if (fileSha) putPayload.sha = fileSha;

                const putResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify(putPayload)
                });

                let putData = {};
                try { putData = await putResponse.json(); } catch {}
                if (!putResponse.ok || ![200, 201].includes(putResponse.status)) {
                    const reason = putData.message || `GitHub respondió con HTTP ${putResponse.status}.`;
                    throw new Error(`No se pudo actualizar el recetario: ${reason}`);
                }

                markGitHubSyncSuccess(isNewDish ? "Receta añadida en GitHub." : "Receta actualizada en GitHub.");
                return true;
            } catch (error) {
                setGitHubSyncStatus("No se pudo guardar el cambio en GitHub.", 'error');
                console.error("Error de sincronización con GitHub:", error);
                const message = error?.message || "Error desconocido al conectar con GitHub.";
                alert(`No se pudo ${isNewDish ? "guardar" : "actualizar"} la receta en GitHub.\n\nMotivo: ${message}`);
                return false;
            } finally {
                setDishSaveState(false);
            }
        }

        async function syncImportedDishesToGitHub(importedDishes) {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo || !github.path) {
                return { success: false, skipped: true, message: "La conexión con GitHub no está configurada." };
            }

            try {
                const apiUrl = `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/contents/${github.path.split('/').map(encodeURIComponent).join('/')}`;
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const normalizedRecipes = importedDishes.map(normalizeDishData);
                const getResponse = await fetch(apiUrl, { method: 'GET', headers });
                let getData = {};
                try { getData = await getResponse.json(); } catch {}

                let updatedContent;
                let fileSha = null;
                let creatingFile = false;

                if (getResponse.status === 404) {
                    // Si el archivo no existe, lo creamos directamente con todas las recetas importadas.
                    updatedContent = JSON.stringify(normalizedRecipes, null, 2) + "\n";
                    creatingFile = true;
                } else {
                    if (!getResponse.ok) {
                        const reason = getData.message || `GitHub respondió con HTTP ${getResponse.status}.`;
                        throw new Error(`No se pudo leer el recetario: ${reason}`);
                    }
                    if (!getData.sha || typeof getData.content !== 'string') {
                        throw new Error("GitHub no devolvió el SHA o el contenido del archivo del recetario.");
                    }

                    fileSha = getData.sha;
                    const currentContent = base64ToUtf8(getData.content);
                    const parsedFile = parseGitHubRecipeFile(currentContent, github.path);
                    const updatedFile = { ...parsedFile, recipes: normalizedRecipes };
                    updatedContent = buildGitHubRecipeFile(updatedFile);
                }

                const putPayload = {
                    message: creatingFile
                        ? "Creado recetario desde importación de GastroOS"
                        : "Actualizadas recetas desde importación de GastroOS",
                    content: utf8ToBase64(updatedContent)
                };
                if (fileSha) putPayload.sha = fileSha;

                const putResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify(putPayload)
                });

                let putData = {};
                try { putData = await putResponse.json(); } catch {}
                if (!putResponse.ok || ![200, 201].includes(putResponse.status)) {
                    const reason = putData.message || `GitHub respondió con HTTP ${putResponse.status}.`;
                    throw new Error(`No se pudo actualizar el recetario: ${reason}`);
                }

                markGitHubSyncSuccess("Recetas importadas y sincronizadas con GitHub.");
                return { success: true, skipped: false };
            } catch (error) {
                setGitHubSyncStatus("No se pudo sincronizar la importación con GitHub.", 'error');
                console.error("Error de sincronización de importación con GitHub:", error);
                return {
                    success: false,
                    skipped: false,
                    message: error?.message || "Error desconocido al conectar con GitHub."
                };
            }
        }

        async function handleFormSubmit(e) {
            e.preventDefault();
            const existingId = document.getElementById('dishId').value.trim();
            const id = existingId || Date.now().toString();
            const isNewDish = !existingId;
            const cat = document.getElementById('dishCategory').value;
            const prot = document.getElementById('dishProtein').value;
            const isPrimero = cat === "Primero";
            const isCarne = cat === "Segundo" && prot === "Carne";
            const isPescado = cat === "Segundo" && prot === "Pescado";

            let fishSpecies = "";
            if (isPescado) {
                fishSpecies = document.getElementById('dishFishSpecies').value;
                if (!fishSpecies || !FISH_SPECIES.includes(fishSpecies)) {
                    alert("El pescado debe tener registrada la especie exacta.");
                    return;
                }
            }

            const subtype = isPrimero ? document.getElementById('dishSubcategory').value : "";
            if (isPrimero && !subtype) {
                alert("Selecciona la subcategoría técnica del primero.");
                return;
            }
            if (isCarne && !document.getElementById('dishSpecies').value) {
                alert("Selecciona el tipo de animal de la carne.");
                return;
            }
            if ((isCarne || isPescado) && !document.getElementById('dishTechnique').value) {
                alert("Selecciona la técnica de cocina.");
                return;
            }

            const newDish = {
                id,
                nombre: document.getElementById('dishName').value.trim(),
                categoria: cat,
                subcategoria_primero: isPrimero ? firstParentFromTechnical(subtype) : "",
                subtipo_primero: subtype,
                proteina_segundo: cat === "Segundo" ? prot : "",
                animal_carne: isCarne ? document.getElementById('dishSpecies').value : "",
                especie_pescado: isPescado ? fishSpecies : "",
                // Se conservan aliases para compatibilidad con menús/histórico anteriores.
                especie_animal: isCarne ? document.getElementById('dishSpecies').value : (isPescado ? "Pescado" : ""),
                tecnica_cocina: (isCarne || isPescado) ? document.getElementById('dishTechnique').value : "",
                tecnica: (isCarne || isPescado) ? document.getElementById('dishTechnique').value : "",
                precocinado: document.getElementById('dishPrecooked').checked,
                plato_elaborado: document.getElementById('dishPrepared').checked,
                demanda: document.getElementById('dishDemand').value,
                alergenos: Array.from(document.querySelectorAll('input[name="dishAllergen"]:checked')).map(input => input.value),
                ingredientes: []
            };

            document.querySelectorAll('.ingredient-row').forEach(row => {
                const inputs = row.querySelectorAll('input, select');
                if (inputs[0].value.trim()) {
                    const rawCantidad = inputs[1].value.toString().trim().replace(',', '.');
                    const parsedCantidad = rawCantidad === '' ? '' : (Number.isFinite(parseFloat(rawCantidad)) ? parseFloat(rawCantidad) : '');
                    const unidad = row.dataset.unidadTouched === 'true'
                        ? inputs[2].value
                        : (row.dataset.originalUnidad ?? inputs[2].value);
                    const categoriaProveedor = row.dataset.categoriaTouched === 'true'
                        ? inputs[3].value
                        : (row.dataset.originalCategoria ?? inputs[3].value);
                    newDish.ingredientes.push({
                        nombre: inputs[0].value.trim(),
                        cantidad: parsedCantidad,
                        unidad,
                        categoria_proveedor: categoriaProveedor
                    });
                }
            });

            const normalizedDish = normalizeDishData(newDish);
            createAutoBackup(`${isNewDish ? 'antes de crear' : 'antes de editar'} ${normalizedDish.nombre}`);

            // Las recetas nuevas y las editadas se sincronizan primero con GitHub.
            // Solo después de un commit correcto se modifica el recetario local, evitando
            // que un fallo remoto deje estados distintos entre la app y el repositorio.
            const synced = await syncDishToGitHub(normalizedDish, isNewDish);
            if (!synced) return;

            const idx = dishes.findIndex(d => d.id === id);
            if (idx >= 0) dishes[idx] = normalizedDish;
            else dishes.unshift(normalizedDish);
            logRecipeChange(isNewDish ? 'create' : 'update', normalizedDish, isNewDish ? 'Nueva receta' : 'Receta modificada');

            saveAll();
            resetForm();
            document.querySelector('.nav-btn[data-target="view-banco"]').click();
            renderDishes();
            renderMigrationUI();
            if (!isNewDish) restoreRecipeListScroll();
            alert(isNewDish ? "Receta guardada con éxito en GitHub" : "Receta actualizada con éxito en GitHub");
        }

        function editDish(id) {
            const d = normalizeDishData(dishes.find(x => x.id === id));
            if (!d) return;

            const scrollContainer = document.getElementById('main-container');
            recipeListScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

            document.getElementById('form-title').innerText = "Editar Plato";
            document.getElementById('btnCancel').classList.remove('hidden');
            document.getElementById('dishId').value = d.id;
            document.getElementById('dishName').value = d.nombre || "";
            document.getElementById('dishCategory').value = d.categoria || "";

            if (d.categoria === 'Primero') {
                document.getElementById('dishSubcategory').value = d.subtipo_primero || "";
            } else if (d.categoria === 'Segundo') {
                document.getElementById('dishProtein').value = d.proteina_segundo || "Carne";
                document.getElementById('dishSpecies').value = d.animal_carne || "";
                const fish = d.especie_pescado || "";
                const known = FISH_SPECIES.includes(fish);
                document.getElementById('dishFishSpecies').value = known ? fish : "";
                document.getElementById('dishTechnique').value = d.tecnica_cocina || "";
            }

            document.getElementById('dishPrecooked').checked = !!d.precocinado;
            document.getElementById('dishPrepared').checked = !!d.plato_elaborado;
            document.getElementById('dishDemand').value = d.demanda || "Media";
            document.querySelectorAll('input[name="dishAllergen"]').forEach(input => {
                input.checked = d.alergenos.includes(input.value);
            });
            updateFormVisibility();

            const container = document.getElementById('ingredientsContainer');
            container.innerHTML = '';
            (d.ingredientes || []).forEach(ing => addIngredientRow(ing.nombre, ing.cantidad, ing.unidad, ing.categoria_proveedor));
            document.querySelector('.nav-btn[data-target="view-form"]').click();
        }

        async function syncDeleteDishToGitHub(id) {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo || !github.path) {
                alert("Configura primero la conexión con GitHub desde Ajustes.");
                document.querySelector('.nav-btn[data-target="view-settings"]')?.click();
                return false;
            }

            const githubButton = document.getElementById('btnSaveDish');
            const originalButtonText = githubButton ? githubButton.textContent : '';
            if (githubButton) {
                githubButton.disabled = true;
                githubButton.setAttribute('aria-busy', 'true');
                githubButton.classList.add('opacity-60', 'cursor-not-allowed');
                githubButton.textContent = "Eliminando en GitHub...";
            }

            try {
                const apiUrl = `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/contents/${github.path.split('/').map(encodeURIComponent).join('/')}`;
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const getResponse = await fetch(apiUrl, { method: 'GET', headers });
                let getData = {};
                try { getData = await getResponse.json(); } catch {}
                if (!getResponse.ok) {
                    const reason = getData.message || `GitHub respondió con HTTP ${getResponse.status}.`;
                    throw new Error(`No se pudo leer el recetario: ${reason}`);
                }
                if (!getData.sha || typeof getData.content !== 'string') {
                    throw new Error("GitHub no devolvió el SHA o el contenido del archivo del recetario.");
                }

                const currentContent = base64ToUtf8(getData.content);
                const parsedFile = parseGitHubRecipeFile(currentContent, github.path);
                const existingIndex = parsedFile.recipes.findIndex(recipe => String(recipe?.id ?? '') === String(id));
                if (existingIndex < 0) {
                    throw new Error("No se encontró en GitHub la receta que quieres eliminar. No se ha realizado ningún cambio.");
                }

                const updatedRecipes = parsedFile.recipes.filter((recipe, index) => index !== existingIndex);
                const updatedFile = { ...parsedFile, recipes: updatedRecipes };
                const updatedContent = buildGitHubRecipeFile(updatedFile, null);

                const putResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: "Eliminada receta desde GastroOS",
                        content: utf8ToBase64(updatedContent),
                        sha: getData.sha
                    })
                });

                let putData = {};
                try { putData = await putResponse.json(); } catch {}
                if (!putResponse.ok || ![200, 201].includes(putResponse.status)) {
                    const reason = putData.message || `GitHub respondió con HTTP ${putResponse.status}.`;
                    throw new Error(`No se pudo actualizar el recetario: ${reason}`);
                }

                markGitHubSyncSuccess("Receta eliminada de GitHub.");
                return true;
            } catch (error) {
                setGitHubSyncStatus("No se pudo eliminar la receta de GitHub.", 'error');
                console.error("Error de sincronización de eliminación con GitHub:", error);
                const message = error?.message || "Error desconocido al conectar con GitHub.";
                alert(`No se pudo eliminar la receta en GitHub.\n\nMotivo: ${message}`);
                return false;
            } finally {
                if (githubButton) {
                    githubButton.disabled = false;
                    githubButton.setAttribute('aria-busy', 'false');
                    githubButton.classList.remove('opacity-60', 'cursor-not-allowed');
                    githubButton.textContent = originalButtonText || "GUARDAR";
                }
            }
        }

        async function deleteDish(id) {
            if (!confirm("¿Deseas borrar este plato?\n\nLa eliminación también se sincronizará con GitHub.")) return;
            const deletedDish = dishes.find(d => String(d.id) === String(id));
            createAutoBackup(`antes de eliminar ${deletedDish?.nombre || id}`);

            const synced = await syncDeleteDishToGitHub(id);
            if (!synced) return;

            dishes = dishes.filter(d => d.id !== id);
            logRecipeChange('delete', deletedDish, 'Receta eliminada');
            saveAll();
            renderDishes();
            renderMigrationUI();
            alert("Receta eliminada con éxito de GitHub");
        }

        function resetForm() {
            document.getElementById('dishForm').reset();
            document.getElementById('dishId').value = '';
            document.getElementById('form-title').innerText = "AÑADIR PLATO";
            document.getElementById('btnCancel').classList.add('hidden');
            document.getElementById('ingredientsContainer').innerHTML = '';
            document.getElementById('dishPrecooked').checked = false;
            document.getElementById('dishPrepared').checked = false;
            document.querySelectorAll('input[name="dishAllergen"]').forEach(input => { input.checked = false; });
            updateFormVisibility();
        }


        function getMigrationCandidates() {
            return dishes.map(normalizeDishData).filter(d => !hasCompleteTechnicalTags(d));
        }

        function renderMigrationUI() {
            const container = document.getElementById("migrationList");
            const badge = document.getElementById("migrationPendingBadge");
            if (!container) return;
            const pending = getMigrationCandidates();
            if (badge) badge.innerText = `${pending.length} pendientes`;
            if (!pending.length) {
                container.innerHTML = '<div class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">Todo el recetario está correctamente etiquetado ✓</div>';
                return;
            }

            container.innerHTML = pending.map(d => {
                const first = d.categoria === "Primero";
                const meat = d.categoria === "Segundo" && d.proteina_segundo === "Carne";
                const fish = d.categoria === "Segundo" && d.proteina_segundo === "Pescado";
                return `
                    <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50" data-migration-id="${escapeHtml(d.id)}">
                        <div class="mb-2">
                            <div class="font-bold text-xs text-gray-800 dark:text-gray-100">${escapeHtml(d.nombre)}</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400">${escapeHtml(d.categoria)}${d.proteina_segundo ? ` · ${escapeHtml(d.proteina_segundo)}` : ''}</div>
                        </div>
                        ${first ? `
                            <select id="mig-sub-${escapeHtml(d.id)}" class="w-full p-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                                <option value="">Seleccionar...</option>
                                ${Object.entries(FIRST_LABELS).map(([value,label]) => `<option value="${value}" ${d.subtipo_primero===value?'selected':''}>${label}</option>`).join("")}
                            </select>` : ''}
                        ${meat ? `
                            <div class="grid grid-cols-2 gap-2 mb-2">
                                <select id="mig-animal-${escapeHtml(d.id)}" class="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                                    <option value="">Animal...</option>
                                    ${MEAT_ANIMALS.map(a => `<option value="${a}" ${d.animal_carne===a?'selected':''}>${MEAT_LABELS[a]}</option>`).join("")}
                                </select>
                                <select id="mig-tech-${escapeHtml(d.id)}" class="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                                    <option value="">Técnica...</option>
                                    <option value="tecnica_guiso" ${d.tecnica_cocina==="tecnica_guiso"?'selected':''}>Guiso / En salsa</option>
                                    <option value="tecnica_seco_asado" ${(d.tecnica_cocina==="tecnica_seco_asado" || d.tecnica_cocina==="tecnica_seco")?'selected':''}>Plancha / Asado / Brasa</option>
                                    <option value="tecnica_frito_rebozado" ${d.tecnica_cocina==="tecnica_frito_rebozado"?'selected':''}>Frito / Rebozado / Empanado</option>
                                </select>
                            </div>` : ''}
                        ${fish ? `
                            <select id="mig-fish-${escapeHtml(d.id)}" class="w-full p-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                                <option value="">Seleccionar…</option>
                                ${FISH_SPECIES.map(a => `<option value="${a}" ${d.especie_pescado===a?'selected':''}>${FISH_LABELS[a]}</option>`).join("")}
                            </select>` : ''}
                        <button onclick="saveMigrationTag(decodeURIComponent('${escapeJsArg(d.id)}'))" class="w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold">Guardar etiqueta</button>
                    </div>`;
            }).join("");
        }

        async function saveMigrationTag(id) {
            const d = dishes.find(x => String(x.id) === String(id));
            if (!d) return;
            const nd = normalizeDishData(d);

            if (nd.categoria === "Primero") {
                const subtype = document.getElementById(`mig-sub-${id}`)?.value || "";
                if (!subtype) return alert("Selecciona una subcategoría.");
                nd.subtipo_primero = subtype;
                nd.subcategoria_primero = firstParentFromTechnical(subtype);
            } else if (nd.proteina_segundo === "Carne") {
                const animal = document.getElementById(`mig-animal-${id}`)?.value || "";
                const technique = document.getElementById(`mig-tech-${id}`)?.value || "";
                if (!animal || !technique) return alert("Selecciona animal y técnica.");
                nd.animal_carne = animal;
                nd.especie_animal = animal;
                nd.tecnica_cocina = technique;
                nd.tecnica = technique;
            } else if (nd.proteina_segundo === "Pescado") {
                const species = document.getElementById(`mig-fish-${id}`)?.value || "";
                if (!species || !FISH_SPECIES.includes(species)) return alert("Registra la especie exacta.");
                nd.especie_pescado = species;
                nd.especie_animal = "Pescado";
            }

            const index = dishes.findIndex(x => String(x.id) === String(id));
            if (index < 0) return;

            createAutoBackup(`antes de etiquetar ${nd.nombre}`);
            const github = getGitHubSettings();
            const githubConfigured = !!(github.token && github.owner && github.repo && github.path);
            if (githubConfigured) {
                setGitHubSyncStatus(`Guardando etiquetas de “${nd.nombre}” en GitHub…`, 'loading');
                const synced = await syncDishToGitHub(nd, false);
                if (!synced) {
                    setGitHubSyncStatus("No se guardó la etiqueta localmente porque GitHub no confirmó el cambio.", 'error');
                    return;
                }
            }

            dishes[index] = normalizeDishData(nd);
            logRecipeChange('migration', nd, 'Etiquetas técnicas completadas');
            saveAll();
            renderDishes();
            renderMigrationUI();
            if (githubConfigured) markGitHubSyncSuccess(`Etiqueta de “${nd.nombre}” sincronizada.`);
            else setGitHubSyncStatus("Etiqueta guardada solo en este navegador. Configura GitHub para compartirla con otros dispositivos.", 'warning');
        }
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

        function renderRawIngredientOptions(selectedValue = "") {
            const select = document.getElementById("rawName");
            if (!select) return;
            const ingredients = getSecondProteinIngredients();
            const current = String(selectedValue || select.value || "");
            select.innerHTML = '<option value="">Seleccionar...</option>';
            ingredients.forEach(name => {
                const option = document.createElement("option");
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
            if (current && ingredients.includes(current)) select.value = current;
        }

        function getPreparedDishRecipes() {
            const unique = new Map();
            dishes
                .map(normalizeDishData)
                .filter(d => d?.plato_elaborado)
                .forEach(d => {
                    const name = String(d.nombre || "").trim();
                    if (!name) return;
                    const key = normalizeFoodKey(name);
                    if (!unique.has(key)) unique.set(key, d);
                });
            return [...unique.values()].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));
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
                    if (compatible && isGuiso && (!isMeat || !GUISO_DAYS.has(dayIndex))) compatible = false;
                    if (compatible && isGuiso && assignedWeeklyGuisos >= MAX_WEEKLY_GUISOS &&
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
                            if (!isGuiso && GUISO_DAYS.has(dayIndex) && guisosAlready === 0 && meatAlready >= 1) compatible = false;
                            if (!isGuiso && GUISO_DAYS.has(dayIndex) && guisosAlready >= 1 && sameDaySeconds.filter(d => d.proteina_segundo === "Carne").length >= 2) compatible = false;
                        } else if (isFish) {
                            const fishAlready = sameDaySeconds.filter(d => d.proteina_segundo === "Pescado").length;
                            if (fishAlready >= 1) compatible = false;
                        }
                    }

                    if (compatible) {
                        options.push({
                            value: `${dayName} - ${slot}`,
                            label: `${dayName} - ${slot}${isGuiso ? " · Guiso válido" : ""}`
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
            document.getElementById('inputComensales').value = settings.comensales;
            document.getElementById('checkMargen').checked = settings.margenActivo;
            updateCalculatedRaciones(false);
            refreshStockReferenceSelectors();
            renderRawStock();
            renderPreparedStock();
        }

        function getTotalRaciones() {
            const base = Math.max(0, Number(settings.comensales) || 0);
            return settings.margenActivo ? Math.ceil(base * 1.3) : base;
        }

        function updateCalculatedRaciones(shouldSave = true) {
            const base = parseInt(document.getElementById('inputComensales').value) || 0;
            const margen = document.getElementById('checkMargen').checked;
            settings.comensales = base;
            settings.margenActivo = margen;
            if (shouldSave) saveAll();

            const total = getTotalRaciones();
            const infoText = margen ? `${base} base + 30% margen de seguridad` : `${base} raciones base`;
            document.getElementById('totalRacionesDisplay').innerText = `${total} raciones`;
            document.getElementById('totalRacionesSubtext').innerText = infoText;
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
                        if (!(ingredientName === stockName || ingredientName.includes(stockName) || stockName.includes(ingredientName))) return;
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
            const cantStr = document.getElementById('rawQty').value.toString().replace(',', '.');
            const item = {
                id: Date.now().toString(),
                nombre: document.getElementById('rawName').value.trim(),
                cantidad: parseFloat(cantStr) || 0,
                unidad: document.getElementById('rawUnit').value,
                categoria_proveedor: document.getElementById('rawCategory').value,
                conservacion: document.getElementById('rawConserv').value === 'Refrigerado' ? 'Refrigerado' : 'Congelado'
            };
            rawStock.unshift(item);
            saveAll();
            renderRawStock();
            document.getElementById('rawStockForm').reset();
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
                        <button onclick="changeRawQty(decodeURIComponent('${escapeJsArg(item.id)}'), -1)" class="w-7 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">-</button>
                        <button onclick="changeRawQty(decodeURIComponent('${escapeJsArg(item.id)}'), 1)" class="w-7 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
                        <button onclick="deleteRaw(decodeURIComponent('${escapeJsArg(item.id)}'))" class="text-red-500 bg-red-50 dark:bg-red-950 p-1.5 rounded-lg ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
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
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="changePrepQty(decodeURIComponent('${escapeJsArg(item.id)}'), -1)" class="px-2 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">-</button>
                        <button onclick="changePrepQty(decodeURIComponent('${escapeJsArg(item.id)}'), 1)" class="px-2 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
                        <button onclick="deletePrep(decodeURIComponent('${escapeJsArg(item.id)}'))" class="text-red-500 bg-red-50 dark:bg-red-950 p-1.5 rounded-lg ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
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

        // --- 6. MOTOR DE GENERACIÓN Y EXPORTACIÓN LIMPIA ---
        // --- 6. MOTOR DE MENÚ: REGLAS PROFESIONALES + FALLBACK DETERMINISTA ---

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
                const species = getDayDishList(menuDays, index, "Segundo", "Pescado")[0]?.especie_pescado;
                if (species) used.add(String(species).toLowerCase());
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

        function getWeeklyFirstSubtypeCount(menuDays, subtype, exceptDayIndex = -1) {
            return daysList.reduce((total, dayName, index) => {
                if (index === exceptDayIndex) return total;
                return total + getDayDishList(menuDays, index, "Primero")
                    .filter(d => d?.subtipo_primero === subtype).length;
            }, 0);
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
            if (!candidate || candidate.categoria !== "Primero") return false;
            const subtype = candidate.subtipo_primero;
            if (!LIQUID_FIRST_SUBTYPES.has(subtype)) return false;
            return chosenFirsts.some(d => LIQUID_FIRST_SUBTYPES.has(d?.subtipo_primero));
        }

        function isStructuralMatch(dish, spec) {
            if (!dish || dish.categoria !== spec.cat) return false;
            if (spec.cat === "Primero") {
                return spec.allowedParents
                    ? spec.allowedParents.includes(dish.subcategoria_primero)
                    : dish.subtipo_primero === spec.subtipo;
            }
            if (spec.protein === "Carne") {
                return dish.proteina_segundo === "Carne" &&
                    MEAT_ANIMALS.includes(dish.animal_carne) &&
                    MEAT_TECHNIQUES.includes(dish.tecnica_cocina);
            }
            if (spec.protein === "Pescado") {
                return dish.proteina_segundo === "Pescado" && !!dish.especie_pescado;
            }
            return false;
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
                if (slots.length === 6) signatures.add(dayPatternSignature(slots));
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

            // Reglas intocables: nunca dos primeros líquidos/triturados en el mismo día.
            if (hasLiquidFirstConflict(dish, chosenFirsts)) return true;

            // Máximo 2 días de crema de verdura por semana.
            if (dish.subtipo_primero === "cremas" && getWeeklyFirstSubtypeCount(menuDays, "cremas", dayIndex) >= 2) return true;

            // Regla intocable: una verdura principal solo puede aparecer una vez de lunes a viernes.
            if (spec.allowedParents?.includes("Verdura")) {
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
            if (CONSECUTIVE_FIRST_SUBTYPES.has(subtype) && previousDayHasSubtype(menuDays, dayIndex, subtype)) return true;

            // Anti-plantilla inter-semanal: no repetir platos/verduras en la misma estructura.
            return !ignorePreviousTemplate && violatesPreviousWeekTemplate(dish, slotIndex, previousMenu);
        }

        function violatesDaySecondRule(dish, spec, menuDays, dayIndex, chosenAnimals, chosenTechniques, chosenSecondFamilies = []) {
            if (spec.cat !== "Segundo") return false;

            if (spec.protein === "Pescado") {
                // Regla absoluta: una especie de pescado solo puede aparecer una vez en toda la semana.
                const species = String(dish?.especie_pescado || "").toLowerCase();
                if (!species) return true;
                if (getWeeklyFishSpecies(menuDays, dayIndex).has(species)) return true;
            }

            // REGLA INTOMABLE: las dos carnes del mismo día nunca pueden compartir animal.
            if (spec.protein === "Carne" && conflictsWithSecondSpecies(dish.animal_carne, chosenAnimals)) return true;

            // Tampoco combinamos dos segundos con la misma forma de elaboración/presentación
            // (por ejemplo, albóndigas de carne + albóndigas de merluza).
            if (conflictsWithSecondPreparationFamily(dish, chosenSecondFamilies)) return true;

            // Máximo un frito/rebozado por día.
            if (dish.tecnica_cocina === "tecnica_frito_rebozado" &&
                chosenTechniques.includes("tecnica_frito_rebozado")) return true;

            // Fritos: máximo 2 en la semana y nunca en días consecutivos.
            if (dish.tecnica_cocina === "tecnica_frito_rebozado") {
                if (getWeeklyTechniqueCount(menuDays, "tecnica_frito_rebozado", chosenTechniques) >= 2) return true;
                const previousDayFritos = dayIndex > 0 && getDayDishList(menuDays, dayIndex - 1, "Segundo")
                    .some(d => d?.tecnica_cocina === "tecnica_frito_rebozado");
                if (previousDayFritos) return true;
            }

            // Guisos: exactamente uno en Lunes/Miércoles/Viernes y ninguno
            // en Martes/Jueves. Nunca puede haber dos guisos el mismo día.
            if (dish.tecnica_cocina === "tecnica_guiso") {
                if (!GUISO_DAYS.has(dayIndex)) return true;
                if (getWeeklyTechniqueCount(menuDays, "tecnica_guiso", chosenTechniques) >= MAX_WEEKLY_GUISOS) return true;
            } else if (GUISO_DAYS.has(dayIndex) && chosenTechniques.length >= 1 &&
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
                .map(r => String(r?.nombre || "").toLowerCase())
                .filter(Boolean);

            return dish.ingredientes.some(ing => {
                const ingredientName = String(ing?.nombre || "").toLowerCase();
                return ingredientName && freshNames.some(raw => ingredientName.includes(raw) || raw.includes(ingredientName));
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
                (!item.asignacion || item.asignacion === 'Sin asignar'))) score += 2;
            if (usesFreshStock(dish)) score += dayIndex < 2 ? 3 : 0;
            if (spec.cat === "Segundo" && spec.protein === "Pescado" && dayIndex === 0) score += 1;

            if (spec.cat === "Segundo" && spec.protein === "Carne") {
                const isGuisoDay = GUISO_DAYS.has(dayIndex);
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
            // Una receta marcada como "Plato elaborado" NO entra en el generador
            // solo por existir en el recetario. Tiene que estar dada de alta
            // actualmente en STOCK/PREV.
            if (!dish.plato_elaborado) return true;
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

            // El fallback es estricto: ninguna regla de negocio se relaja. Los niveles se conservan
            // solo por compatibilidad con el formato existente de los slots y para evitar bucles infinitos.
            {
                let candidates = getUniqueNormalizedDishes()
                    .filter(d => isStructuralMatch(d, spec))
                    .filter(d => !usedDishIdsThisWeek.has(String(d.id)))
                    .filter(d => !violatesDayFirstRule(d, spec, menuDays, dayIndex, chosenFirsts, usedVegetableKeys, previousMenu, slotIndex))
                    .filter(d => !violatesDaySecondRule(d, spec, menuDays, dayIndex, chosenAnimals, chosenTechniques, chosenSecondFamilies))
                    .filter(d => !violatesFutureGuisoProtection(d, dayIndex, menuDays, usedDishIdsThisWeek));

                // El segundo hueco de carne de L/M/V debe cerrar obligatoriamente
                // el día con un guiso si el primer hueco no lo ha elegido ya.
                if (spec.cat === "Segundo" && spec.protein === "Carne" &&
                    GUISO_DAYS.has(dayIndex) && chosenTechniques.length === 1 &&
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
                    GUISO_DAYS.has(dayIndex) && !chosenTechniques.includes("tecnica_guiso")) {
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
                            .filter(d => !violatesDaySecondRule(d, spec, menuDays, dayIndex, chosenAnimals, chosenTechniques, chosenSecondFamilies))
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
                        GUISO_DAYS.has(dayIndex) &&
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
            const slotSpecs = [
                { slotLabel: FIRST_SLOT_LABELS.vegetable, cat: "Primero", allowedParents: ["Verdura"] },
                { slotLabel: FIRST_SLOT_LABELS.spoon, cat: "Primero", allowedParents: ["Cuchara"] },
                { slotLabel: FIRST_SLOT_LABELS.starch, cat: "Primero", allowedParents: ["Tenedor"] },
                { slotLabel: "2º Carne (Opción 1)", cat: "Segundo", protein: "Carne" },
                { slotLabel: "2º Carne (Opción 2)", cat: "Segundo", protein: "Carne" },
                { slotLabel: "2º Pescado", cat: "Segundo", protein: "Pescado" }
            ];

            const daySlots = [];
            const chosenAnimals = [];
            const chosenTechniques = [];
            const chosenSecondFamilies = [];
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
                    if (isStructuralMatch(candidate, spec)) {
                        const isGuisoDay = GUISO_DAYS.has(dayIndex);
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
                            slotIndex: index
                        }
                    );

                const dish = result.dish;
                if (dish && dish.id !== "none") {
                    const id = String(dish.id);
                    usedDishIdsThisWeek.add(id);
                    if (spec.cat === "Segundo" && spec.protein === "Carne") {
                        chosenAnimals.push(dish.animal_carne);
                        chosenTechniques.push(dish.tecnica_cocina);
                    }
                    if (spec.cat === "Segundo") {
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

        function generateWeeklyMenu() {
            const previousCandidate = getPreviousWeekCandidateMenu();
            const previousForAntiTemplate = previousCandidate?.days ? previousCandidate : null;
            const MAX_GENERATION_ATTEMPTS = 80;
            let bestMenu = null;
            let bestValidation = null;

            for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
                const candidate = buildWeeklyMenuCandidate(previousForAntiTemplate);
                const validation = validateWeeklyMenu(candidate);
                if (!bestValidation || validation.errors.length < bestValidation.errors.length) {
                    bestMenu = candidate;
                    bestValidation = validation;
                }
                if (validation.valid) {
                    currentMenu = candidate;
                    saveAll();
                    renderGeneratorView();
                    return;
                }
            }

            // No guardamos un menú inválido como si fuese correcto. Conservamos
            // únicamente el mejor candidato para que el usuario pueda ver el
            // diagnóstico y no se pierda el menú anterior válido.
            if (bestMenu && bestValidation) {
                alert(`No se ha podido construir una semana que cumpla todas las reglas después de ${MAX_GENERATION_ATTEMPTS} intentos.\n\nEl menú anterior se mantiene sin cambios.\n\nPrincipales incidencias detectadas: ${bestValidation.errors.slice(0, 5).join(" | ")}`);
            }
        }

        function regenerateSingleDay(dayName) {
            if (!currentMenu?.days || !daysList.includes(dayName)) return;

            const originalMenu = JSON.parse(JSON.stringify(currentMenu));
            const usedDishIdsInOtherDays = new Set();
            daysList.forEach(d => {
                if (d !== dayName) {
                    (currentMenu.days[d] || []).forEach(slot => {
                        if (slot.dish?.id && slot.dish.id !== "none") usedDishIdsInOtherDays.add(String(slot.dish.id));
                    });
                }
            });

            const rebuilt = {};
            daysList.forEach(d => {
                if (d !== dayName) rebuilt[d] = currentMenu.days[d] || [];
            });

            const dayIndex = daysList.indexOf(dayName);
            const usedVegetableKeys = getWeeklyUsedVegetableKeys(rebuilt, dayName);
            const previousMenu = getLatestHistoryMenu();
            const MAX_DAY_REGENERATION_ATTEMPTS = 80;
            let bestDay = null;
            let bestValidation = null;

            for (let attempt = 1; attempt <= MAX_DAY_REGENERATION_ATTEMPTS; attempt++) {
                const candidateDay = generateDayMenu(
                    dayName,
                    dayIndex,
                    rebuilt,
                    new Set(usedDishIdsInOtherDays),
                    getPreparedMap(),
                    { previousMenu, usedVegetableKeys: new Set(usedVegetableKeys) }
                );
                const testMenu = JSON.parse(JSON.stringify(originalMenu));
                testMenu.days[dayName] = candidateDay;
                const validation = validateWeeklyMenu(testMenu);
                if (!bestValidation || validation.errors.length < bestValidation.errors.length) {
                    bestDay = candidateDay;
                    bestValidation = validation;
                }
                if (validation.valid) {
                    currentMenu.days[dayName] = candidateDay;
                    saveAll();
                    renderGeneratorView();
                    return;
                }
            }

            alert(`No se ha podido regenerar ${dayName} manteniendo todas las reglas.\n\nEl día anterior se conserva sin cambios.\n\nPrincipales incidencias: ${bestValidation?.errors?.slice(0, 5).join(" | ") || "sin diagnóstico"}`);
        }

        function validateWeeklyMenu(menu) {
            return window.GastroOSMenuValidator.validateWeeklyMenu(menu, {
                daysList,
                GUISO_DAYS,
                LIQUID_FIRST_SUBTYPES,
                CONSECUTIVE_FIRST_SUBTYPES,
                FIRST_LABELS,
                MEAT_LABELS,
                getPrimaryVegetableKey,
                getSecondPreparationFamily,
                getWeeklyFirstSubtypeCount,
                getPreviousWeekHistoryMenu,
                getPreviousWeekPatternSignatures,
                dayPatternSignature
            });
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

            const daysToRender = selectedGeneratorDay === 'Todos' ? daysList : [selectedGeneratorDay];

            daysToRender.forEach(dayName => {
                const slots = currentMenu.days[dayName] || [];
                const dayCard = document.createElement('div');
                dayCard.className = "bg-white/80 p-4 rounded-2xl space-y-4 transition-all";
                const primeros = slots.slice(0, 3);
                const segundos = slots.slice(3, 6);

                dayCard.innerHTML = `
                    <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            <h3 class="font-bold text-gray-800 dark:text-gray-100 text-base">${dayName}</h3>
                        </div>
                        <button onclick="regenerateSingleDay('${dayName}')" class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                            Reorganizar día ↻
                        </button>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">1. Primeros Platos</h4>
                        <div class="space-y-2">${primeros.map((s, idx) => renderSlotCard(dayName, idx, s)).join('')}</div>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">2. Segundos Platos</h4>
                        <div class="space-y-2">${segundos.map((s, idx) => renderSlotCard(dayName, idx+3, s)).join('')}</div>
                    </div>
                `;
                container.appendChild(dayCard);
            });
        }

        function renderSlotCard(dayName, index, slot) {
            const isPrimero = slot.cat === 'Primero';
            let dishName = slot.dish ? slot.dish.nombre : "Sin asignar";
            const warningBadge = slot.warning ? `<span class="text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-bold ml-2">${escapeHtml(slot.warning)}</span>` : '';
            const stockBadge = slot.isPreparedStock ? `<span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold ml-2">Stock Elaborado</span>` : '';
            const precookedBadge = (slot.dish && slot.dish.precocinado) ? `<span class="text-[10px] bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 px-1.5 py-0.5 rounded font-bold ml-2">Precocinado</span>` : '';
            // En el menú semanal no mostramos la etiqueta interna "Plato elaborado".
            // Si procede de stock elaborado, la única etiqueta visible es "Stock Elaborado".
            const preparedDishBadge = '';
            const allergenNames = slot.dish && Array.isArray(slot.dish.alergenos)
                ? slot.dish.alergenos.map(a => ALLERGEN_LABELS[a]).filter(Boolean)
                : [];
            const allergenLine = allergenNames.length
                ? `<div class="text-[9px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">Alérgenos: ${allergenNames.map(escapeHtml).join(' · ')}</div>`
                : '';

            const safeDay = escapeJsArg(dayName);
            const safeCat = escapeJsArg(slot.cat);
            const safeFirstSubtype = escapeJsArg(isPrimero ? (slot.dish?.subcategoria_primero || '') : '');
            const safeProtein = escapeJsArg(!isPrimero ? (slot.dish?.proteina_segundo || '') : '');
            return `
                <div class="gastro-slot flex items-center justify-between p-3">
                    <div class="flex items-center gap-2 flex-1">
                        <div>
                            <div class="text-[10px] font-bold text-gray-500 uppercase">${escapeHtml(slot.slotLabel)}</div>
                            <div class="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">${escapeHtml(dishName)} ${warningBadge} ${stockBadge} ${precookedBadge} ${preparedDishBadge}</div>
                            ${allergenLine}
                        </div>
                    </div>
                    <button onclick="openSwapModal(decodeURIComponent('${safeDay}'), ${index}, decodeURIComponent('${safeCat}'), decodeURIComponent('${safeFirstSubtype}'), decodeURIComponent('${safeProtein}'))" class="gastro-slot-action flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                </div>
            `;
        }

        // --- EXPORTAR MENÚ EN FORMATO TXT LIMPIO ---
        function getWeekDatesForMenu() {
            // La exportación siempre representa la semana SIGUIENTE a la fecha
            // real de exportación, independientemente del día en que se ejecute.
            const base = new Date();
            base.setHours(0, 0, 0, 0);
            const day = base.getDay() || 7; // ISO: lunes=1 ... domingo=7
            base.setDate(base.getDate() - day + 1 + 7);
            return daysList.map((_, index) => {
                const d = new Date(base);
                d.setDate(base.getDate() + index);
                return d;
            });
        }

        function downloadWeeklyMenuTxt() {
            if (!currentMenu || !currentMenu.days) {
                alert("No hay ningún menú generado para exportar.");
                return;
            }
            const dates = getWeekDatesForMenu();
            const blocks = daysList.map((dayName, index) => {
                const slots = currentMenu.days[dayName] || [];
                const primeros = slots.slice(0, 3).map(s => s.dish?.nombre || "Sin asignar");
                const segundos = slots.slice(3, 6).map(s => s.dish?.nombre || "Sin asignar");
                const dateLabel = dates[index].toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `${dateLabel} / ${dayName.toUpperCase()}\n\nPrimeros:\n\n${primeros.join('\n')}\n\nSegundos:\n\n${segundos.join('\n')}`;
            });
            const text = blocks.join('\n\n');
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `menu_semanal_${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // --- LISTA DE COMPRA CON REDONDEO ESTRICTO HACIA ARRIBA ---
        function createStockLedger() {
            return rawStock.map(stock => {
                const unit = String(stock?.unidad || '').toLowerCase();
                const dimension = ['kg', 'g'].includes(unit) ? 'weight' : (['l', 'ml'].includes(unit) ? 'volume' : null);
                const baseQty = dimension ? ((unit === 'kg' || unit === 'l') ? Number(stock.cantidad) * 1000 : Number(stock.cantidad)) : 0;
                return { stock, key: normalizeFoodKey(stock?.nombre), category: String(stock?.categoria_proveedor || ''), dimension, remaining: Math.max(0, baseQty) };
            });
        }

        function deductFromStockLedger(ledger, ingredientName, requiredQtyBase, unit, category) {
            const name = normalizeFoodKey(ingredientName);
            if (!name || requiredQtyBase <= 0) return 0;
            const dimension = ['kg', 'g'].includes(String(unit).toLowerCase()) ? 'weight' : 'volume';
            let remaining = requiredQtyBase;
            for (const entry of ledger) {
                if (remaining <= 0) break;
                if (!entry.key || entry.remaining <= 0 || entry.dimension !== dimension || entry.category !== category) continue;
                if (!(entry.key === name || entry.key.includes(name) || name.includes(entry.key))) continue;
                const used = Math.min(remaining, entry.remaining);
                entry.remaining -= used;
                remaining -= used;
            }
            return requiredQtyBase - remaining;
        }

        function buildShoppingData() {
            const totalRacionesPorComida = getTotalRaciones();
            const aggregated = {};
            const stockLedger = createStockLedger();
            daysList.forEach(dayName => {
                const slots = currentMenu.days[dayName] || [];
                slots.forEach(slot => {
                    if (slot.isPreparedStock) return;
                    (slot.dish?.ingredientes || []).forEach(ing => {
                        const rawName = String(ing?.nombre || '').trim();
                        if (!rawName) return;

                        const unit = String(ing?.unidad || '').trim().toLowerCase();
                        const rawQuantityText = String(ing?.cantidad ?? '').trim().replace(',', '.');
                        const rawQty = Number(rawQuantityText);
                        const isWeight = ['kg', 'g'].includes(unit);
                        const isVolume = ['l', 'ml'].includes(unit);
                        const hasCalculableQuantity = rawQuantityText !== '' && Number.isFinite(rawQty) && rawQty > 0 && (isWeight || isVolume);
                        const category = proveedorCategorias.includes(ing?.categoria_proveedor) ? ing.categoria_proveedor : 'Secos';
                        const key = normalizeFoodKey(rawName);
                        if (!key) return;

                        if (!aggregated[key]) {
                            aggregated[key] = {
                                nombre: rawName,
                                totalBaseQty: 0,
                                cat: category,
                                baseUnit: isWeight ? 'kg' : (isVolume ? 'L' : ''),
                                needsManualPurchase: false
                            };
                        }

                        // Una cantidad vacía NO significa que el ingrediente deba desaparecer
                        // de la lista: debe aparecer como "Por comprar" para recordar la compra.
                        if (!hasCalculableQuantity) {
                            aggregated[key].needsManualPurchase = true;
                            if (!aggregated[key].baseUnit) aggregated[key].baseUnit = '';
                            return;
                        }

                        const demandFactor = getDemandPortionFactor(slot.dish?.demanda || 'Media');
                        const estimatedDishRations = totalRacionesPorComida * demandFactor;
                        const totalForMeal = rawQty * estimatedDishRations * PURCHASE_ADJUSTMENT_FACTOR;
                        const baseQty = totalForMeal * ((unit === 'kg' || unit === 'l') ? 1000 : 1);
                        const stockUsed = deductFromStockLedger(stockLedger, rawName, baseQty, unit, category);
                        const netQty = Math.max(0, baseQty - stockUsed);
                        aggregated[key].totalBaseQty += netQty;
                        aggregated[key].baseUnit = isWeight ? 'kg' : 'L';
                    });
                });
            });

            const groupedByCategory = {};
            proveedorCategorias.forEach(cat => groupedByCategory[cat] = []);
            Object.values(aggregated).forEach(item => {
                if (item.totalBaseQty <= 0 && !item.needsManualPurchase) return;
                let cantidad = '';
                let unidad = '';
                if (item.totalBaseQty > 0) {
                    cantidad = Math.ceil(item.totalBaseQty / 1000);
                    unidad = item.baseUnit;
                    if (item.needsManualPurchase) unidad = `${unidad} + revisar`;
                } else {
                    cantidad = 'Por comprar';
                }
                groupedByCategory[item.cat].push({
                    nombre: item.nombre,
                    cantidad,
                    unidad
                });
            });
            return { totalRacionesPorComida, groupedByCategory };
        }

        function renderShoppingListUI() {
            const container = document.getElementById('shoppingListBreakdown');
            if (!currentMenu || !currentMenu.days) {
                container.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">Genera un menú semanal para calcular la lista de la compra.</p>';
                document.getElementById('shoppingRacionesBadge').innerText = `${getTotalRaciones()} Raciones`;
                return;
            }
            const { totalRacionesPorComida, groupedByCategory } = buildShoppingData();
            document.getElementById('shoppingRacionesBadge').innerText = `${totalRacionesPorComida} Raciones`;
            container.innerHTML = '';
            let hasItems = false;
            proveedorCategorias.forEach(cat => {
                const items = groupedByCategory[cat];
                if (!items.length) return;
                hasItems = true;
                const section = document.createElement('div');
                section.className = "bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-2";
                section.innerHTML = `<h4 class="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 pb-1">${escapeHtml(cat)}</h4><ul class="space-y-1.5">${items.map(i => `<li class="flex justify-between text-xs text-gray-800 dark:text-gray-200"><span>${escapeHtml(i.nombre)}</span><span class="font-bold">${escapeHtml(`${i.cantidad}${i.unidad}`)}</span></li>`).join('')}</ul>`;
                container.appendChild(section);
            });
            if (!hasItems) container.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">No hay ingredientes necesarios en el menú actual.</p>';
        }

        function downloadShoppingListTxt() {
            if (!currentMenu || !currentMenu.days) {
                alert("Primero genera un menú semanal.");
                return;
            }
            const { totalRacionesPorComida, groupedByCategory } = buildShoppingData();
            let text = '';
            proveedorCategorias.forEach(cat => {
                const items = groupedByCategory[cat];
                if (!items.length) return;
                text += `${cat.toUpperCase()}\n\n`;
                items.forEach(i => { text += `${i.nombre}: ${i.cantidad} ${i.unidad}\n`; });
                text += '\n';
            });
            const blob = new Blob([text.trim()], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lista_compra_${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // --- 7. MODAL DE CAMBIO DE PLATO ---
        function openSwapModal(dayName, slotIndex, cat, subcat, protein) {
            swapTarget = { dayName, slotIndex, cat, subcat, protein };
            document.getElementById('modalSwapTitle').innerText = `Seleccionar... (${dayName})`;
            document.getElementById('modalSwapSubtitle').innerText = `Filtrado para ${cat}`;
            document.getElementById('modalSearchInput').value = '';
            renderModalDishList();
            document.getElementById('modalChangeDish').classList.remove('hidden');
        }

        function closeSwapModal() {
            document.getElementById('modalChangeDish').classList.add('hidden');
            swapTarget = null;
        }

        function renderModalDishList() {
            if (!swapTarget) return;
            const container = document.getElementById('modalDishList');
            const searchVal = document.getElementById('modalSearchInput').value.toLowerCase();
            container.innerHTML = '';

            const alternatives = dishes.filter(d => {
                if (d.categoria !== swapTarget.cat) return false;
                if (swapTarget.cat === 'Primero' && swapTarget.subcat && d.subcategoria_primero !== swapTarget.subcat) return false;
                if (swapTarget.cat === 'Segundo' && swapTarget.protein && d.proteina_segundo !== swapTarget.protein) return false;
                if (String(d.id) === String(currentMenu?.days?.[swapTarget.dayName]?.[swapTarget.slotIndex]?.dish?.id)) return false;
                if (searchVal && !String(d.nombre || '').toLowerCase().includes(searchVal)) return false;

                // Solo mostramos candidatos que, si se colocan en este hueco,
                // dejan el menú completo dentro de todas las reglas de negocio.
                const testMenu = JSON.parse(JSON.stringify(currentMenu));
                testMenu.days[swapTarget.dayName][swapTarget.slotIndex].dish = normalizeDishData(d);
                return validateWeeklyMenu(testMenu).valid;
            });

            if (alternatives.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 text-xs py-4">Sin alternativas disponibles.</p>';
                return;
            }

            alternatives.forEach(d => {
                const card = document.createElement('div');
                card.className = "bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-all";
                card.innerHTML = `
                    <div>
                        <h4 class="font-bold text-gray-800 dark:text-gray-100 text-xs mb-1">${escapeHtml(d.nombre)}</h4>
                        <div class="flex gap-1.5">
                            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">${escapeHtml(d.categoria)}</span>
                            ${d.precocinado ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300">Precocinado</span>' : ''}
                        </div>
                    </div>
                    <button onclick="confirmSwap(decodeURIComponent('${escapeJsArg(d.id)}'))" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">Seleccionar</button>
                `;
                container.appendChild(card);
            });
        }

        function confirmSwap(dishId) {
            if (!swapTarget || !currentMenu || !currentMenu.days) return;
            const newDish = dishes.find(d => String(d.id) === String(dishId));
            if (!newDish) return;

            const testMenu = JSON.parse(JSON.stringify(currentMenu));
            testMenu.days[swapTarget.dayName][swapTarget.slotIndex].dish = normalizeDishData(newDish);
            const validation = validateWeeklyMenu(testMenu);
            if (!validation.valid) {
                alert(`Ese cambio no cumple las reglas del menú.\n\n${validation.errors.slice(0, 3).join("\n")}`);
                return;
            }

            currentMenu.days[swapTarget.dayName][swapTarget.slotIndex].dish = normalizeDishData(newDish);
            currentMenu.days[swapTarget.dayName][swapTarget.slotIndex].warning = "Intercambio manual ☓";
            currentMenu.days[swapTarget.dayName][swapTarget.slotIndex].isPreparedStock = false;

            saveAll();
            renderGeneratorView();
            closeSwapModal();
        }

        // --- 8. HISTÓRICO Y BACKUP ---
        function saveMenuToHistory() {
            if (!currentMenu || !currentMenu.days) {
                alert("No hay menú activo para guardar.");
                return;
            }
            const signature = JSON.stringify(currentMenu.days);
            const duplicate = historyMenus.find(item => JSON.stringify(item?.menu?.days || {}) === signature);
            if (duplicate && !confirm(`Este menú ya está guardado en el histórico (${duplicate.date || 'fecha anterior'}). ¿Quieres guardarlo de nuevo?`)) return;
            const record = {
                id: Date.now().toString(),
                date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                savedAt: new Date().toISOString(),
                menu: JSON.parse(JSON.stringify(currentMenu))
            };
            historyMenus.unshift(record);
            if (historyMenus.length > 10) historyMenus.pop();
            saveAll();
            renderHistorySection();
            alert("Menú guardado en el histórico correctamente.");
        }

        function renderHistorySection() {
            const container = document.getElementById('historyListContainer');
            if (!container) return;
            container.innerHTML = '';

            if (historyMenus.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 dark:text-gray-500 text-xs py-2">No hay menús guardados.</p>';
                return;
            }

            historyMenus.forEach(item => {
                const row = document.createElement('div');
                row.className = "bg-white/80 p-3.5 rounded-2xl flex justify-between items-center transition-all";
                row.innerHTML = `
                    <div>
                        <h4 class="font-bold text-gray-800 dark:text-gray-100 text-xs">Menú del ${item.date}</h4>
                        <span class="text-[10px] text-gray-500">Planificación semanal completa</span>
                    </div>
                    <div class="flex gap-1.5">
                        <button onclick="loadHistoryMenu(decodeURIComponent('${escapeJsArg(item.id)}'))" class="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold">Cargar</button>
                        <button onclick="deleteHistoryMenu(decodeURIComponent('${escapeJsArg(item.id)}'))" class="bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-lg text-xs font-bold">×</button>
                    </div>
                `;
                container.appendChild(row);
            });
        }

        function loadHistoryMenu(id) {
            const item = historyMenus.find(h => h.id === id);
            if (item) {
                currentMenu = JSON.parse(JSON.stringify(item.menu));
                saveAll();
                renderGeneratorView();
                document.querySelector('.nav-btn[data-target="view-generator"]').click();
                switchGeneratorSubTab('menu');
            }
        }

        function deleteHistoryMenu(id) {
            historyMenus = historyMenus.filter(h => h.id !== id);
            saveAll();
            renderHistorySection();
        }

        function exportData() {
            const data = { app: 'GastroOS', type: 'full-backup', exportedAt: new Date().toISOString(), dishes, settings, rawStock, preparedStock, currentMenu, previousWeekMenu, historyMenus, recipeChangeHistory };
            downloadJsonFile(data, `gastroos_backup_${new Date().toISOString().slice(0,10)}.json`);
        }

        function exportRecipesOnly() {
            const data = {
                app: "GastroOS",
                type: "recipes-only",
                exportedAt: new Date().toISOString(),
                dishes: dishes.map(normalizeDishData)
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gastroos_recetas_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function closeImportPreview() {
            pendingImportData = null;
            document.getElementById('modalImportPreview')?.classList.add('hidden');
        }

        function summarizeImport(data) {
            const importedDishes = Array.isArray(data) ? data : (Array.isArray(data?.dishes) ? data.dishes : (Array.isArray(data?.recipes) ? data.recipes : null));
            const full = !Array.isArray(data) && data && typeof data === 'object';
            return {
                importedDishes,
                full,
                recipeCount: importedDishes?.length || 0,
                hasSettings: !!(full && data.settings && typeof data.settings === 'object'),
                hasStock: !!(full && (Array.isArray(data.rawStock) || Array.isArray(data.preparedStock))),
                hasMenu: !!(full && Object.prototype.hasOwnProperty.call(data, 'currentMenu')),
                hasHistory: !!(full && Array.isArray(data.historyMenus))
            };
        }

        function openImportPreview(data, fileName = '') {
            const summary = summarizeImport(data);
            if (!summary.importedDishes && !summary.full) throw new Error('El archivo no contiene datos reconocibles de GastroOS.');
            pendingImportData = { data, fileName, summary };
            const el = document.getElementById('importPreviewContent');
            el.innerHTML = `
                <div class="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 p-3">
                    <div class="font-bold text-indigo-800 dark:text-indigo-200">${escapeHtml(fileName || 'archivo JSON')}</div>
                    <div class="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1">Se creará una copia automática antes de aplicar los cambios.</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800"><b>${summary.recipeCount}</b><div class="text-gray-500 mt-1">recetas</div></div>
                    <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800"><b>${summary.full ? 'Sí' : 'No'}</b><div class="text-gray-500 mt-1">copia integral</div></div>
                </div>
                <ul class="space-y-1 text-gray-600 dark:text-gray-300">
                    <li>• Configuración: ${summary.hasSettings ? 'se restaurará' : 'no se modifica'}</li>
                    <li>• Stock: ${summary.hasStock ? 'se restaurará' : 'no se modifica'}</li>
                    <li>• Menú actual: ${summary.hasMenu ? 'se restaurará' : 'no se modifica'}</li>
                    <li>• Histórico: ${summary.hasHistory ? 'se restaurará' : 'no se modifica'}</li>
                </ul>
                <p class="text-[10px] text-amber-700 dark:text-amber-300">La restauración sustituirá los datos equivalentes de este navegador. Si el archivo contiene solo recetas, únicamente se sustituirá el recetario.</p>`;
            document.getElementById('modalImportPreview').classList.remove('hidden');
        }

        async function confirmPendingImport() {
            if (!pendingImportData) return;
            const { data, summary } = pendingImportData;
            createAutoBackup(`antes de restaurar ${pendingImportData.fileName || 'una copia JSON'}`);
            const importedDishes = summary.importedDishes;
            if (importedDishes) {
                dishes = importedDishes.map(normalizeDishData);
                logRecipeChange('import', null, `${dishes.length} recetas importadas`);
            }
            if (summary.full && data.settings && typeof data.settings === 'object') settings = { ...defaultSettings, ...data.settings };
            if (summary.full && Array.isArray(data.rawStock)) rawStock = data.rawStock;
            if (summary.full && Array.isArray(data.preparedStock)) preparedStock = data.preparedStock;
            if (summary.full && Object.prototype.hasOwnProperty.call(data, 'currentMenu')) currentMenu = data.currentMenu;
            if (summary.full && Object.prototype.hasOwnProperty.call(data, 'previousWeekMenu')) previousWeekMenu = data.previousWeekMenu;
            if (summary.full && Array.isArray(data.historyMenus)) historyMenus = data.historyMenus;
            if (summary.full && Array.isArray(data.recipeChangeHistory)) recipeChangeHistory = data.recipeChangeHistory;

            saveAll();
            applyDarkMode();
            updateFormVisibility();
            renderDishes(); renderStockView(); renderGeneratorView(); renderHistorySection(); renderMigrationUI(); renderRecipeDiagnostics(); renderRecipeChangeHistory();
            closeImportPreview();

            if (importedDishes) {
                const syncResult = await syncImportedDishesToGitHub(dishes);
                if (syncResult.success) alert('Datos restaurados correctamente y recetas sincronizadas con GitHub.');
                else if (syncResult.skipped) {
                    setGitHubSyncStatus('Restauración guardada localmente. GitHub no está configurado en este navegador.', 'warning');
                    alert('Datos restaurados correctamente. GitHub no está configurado, así que las recetas quedan solo en este navegador.');
                } else {
                    setGitHubSyncStatus('La restauración está guardada localmente, pero no se pudo sincronizar con GitHub.', 'error');
                    alert(`Datos restaurados localmente, pero no se pudieron sincronizar con GitHub.\n\nMotivo: ${syncResult.message}`);
                }
            } else {
                alert('Datos restaurados correctamente.');
            }
        }

        function importData(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const data = JSON.parse(evt.target.result);
                    openImportPreview(data, file.name);
                } catch(err) {
                    console.error('Error al leer el archivo JSON:', err);
                    alert('No se pudo leer el JSON. Comprueba que el archivo sea válido.');
                } finally {
                    e.target.value = '';
                }
            };
            reader.readAsText(file);
        }

        function wipeData() {
            if (confirm("¿Estás completamente seguro de borrar los datos locales y restaurar valores iniciales? La conexión con GitHub se conservará para poder volver a cargar el recetario.")) {
                createAutoBackup('antes de borrar todos los datos locales');
                const githubSettings = localStorage.getItem('chefTrack_githubSettings');
                const autoBackup = localStorage.getItem('chefTrack_autoBackup');
                const autoBackupAt = localStorage.getItem('chefTrack_autoBackupAt');
                localStorage.clear();
                if (autoBackup) localStorage.setItem('chefTrack_autoBackup', autoBackup);
                if (autoBackupAt) localStorage.setItem('chefTrack_autoBackupAt', autoBackupAt);
                if (githubSettings) localStorage.setItem('chefTrack_githubSettings', githubSettings);
                location.reload();
            }
        }

        window.onload = init;
    
    
