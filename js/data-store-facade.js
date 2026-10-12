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
        autoBackupAt: 'chefTrack_autoBackupAt',
        githubSettings: 'chefTrack_githubSettings',
        githubLastSync: 'chefTrack_githubLastSync',
        githubLastSyncedRecipes: 'chefTrack_githubLastSyncedRecipes',
        dataSchemaVersion: 'chefTrack_dataSchemaVersion',
        legacyPreviousWeekMenu: 'previousWeekMenu',
        githubFileMissing: 'chefTrack_githubFileMissing'
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

    function clear() {
        try { localStorage.clear(); return true; }
        catch (error) { console.warn('GastroOS: no se pudo limpiar almacenamiento local.', error); return false; }
    }

    function createSnapshot(keys = [...new Set([...Object.values(STORAGE_KEYS), 'chefTrack_dishes', 'chefTrack_settings', 'chefTrack_rawStock', 'chefTrack_preparedStock', 'chefTrack_currentMenu', 'chefTrack_historyMenus', 'chefTrack_recipeChangeHistory', 'chefTrack_productAllergens', 'chefTrack_autoBackup', 'chefTrack_autoBackupAt', 'chefTrack_githubSettings', 'chefTrack_githubLastSync', 'chefTrack_githubLastSyncedRecipes', 'previousWeekMenu'])]) {
        const snapshot = {};
        try {
            keys.forEach(key => { snapshot[key] = localStorage.getItem(key); });
            return Object.freeze({ createdAt: new Date().toISOString(), values: snapshot });
        } catch (error) {
            console.warn('GastroOS: no se pudo crear snapshot local.', error);
            return null;
        }
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot || !snapshot.values || typeof snapshot.values !== 'object' || Array.isArray(snapshot.values)) return false;
        const entries = Object.entries(snapshot.values);
        const before = {};
        try {
            entries.forEach(([key]) => { before[key] = localStorage.getItem(key); });
            entries.forEach(([key, value]) => {
                if (value === null) localStorage.removeItem(key);
                else if (typeof value === 'string') localStorage.setItem(key, value);
                else throw new TypeError(`Snapshot inválido para ${key}`);
            });
            return true;
        } catch (error) {
            // Best-effort rollback: evita dejar una mezcla de claves si falla una escritura.
            try {
                Object.entries(before).forEach(([key, value]) => {
                    if (value === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, value);
                });
            } catch (rollbackError) {
                console.error('GastroOS: también falló la reversión del snapshot.', rollbackError);
            }
            console.error('GastroOS: falló la restauración del snapshot.', error);
            return false;
        }
    }

    function migrateSchema() {
        const CURRENT_SCHEMA = 2;
        const storedVersion = Number(get(STORAGE_KEYS.dataSchemaVersion, '1')) || 1;
        if (storedVersion > CURRENT_SCHEMA) return { ok: false, reason: 'future-version', version: storedVersion };
        if (storedVersion < 2) {
            const canonical = get('chefTrack_previousWeekMenu', null);
            const legacy = get('previousWeekMenu', null);
            if (canonical === null && legacy !== null && !set('chefTrack_previousWeekMenu', legacy)) return { ok: false, reason: 'storage-write' };
            if (!set(STORAGE_KEYS.dataSchemaVersion, String(CURRENT_SCHEMA))) return { ok: false, reason: 'storage-write' };
        }
        return { ok: true, version: CURRENT_SCHEMA };
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
        remove,
        clear,
        createSnapshot,
        restoreSnapshot,
        migrateSchema
    });
})();
