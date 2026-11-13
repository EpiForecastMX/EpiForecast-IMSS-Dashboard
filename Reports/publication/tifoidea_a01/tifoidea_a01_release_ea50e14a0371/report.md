# Pronóstico — Fiebre tifoidea (A01.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `tifoidea_a01_release_ea50e14a0371`
- Lineage: forecast `tifoidea_a01_forecast_h52_02535aabd48d_263f3695fd5e` · refit `tifoidea_a01_refit_final_9fe0414b00c7_02535aabd48d` · dataset `tifoidea_a01_6e5065cef2f2`
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
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `aa652e4bf0ba1a32188c244b67f2df2c5ab107adc3b67be6fb5878099d985ed3`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
