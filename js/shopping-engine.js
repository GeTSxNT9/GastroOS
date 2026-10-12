/* GastroOS: cálculo puro de necesidades de compra y consumo de stock. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GastroOSShoppingEngine = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function createStockLedger(rawStock, normalizeFoodKey, stockUtils) {
        return (Array.isArray(rawStock) ? rawStock : []).map(stock => {
            const unit = String(stock?.unidad || '').trim().toLowerCase();
            const dimension = stockUtils.getUnitDimension(unit);
            const baseQty = dimension !== 'unknown'
                ? ((unit === 'kg' || unit === 'l') ? Number(stock.cantidad) * 1000 : Number(stock.cantidad))
                : 0;
            return {
                stock,
                key: normalizeFoodKey(stock?.nombre),
                category: String(stock?.categoria_proveedor || ''),
                dimension: dimension === 'unknown' ? null : dimension,
                remaining: Math.max(0, Number.isFinite(baseQty) ? baseQty : 0)
            };
        });
    }

    function deductFromStockLedger(ledger, ingredientName, requiredQtyBase, unit, category, normalizeFoodKey, stockUtils) {
        const name = normalizeFoodKey(ingredientName);
        if (!name || requiredQtyBase <= 0) return 0;
        const dimension = stockUtils.getUnitDimension(unit);
        if (dimension === 'unknown') return 0;
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

    function buildShoppingData(context) {
        const {
            currentMenu, daysList, proveedorCategorias, rawStock, normalizeFoodKey,
            getTotalRaciones, getDemandPortionFactor, purchaseAdjustment,
            manualStockKeys, stockUtils
        } = context || {};
        if (!currentMenu?.days) return { totalRacionesPorComida: getTotalRaciones(), groupedByCategory: Object.fromEntries((proveedorCategorias || []).map(category => [category, []])) };
        if (!Array.isArray(daysList) || !Array.isArray(proveedorCategorias) || typeof normalizeFoodKey !== 'function' ||
            typeof getTotalRaciones !== 'function' || typeof getDemandPortionFactor !== 'function' || !stockUtils) {
            throw new TypeError('Faltan dependencias necesarias para calcular la lista de compra.');
        }

        const totalRacionesPorComida = getTotalRaciones();
        const aggregated = Object.create(null);
        const stockLedger = createStockLedger(rawStock, normalizeFoodKey, stockUtils);
        const manuallyAvailable = manualStockKeys instanceof Set ? manualStockKeys : new Set();

        daysList.forEach(dayName => {
            const slots = currentMenu.days[dayName] || [];
            slots.forEach(slot => {
                if (slot.isPreparedStock) return;
                (slot.dish?.ingredientes || []).forEach(ingredient => {
                    const rawName = String(ingredient?.nombre || '').trim();
                    if (!rawName) return;
                    const unit = String(ingredient?.unidad || '').trim().toLowerCase();
                    const rawQuantityText = String(ingredient?.cantidad ?? '').trim().replace(',', '.');
                    const rawQty = Number(rawQuantityText);
                    const dimensionKey = stockUtils.getUnitDimension(unit);
                    const hasCalculableQuantity = rawQuantityText !== '' && Number.isFinite(rawQty) && rawQty > 0 && dimensionKey !== 'unknown';
                    const category = proveedorCategorias.includes(ingredient?.categoria_proveedor) ? ingredient.categoria_proveedor : 'Secos';
                    const foodKey = normalizeFoodKey(rawName);
                    if (!foodKey) return;
                    const key = `${foodKey}::${dimensionKey}`;
                    const isManualStock = manuallyAvailable.has(foodKey);

                    if (!aggregated[key]) {
                        aggregated[key] = {
                            nombre: rawName, totalBaseQty: 0, requiredBaseQty: 0, stockUsedBaseQty: 0,
                            cat: category, baseUnit: stockUtils.getBaseUnit(unit),
                            needsManualPurchase: false, manualStock: isManualStock
                        };
                    }
                    const item = aggregated[key];
                    item.manualStock = isManualStock;
                    if (!hasCalculableQuantity) {
                        item.needsManualPurchase = true;
                        if (!item.baseUnit) item.baseUnit = '';
                        return;
                    }

                    const demandFactor = getDemandPortionFactor(slot.dish?.demanda || 'Media');
                    const estimatedDishRations = totalRacionesPorComida * demandFactor;
                    const totalForMeal = rawQty * estimatedDishRations * (Number(purchaseAdjustment) / 100);
                    const baseQty = totalForMeal * ((unit === 'kg' || unit === 'l') ? 1000 : 1);
                    const stockUsed = isManualStock ? 0 : deductFromStockLedger(stockLedger, rawName, baseQty, unit, category, normalizeFoodKey, stockUtils);
                    const netQty = isManualStock ? 0 : Math.max(0, baseQty - stockUsed);
                    item.requiredBaseQty += baseQty;
                    item.stockUsedBaseQty += stockUsed;
                    item.totalBaseQty += netQty;
                    item.baseUnit = stockUtils.getBaseUnit(unit);
                });
            });
        });

        const groupedByCategory = Object.fromEntries(proveedorCategorias.map(category => [category, []]));
        Object.values(aggregated).forEach(item => {
            if (item.totalBaseQty <= 0 && !item.needsManualPurchase && !item.manualStock) return;
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
                nombre: item.nombre, cantidad, unidad, necesario: item.requiredBaseQty,
                disponible: item.stockUsedBaseQty, comprar: item.totalBaseQty,
                dimension: item.baseUnit, manualStock: item.manualStock
            });
        });
        return { totalRacionesPorComida, groupedByCategory };
    }

    return { buildShoppingData };
});
