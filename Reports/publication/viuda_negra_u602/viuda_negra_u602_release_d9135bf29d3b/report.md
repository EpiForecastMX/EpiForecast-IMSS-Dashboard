# Pronóstico — Mordedura de araña viuda negra (U60.2)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `viuda_negra_u602_release_d9135bf29d3b`
- Lineage: forecast `viuda_negra_u602_forecast_h52_92a3ba3f3658_2a454e980366` · refit `viuda_negra_u602_refit_final_947eb11f60fe_92a3ba3f3658` · dataset `viuda_negra_u602_0e21c90f2060`
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
- Gate congelado `70cff95443e663be98a3d7fc83bb9eb08bf6b3642530a3c8f297c1c699f5a59d`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
