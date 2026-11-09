# Pronóstico — Tumor maligno del esófago (C15)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_esofago_c15_release_9b1f38c2dea0`
- Lineage: forecast `cancer_esofago_c15_forecast_h52_8d281eed1dba_1dde200f684b` · refit `cancer_esofago_c15_refit_final_9fe0414b00c7_8d281eed1dba` · dataset `cancer_esofago_c15_af8ac9436fda`
- Origen 2026-W41 → horizonte 52 semanas
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
- Gate congelado `3894e6f4a3900bc1bc470454e13a4f16107f58edb7541a26b71abf1172d3196e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
