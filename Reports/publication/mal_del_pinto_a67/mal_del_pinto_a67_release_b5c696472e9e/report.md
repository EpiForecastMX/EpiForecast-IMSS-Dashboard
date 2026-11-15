# Pronóstico — Mal del pinto (A67)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `mal_del_pinto_a67_release_b5c696472e9e`
- Lineage: forecast `mal_del_pinto_a67_forecast_h52_23181eecfc6f_0b59bb6f4f65` · refit `mal_del_pinto_a67_refit_final_5b4508b3dc25_23181eecfc6f` · dataset `mal_del_pinto_a67_98b1b03324b1`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 1 |
| `seasonal_median_3y` | 27 |
| `seasonal_median_5y` | 36 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `fc1e310f6459018cb48861410c29b83224910dcd02a7d55904412d9b24b31f9c`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
