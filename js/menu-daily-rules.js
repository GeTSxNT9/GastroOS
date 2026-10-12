/* GastroOS — validaciones puras de composición diaria del menú. */
(function (root, factory) {
  'use strict';
  const api = factory();
  root.GastroOSMenuDailyRules = Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validateDayComposition(options = {}) {
    const {
      dayName = 'Día', firsts = [], seconds = [], structure = {},
      avoidLiquidFirsts = true, liquidFirstSubtypes = [],
      getSecondPreparationFamily = () => null
    } = options;
    const errors = [];
    const expectedFirstParents = (structure.firstSpecs || []).map(spec => spec?.allowedParents?.[0]);
    expectedFirstParents.forEach((parent, index) => {
      if (firsts[index]?.subcategoria_primero !== parent) {
        errors.push(`${dayName}: el primero ${index + 1} no es compatible con ${parent}.`);
      }
    });
    if (avoidLiquidFirsts && firsts.filter(dish => liquidFirstSubtypes.includes(dish?.subtipo_primero)).length > 1) {
      errors.push(`${dayName}: no se pueden combinar crema de verduras y sopas o caldos en los primeros.`);
    }
    const hasCream = firsts.some(dish => dish?.subtipo_primero === 'cremas');
    const hasHeavySpoon = firsts.some(dish => ['guisos', 'legumbres'].includes(dish?.subtipo_primero));
    const hasRequiredHydrate = firsts.some(dish => ['arroces', 'pastas', 'pastas_rellenas'].includes(dish?.subtipo_primero));
    // La regla de combinación no puede inventar un hueco que la configuración
    // no haya solicitado. Solo exigimos un hidrato si la oferta incluye ese hueco.
    const hasConfiguredTenedorSlot = (structure.firstSpecs || []).some(spec => spec?.allowedParents?.includes('Tenedor'));
    if (hasCream && hasHeavySpoon && hasConfiguredTenedorSlot && !hasRequiredHydrate) {
      errors.push(`${dayName}: hay una crema y un plato de cuchara; el hueco de tenedor configurado debe ser un hidrato tipo arroz o pasta.`);
    }

    const meats = seconds.filter(dish => dish?.proteina_segundo === 'Carne');
    const fishOptions = seconds.filter(dish => dish?.proteina_segundo === 'Pescado');
    const expectedMeats = (structure.secondSpecs || []).filter(spec => spec?.protein === 'Carne').length;
    const expectedFish = (structure.secondSpecs || []).filter(spec => spec?.protein === 'Pescado').length;
    if (meats.length !== expectedMeats) errors.push(`${dayName}: la cantidad de carnes no coincide con la configuración.`);
    if (fishOptions.length !== expectedFish) errors.push(`${dayName}: la cantidad de pescados no coincide con la configuración.`);
    const meatAnimals = meats.map(dish => dish?.animal_carne).filter(Boolean);
    if (new Set(meatAnimals).size !== meatAnimals.length) errors.push(`${dayName}: no se puede repetir el mismo animal entre las carnes del día.`);

    const guisos = meats.filter(dish => dish?.tecnica_cocina === 'tecnica_guiso').length;
    const fritos = seconds.filter(dish => dish?.tecnica_cocina === 'tecnica_frito_rebozado').length;
    if (guisos > 1) errors.push(`${dayName}: hay dos carnes guisadas.`);
    if (fritos > 1) errors.push(`${dayName}: hay dos fritos o rebozados.`);
    const families = seconds.map(getSecondPreparationFamily).filter(Boolean);
    if (options.avoidRepeatedSecondPreparation && new Set(families).size !== families.length) {
      errors.push(`${dayName}: no se puede repetir la misma forma de preparación en los segundos.`);
    }
    return { valid: errors.length === 0, errors, guisos, fritos };
  }
  return { validateDayComposition };
});
