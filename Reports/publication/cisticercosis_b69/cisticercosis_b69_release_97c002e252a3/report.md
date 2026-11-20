# Pronóstico — Cisticercosis (B69)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cisticercosis_b69_release_97c002e252a3`
- Lineage: forecast `cisticercosis_b69_forecast_h52_a0b5c9cd7a58_a0d2e1cf00c2` · refit `cisticercosis_b69_refit_final_9fe0414b00c7_a0b5c9cd7a58` · dataset `cisticercosis_b69_483d35377491`
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
- Gate congelado `452a700a274f77243f35249da3ea9b8ebc49672c25b18b4221ebe5010cdc3d12`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
