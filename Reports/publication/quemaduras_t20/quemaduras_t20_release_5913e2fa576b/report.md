# Pronóstico — Quemaduras (T20, T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `quemaduras_t20_release_5913e2fa576b`
- Lineage: forecast `quemaduras_t20_forecast_h52_27f30c8a4d7a_3bc2f693f43a` · refit `quemaduras_t20_refit_final_9fe0414b00c7_27f30c8a4d7a` · dataset `quemaduras_t20_0d748b284be1`
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
- Gate congelado `8648fa5a31a039047a5c1b510a58c914a850c4e395e02b4f47a09fce61efb551`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
