/* GastroOS — motor de orquestación de generación semanal.
 * No conoce el DOM ni el almacenamiento: recibe dependencias explícitas.
 * Mantiene el orden de intentos y la política de no sustituir menús válidos por fallos.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GastroOSMenuGenerationEngine = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const MAX_GENERATION_ATTEMPTS = 80;
  const SAVE_ERROR = 'No se pudo guardar el menú generado. Se conserva el menú anterior.';
  const INVALID_ERROR = 'Se produjo un error interno al generar el menú. El menú anterior se mantiene sin cambios.';

  function generateWeeklyMenu(deps) {
    const previousMenu = deps.getCurrentMenu();
    try {
      const previousCandidate = deps.getPreviousCandidate();
      const previousForAntiTemplate = previousCandidate && previousCandidate.days ? previousCandidate : null;
      deps.setDiagnostics(null);
      let bestMenu = null;
      let bestValidation = null;

      for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
        const candidate = deps.buildCandidate(previousForAntiTemplate);
        const validation = deps.validateCandidate(candidate);
        if (!bestValidation || validation.errors.length < bestValidation.errors.length) {
          bestMenu = candidate;
          bestValidation = validation;
        }
        if (validation.valid) {
          deps.setCurrentMenu(candidate);
          deps.clearManualStockMarks();
          deps.setDiagnostics({ valid: true, errors: [], attempts: attempt });
          if (!deps.save()) {
            deps.setCurrentMenu(previousMenu);
            deps.setDiagnostics({ valid: false, errors: [SAVE_ERROR], attempts: attempt });
            try { deps.render(); } catch (renderError) { deps.logError(renderError); }
            return { status: 'save-failed', attempts: attempt };
          }
          deps.render();
          return { status: 'success', attempts: attempt, menu: candidate };
        }
      }

      if (bestMenu && bestValidation) {
        deps.setDiagnostics({ valid: false, errors: bestValidation.errors.slice(0, 12), attempts: MAX_GENERATION_ATTEMPTS });
        deps.render();
        deps.alert(`No se ha podido construir una semana que cumpla todas las reglas después de ${MAX_GENERATION_ATTEMPTS} intentos.\n\nEl menú anterior se mantiene sin cambios.\n\nPrincipales incidencias detectadas: ${bestValidation.errors.slice(0, 5).join(' | ')}`);
      }
      return { status: 'invalid', attempts: MAX_GENERATION_ATTEMPTS, bestMenu };
    } catch (error) {
      deps.setCurrentMenu(previousMenu);
      deps.setDiagnostics({ valid: false, errors: [INVALID_ERROR], attempts: 0 });
      deps.logError('GastroOS: fallo controlado en el generador de menús.', error);
      try { deps.render(); } catch (renderError) { deps.logError(renderError); }
      deps.alert('No se ha podido generar el menú por un error inesperado. El menú anterior se conserva y tus datos no se han sustituido.');
      return { status: 'error', attempts: 0, error };
    }
  }

  return { generateWeeklyMenu, MAX_GENERATION_ATTEMPTS };
});
