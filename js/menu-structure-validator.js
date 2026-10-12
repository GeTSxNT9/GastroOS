/* Validación estructural pura del menú semanal. No aplica reglas culinarias. */
(function (root) {
  'use strict';

  function validateMenuStructure(menu, daysList, structure) {
    const errors = [];
    const days = daysList.filter(day => menu?.days?.[day]);
    if (days.length !== daysList.length) {
      daysList.filter(day => !menu?.days?.[day]).forEach(day => errors.push(`${day}: falta el día completo.`));
    }

    const expectedLabels = structure.slotSpecs.map(spec => spec.slotLabel);
    const usedIds = new Set();
    days.forEach(dayName => {
      const slots = menu.days[dayName] || [];
      if (!Array.isArray(slots) || slots.length !== structure.slotSpecs.length) {
        errors.push(`${dayName}: deben existir exactamente ${structure.slotSpecs.length} opciones según la configuración actual.`);
        return;
      }
      slots.forEach((slot, index) => {
        if (!slot || slot.slotLabel !== expectedLabels[index]) {
          errors.push(`${dayName}: slot ${index + 1} no respeta la estructura fija.`);
        }
        const id = slot?.dish?.id;
        if (id && id !== 'none') {
          const normalizedId = String(id);
          if (usedIds.has(normalizedId)) errors.push(`${dayName}: el plato "${slot?.dish?.nombre || ''}" se repite en la semana.`);
          usedIds.add(normalizedId);
        }
      });
    });
    return { valid: errors.length === 0, errors, days };
  }

  const api = { validateMenuStructure };
  root.GastroOSMenuStructureValidator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
