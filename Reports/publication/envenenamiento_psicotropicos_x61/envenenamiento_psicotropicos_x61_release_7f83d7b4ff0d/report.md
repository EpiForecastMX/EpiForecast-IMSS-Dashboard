# Pronóstico — Envenenamiento autoinfligido intencionalmente por drogas antiepilépticas, sedantes, hipnóticas, antiparkinsonianas y psicotrópicas (X61)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `envenenamiento_psicotropicos_x61_release_7f83d7b4ff0d`
- Lineage: forecast `envenenamiento_psicotropicos_x61_forecast_h52_b93e13cfb4a7_e8ca6f98da92` · refit `envenenamiento_psicotropicos_x61_refit_final_11423534b84b_b93e13cfb4a7` · dataset `envenenamiento_psicotropicos_x61_68ef80c1cc9c`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 27 |
| `seasonal_naive_lag52` | 37 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `8937e2992b93a3f625d398e3e0deb8c40f06fe9174df8f043f14b52717f50708`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
