# Pronóstico — Otitis media aguda (H65.0, H65.1)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `otitis_h65_release_3dce204c0ac3`
- Lineage: forecast `otitis_h65_forecast_h52_bc7326bf0ed5_aae183503c7a` · refit `otitis_h65_refit_final_e6e3eba32fd9_bc7326bf0ed5` · dataset `otitis_h65_d7c983f8aca3`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 57 |
| `seasonal_median_5y` | 1 |
| `seasonal_naive_lag52` | 6 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `34549d032f718bb1279c228bf7e8dd438f0c2e3deefa63b322bf2e5357d04cb2`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
