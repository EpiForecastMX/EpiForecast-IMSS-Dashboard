# Pronóstico — Leucemia (C91, C92, C93, C94, C95)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `leucemia_c91_release_927f100c33f3`
- Lineage: forecast `leucemia_c91_forecast_h52_7eb8a67fa8e0_a8a64dc6351b` · refit `leucemia_c91_refit_final_fd72c61146f7_7eb8a67fa8e0` · dataset `leucemia_c91_1a9a0877e093`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 18 |
| `seasonal_naive_lag52` | 46 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `7367d50bba605c11791060f9ccf0a3ca6f10f04e3cc916d46adcc0e10c71a367`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
