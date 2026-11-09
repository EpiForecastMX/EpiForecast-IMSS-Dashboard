# Pronóstico — Tumores malignos del encéfalo y otras partes del sistema nervioso central (C70, C71, C72)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_encefalo_c70_release_0de6f44f8bfd`
- Lineage: forecast `cancer_encefalo_c70_forecast_h52_6d075bd6ec46_182befaf355b` · refit `cancer_encefalo_c70_refit_final_73829e7b7d9b_6d075bd6ec46` · dataset `cancer_encefalo_c70_695a24979ae3`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 8 |
| `seasonal_naive_lag52` | 56 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `4d62fc8b2ee3338d7c2a4117d3c0b3619bb725e10d34708c693f3fe1c9f46d93`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
