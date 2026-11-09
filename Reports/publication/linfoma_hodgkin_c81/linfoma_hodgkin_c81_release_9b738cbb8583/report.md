# Pronóstico — Linfoma de Hodgkin (C81)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `linfoma_hodgkin_c81_release_9b738cbb8583`
- Lineage: forecast `linfoma_hodgkin_c81_forecast_h52_f164efca60f6_cf8e97a175b1` · refit `linfoma_hodgkin_c81_refit_final_bb7200dc9609_f164efca60f6` · dataset `linfoma_hodgkin_c81_c5632b386d0d`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 12 |
| `seasonal_naive_lag52` | 52 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `25503ac59a50e24ae8e421148c02396d69e21913405c532b600cf3516922c953`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
