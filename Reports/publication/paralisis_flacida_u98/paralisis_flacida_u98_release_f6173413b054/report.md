# Pronóstico — Parálisis flácida aguda (menores de 15 años) (U98)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `paralisis_flacida_u98_release_f6173413b054`
- Lineage: forecast `paralisis_flacida_u98_forecast_h52_0c3c7ad27b81_cc9f05c366b0` · refit `paralisis_flacida_u98_refit_final_9fe0414b00c7_0c3c7ad27b81` · dataset `paralisis_flacida_u98_dc27023625ef`
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
- Gate congelado `24563ed7c6d66a10d64e1aee794c599c1961f3a06a61cd8ae3c3798451ea23c0`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
