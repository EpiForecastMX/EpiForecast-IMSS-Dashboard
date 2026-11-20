# Pronóstico — Enfermedad invasiva por neumococo (A40.3, G00.1, J13)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `neumococo_a40_release_5895fcd30f54`
- Lineage: forecast `neumococo_a40_forecast_h52_e93a6545b73c_d405f14a2f04` · refit `neumococo_a40_refit_final_7e306c2dbc40_e93a6545b73c` · dataset `neumococo_a40_64c5d5f81a85`
- Origen 2026-W44 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 16 |
| `seasonal_median_3y` | 37 |
| `seasonal_median_5y` | 11 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `1ad06048c44fc83f6109a228db9a2127f746ae23b12ffc5d575622cc269288d0`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
