# Pronóstico — Tumor maligno del estómago (C16)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_estomago_c16_release_94460da48374`
- Lineage: forecast `cancer_estomago_c16_forecast_h52_557475727717_e69668b9fe0c` · refit `cancer_estomago_c16_refit_final_036e95dfdcbf_557475727717` · dataset `cancer_estomago_c16_50a6743a8dfd`
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
- Gate congelado `1734ed8e726c3139eae89aa7f29e0557874ab4af346338d65524862652c5ccab`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
