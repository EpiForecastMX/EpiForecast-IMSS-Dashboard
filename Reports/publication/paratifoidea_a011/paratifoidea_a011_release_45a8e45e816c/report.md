# Pronóstico — Fiebre paratifoidea (A01.1, A01.2, A01.3, A01.4)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `paratifoidea_a011_release_45a8e45e816c`
- Lineage: forecast `paratifoidea_a011_forecast_h52_bc51a427a76e_64a4ee63b691` · refit `paratifoidea_a011_refit_final_8b7a13f1f129_bc51a427a76e` · dataset `paratifoidea_a011_656f1c8ab187`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 2 |
| `seasonal_mean_5y` | 3 |
| `seasonal_median_3y` | 26 |
| `seasonal_median_5y` | 24 |
| `seasonal_naive_lag52` | 9 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `13926e1f6ad84f7f889236c155b2fa56d70599af45343431544e55858665b804`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
