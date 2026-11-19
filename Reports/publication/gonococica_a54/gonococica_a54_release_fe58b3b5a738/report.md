# Pronóstico — Infección gonocócica del tracto genitourinario (A54.0, A54.1, A54.2)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `gonococica_a54_release_fe58b3b5a738`
- Lineage: forecast `gonococica_a54_forecast_h52_75e7ab9b0410_f03eceec0bf6` · refit `gonococica_a54_refit_final_96d350394855_75e7ab9b0410` · dataset `gonococica_a54_e2749a858cbf`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 1 |
| `seasonal_mean_5y` | 17 |
| `seasonal_median_3y` | 11 |
| `seasonal_median_5y` | 27 |
| `seasonal_naive_lag52` | 8 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `ce0a549a87fa27a2d4453250cc89620e2615a61821e304c53428571f5fe18a5c`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
