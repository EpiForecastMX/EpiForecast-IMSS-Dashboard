# Pronóstico — Lesión autoinfligida intencionalmente por ahorcamiento, estrangulamiento o sofocación (X70)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `ahorcamiento_x70_release_6d68f72ec4bd`
- Lineage: forecast `ahorcamiento_x70_forecast_h52_bbb45b843cfb_0defbb61b1f3` · refit `ahorcamiento_x70_refit_final_debb7ecb3452_bbb45b843cfb` · dataset `ahorcamiento_x70_93c8f14524d4`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 9 |
| `seasonal_naive_lag52` | 55 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `d96898a4cb520bd65666936907996ef8c2438539255b05f84f2416eb0914a37b`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
