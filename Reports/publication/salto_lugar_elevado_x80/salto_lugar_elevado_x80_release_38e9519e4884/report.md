# Pronóstico — Lesión autoinfligida intencionalmente al saltar desde un lugar elevado (X80)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `salto_lugar_elevado_x80_release_38e9519e4884`
- Lineage: forecast `salto_lugar_elevado_x80_forecast_h52_7fe8053ad48d_a501fd78dbda` · refit `salto_lugar_elevado_x80_refit_final_be825ec81429_7fe8053ad48d` · dataset `salto_lugar_elevado_x80_b89eebda586b`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 28 |
| `seasonal_naive_lag52` | 36 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `fe48d384dd5e125fa1d4cc1a7b137374992da7bec3cd928243d8184d3f3ee6af`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
