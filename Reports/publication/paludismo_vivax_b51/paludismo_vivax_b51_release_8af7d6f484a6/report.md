# Pronóstico — Paludismo por Plasmodium vivax (B51)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `paludismo_vivax_b51_release_8af7d6f484a6`
- Lineage: forecast `paludismo_vivax_b51_forecast_h52_74810fe4d75b_cd583a3ff0aa` · refit `paludismo_vivax_b51_refit_final_30e6b4ef89df_74810fe4d75b` · dataset `paludismo_vivax_b51_3ddb06978792`
- Origen 2026-W44 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 32 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `51d4701a3580e2e9f8130c39f1cafdbb4e4c30ea8d4e5bf31d81551047143e53`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
