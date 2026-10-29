/* GastroOS — Eventos y cambio de vistas.
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */
        // --- 3. EVENTOS Y VISTAS ---
        function setupEventListeners() {
            document.addEventListener('change', (event) => {
                const checkbox = event.target.closest('input[data-shopping-stock-key]');
                if (!checkbox) return;
                const key = checkbox.dataset.shoppingStockKey;
                if (!key) return;
                if (checkbox.checked) shoppingManualStockKeys.add(key);
                else shoppingManualStockKeys.delete(key);
                renderShoppingListUI();
            });
            document.getElementById('btnQuickAddRecipe')?.addEventListener('click', () => switchView('view-form'));
            document.getElementById('btnSaveKitchenRules')?.addEventListener('click', saveKitchenRules);
            document.getElementById('btnAddKitchenFish')?.addEventListener('click', () => addCustomProtein('fish'));
            document.getElementById('btnAddKitchenMeat')?.addEventListener('click', () => addCustomProtein('meat'));
            document.getElementById('newKitchenFish')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCustomProtein('fish'); } });
            document.getElementById('newKitchenMeat')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCustomProtein('meat'); } });
            document.getElementById('settingsComensales')?.addEventListener('input', () => updateCalculatedRaciones(false));
            document.getElementById('settingsMargenSeguridad')?.addEventListener('input', () => updateCalculatedRaciones(false));
            document.getElementById('btnOpenProductAllergens')?.addEventListener('click', openProductAllergenManager);
            document.getElementById('btnCloseProductAllergens')?.addEventListener('click', closeProductAllergenManager);
            document.getElementById('btnCancelProductAllergens')?.addEventListener('click', closeProductAllergenManager);
            document.getElementById('btnSaveProductAllergens')?.addEventListener('click', saveProductAllergens);
            document.getElementById('productAllergenSearch')?.addEventListener('input', renderProductAllergenManager);

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

            document.getElementById('rawStockForm').addEventListener('submit', handleAddRawStock);
            document.getElementById('prepStockForm').addEventListener('submit', handleAddPrepStock);
            document.getElementById('prepName').addEventListener('change', () => {
                renderPreparedAssignmentOptions(document.getElementById('prepName').value);
            });

            document.getElementById('btnSubTabMenu').addEventListener('click', () => switchGeneratorSubTab('menu'));
            document.getElementById('btnSubTabShopping').addEventListener('click', () => switchGeneratorSubTab('shopping'));
            document.getElementById('btnGenerateMenu').addEventListener('click', generateWeeklyMenu);
            document.getElementById('btnSaveToHistory').addEventListener('click', saveMenuToHistory);
            // Los exportadores se enlazan también mediante onclick inline en index.html.
            // En iOS/PWA esto evita perder el gesto de usuario que necesita Web Share.

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
            document.getElementById('btnDisconnectGitHub').addEventListener('click', disconnectGitHub);
            document.getElementById('btnExportRecipes').addEventListener('click', exportRecipesOnly);
            document.getElementById('btnDownloadAutoBackup').addEventListener('click', downloadAutoBackup);
            document.getElementById('btnRunDiagnostics').addEventListener('click', runRecipeDiagnostics);
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
