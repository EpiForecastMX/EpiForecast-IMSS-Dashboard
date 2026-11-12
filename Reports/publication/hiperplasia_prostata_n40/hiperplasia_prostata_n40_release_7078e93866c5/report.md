# Pronóstico — Hiperplasia de la próstata (N40)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `hiperplasia_prostata_n40_release_7078e93866c5`
- Lineage: forecast `hiperplasia_prostata_n40_forecast_h52_b75a59c06b37_a586b18aaf3f` · refit `hiperplasia_prostata_n40_refit_final_30e6b4ef89df_b75a59c06b37` · dataset `hiperplasia_prostata_n40_5155be8b14a0`
- Origen 2026-W42 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 32 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `044281726ebe54a96156dceb0ef2382f44baab8fb87b7dbc6d5ae9ff2ba15f7e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
