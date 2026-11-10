# Pronóstico — Neumonías y bronconeumonías (J12, J15, J16, J17, J18)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `neumonias_j12_release_5814ddca1860`
- Lineage: forecast `neumonias_j12_forecast_h52_dc007321409a_4e880f5255b7` · refit `neumonias_j12_refit_final_9fe0414b00c7_dc007321409a` · dataset `neumonias_j12_1c7577d9ee20`
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
- Gate congelado `69d97338d1a6e5e5c7f6de63ecfc01f24f7ab8cd8b8a74e6c590cfdb9832abbf`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
