# Pronóstico — Tuberculosis respiratoria (A15, A16)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `tuberculosis_respiratoria_a15_release_5098dd8fc6e4`
- Lineage: forecast `tuberculosis_respiratoria_a15_forecast_h52_0522af7483b5_e95b2096c627` · refit `tuberculosis_respiratoria_a15_refit_final_70fd35c5ec2d_0522af7483b5` · dataset `tuberculosis_respiratoria_a15_b851946a9510`
- Origen 2026-W44 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 2 |
| `seasonal_mean_5y` | 14 |
| `seasonal_median_3y` | 3 |
| `seasonal_median_5y` | 36 |
| `seasonal_naive_lag52` | 9 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `ce61aea00dbde9230e0ce61f4c4dd2ac556f5e83287badbc47e7fac706da11ea`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
