# Pronóstico — Mordedura por otras serpientes (T63.0, X20)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `mordedura_otras_serpientes_t630_release_15f4ad5a7c59`
- Lineage: forecast `mordedura_otras_serpientes_t630_forecast_h52_f2b096b80115_264ad4ef84fd` · refit `mordedura_otras_serpientes_t630_refit_final_947eb11f60fe_f2b096b80115` · dataset `mordedura_otras_serpientes_t630_b6d8bbf479c6`
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
- Gate congelado `365cecfff51569886d6e6d568d21d9f1e142a085609e52498bead8efcefb0b90`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
