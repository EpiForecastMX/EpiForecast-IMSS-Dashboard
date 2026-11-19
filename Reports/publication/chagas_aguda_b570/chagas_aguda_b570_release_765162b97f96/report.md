# Pronóstico — Tripanosomiasis americana (enfermedad de Chagas) aguda (B57.0, B57.1)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `chagas_aguda_b570_release_765162b97f96`
- Lineage: forecast `chagas_aguda_b570_forecast_h52_24820f121da0_79544526bc33` · refit `chagas_aguda_b570_refit_final_ea2c127364e6_24820f121da0` · dataset `chagas_aguda_b570_750e05062261`
- Origen 2026-W44 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 18 |
| `seasonal_median_3y` | 45 |
| `seasonal_median_5y` | 1 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `addc8fd735685a13a3e3db8e1ab81346afc0f311b07a16e3c11bef4934b5ffd6`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
