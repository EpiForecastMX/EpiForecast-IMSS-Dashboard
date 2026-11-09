# Pronóstico — Tumor maligno del estómago (C16)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_estomago_c16_release_bcb7311dcd13`
- Lineage: forecast `cancer_estomago_c16_forecast_h52_b01d2ad5863e_9bc71f0c6140` · refit `cancer_estomago_c16_refit_final_036e95dfdcbf_b01d2ad5863e` · dataset `cancer_estomago_c16_a44cac252f9f`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 17 |
| `seasonal_naive_lag52` | 47 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `e774b478ab5d54991f9219e85652b2569e73d6f30f90b62ae7f408d24677b9dc`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
