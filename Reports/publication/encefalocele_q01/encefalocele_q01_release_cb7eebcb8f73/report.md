# Pronóstico — Encefalocele (Q01)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `encefalocele_q01_release_cb7eebcb8f73`
- Lineage: forecast `encefalocele_q01_forecast_h52_037e90557764_09516e035637` · refit `encefalocele_q01_refit_final_9fe0414b00c7_037e90557764` · dataset `encefalocele_q01_486f65f622e6`
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
- Gate congelado `3288f903434969872de2be9c873feed94c415f2abf8609d67f23e250107dfb50`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
