# Pronóstico — Linfogranuloma venéreo por Clamidias (A55)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `linfogranuloma_a55_release_13706f4a5596`
- Lineage: forecast `linfogranuloma_a55_forecast_h52_153e6e80cf27_ce8a76d5f1e6` · refit `linfogranuloma_a55_refit_final_9fe0414b00c7_153e6e80cf27` · dataset `linfogranuloma_a55_b9b66d16e50b`
- Origen 2026-W43 → horizonte 52 semanas
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
- Gate congelado `70385b4057e98e0ffb40eb25c06026bc0250e37e4e2bf275faa17dd633b2b4bf`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
