# Pronóstico — Mordedura por serpiente de cascabel (U60.0)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `mordedura_cascabel_u600_release_76429c90d256`
- Lineage: forecast `mordedura_cascabel_u600_forecast_h52_26ba9324af7e_588c21cd2ca1` · refit `mordedura_cascabel_u600_refit_final_947eb11f60fe_26ba9324af7e` · dataset `mordedura_cascabel_u600_416ed9229e43`
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
- Gate congelado `d4e50d65d682238cbf17b4b5ee61edb6e2322ad56129a099a8a003ac196f575b`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
