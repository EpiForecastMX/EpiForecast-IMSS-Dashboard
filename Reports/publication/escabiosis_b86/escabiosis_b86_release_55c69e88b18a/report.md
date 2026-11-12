# Pronóstico — Escabiosis (B86)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `escabiosis_b86_release_55c69e88b18a`
- Lineage: forecast `escabiosis_b86_forecast_h52_49303fdeec36_cab22387abbf` · refit `escabiosis_b86_refit_final_9fe0414b00c7_49303fdeec36` · dataset `escabiosis_b86_733412793349`
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
- Gate congelado `b793fa47eac57a341829f16eb4247c6e3db734024af5be2123258b3f8611f680`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
