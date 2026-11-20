# Pronóstico — Labio y paladar hendido (Q35, Q36, Q37)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `labio_paladar_q35_release_5a88e7c03f1d`
- Lineage: forecast `labio_paladar_q35_forecast_h52_464bc164d4bb_ef8d3be6ab2e` · refit `labio_paladar_q35_refit_final_9fe0414b00c7_464bc164d4bb` · dataset `labio_paladar_q35_eedbd29c8f39`
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
- Gate congelado `bc7d8b38a990eb049151413b7d027cc536b49a36054dbdaecd50443a29fae97e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
