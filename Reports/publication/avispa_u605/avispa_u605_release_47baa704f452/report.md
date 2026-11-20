# Pronóstico — Picadura de avispa (U60.5)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `avispa_u605_release_47baa704f452`
- Lineage: forecast `avispa_u605_forecast_h52_26fe87c998c5_98aea16c791d` · refit `avispa_u605_refit_final_947eb11f60fe_26fe87c998c5` · dataset `avispa_u605_2608ce24ad8f`
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
- Gate congelado `50c4e9a30b5ce5d11f032710b49ca403438dc1a3abb8500b644ed6f83d6abc18`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
