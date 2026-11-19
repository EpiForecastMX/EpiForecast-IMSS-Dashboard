# Pronóstico — Enfermedad por virus Chikungunya (A92.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `chikungunya_a920_release_6a16fc7fbe23`
- Lineage: forecast `chikungunya_a920_forecast_h52_973ed0e91e2c_c0d42513b186` · refit `chikungunya_a920_refit_final_9fe0414b00c7_973ed0e91e2c` · dataset `chikungunya_a920_708ee6cf989e`
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
- Gate congelado `d36518577f923029b9b49871166af451f0b1bc903e6078f36edaa052b4043d1e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
