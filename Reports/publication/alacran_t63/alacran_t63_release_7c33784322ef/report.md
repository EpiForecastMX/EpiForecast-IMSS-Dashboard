# Pronóstico — Intoxicación por picadura de alacrán (T63.2, X22)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `alacran_t63_release_7c33784322ef`
- Lineage: forecast `alacran_t63_forecast_h52_c79b74310772_3a7448f4f877` · refit `alacran_t63_refit_final_65b6e887f338_c79b74310772` · dataset `alacran_t63_d38c6efe3231`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 7 |
| `seasonal_mean_5y` | 23 |
| `seasonal_median_3y` | 11 |
| `seasonal_median_5y` | 23 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `40aca7be9537c854d3e405024cc8415a291d65d047842522d5717a96cc2e3af9`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
