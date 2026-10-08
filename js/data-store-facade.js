/*
 * GastroOS — Fase 10
 * Fachada de almacenamiento local.
 *
 * Esta capa define un contrato pequeño para la persistencia del navegador.
 * No sustituye todavía a localStorage ni cambia el flujo de la aplicación.
 * En una fase posterior, el mismo contrato podrá apuntar a una API/backend
 * sin que el resto de la interfaz tenga que conocer los detalles de almacenamiento.
 */
(function () {
    const STORAGE_KEYS = Object.freeze({
        dishes: 'chefTrack_dishes',
        settings: 'chefTrack_settings',
        rawStock: 'chefTrack_rawStock',
        preparedStock: 'chefTrack_preparedStock',
        currentMenu: 'chefTrack_currentMenu',
        previousWeekMenu: 'chefTrack_previousWeekMenu',
        historyMenus: 'chefTrack_historyMenus',
        recipeChangeHistory: 'chefTrack_recipeChangeHistory',
        productAllergens: 'chefTrack_productAllergens',
        autoBackup: 'chefTrack_autoBackup',
        autoBackupAt: 'chefTrack_autoBackupAt'
    });

    function get(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (error) {
            console.warn('GastroOS: no se pudo leer almacenamiento local.', error);
            return fallback;
        }
    }

    function getJSON(key, fallback = null) {
        const raw = get(key, null);
        if (raw === null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn(`GastroOS: el valor almacenado en ${key} no es JSON válido.`, error);
            return fallback;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(key, String(value));
            return true;
        } catch (error) {
            console.warn('GastroOS: no se pudo guardar en almacenamiento local.', error);
            return false;
        }
    }

    function setJSON(key, value) {
        try {
            return set(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`GastroOS: no se pudo serializar ${key}.`, error);
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('GastroOS: no se pudo eliminar un dato local.', error);
            return false;
        }
    }

    window.GastroOSDataStore = Object.freeze({
        STORAGE_KEYS,
        get,
        getJSON,
        set,
        setJSON,
        remove
    });
})();
