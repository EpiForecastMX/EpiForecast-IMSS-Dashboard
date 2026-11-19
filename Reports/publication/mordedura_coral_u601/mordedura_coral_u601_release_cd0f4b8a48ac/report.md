# Pronóstico — Mordedura por serpiente coral (U60.1)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `mordedura_coral_u601_release_cd0f4b8a48ac`
- Lineage: forecast `mordedura_coral_u601_forecast_h52_db54a0973656_4126114c0f6c` · refit `mordedura_coral_u601_refit_final_947eb11f60fe_db54a0973656` · dataset `mordedura_coral_u601_0406ecb79302`
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
- Gate congelado `6263d18465bd681d9dc59bf630d81ea8bbe8f7245d51141899bac67ff598935b`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
