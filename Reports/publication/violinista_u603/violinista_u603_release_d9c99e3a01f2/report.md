# Pronóstico — Mordedura de araña violinista (U60.3)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `violinista_u603_release_d9c99e3a01f2`
- Lineage: forecast `violinista_u603_forecast_h52_b9ee9ba47594_2f6b205ffd4e` · refit `violinista_u603_refit_final_947eb11f60fe_b9ee9ba47594` · dataset `violinista_u603_f214f2185db2`
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
- Gate congelado `3283f57514c4add254e139bfd87d559278848dc6fea026653f0c3c071bac7d31`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
