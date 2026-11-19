# Pronóstico — Eventos supuestamente asociados a la vacunación (ESAVI) (Y58, Y59)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `esavi_y58_release_703090d3bcb4`
- Lineage: forecast `esavi_y58_forecast_h52_60cdba0128c3_97909db65a66` · refit `esavi_y58_refit_final_9fe0414b00c7_60cdba0128c3` · dataset `esavi_y58_ee73a3c4236c`
- Origen 2026-W44 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `c2f8146bc005c29db392c6eae8a65ebe250d41589fd1d6c9f6b8bf68029ee881`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
