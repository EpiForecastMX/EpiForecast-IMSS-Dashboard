# Pronóstico — Infecciones invasivas por Haemophilus influenzae (A41.3, G00.0, J14)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `haemophilus_a41_release_11c95a322723`
- Lineage: forecast `haemophilus_a41_forecast_h52_05b457521357_d20d28686b86` · refit `haemophilus_a41_refit_final_9fe0414b00c7_05b457521357` · dataset `haemophilus_a41_3fb1fa28fbac`
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
- Gate congelado `a46fdadf1498900e20ecc5d75bdedcb7d2166ee9d19031d7a7bfbeec332d4a10`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
