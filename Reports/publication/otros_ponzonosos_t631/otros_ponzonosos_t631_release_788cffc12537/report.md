# Pronóstico — Picadura o intoxicación por otros animales ponzoñosos (T63.1, T63.5, T63.6, T63.7, T63.8, T63.9, X27, U60.8)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `otros_ponzonosos_t631_release_788cffc12537`
- Lineage: forecast `otros_ponzonosos_t631_forecast_h52_17d7588f06f8_b2e58c90cf99` · refit `otros_ponzonosos_t631_refit_final_947eb11f60fe_17d7588f06f8` · dataset `otros_ponzonosos_t631_ffe78f339439`
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
- Gate congelado `5ea115ecdea975da22b02f36e5ac471d33efdd1e04ba561a4971afbacc49263e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
