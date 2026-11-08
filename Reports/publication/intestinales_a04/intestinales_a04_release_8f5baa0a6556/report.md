# Pronóstico — Infecciones intestinales por otros organismos y las mal definidas (A04, A08, A09)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `intestinales_a04_release_8f5baa0a6556`
- Lineage: forecast `intestinales_a04_forecast_h52_bc8fcb94f171_da7510aebba7` · refit `intestinales_a04_refit_final_a30f815ff09f_bc8fcb94f171` · dataset `intestinales_a04_f64acd5a517f`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 39 |
| `ridge_harmonic_log1p` | 6 |
| `seasonal_mean_3y` | 1 |
| `seasonal_mean_5y` | 3 |
| `seasonal_median_5y` | 3 |
| `seasonal_naive_lag52` | 12 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `feff126f7c283443b1b712a90ba9c657c63d879099ae0cdcf6a7a29576bb3664`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
