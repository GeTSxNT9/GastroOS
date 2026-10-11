/* GastroOS — validación de copias antes de importar/restaurar.
 * Funciones puras compartidas por la interfaz y las pruebas automatizadas.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GastroOSBackupValidation = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const ALLOWED_TYPES = new Set(['full-backup', 'automatic-backup', 'recipes-only']);
    const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const isOptionalRecord = (obj, key) => !Object.prototype.hasOwnProperty.call(obj, key) || obj[key] == null || isRecord(obj[key]);
    const isOptionalArray = (obj, key) => !Object.prototype.hasOwnProperty.call(obj, key) || obj[key] == null || Array.isArray(obj[key]);

    function validate(data) {
        const errors = [];
        const legacyArray = Array.isArray(data);
        const full = isRecord(data);
        if (!legacyArray && !full) return { valid: false, errors: ['El archivo debe ser un objeto o una lista de recetas.'], full: false, dishes: null };
        if (full && data.app && data.app !== 'GastroOS') errors.push('El archivo declara una aplicación distinta de GastroOS.');
        if (full && data.type && !ALLOWED_TYPES.has(data.type)) errors.push('El tipo de copia no está reconocido.');
        const dishes = legacyArray ? data : (Array.isArray(data.dishes) ? data.dishes : (Array.isArray(data.recipes) ? data.recipes : null));
        if (!dishes) errors.push('No se encuentra una lista de recetas (dishes o recipes).');
        if (dishes) {
            const seen = new Set();
            dishes.forEach((dish, index) => {
                if (!isRecord(dish)) { errors.push(`La receta ${index + 1} no es un objeto válido.`); return; }
                if (dish.id === undefined || dish.id === null || String(dish.id).trim() === '') errors.push(`La receta ${index + 1} no tiene identificador.`);
                else {
                    const id = String(dish.id);
                    if (seen.has(id)) errors.push(`El identificador de receta «${id}» está repetido.`);
                    seen.add(id);
                }
                if (typeof dish.nombre !== 'string' || !dish.nombre.trim()) errors.push(`La receta ${index + 1} no tiene un nombre válido.`);
                if (dish.ingredientes != null && !Array.isArray(dish.ingredientes)) errors.push(`Los ingredientes de la receta ${index + 1} no tienen formato de lista.`);
            });
        }
        if (full) {
            ['settings', 'productAllergenMap', 'proteinCatalog'].forEach(key => { if (!isOptionalRecord(data, key)) errors.push(`El campo «${key}» debe ser un objeto.`); });
            ['rawStock', 'preparedStock', 'historyMenus', 'recipeChangeHistory'].forEach(key => { if (!isOptionalArray(data, key)) errors.push(`El campo «${key}» debe ser una lista.`); });
            ['currentMenu', 'previousWeekMenu'].forEach(key => {
                if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null && !isRecord(data[key])) errors.push(`El campo «${key}» debe ser un objeto o null.`);
            });
            if (Array.isArray(data.historyMenus)) data.historyMenus.forEach((item, index) => {
                if (!isRecord(item)) errors.push(`El elemento ${index + 1} del histórico de menús no es válido.`);
                else if (item.menu != null && !isRecord(item.menu)) errors.push(`El menú del histórico ${index + 1} no tiene formato válido.`);
            });
            ['rawStock', 'preparedStock'].forEach(key => {
                if (Array.isArray(data[key])) data[key].forEach((item, index) => {
                    if (!isRecord(item)) errors.push(`El elemento ${index + 1} de «${key}» no es válido.`);
                });
            });
        }
        return { valid: errors.length === 0, errors, full, dishes };
    }
    return { validate };
});
