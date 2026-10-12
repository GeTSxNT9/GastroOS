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

    // Borra únicamente claves propiedad de GastroOS. Nunca limpia el origen completo.
    function clearOwned(options = {}) {
        const preserve = new Set(options.preserve || [
            STORAGE_KEYS.autoBackup,
            STORAGE_KEYS.autoBackupAt,
            STORAGE_KEYS.githubSettings,
            STORAGE_KEYS.dataSchemaVersion,
            'chefTrack_safetySnapshot'
        ]);
        let snapshot = null;
        try {
            const owned = [];
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (key && (key.startsWith('chefTrack_') || key === STORAGE_KEYS.legacyPreviousWeekMenu) && !preserve.has(key)) owned.push(key);
            }
            snapshot = createSnapshot(owned);
            if (!snapshot) return { ok: false, removed: 0, reason: 'snapshot-failed' };
            owned.forEach(key => localStorage.removeItem(key));
            return { ok: true, removed: owned.length };
        } catch (error) {
            const rolledBack = snapshot ? restoreSnapshot(snapshot) : false;
            console.warn('GastroOS: no se pudieron limpiar todos los datos propios.', error);
            return { ok: false, removed: 0, error, rolledBack };
        }
    }

    // Actualización lógica atómica: conserva valores anteriores y revierte si falla
    // cualquier escritura. localStorage no ofrece transacciones nativas.
    function writeBatch(operations, options = {}) {
        if (!Array.isArray(operations) || operations.length === 0) return { ok: false, reason: 'invalid-operations' };
        const seen = new Set();
        for (const operation of operations) {
            if (!operation || typeof operation.key !== 'string' || !operation.key || seen.has(operation.key)) {
                return { ok: false, reason: 'invalid-or-duplicate-key' };
            }
            if (!['set', 'remove'].includes(operation.type)) return { ok: false, reason: 'invalid-operation' };
            if (operation.type === 'set' && typeof operation.value !== 'string') return { ok: false, reason: 'invalid-value' };
            seen.add(operation.key);
        }
        let snapshot;
        try {
            snapshot = createSnapshot([...seen]);
            if (!snapshot) return { ok: false, reason: 'snapshot-failed' };
            if (options.requireSafetySnapshot) {
                const safetyKey = options.safetyKey || 'chefTrack_safetySnapshot';
                const serialized = JSON.stringify(snapshot);
                localStorage.setItem(safetyKey, serialized);
            }
            for (const operation of operations) {
                if (operation.type === 'remove') localStorage.removeItem(operation.key);
                else localStorage.setItem(operation.key, operation.value);
            }
            return { ok: true, snapshot };
        } catch (error) {
            const rolledBack = snapshot ? restoreSnapshot(snapshot) : false;
            console.error('GastroOS: falló el lote de escritura.', error);
            return { ok: false, reason: 'write-failed', error, rolledBack };
        }
    }

    function createSnapshot(keys = [...new Set([...Object.values(STORAGE_KEYS), 'chefTrack_safetySnapshot'])]) {
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
        const CURRENT_SCHEMA = 3;
        const rawVersion = get(STORAGE_KEYS.dataSchemaVersion, '1');
        const storedVersion = Number(rawVersion);
        if (!Number.isInteger(storedVersion) || storedVersion < 1) return { ok: false, reason: 'invalid-version', version: rawVersion };
        if (storedVersion > CURRENT_SCHEMA) return { ok: false, reason: 'future-version', version: storedVersion };
        if (storedVersion === CURRENT_SCHEMA) return { ok: true, version: CURRENT_SCHEMA, migrated: false };

        // La copia previa se guarda antes de modificar cualquier clave.
        const snapshot = createSnapshot();
        if (!snapshot) return { ok: false, reason: 'snapshot-failed', version: storedVersion };
        try {
            let version = storedVersion;
            while (version < CURRENT_SCHEMA) {
                if (version === 1) {
                    const canonical = get(STORAGE_KEYS.previousWeekMenu, null);
                    const legacy = get(STORAGE_KEYS.legacyPreviousWeekMenu, null);
                    if (canonical === null && legacy !== null) localStorage.setItem(STORAGE_KEYS.previousWeekMenu, legacy);
                    version = 2;
                } else if (version === 2) {
                    // v3 formaliza la versión del esquema y reserva una clave de snapshot.
                    // No transforma registros de negocio: evita cambios destructivos sin contexto.
                    version = 3;
                } else {
                    throw new Error(`No existe migración desde el esquema ${version}.`);
                }
                localStorage.setItem(STORAGE_KEYS.dataSchemaVersion, String(version));
            }
            return { ok: true, version: CURRENT_SCHEMA, migrated: true, fromVersion: storedVersion };
        } catch (error) {
            const rolledBack = restoreSnapshot(snapshot);
            console.error('GastroOS: migración revertida.', error);
            return { ok: false, reason: 'migration-failed', version: storedVersion, rolledBack };
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
        remove,
        clear: clearOwned,
        clearOwned,
        writeBatch,
        createSnapshot,
        restoreSnapshot,
        migrateSchema
    });
})();
