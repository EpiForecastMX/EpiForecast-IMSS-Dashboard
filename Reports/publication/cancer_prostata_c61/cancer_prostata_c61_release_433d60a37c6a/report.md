# Pronóstico — Tumor maligno de la próstata (C61)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_prostata_c61_release_433d60a37c6a`
- Lineage: forecast `cancer_prostata_c61_forecast_h52_d066831a5245_da18c53bfee8` · refit `cancer_prostata_c61_refit_final_30e6b4ef89df_d066831a5245` · dataset `cancer_prostata_c61_a7a0989ab0fe`
- Origen 2026-W41 → horizonte 52 semanas
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
- Gate congelado `afba99119f22a6787d946e5a9ad11f168a44d055f50a1895b396bf6360151e6f`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
