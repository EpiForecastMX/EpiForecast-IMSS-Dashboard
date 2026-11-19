# Pronóstico — Tripanosomiasis americana (enfermedad de Chagas) crónica (B57.2, B57.3, B57.4, B57.5)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `chagas_cronica_b572_release_67c0a551a6f4`
- Lineage: forecast `chagas_cronica_b572_forecast_h52_9f791be7aed7_6ef152bb8047` · refit `chagas_cronica_b572_refit_final_9fe0414b00c7_9f791be7aed7` · dataset `chagas_cronica_b572_3a1662191a14`
- Origen 2026-W44 → horizonte 52 semanas
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
- Gate congelado `c7eabc6de9ec603ab8e4196c256bd9d4306bf4ae5f84cf3b891b7297e936dea4`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
