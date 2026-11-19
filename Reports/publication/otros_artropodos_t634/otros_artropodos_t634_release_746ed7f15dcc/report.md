# Pronóstico — Picadura por otros artrópodos (T63.4)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `otros_artropodos_t634_release_746ed7f15dcc`
- Lineage: forecast `otros_artropodos_t634_forecast_h52_acab0dac42c0_f9e0e5aba3ef` · refit `otros_artropodos_t634_refit_final_947eb11f60fe_acab0dac42c0` · dataset `otros_artropodos_t634_abf93a5f314d`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `fe542293216629cd6e0083224ed0b74395d8bdfe0d7b0155bd516616463a05a6`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
