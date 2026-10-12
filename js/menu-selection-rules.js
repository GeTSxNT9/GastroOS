/* GastroOS — reglas estructurales puras para la selección de platos. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GastroOSMenuSelectionRules = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function isStructuralMatch(dish, spec, rules = {}) {
    if (!dish || !spec || dish.categoria !== spec.cat) return false;
    if (spec.cat === 'Primero') {
      return Array.isArray(spec.allowedParents)
        ? spec.allowedParents.includes(dish.subcategoria_primero)
        : dish.subtipo_primero === spec.subtipo;
    }
    if (spec.protein === 'Carne') {
      return dish.proteina_segundo === 'Carne' &&
        Array.isArray(rules.meatAnimals) && rules.meatAnimals.includes(dish.animal_carne) &&
        Array.isArray(rules.meatTechniques) && rules.meatTechniques.includes(dish.tecnica_cocina);
    }
    if (spec.protein === 'Pescado') {
      return dish.proteina_segundo === 'Pescado' && Boolean(dish.especie_pescado);
    }
    return false;
  }

  function hasLiquidFirstConflict(candidate, chosenFirsts, liquidSubtypes) {
    if (!candidate || candidate.categoria !== 'Primero' || !liquidSubtypes || !liquidSubtypes.has(candidate.subtipo_primero)) return false;
    return (Array.isArray(chosenFirsts) ? chosenFirsts : [])
      .some(dish => liquidSubtypes.has(dish?.subtipo_primero));
  }

  return { isStructuralMatch, hasLiquidFirstConflict };
});
