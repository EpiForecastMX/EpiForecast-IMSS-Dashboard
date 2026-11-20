# Pronóstico — Infección asociada a la atención de la salud (S/C)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `iaas_sc_release_b0e917832a47`
- Lineage: forecast `iaas_sc_forecast_h52_ee64e8d6e9fe_a21591729d05` · refit `iaas_sc_refit_final_9fe0414b00c7_ee64e8d6e9fe` · dataset `iaas_sc_9ac79006df40`
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
- Gate congelado `12f4f59035d4188cc39c404b3c481d769538fe3140450b727c1fa914917a8067`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
