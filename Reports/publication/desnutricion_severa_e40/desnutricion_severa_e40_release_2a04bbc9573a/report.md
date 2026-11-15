# Pronóstico — Desnutrición severa (E40, E41, E42, E43)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `desnutricion_severa_e40_release_2a04bbc9573a`
- Lineage: forecast `desnutricion_severa_e40_forecast_h52_ef6a86292c91_f5eaad96452e` · refit `desnutricion_severa_e40_refit_final_9fe0414b00c7_ef6a86292c91` · dataset `desnutricion_severa_e40_b958de06dd18`
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
- Gate congelado `1b08bb3d9e4c5214cfe1695853b363f4e06973b8352e16f9acef2b0c82742ccd`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
