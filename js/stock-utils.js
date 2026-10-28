/* GastroOS: utilidades puras para validar stock y clasificar unidades. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GastroOSStockUtils = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TEXT_FIELDS = Object.freeze(['nombre', 'unidad', 'categoria_proveedor', 'conservacion', 'asignacion']);
    const NUMERIC_FIELDS = Object.freeze(['cantidad', 'stock', 'cantidad_actual', 'cantidadDisponible']);
    const WEIGHT_UNITS = new Set(['kg', 'g']);
    const VOLUME_UNITS = new Set(['l', 'ml']);

    function normalizeImportedStockItem(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('El stock contiene un registro que no es un objeto válido.');
        }
        const copy = { ...item };
        for (const key of TEXT_FIELDS) {
            if (copy[key] !== undefined && typeof copy[key] !== 'string') {
                throw new Error(`El campo ${key} del stock debe ser texto.`);
            }
        }
        for (const key of NUMERIC_FIELDS) {
            if (copy[key] === undefined || copy[key] === null || copy[key] === '') continue;
            const numeric = typeof copy[key] === 'number'
                ? copy[key]
                : (typeof copy[key] === 'string' && copy[key].trim() !== ''
                    ? Number(copy[key].trim().replace(',', '.'))
                    : NaN);
            if (!Number.isFinite(numeric) || numeric < 0) {
                throw new Error(`El campo ${key} del stock debe ser un número no negativo; se recibió un valor inválido.`);
            }
            copy[key] = numeric;
        }
        return copy;
    }

    function getUnitDimension(unit) {
        const normalized = String(unit ?? '').trim().toLowerCase();
        if (WEIGHT_UNITS.has(normalized)) return 'weight';
        if (VOLUME_UNITS.has(normalized)) return 'volume';
        return 'unknown';
    }

    function getBaseUnit(unit) {
        const dimension = getUnitDimension(unit);
        return dimension === 'weight' ? 'kg' : dimension === 'volume' ? 'L' : '';
    }

    function toBaseQuantity(quantity, unit) {
        const normalized = String(unit ?? '').trim().toLowerCase();
        const numeric = typeof quantity === 'number' ? quantity : Number(quantity);
        if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError('La cantidad debe ser un número no negativo.');
        if (normalized === 'g' || normalized === 'ml') return numeric / 1000;
        if (normalized === 'kg' || normalized === 'l') return numeric;
        throw new TypeError(`Unidad no convertible: ${normalized || '(vacía)'}.`);
    }


    // Comparación de nombres de alimentos ya normalizados (sin acentos, minúsculas).
    // Antes se usaba "includes" sobre el texto, lo que hacía que el stock de "pan"
    // descontara "panga" o que "jamón" descontara "jamoncitos de pollo".
    // Ahora se compara por palabras completas, tolerando plurales sencillos.
    const FOOD_STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'al', 'a', 'y']);

    function stemFoodToken(token) {
        if (token.length > 4 && /(on|or|al|el|ur|ez|iz)es$/.test(token)) return token.slice(0, -2); // limones -> limon
        if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);                    // huevos -> huevo
        return token;
    }

    function foodTokens(key) {
        return String(key ?? '').split(' ')
            .filter(token => token && !FOOD_STOPWORDS.has(token))
            .map(stemFoodToken);
    }

    function foodNamesMatch(keyA, keyB) {
        const a = foodTokens(keyA);
        const b = foodTokens(keyB);
        if (!a.length || !b.length) return false;
        const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
        const pool = new Set(longer);
        return shorter.every(token => pool.has(token));
    }

    return { normalizeImportedStockItem, getUnitDimension, getBaseUnit, toBaseQuantity, foodNamesMatch };
});
