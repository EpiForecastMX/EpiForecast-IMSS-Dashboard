# Pronóstico — Tumor maligno del cuerpo del útero (C54)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_cuerpo_utero_c54_release_3523a60b29ef`
- Lineage: forecast `cancer_cuerpo_utero_c54_forecast_h52_f72035c0d41b_377bcbb2af4b` · refit `cancer_cuerpo_utero_c54_refit_final_08e83d492040_f72035c0d41b` · dataset `cancer_cuerpo_utero_c54_a7ba45445f60`
- Origen 2026-W41 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 11 |
| `seasonal_naive_lag52` | 21 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `fd8d57fcd070471ce1d3a4adde1c95474441bfc630a7c07346d6317efbb909a7`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
