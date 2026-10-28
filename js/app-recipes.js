/* GastroOS — Banco de platos, formulario y sincronización con GitHub.
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */
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

            const resultsSummary = document.getElementById('recipeResultsSummary');
            if (resultsSummary) {
                const total = dishes.length;
                resultsSummary.textContent = searchVal || activeFilterLevel1 !== 'all' || activeFilterLevel2 !== 'all'
                    ? `${filtered.length} de ${total} recetas`
                    : `${total} recetas disponibles`;
            }
            if (!filtered.length) {
                list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⌕</div><p>No hay recetas que coincidan.</p><small>Prueba con otro nombre o cambia los filtros.</small></div>';
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
                const precookedBadge = d.precocinado ? '<span class="recipe-status-badge precooked">Precocinado</span>' : '';
                const preparedDishBadge = d.plato_elaborado ? '<span class="recipe-status-badge prepared">Plato elaborado</span>' : '';

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
                const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl(github);
                const headers = {"Accept":"application/vnd.github+json","Authorization":`Bearer ${github.token}`,"X-GitHub-Api-Version":"2022-11-28"};
                const response = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, {method:'GET', headers});
                let data = {}; try { data = await response.json(); } catch {}
                if (!response.ok || typeof data.content !== 'string' || !data.sha) throw new Error(data.message || `GitHub respondió con HTTP ${response.status}.`);
                const parsedFile = parseGitHubRecipeFile(base64ToUtf8(data.content), github.path);
                const updates = new Map(updatedLocalDishes.map(d => [String(d.id), normalizeDishData(d)]));
                const updatedRecipes = parsedFile.recipes.map(recipe => updates.has(String(recipe?.id ?? '')) ? updates.get(String(recipe.id)) : recipe);
                if (updates.size !== updatedRecipes.filter(r => updates.has(String(r?.id ?? ''))).length) throw new Error('No se encontraron todas las recetas seleccionadas en GitHub.');
                const updatedContent = buildGitHubRecipeFile({...parsedFile, recipes: updatedRecipes}, null);
                const putResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, {method:'PUT', headers:{...headers,"Content-Type":"application/json"}, body:JSON.stringify({message:"Actualizadas varias recetas desde GastroOS",content:utf8ToBase64(updatedContent),sha:data.sha})});
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
            if (categoria === "Verduras y frutas") categoria = "Verduras";
            const legacyUnit = ['kg', 'L'].includes(String(unidad)) ? String(unidad) : '';
            row.dataset.originalUnidad = unidad ?? '';
            row.dataset.originalCategoria = categoria ?? '';
            row.dataset.unidadTouched = 'false';
            row.dataset.categoriaTouched = 'false';
            row.innerHTML = `
                <input type="text" placeholder="Ingrediente..." value="${escapeHtml(nombre)}" required class="ingredient-name-input flex-[4] min-w-0 w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                <input type="text" inputmode="decimal" placeholder="Cant." value="${escapeHtml(cantidad !== '' && cantidad !== undefined ? cantidad : '')}" class="w-16 min-w-[4rem] flex-[0_0_4rem] p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                <select class="w-14 min-w-[3.5rem] flex-[0_0_3.5rem] p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                    ${legacyUnit ? `<option value="${legacyUnit}" selected>${legacyUnit}</option>` : ''}
                    <option value="g" ${unidad==='g'?'selected':''}>g</option>
                    <option value="ml" ${unidad==='ml'?'selected':''}>ml</option>
                </select>
                <select class="ingredient-category-select flex-[1.25] min-w-0 w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
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
                const stored = window.GastroOSDataStore.get('chefTrack_githubSettings');
                const github = stored ? JSON.parse(stored) : {};
                if (github.token) { try { localStorage.setItem('gastroos_github_token', github.token); } catch {} delete github.token; window.GastroOSDataStore.setJSON('chefTrack_githubSettings', github); }
                const token = document.getElementById('githubToken');
                const owner = document.getElementById('githubOwner');
                const repo = document.getElementById('githubRepo');
                const path = document.getElementById('githubPath');
                // No volvemos a mostrar el token guardado en el campo; se conserva si se deja vacío al guardar.
                if (token) token.value = "";
                if (owner) owner.value = github.owner || "";
                if (repo) repo.value = github.repo || "";
                if (path) path.value = github.path || "";
                const remember = document.getElementById('githubRememberToken');
                if (remember) remember.checked = github.rememberToken !== false;
                updateGitHubSettingsStatus(getGitHubSettings());
            } catch {
                console.warn("No se pudieron cargar las credenciales de GitHub.");
            }
        }

        function getGitHubSettings() {
            try {
                const stored = window.GastroOSDataStore.get('chefTrack_githubSettings');
                const github = stored ? JSON.parse(stored) : {};
                let savedToken = '';
                // Persistir el token entre aperturas de la PWA. El token queda en el almacenamiento
                // local de este navegador/dispositivo; no se sube al repositorio.
                try { savedToken = localStorage.getItem('gastroos_github_token') || ''; } catch {}
                // Si el usuario eligió no recordar el token, solo vive en sessionStorage (no se copia a localStorage).
                if (!savedToken) { try { savedToken = sessionStorage.getItem('gastroos_github_token') || ''; } catch {} }
                return { ...github, token: savedToken };
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
                mergeRecipeProteinCatalogIntoProfile(parsedFile.proteinCatalog);
                window.GastroOSDataStore.set('chefTrack_dishes', JSON.stringify(dishes));
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
                const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl(github);
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const response = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'GET', headers });
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

                // Fusión no destructiva: GitHub es la base compartida; las recetas locales
                // que todavía no existen allí se añaden sin eliminar recetas remotas.
                // En IDs coincidentes gana la versión remota para evitar sobrescribir cambios compartidos.
                const localBeforeConnect = Array.isArray(dishes) ? dishes.map(normalizeDishData) : [];
                const remoteRecipes = parsedFile.recipes.map(normalizeDishData);
                mergeRecipeProteinCatalogIntoProfile(parsedFile.proteinCatalog);
                const remoteIds = new Set(remoteRecipes.map(r => String(r?.id ?? '')).filter(Boolean));
                const localOnly = localBeforeConnect.filter(r => {
                    const id = String(r?.id ?? '');
                    return id && !remoteIds.has(id);
                });
                dishes = [...remoteRecipes, ...localOnly];
                const normalizedSerialized = JSON.stringify(dishes);
                const remoteNormalizedSerialized = JSON.stringify(remoteRecipes);

                // Si había recetas locales nuevas o una migración de formato, escribir la unión
                // usando el SHA recién leído. Nunca escribir la copia local completa a ciegas.
                if (localOnly.length || JSON.stringify(parsedFile.recipes) !== remoteNormalizedSerialized) {
                    const updatedContent = buildGitHubRecipeFile(parsedFile, null, dishes);
                    const putPayload = {
                        message: localOnly.length
                            ? `Fusionado recetario sin pérdida desde GastroOS (${localOnly.length} recetas locales añadidas)`
                            : "Normalizados datos del recetario desde GastroOS",
                        content: utf8ToBase64(updatedContent),
                        sha: data.sha
                    };
                    const putResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, {
                        method: 'PUT', headers: { ...headers, "Content-Type": "application/json" },
                        body: JSON.stringify(putPayload)
                    });
                    if (!putResponse.ok) {
                        const putError = await putResponse.json().catch(() => ({}));
                        throw new Error(`No se pudo guardar la fusión de recetas en GitHub: ${putError.message || putResponse.status}`);
                    }
                }

                window.GastroOSDataStore.set('chefTrack_dishes', JSON.stringify(dishes));
                refreshStockReferenceSelectors();
                githubLastLoadIssue = "success";
                window.GastroOSDataStore.remove('chefTrack_githubFileMissing');
                window.GastroOSDataStore.set('chefTrack_githubLastSync', new Date().toISOString());
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
                status.textContent = github.rememberToken === false
                    ? "GitHub configurado ✓ El token solo se conserva mientras esta pestaña siga abierta."
                    : "GitHub configurado ✓ La conexión se conserva en este dispositivo.";
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
            const last = window.GastroOSDataStore.get('chefTrack_githubLastSync');
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
            window.GastroOSDataStore.set('chefTrack_githubLastSync', now);
            markRecipesSnapshotSynced();
            setGitHubSyncStatus(`${message} ${new Date(now).toLocaleString('es-ES')} · ${dishes.length} recetas.`, 'success');
        }

        // Olvida el token (en ambos almacenamientos) y deja el repositorio configurado para volver a conectar.
        function disconnectGitHub() {
            if (!confirm('¿Desconectar GitHub y olvidar el token en este dispositivo? Tus recetas locales no se borran.')) return;
            try { localStorage.removeItem('gastroos_github_token'); } catch {}
            try { sessionStorage.removeItem('gastroos_github_token'); } catch {}
            window.GastroOSDataStore.remove('chefTrack_githubLastSync');
            const tokenInput = document.getElementById('githubToken');
            if (tokenInput) tokenInput.value = '';
            updateGitHubSettingsStatus(getGitHubSettings());
            alert('GitHub desconectado. El token se ha olvidado en este dispositivo.');
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
                alert("Completa el propietario, el repositorio y la ruta, e introduce un token de GitHub. Se conservará en este dispositivo hasta que borres los datos del navegador o lo desconectes.");
                return;
            }

            const repositoryChanged = existing.owner !== github.owner || existing.repo !== github.repo || existing.path !== github.path;
            if (repositoryChanged) window.GastroOSDataStore.remove('chefTrack_githubLastSync');
            const rememberToken = document.getElementById('githubRememberToken')?.checked !== false;
            try {
                if (rememberToken) { localStorage.setItem('gastroos_github_token', github.token); sessionStorage.removeItem('gastroos_github_token'); }
                else { sessionStorage.setItem('gastroos_github_token', github.token); localStorage.removeItem('gastroos_github_token'); }
            } catch { alert('No se pudo guardar el token en este dispositivo. Comprueba el almacenamiento del navegador.'); return; }
            github.rememberToken = rememberToken;
            const persistedGitHub = { owner: github.owner, repo: github.repo, path: github.path, rememberToken };
            if (!window.GastroOSDataStore.setJSON('chefTrack_githubSettings', persistedGitHub)) { alert('No se pudieron guardar los ajustes de GitHub localmente.'); return; }
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
                const allergenSync = await syncProductAllergensToGitHub();
                markGitHubSyncSuccess("Conexión comprobada y recetario fusionado con GitHub.");
                if (!allergenSync.success && !allergenSync.skipped) {
                    setGitHubSyncStatus(`Recetario sincronizado; los alérgenos de productos no se pudieron subir: ${allergenSync.message}`, 'warning');
                }
                alert(allergenSync.success
                    ? "Conexión con GitHub comprobada. Recetas fusionadas y alérgenos de productos sincronizados."
                    : "Conexión con GitHub comprobada y recetas fusionadas. Revisa el estado de los alérgenos de productos.");
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
                    return { recipes: parsed, format: 'json-array', proteinCatalog: { fish: [], meat: [] } };
                }
                if (parsed && Array.isArray(parsed.dishes)) {
                    return { recipes: parsed.dishes, format: 'json-dishes', wrapper: parsed, proteinCatalog: normalizeRecipeProteinCatalog(parsed.proteinCatalog || parsed.catalogosProteinas || {}) };
                }
                if (parsed && Array.isArray(parsed.recipes)) {
                    return { recipes: parsed.recipes, format: 'json-recipes', wrapper: parsed, proteinCatalog: normalizeRecipeProteinCatalog(parsed.proteinCatalog || parsed.catalogosProteinas || {}) };
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

        function buildGitHubRecipeFile(parsedFile, newDish = null, recipesOverride = null, proteinCatalogOverride = null) {
            const updatedProteinCatalog = normalizeRecipeProteinCatalog(proteinCatalogOverride || parsedFile.proteinCatalog || {});
            const updatedRecipes = Array.isArray(recipesOverride)
                ? [...recipesOverride]
                : (newDish === null
                    ? [...parsedFile.recipes]
                    : [...parsedFile.recipes, newDish]);
            if (parsedFile.format === 'json-array') {
                if (!updatedProteinCatalog.fish.length && !updatedProteinCatalog.meat.length) return JSON.stringify(updatedRecipes, null, 2) + "\n";
                return JSON.stringify({ app: 'GastroOS', schemaVersion: 2, proteinCatalog: updatedProteinCatalog, recipes: updatedRecipes }, null, 2) + "\n";
            }
            if (parsedFile.format === 'json-dishes' || parsedFile.format === 'json-recipes') {
                const wrapper = JSON.parse(JSON.stringify(parsedFile.wrapper));
                if (parsedFile.format === 'json-dishes') wrapper.dishes = updatedRecipes;
                else wrapper.recipes = updatedRecipes;
                wrapper.proteinCatalog = updatedProteinCatalog;
                return JSON.stringify(wrapper, null, 2) + "\n";
            }
            if (parsedFile.format === 'js-array') {
                const replacement = JSON.stringify(updatedRecipes, null, 2);
                return parsedFile.originalContent.slice(0, parsedFile.arrayStart) + replacement + parsedFile.originalContent.slice(parsedFile.arrayEnd + 1);
            }
            throw new Error("Formato de recetario no compatible.");
        }

        async function syncProteinCatalogToGitHub() {
            const github = getGitHubSettings();
            if (!github.token || !github.owner || !github.repo || !github.path) return { success: false, skipped: true };
            try {
                const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl(github);
                const headers = { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${github.token}`, 'X-GitHub-Api-Version': '2022-11-28' };
                const response = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'GET', headers });
                const data = await response.json().catch(() => ({}));
                let parsedFile;
                let sha = null;
                if (response.status === 404) {
                    parsedFile = { recipes: dishes.map(normalizeDishData), format: 'json-recipes', wrapper: { app: 'GastroOS', schemaVersion: 2 }, proteinCatalog: getRecipeProteinCatalog() };
                } else {
                    if (!response.ok || typeof data.content !== 'string') throw new Error(data.message || `HTTP ${response.status}`);
                    sha = data.sha;
                    parsedFile = parseGitHubRecipeFile(base64ToUtf8(data.content), github.path);
                }
                parsedFile.proteinCatalog = getRecipeProteinCatalog();
                const content = buildGitHubRecipeFile(parsedFile, null, parsedFile.recipes, parsedFile.proteinCatalog);
                const payload = { message: 'Actualizado catálogo de carnes y pescados desde GastroOS', content: utf8ToBase64(content) };
                if (sha) payload.sha = sha;
                const put = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!put.ok) { const body = await put.json().catch(() => ({})); throw new Error(body.message || `HTTP ${put.status}`); }
                markGitHubSyncSuccess('Catálogo de carnes y pescados actualizado en recipes.json.');
                return { success: true, skipped: false };
            } catch (error) {
                console.warn('No se pudo sincronizar el catálogo de proteínas:', error);
                return { success: false, skipped: false, message: error?.message || 'Error desconocido' };
            }
        }

        async function syncDishToGitHub(dish, isNewDish) {
            const github = getGitHubSettings();
            // GitHub es opcional: guardar localmente nunca debe bloquear el formulario.
            if (!github.token || !github.owner || !github.repo || !github.path) {
                setGitHubSyncStatus("Receta guardada en este dispositivo; conecta GitHub cuando quieras sincronizarla.", 'warning');
                return { success: false, skipped: true, message: "GitHub no está configurado." };
            }

            setDishSaveState(true);
            try {
                const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl(github);
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const getResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'GET', headers });
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

                const putResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, {
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
                const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl(github);
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const normalizedRecipes = importedDishes.map(normalizeDishData);
                const getResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'GET', headers });
                let getData = {};
                try { getData = await getResponse.json(); } catch {}

                let updatedContent;
                let fileSha = null;
                let creatingFile = false;

                if (getResponse.status === 404) {
                    // Si el archivo no existe, lo creamos directamente con todas las recetas importadas.
                    updatedContent = JSON.stringify({ app: 'GastroOS', schemaVersion: 2, proteinCatalog: getRecipeProteinCatalog(), recipes: normalizedRecipes }, null, 2) + "\n";
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

                const putResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, {
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
                if (!fishSpecies || !getProteinCatalog('fish').some(item => item.id === fishSpecies)) {
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
                alergenosManuales: Array.from(document.querySelectorAll('input[name="dishAllergen"]:checked')).map(input => input.value),
                alergenos: [],
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

            // Guardado local primero: GitHub nunca es requisito para crear o editar recetas.
            const idx = dishes.findIndex(d => String(d.id) === String(id));
            if (idx >= 0) dishes[idx] = normalizedDish;
            else dishes.unshift(normalizedDish);
            logRecipeChange(isNewDish ? 'create' : 'update', normalizedDish, isNewDish ? 'Nueva receta' : 'Receta modificada');
            saveAll();
            resetForm();
            document.querySelector('.nav-btn[data-target="view-banco"]')?.click();
            renderDishes();
            renderMigrationUI();
            if (!isNewDish) restoreRecipeListScroll();

            const syncResult = await syncDishToGitHub(normalizedDish, isNewDish);
            if (syncResult?.success) {
                alert(isNewDish ? "Receta guardada en este dispositivo y sincronizada con GitHub." : "Receta actualizada en este dispositivo y sincronizada con GitHub.");
            } else {
                alert(isNewDish ? "Receta guardada en este dispositivo. Conecta GitHub cuando quieras sincronizarla." : "Receta actualizada en este dispositivo. El cambio queda guardado localmente; conecta GitHub para sincronizarlo.");
            }
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
                renderProteinFormOptions(d.animal_carne || '', fish);
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
                const apiUrl = window.GastroOSGitHubNetwork.buildContentsUrl(github);
                const headers = {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${github.token}`,
                    "X-GitHub-Api-Version": "2022-11-28"
                };

                const getResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, { method: 'GET', headers });
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

                const putResponse = await window.GastroOSGitHubNetwork.fetchWithTimeout(apiUrl, {
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
                                    ${getProteinCatalog('meat').map(a => `<option value="${escapeHtml(a.id)}" ${d.animal_carne===a.id?'selected':''}>${escapeHtml(a.label)}</option>`).join("")}
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
                                ${getProteinCatalog('fish').map(a => `<option value="${escapeHtml(a.id)}" ${d.especie_pescado===a.id?'selected':''}>${escapeHtml(a.label)}</option>`).join("")}
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
                if (!species || !getProteinCatalog('fish').some(item => item.id === species)) return alert("Registra la especie exacta.");
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