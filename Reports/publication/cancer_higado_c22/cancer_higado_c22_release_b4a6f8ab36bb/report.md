# Pronóstico — Tumor maligno del hígado y de las vías biliares intrahepáticas (C22)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_higado_c22_release_b4a6f8ab36bb`
- Lineage: forecast `cancer_higado_c22_forecast_h52_d05e1898ed99_34636704e2f9` · refit `cancer_higado_c22_refit_final_9fe0414b00c7_d05e1898ed99` · dataset `cancer_higado_c22_05293bd48df5`
- Origen 2026-W41 → horizonte 52 semanas
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
- Gate congelado `6cb1e7b9944898a51cea6a1ff17bfc3df7dca6c44373b94aa12310a8f80413e4`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
