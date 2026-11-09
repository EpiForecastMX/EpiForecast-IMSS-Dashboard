# Pronóstico — Linfoma no Hodgkin (C82, C83, C84, C85)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `linfoma_no_hodgkin_c82_release_f13bb4b27953`
- Lineage: forecast `linfoma_no_hodgkin_c82_forecast_h52_cb9cfee0dab3_747f57b348d4` · refit `linfoma_no_hodgkin_c82_refit_final_4af87dc22242_cb9cfee0dab3` · dataset `linfoma_no_hodgkin_c82_1de211829fdc`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 17 |
| `seasonal_naive_lag52` | 47 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `3b04ac0e5e46a0d2cf06c2d8a4e9586e6b61919ce04d7424295eef1b21c58d5a`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
