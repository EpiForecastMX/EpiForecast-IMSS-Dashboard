# Instrucciones para Claude Code

## Git / Commits
- **NUNCA agregar Co-Authored-By** en los mensajes de commit.
- Los commits deben llevar únicamente el nombre del usuario, sin líneas de co-autoría.

## EpiBot (`epibot/`)
- **Cache-bust al tocar `kb.js`/`entities.js`**: sube `app.js?v=N` en `index.html` (la de **afuera**), además del `?v` interno del import de `kb.js`. Netlify sirve `/js/*` con `Cache-Control: public, max-age=3600`, así que sin bumpear `app.js?v` el navegador sigue corriendo el `app.js` viejo cacheado (que importa el `kb.js` viejo) y tu cambio no aparece aunque el deploy haya llegado bien. `index.html` se sirve must-revalidate (el bump sí se propaga); `knowledge.json` va con `no-cache`. Mientras tanto, un hard refresh (Cmd+Shift+R) basta si el server ya tiene los archivos nuevos.
- **Cuadros de rendimiento 2026**: el handler `answerRendimientoPorPadecimiento` (+ helper `_cuadroDengue`) dibuja las tablas de SMAPE/MASE por padecimiento × motor (neuro + Dengue) desde la sección `rendimiento_2026` de `knowledge.json` (que genera el repo principal, `EpiForecast-MX/scripts/build_web_knowledge.py`). Está registrado **antes** de `answerMatrizRendimiento` en la cadena `HANDLERS`. Para Dengue específico, `answerDengue` tiene una rama que devuelve el mismo cuadro ante "rendimiento/mase/cuadro de dengue".
