# Pronóstico — Peatón lesionado en accidente de transporte (V01, V02, V03, V04, V05, V06, V07, V08, V09)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `peaton_v01_release_59de3df5aba6`
- Lineage: forecast `peaton_v01_forecast_h52_75712d57e01c_bd93fcf87e18` · refit `peaton_v01_refit_final_9fe0414b00c7_75712d57e01c` · dataset `peaton_v01_2a1b23ab1034`
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
- Gate congelado `3e06cd0becfcf9a1a8a9c05e415d99e4bbc6196bcef2a2f1b2b597fcd665a780`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
