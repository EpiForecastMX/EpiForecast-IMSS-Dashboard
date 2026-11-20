# Pronóstico — Toxoplasmosis (B58)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `toxoplasmosis_b58_release_4be4a46a1fc9`
- Lineage: forecast `toxoplasmosis_b58_forecast_h52_89d1ececa9a8_6056e968c8b2` · refit `toxoplasmosis_b58_refit_final_9fe0414b00c7_89d1ececa9a8` · dataset `toxoplasmosis_b58_ef7f1d1642c9`
- Origen 2026-W42 → horizonte 52 semanas
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
- Veredicto `INCOMPLETE` · 1 de 4 semanas objetivo con verdad disponible.
- Gate congelado `cb8ca6fbdb35a945ad9f17712c7a1db41f5d5bc024827fc97bd8f0dafccf97ed`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
