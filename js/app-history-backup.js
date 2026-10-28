/* GastroOS — Histórico, copias de seguridad, importación y arranque (init).
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */
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

        // Un elemento del historial dañado (sin id o sin menú) no debe romper la pantalla de ajustes.
        function isValidHistoryItem(item) {
            return !!item && typeof item === 'object' && item.id !== undefined && item.id !== null &&
                !!item.menu && typeof item.menu === 'object' && !!item.menu.days && typeof item.menu.days === 'object';
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
                        <h4 class="font-bold text-gray-800 dark:text-gray-100 text-xs">Menú del ${escapeHtml(item.date)}</h4>
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
            const data = buildBackupData('full-backup', 'exportación manual');
            downloadJsonFile(data, `gastroos_backup_${new Date().toISOString().slice(0,10)}.json`);
        }

        function exportRecipesOnly() {
            const data = {
                app: "GastroOS",
                type: "recipes-only",
                exportedAt: new Date().toISOString(),
                proteinCatalog: getRecipeProteinCatalog(),
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
            const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
            const importedDishes = Array.isArray(data) ? data : (Array.isArray(data?.dishes) ? data.dishes : (Array.isArray(data?.recipes) ? data.recipes : null));
            const full = isObject(data);
            const recognizedType = !full || (!data.type || ['full-backup', 'automatic-backup', 'recipes-only'].includes(data.type));
            const backupRequiresDishes = full && ['full-backup', 'automatic-backup'].includes(data.type);
            const missingRequiredDishes = backupRequiresDishes && !Array.isArray(data.dishes);
            const versionValid = !full || (
                (data.app === undefined || data.app === 'GastroOS') &&
                (data.backupFormatVersion === undefined ||
                    (Number.isInteger(data.backupFormatVersion) && data.backupFormatVersion >= 1 && data.backupFormatVersion <= BACKUP_FORMAT_VERSION)) &&
                (data.schemaVersion === undefined ||
                    (Number.isInteger(data.schemaVersion) && data.schemaVersion >= 1 && data.schemaVersion <= BACKUP_SCHEMA_VERSION))
            );
            const recipeArrayValid = Array.isArray(importedDishes);
            const invalidRecipes = recipeArrayValid ? importedDishes.filter(recipe =>
                !isObject(recipe) || recipe.id === undefined || !String(recipe.nombre || '').trim() ||
                (recipe.ingredientes !== undefined && (!Array.isArray(recipe.ingredientes) || recipe.ingredientes.some(ing => !isObject(ing) || (ing.nombre !== undefined && typeof ing.nombre !== 'string') || (ing.unidad !== undefined && typeof ing.unidad !== 'string') || (ing.cantidad !== undefined && !['string','number'].includes(typeof ing.cantidad) && ing.cantidad !== null) || (typeof ing.cantidad === 'number' && !Number.isFinite(ing.cantidad))))) || (recipe.nombre !== undefined && typeof recipe.nombre !== 'string') || (recipe.demanda !== undefined && !['Alta','Media','Baja'].includes(recipe.demanda))
            ).length : 0;
            const validArrayField = (key) => data?.[key] === undefined || Array.isArray(data[key]);
            const settingsValid = data?.settings === undefined || isObject(data.settings);
            const allergenValid = data?.productAllergenMap === undefined || isObject(data.productAllergenMap);
            const menuValid = ['currentMenu','previousWeekMenu'].every(key => data?.[key] === undefined || data[key] === null || (isObject(data[key]) && isObject(data[key].days)));
            const stockValid = validArrayField('rawStock') && validArrayField('preparedStock') && (!Array.isArray(data?.rawStock) || data.rawStock.every(isObject)) && (!Array.isArray(data?.preparedStock) || data.preparedStock.every(isObject));
            const historyValid = validArrayField('historyMenus') && validArrayField('recipeChangeHistory');
            const incompatible = !versionValid || !settingsValid || !allergenValid || !stockValid || !historyValid || !menuValid;
            return {
                importedDishes, full, recognizedType, versionValid, incompatible, missingRequiredDishes, recipeArrayValid, invalidRecipes,
                recipeCount: importedDishes?.length || 0,
                hasSettings: !!(full && data.settings && isObject(data.settings)),
                hasStock: !!(full && (Array.isArray(data.rawStock) || Array.isArray(data.preparedStock))),
                hasMenu: !!(full && Object.prototype.hasOwnProperty.call(data, 'currentMenu')),
                hasHistory: !!(full && Array.isArray(data.historyMenus))
            };
        }

        function openImportPreview(data, fileName = '') {
            const summary = summarizeImport(data);
            if (!summary.importedDishes && !summary.full) throw new Error('El archivo no contiene datos reconocibles de GastroOS.');
            if (!summary.recognizedType) throw new Error('El archivo parece ser JSON, pero no es un formato de copia de GastroOS reconocido.');
            if (!summary.versionValid) throw new Error('La copia pertenece a otra aplicación o a una versión futura/no compatible. No se han modificado los datos.');
            if (summary.missingRequiredDishes) throw new Error('La copia integral no contiene el catálogo de recetas obligatorio. No se han modificado los datos.');
            if (summary.incompatible) throw new Error('La estructura de la copia está incompleta o contiene tipos incompatibles (configuración, stock, menú, alérgenos o histórico). No se han modificado los datos.');
            if (!summary.recipeArrayValid || summary.invalidRecipes > 0) throw new Error(`El archivo contiene ${summary.invalidRecipes} receta(s) con estructura básica inválida.`);
            pendingImportData = { data, fileName, summary };
            const el = document.getElementById('importPreviewContent');
            el.innerHTML = `
                <div class="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 p-3">
                    <div class="font-bold text-indigo-800 dark:text-indigo-200">${escapeHtml(fileName || 'archivo JSON')}</div>
                    <div class="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1">Formato GastroOS ${escapeHtml(String(data.backupFormatVersion || 'clásico'))} · Se creará una copia automática antes de aplicar los cambios.</div>
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
            const pending = pendingImportData;
            const { data, summary } = pending;
            const safetyBackup = createAutoBackup(`antes de restaurar ${pending.fileName || 'una copia JSON'}`);
            if (!safetyBackup) {
                alert('No se pudo crear la copia de seguridad previa. La restauración se ha cancelado para proteger los datos actuales.');
                return;
            }
            const storageSnapshot = window.GastroOSDataStore.createSnapshot();
            if (!storageSnapshot) {
                alert('No se pudo crear una instantánea de seguridad del almacenamiento. La restauración se ha cancelado.');
                return;
            }
            const previousState = { dishes, settings, productAllergenMap, rawStock, preparedStock, currentMenu, previousWeekMenu, historyMenus, recipeChangeHistory, recipeProteinCatalog };
            try {
                if (summary.full && data.settings && typeof data.settings === 'object') settings = { ...defaultSettings, ...data.settings };
                if (summary.full && data.productAllergenMap && typeof data.productAllergenMap === 'object') productAllergenMap = data.productAllergenMap;
                if (summary.full && data.proteinCatalog) mergeRecipeProteinCatalogIntoProfile(data.proteinCatalog);
                const importedDishes = summary.importedDishes;
                if (importedDishes) {
                    dishes = importedDishes.map(normalizeDishData);
                    logRecipeChange('import', null, `${dishes.length} recetas importadas`);
                }
                if (summary.full && Array.isArray(data.rawStock)) rawStock = data.rawStock.map(normalizeImportedStockItem);
                if (summary.full && Array.isArray(data.preparedStock)) preparedStock = data.preparedStock.map(normalizeImportedStockItem);
                if (summary.full && Object.prototype.hasOwnProperty.call(data, 'currentMenu')) currentMenu = validateImportedMenu(data.currentMenu, 'menú actual');
                if (summary.full && Object.prototype.hasOwnProperty.call(data, 'previousWeekMenu')) previousWeekMenu = validateImportedMenu(data.previousWeekMenu, 'menú anterior');
                if (summary.full && Array.isArray(data.historyMenus)) historyMenus = data.historyMenus.filter(isValidHistoryItem);
                if (summary.full && Array.isArray(data.recipeChangeHistory)) recipeChangeHistory = data.recipeChangeHistory;

                if (!saveAll()) throw new Error('El navegador no pudo guardar todos los datos restaurados.');
                applyDarkMode();
                updateFormVisibility();
                renderDishes(); renderStockView(); renderGeneratorView(); renderHistorySection(); renderMigrationUI(); renderRecipeDiagnostics(); renderRecipeChangeHistory();
                closeImportPreview();

                if (importedDishes) {
                    const syncResult = await syncImportedDishesToGitHub(dishes);
                    if (syncResult.success) alert('Datos restaurados correctamente y recetas sincronizadas con GitHub.');
                    else if (syncResult.skipped) {
                        setGitHubSyncStatus('Restauración guardada localmente. GitHub no está configurado en esta sesión.', 'warning');
                        alert('Datos restaurados correctamente. GitHub no está configurado en esta sesión, así que las recetas quedan solo en este navegador.');
                    } else {
                        setGitHubSyncStatus('La restauración está guardada localmente, pero no se pudo sincronizar con GitHub.', 'error');
                        alert(`Datos restaurados localmente, pero no se pudieron sincronizar con GitHub.\n\nMotivo: ${syncResult.message}`);
                    }
                } else alert('Datos restaurados correctamente.');
            } catch (error) {
                dishes = previousState.dishes; settings = previousState.settings; productAllergenMap = previousState.productAllergenMap;
                rawStock = previousState.rawStock; preparedStock = previousState.preparedStock; currentMenu = previousState.currentMenu;
                previousWeekMenu = previousState.previousWeekMenu; historyMenus = previousState.historyMenus;
                recipeChangeHistory = previousState.recipeChangeHistory; recipeProteinCatalog = previousState.recipeProteinCatalog;
                const restored = window.GastroOSDataStore.restoreSnapshot(storageSnapshot);
                console.error('GastroOS: restauración revertida por un error.', error);
                try { renderDishes(); renderStockView(); renderGeneratorView(); renderHistorySection(); renderRecipeDiagnostics(); } catch (renderError) { console.error(renderError); }
                alert(`No se pudo completar la restauración. ${restored ? 'Los datos anteriores se han recuperado.' : 'No se pudo recuperar automáticamente el almacenamiento; descarga la copia de seguridad automática antes de continuar.'}\n\nMotivo: ${error.message || 'error inesperado'}`);
            }
        }

        function normalizeImportedStockItem(item) {
            return window.GastroOSStockUtils.normalizeImportedStockItem(item);
        }

        function validateImportedMenu(menu, label) {
            if (menu === null) return null;
            if (!menu || typeof menu !== 'object' || Array.isArray(menu) || !menu.days || typeof menu.days !== 'object' || Array.isArray(menu.days)) {
                throw new Error(`La estructura de ${label} no es válida.`);
            }
            if (menu.days) {
                for (const [day, slots] of Object.entries(menu.days)) {
                    if (!daysList.includes(day) || !Array.isArray(slots)) throw new Error(`La estructura de ${label} contiene un día o lista de platos inválida.`);
                    for (const slot of slots) {
                        if (!slot || typeof slot !== 'object' || Array.isArray(slot) || (slot.dish !== undefined && (!slot.dish || typeof slot.dish !== 'object' || Array.isArray(slot.dish)))) throw new Error(`Un plato de ${label} tiene una estructura inválida.`);
                    }
                }
            }
            return menu;
        }

        function importData(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 25 * 1024 * 1024) {
                alert('El archivo supera el límite de 25 MB. Exporta una copia más pequeña e inténtalo de nuevo.');
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onerror = () => { alert('No se pudo leer el archivo. Comprueba que no esté dañado y vuelve a intentarlo.'); e.target.value = ''; };
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
                if (!createAutoBackup('antes de borrar todos los datos locales')) {
                    alert('No se pudo crear la copia de seguridad previa (puede que el almacenamiento del navegador esté lleno). No se ha borrado nada. Exporta una copia manual antes de continuar.');
                    return;
                }
                const cleared = window.GastroOSDataStore.clearOwned({ preserve: ['chefTrack_autoBackup', 'chefTrack_autoBackupAt', 'chefTrack_githubSettings', 'chefTrack_dataSchemaVersion'] });
                if (!cleared.ok) {
                    alert('No se pudieron borrar todos los datos. No se recargará la aplicación para evitar mostrar un estado parcial.');
                    return;
                }
                // clearOwned conserva las claves protegidas; no hace falta reescribirlas.
                location.reload();
            }
        }

        // Captura de errores no controlados: evita fallos silenciosos en operaciones críticas.
        window.addEventListener('error', event => {
            console.error('GastroOS: error de interfaz no controlado.', event.error || event.message);
            const status = document.getElementById('appErrorStatus');
            if (status) { status.textContent = 'Ha ocurrido un error inesperado. Tus datos locales se conservan; vuelve a intentarlo.'; status.hidden = false; }
        });
        window.addEventListener('unhandledrejection', event => {
            console.error('GastroOS: operación asíncrona no controlada.', event.reason);
            const status = document.getElementById('appErrorStatus');
            if (status) { status.textContent = 'Una operación no se ha completado. Comprueba la conexión e inténtalo de nuevo.'; status.hidden = false; }
        });

        // API pública mínima para botones/instalaciones antiguas que todavía
        // puedan invocar los exportadores mediante onclick inline.
        window.downloadWeeklyMenuTxt = downloadWeeklyMenuTxt;
        window.downloadShoppingListTxt = downloadShoppingListTxt;

        init();
