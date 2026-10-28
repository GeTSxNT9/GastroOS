/* GastroOS — Exportación TXT, lista de compra y cambio de plato.
 * Parte de la aplicación principal (antes gastroos.js). Se carga como script clásico,
 * en el orden indicado en index.html: comparte el ámbito global con el resto de partes. */
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

        function downloadTextFile(text, filename) {
            const content = String(text ?? '');
            if (!content.trim()) {
                alert('No hay contenido para exportar.');
                return false;
            }
            const safeFilename = String(filename || 'gastroos.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
            const blob = new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' });
            const objectUrl = URL.createObjectURL(blob);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

            // iOS/WebKit: abrir directamente el Blob de texto en una pestaña.
            // Así se evita cualquier diálogo/overlay de imagen y el contenido queda
            // visible para guardar o compartir desde el propio visor del sistema.
            if (isIOS) {
                try {
                    const popup = window.open(objectUrl, '_blank');
                    if (popup) {
                        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                        return true;
                    }
                } catch (error) {
                    console.warn('No se pudo abrir el TXT en iOS.', error);
                }
                URL.revokeObjectURL(objectUrl);
                return false;
            }

            // Escritorio/Android: descarga estándar mediante Blob + enlace temporal.
            try {
                const anchor = document.createElement('a');
                anchor.href = objectUrl;
                anchor.download = safeFilename;
                anchor.rel = 'noopener';
                anchor.style.display = 'none';
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
                return true;
            } catch (error) {
                console.warn('No se pudo descargar el TXT mediante Blob.', error);
                try {
                    const popup = window.open(objectUrl, '_blank');
                    if (popup) {
                        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                        return true;
                    }
                } catch (_) {}
                URL.revokeObjectURL(objectUrl);
                alert('No se ha podido preparar el archivo para exportar.');
                return false;
            }
        }

        function downloadWeeklyMenuTxt() {
            if (!currentMenu || !currentMenu.days) {
                alert("No hay ningún menú generado para exportar.");
                return;
            }
            const dates = getWeekDatesForMenu();
            const blocks = daysList.map((dayName, index) => {
                const slots = currentMenu.days[dayName] || [];
                const primeros = slots.filter(s => s.cat === 'Primero').map(s => s.dish?.nombre || "Sin asignar");
                const segundos = slots.filter(s => s.cat === 'Segundo').map(s => s.dish?.nombre || "Sin asignar");
                const dateLabel = dates[index].toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `${dateLabel} / ${dayName.toUpperCase()}\n\nPrimeros:\n\n${primeros.join('\n')}\n\nSegundos:\n\n${segundos.join('\n')}`;
            });
            const text = blocks.join('\n\n');
            downloadTextFile(text, `menu_semanal_${new Date().toISOString().slice(0,10)}.txt`);
        }

        // --- LISTA DE COMPRA ---
        // El cálculo vive en shopping-engine.js; aquí solo se inyecta el estado actual.
        function buildShoppingData() {
            return window.GastroOSShoppingEngine.buildShoppingData({
                currentMenu,
                daysList,
                proveedorCategorias,
                rawStock,
                normalizeFoodKey,
                getTotalRaciones,
                getDemandPortionFactor,
                purchaseAdjustment: getKitchenProfile().ajusteCompraPorcentaje,
                manualStockKeys: shoppingManualStockKeys,
                stockUtils: window.GastroOSStockUtils
            });
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
                section.innerHTML = `<h4 class="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 pb-1">${escapeHtml(cat)}</h4><div class="shopping-grid shopping-grid-header"><span>Producto</span><span>Necesario</span><span>Stock</span><span>Comprar</span></div><ul class="shopping-grid-list">${items.map(i => { const fmt = n => n > 0 ? `${Math.ceil(n/1000)} ${i.dimension}` : '—'; const stockText = i.manualStock ? '✓ Manual' : fmt(i.disponible); const buyText = i.manualStock ? '0' : (i.comprar > 0 ? `${i.cantidad} ${i.unidad}` : '0'); return `<li class="shopping-grid shopping-grid-row"><span class="shopping-product-name"><label class="shopping-manual-stock" aria-label="Marcar ${escapeHtml(i.nombre)} como disponible en stock"><input type="checkbox" data-shopping-stock-key="${escapeHtml(normalizeFoodKey(i.nombre))}" ${i.manualStock ? 'checked' : ''}><span class="sr-only">En stock</span></label><span class="shopping-product-label">${escapeHtml(i.nombre)}</span></span><span class="shopping-number">${escapeHtml(fmt(i.necesario))}</span><span class="shopping-number shopping-stock ${i.manualStock ? 'is-manual' : ''}">${escapeHtml(stockText)}</span><span class="shopping-buy">${escapeHtml(buyText)}</span></li>`; }).join('')}</ul>`;
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
                const exportItems = items.filter(i => !i.manualStock);
                if (!exportItems.length) return;
                text += `${cat.toUpperCase()}\n\n`;
                exportItems.forEach(i => { text += `${i.nombre}: ${i.cantidad} ${i.unidad}\n`; });
                text += '\n';
            });
            const cleanText = text.trim();
            if (!cleanText) {
                alert('No hay productos para exportar: todos están marcados como Stock.');
                return;
            }
            downloadTextFile(cleanText, `lista_compra_${new Date().toISOString().slice(0,10)}.txt`);
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
                // Los platos elaborados solo pueden seleccionarse manualmente si están físicamente en stock.
                if (d.plato_elaborado && !getKitchenProfile().permitirPlatosElaboradosSinStock &&
                    !preparedStock.some(item => normalizeFoodKey(item?.nombre) === normalizeFoodKey(d.nombre))) return false;
                if (String(d.id) === String(currentMenu?.days?.[swapTarget.dayName]?.[swapTarget.slotIndex]?.dish?.id)) return false;
                if (!window.GastroOSKitchenRules.isFishAllowed(d, getKitchenProfile())) return false;
                if (!window.GastroOSKitchenRules.isMeatAnimalAllowed(d, getKitchenProfile())) return false;
                if (!getKitchenProfile().permitirPrecocinados && d.precocinado) return false;
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
                            ${d.plato_elaborado ? '<span class="menu-status-badge prepared">Plato elaborado</span>' : ''}${d.precocinado ? '<span class="menu-status-badge precooked">Precocinado</span>' : ''}
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
