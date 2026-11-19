# Pronóstico — Mordedura de otras arañas (T63.3, X21)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `otras_aranas_t633_release_f4663d8c58e0`
- Lineage: forecast `otras_aranas_t633_forecast_h52_5017c3a63203_4066cb78af81` · refit `otras_aranas_t633_refit_final_947eb11f60fe_5017c3a63203` · dataset `otras_aranas_t633_b6f93fdb7e0f`
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
- Gate congelado `f09aa5faabc5e9764f8b7c118e1eaad160286d7ae8c8063d2645dd5669c7f4a2`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
