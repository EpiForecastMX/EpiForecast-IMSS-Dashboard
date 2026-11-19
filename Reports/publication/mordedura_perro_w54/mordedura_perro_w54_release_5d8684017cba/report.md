# Pronóstico — Mordeduras por perro (W54)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `mordedura_perro_w54_release_5d8684017cba`
- Lineage: forecast `mordedura_perro_w54_forecast_h52_ec77ec4e98bb_c45b5aa546c2` · refit `mordedura_perro_w54_refit_final_9fe0414b00c7_ec77ec4e98bb` · dataset `mordedura_perro_w54_8feaad606895`
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
- Gate congelado `969cc74f810134a8059e3f527561dcb2b996eea27334a1f9ad686ddaf9f7a273`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
