# Pronóstico — Anorexia, bulimia y otros trastornos alimentarios (F50)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `anorexia_f50_release_173404ea4ef0`
- Lineage: forecast `anorexia_f50_forecast_h52_558c30c685eb_dcb6224a5dfc` · refit `anorexia_f50_refit_final_9fe0414b00c7_558c30c685eb` · dataset `anorexia_f50_a95b424f5056`
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
- Gate congelado `e9728d49fe146fb679d6a360d9374b7d0fe6fe7b314b4edde02e10b073af9a04`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
