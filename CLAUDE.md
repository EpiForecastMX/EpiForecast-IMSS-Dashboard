# Instrucciones para Claude Code

## Git / Commits
- **NUNCA agregar Co-Authored-By** en los mensajes de commit.
- Los commits deben llevar únicamente el nombre del usuario, sin líneas de co-autoría.

## EpiBot (`epibot/`)
- **Cache-bust al tocar `kb.js`/`entities.js`**: sube `app.js?v=N` en `index.html` (la de **afuera**), además del `?v` interno del import de `kb.js`. Sin bumpear `app.js?v` el navegador sigue corriendo el `app.js` viejo cacheado (que importa el `kb.js` viejo) y tu cambio no aparece aunque el deploy haya llegado bien.
- **Cache-bust al tocar `knowledge.json`**: sube `DATA_VERSION` en `epibot/js/kb.js`. **No es opcional.** Las cabeceras que mandan son las del `netlify.toml` de la **raíz** (`publish = "."`), y ahí `knowledge.json` va con `public, max-age=3600` — no con `no-cache`, como decía este archivo hasta el 24-ago-2026. El `epibot/netlify.toml` que aún declara `no-cache` parece vestigial de cuando EpiBot era un sitio aparte.
- **Cabeceras vigentes** (`netlify.toml` de la raíz): `/epibot/js/*` y `/epibot/css/*` con `max-age=300`; `/epibot/knowledge.json` con `max-age=3600`. Un hard refresh (Cmd+Shift+R) basta si el server ya tiene los archivos nuevos.
- **Cifras públicas**: el vocabulario (333 neuro · 99 dengue · 432 series productivas · 444 gráficos) está congelado en `EpiForecast-MX/docs/CONTRATO_VOCABULARIO_CIFRAS.md` y lo comprueba `npm run cifras:verify`, que corre sin API key y va **antes** que el índice en `rag:ci`. El `knowledge.json` se corrige en su generador (`EpiForecast-MX/scripts/build_web_knowledge.py`), nunca a mano ni reparándolo en el navegador.
- **Cuadros de rendimiento 2026**: el handler `answerRendimientoPorPadecimiento` (+ helper `_cuadroDengue`) dibuja las tablas de SMAPE/MASE por padecimiento × motor (neuro + Dengue) desde la sección `rendimiento_2026` de `knowledge.json` (que genera el repo principal, `EpiForecast-MX/scripts/build_web_knowledge.py`). Está registrado **antes** de `answerMatrizRendimiento` en la cadena `HANDLERS`. Para Dengue específico, `answerDengue` tiene una rama que devuelve el mismo cuadro ante "rendimiento/mase/cuadro de dengue".
