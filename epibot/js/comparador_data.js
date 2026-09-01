/**
 * Datos puros del comparador de entidades.
 *
 * Vive separado del DOM para que el contrato del payload se pueda probar en Node. En
 * particular, cada padecimiento debe conservar su motor: antes `app.js` calculaba el
 * motor principal de la entidad, pero descartaba el motor por padecimiento y la vista
 * terminaba mostrando «Depresión · ?».
 */

export function buildComparadorState(comparison) {
  const smapes = comparison.models.filter(m => m.smape != null).map(m => Number(m.smape));
  const avgSmape = smapes.length
    ? Math.round((smapes.reduce((total, value) => total + value, 0) / smapes.length) * 10) / 10
    : null;

  const motors = {};
  const pads = {};
  for (const model of comparison.models) {
    const motor = model.motor || model.modelo || '?';
    motors[motor] = (motors[motor] || 0) + 1;

    if (!pads[model.pad]) pads[model.pad] = { casos: 0, smape: null, motor: '?' };
    pads[model.pad].casos += model.casos || 0;
    if (model.smape != null) pads[model.pad].smape = Number(model.smape);
    pads[model.pad].motor = motor;
  }

  const topMotor = Object.entries(motors).sort((a, b) => b[1] - a[1])[0];
  return {
    name: comparison.estado,
    casos: comparison.total,
    smape: avgSmape,
    motor: topMotor ? topMotor[0] : '?',
    pads,
  };
}
