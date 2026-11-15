# Pronóstico — Giardiasis (A07.1)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `giardiasis_a071_release_e3458e42deda`
- Lineage: forecast `giardiasis_a071_forecast_h52_34685d3bceee_ac8d0421e334` · refit `giardiasis_a071_refit_final_9fe0414b00c7_34685d3bceee` · dataset `giardiasis_a071_23d5d9e15daa`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `1cc58190129007ffe7651ed1f64822652fa1e41f73adbc084f9bd8d4be2261db`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
