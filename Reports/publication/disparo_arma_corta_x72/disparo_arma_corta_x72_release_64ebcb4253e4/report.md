# Pronóstico — Lesión autoinfligida intencionalmente por disparo de arma corta (X72)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `disparo_arma_corta_x72_release_64ebcb4253e4`
- Lineage: forecast `disparo_arma_corta_x72_forecast_h52_be4f503699f0_5cf5a9bf9ff7` · refit `disparo_arma_corta_x72_refit_final_9fe0414b00c7_be4f503699f0` · dataset `disparo_arma_corta_x72_39090d760d91`
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
- Gate congelado `f834a8aca2621ca2b76896429f02392c52b4e369a23dbc5886061fb4d839e9ef`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
