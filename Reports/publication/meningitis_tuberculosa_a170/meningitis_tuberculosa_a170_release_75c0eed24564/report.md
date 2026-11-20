# Pronóstico — Meningitis tuberculosa (A17.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `meningitis_tuberculosa_a170_release_75c0eed24564`
- Lineage: forecast `meningitis_tuberculosa_a170_forecast_h52_d49353e8d601_727edd158872` · refit `meningitis_tuberculosa_a170_refit_final_9fe0414b00c7_d49353e8d601` · dataset `meningitis_tuberculosa_a170_41037e61fabc`
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
- Gate congelado `4c7f6479406bc0240bee435183123296f4c83a6b775381fe87f8e1f8cb006aa6`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
