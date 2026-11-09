# Pronóstico — Tumor maligno del colon y recto (C18, C19, C20, C21)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_colon_c18_release_30b04f3b5815`
- Lineage: forecast `cancer_colon_c18_forecast_h52_6e09b709e3ba_19a286194a9f` · refit `cancer_colon_c18_refit_final_074419c03585_6e09b709e3ba` · dataset `cancer_colon_c18_962b8199ab76`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 25 |
| `seasonal_naive_lag52` | 39 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `e3dc8eb594c96823528907091123b6583bc660aa020822ed401f004c4e955d57`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
