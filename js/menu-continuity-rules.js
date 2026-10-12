/* Reglas puras de continuidad entre días del menú semanal. */
(function (root, factory) {
  'use strict';
  const api = factory();
  root.GastroOSMenuContinuityRules = Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validateDayContinuity(options = {}) {
    const {
      dayName, dayIndex, days = [], menuDays = {}, firsts = [], meats = [], dayFritos = 0,
      avoidConsecutiveFirsts = true, avoidConsecutiveFritos = true, avoidThreeConsecutiveMeatAnimals = true,
      consecutiveFirstSubtypes = [], liquidFirstLabels = {}, getProteinLabel = (_kind, value) => value
    } = options;
    const errors = [];
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || !dayName) return errors;
    const getSlots = name => Array.isArray(menuDays?.[name]) ? menuDays[name] : [];

    if (dayIndex > 0) {
      const previousSlots = getSlots(days[dayIndex - 1]);
      const previousFirsts = previousSlots.filter(slot => slot?.cat === 'Primero').map(slot => slot?.dish).filter(Boolean);
      if (avoidConsecutiveFirsts) {
        firsts.forEach(first => {
          const subtype = first?.subtipo_primero;
          if (consecutiveFirstSubtypes.includes(subtype) && previousFirsts.some(dish => dish?.subtipo_primero === subtype)) {
            errors.push(`${dayName}: ${liquidFirstLabels[subtype] || subtype} repetido en días consecutivos.`);
          }
        });
      }
      const previousDayFritos = previousSlots.some(slot => slot?.cat === 'Segundo' && slot?.dish?.tecnica_cocina === 'tecnica_frito_rebozado');
      if (avoidConsecutiveFritos && Number(dayFritos) > 0 && previousDayFritos) {
        errors.push(`${dayName}: no puede haber frito en días consecutivos.`);
      }
    }

    if (avoidThreeConsecutiveMeatAnimals && dayIndex >= 2) {
      const previousTwoAnimals = [days[dayIndex - 1], days[dayIndex - 2]]
        .flatMap(name => getSlots(name)
          .filter(slot => slot?.cat === 'Segundo' && slot?.dish?.proteina_segundo === 'Carne')
          .map(slot => slot?.dish?.animal_carne))
        .filter(Boolean);
      meats.forEach(meat => {
        if (meat?.animal_carne && previousTwoAnimals.filter(animal => animal === meat.animal_carne).length >= 2) {
          errors.push(`${dayName}: ${getProteinLabel('meat', meat.animal_carne)} aparece 3 días consecutivos.`);
        }
      });
    }
    return errors;
  }

  return { validateDayContinuity };
});
