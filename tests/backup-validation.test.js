const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../js/backup-validation.js');

const recipe = (id = 'r1', nombre = 'Lentejas') => ({ id, nombre, ingredientes: [] });

test('acepta una copia integral válida', () => {
  const result = validate({
    app: 'GastroOS', type: 'full-backup', dishes: [recipe()],
    settings: {}, rawStock: [], preparedStock: [], historyMenus: [],
    recipeChangeHistory: [], productAllergenMap: {}, proteinCatalog: {},
    currentMenu: null, previousWeekMenu: null
  });
  assert.equal(result.valid, true);
  assert.equal(result.dishes.length, 1);
});

test('acepta una lista antigua de recetas', () => {
  assert.equal(validate([recipe()]).valid, true);
});

test('rechaza recetas sin identificador o nombre', () => {
  const result = validate([{ id: '', nombre: 'Plato' }, { id: 'r2', nombre: '  ' }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('identificador')));
  assert.ok(result.errors.some(error => error.includes('nombre')));
});

test('rechaza identificadores duplicados', () => {
  const result = validate([recipe('same', 'Uno'), recipe('same', 'Dos')]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('repetido')));
});

test('rechaza estructuras de stock e historial mal formadas', () => {
  const result = validate({ app: 'GastroOS', type: 'full-backup', dishes: [recipe()], rawStock: {}, historyMenus: [null] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('rawStock')));
  assert.ok(result.errors.some(error => error.includes('histórico')));
});

test('rechaza una copia de otra aplicación y tipos desconocidos', () => {
  assert.equal(validate({ app: 'Otra', type: 'full-backup', dishes: [recipe()] }).valid, false);
  assert.equal(validate({ app: 'GastroOS', type: 'unknown', dishes: [recipe()] }).valid, false);
});

test('rechaza ingredientes que no sean una lista', () => {
  assert.equal(validate([ { id: 'r1', nombre: 'Plato', ingredientes: {} } ]).valid, false);
});
