# Pronóstico — Envenenamiento autoinfligido intencionalmente por analgésicos no narcóticos, antipiréticos y antirreumáticos (X60)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `envenenamiento_analgesicos_x60_release_ad01a4df3ba9`
- Lineage: forecast `envenenamiento_analgesicos_x60_forecast_h52_0090ba17cc9b_684a5c694c21` · refit `envenenamiento_analgesicos_x60_refit_final_354f6d2d8ae1_0090ba17cc9b` · dataset `envenenamiento_analgesicos_x60_5e1e8c7fde66`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 21 |
| `seasonal_naive_lag52` | 43 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `9b0ba442d83391013f8ae553d94a10d322f52f6d3bd760dae829060968ff7580`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
