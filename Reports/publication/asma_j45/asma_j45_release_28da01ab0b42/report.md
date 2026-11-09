# Pronóstico — Asma (J45, J46)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `asma_j45_release_28da01ab0b42`
- Lineage: forecast `asma_j45_forecast_h52_08aa2ad1ad02_3803b15e8d7f` · refit `asma_j45_refit_final_a6da6e7705d0_08aa2ad1ad02` · dataset `asma_j45_1635a7484519`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 17 |
| `seasonal_mean_5y` | 29 |
| `seasonal_median_5y` | 1 |
| `seasonal_naive_lag52` | 17 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `637cde349d180bf42504019bdb7f48292fb0b2a35efaf208f929df78eb69eeed`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
