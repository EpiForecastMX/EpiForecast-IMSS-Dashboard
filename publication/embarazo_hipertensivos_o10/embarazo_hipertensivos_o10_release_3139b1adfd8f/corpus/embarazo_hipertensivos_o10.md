# Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio — release embarazo_hipertensivos_o10_release_3139b1adfd8f

Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio (O10, O11, O12, O13, O14, O15, O16) tiene 32 modelos finales, uno por serie base (entidad; el boletín no desglosa sexo). De esas 32 series base se derivan por suma 5 productos agregados, hasta un total de 37 productos. Los modelos y los productos NO son lo mismo: hay 32 modelos y 37 productos.

El pronóstico cubre 52 semanas desde 2026-W42.

Motores del portafolio: ets_add_damped_log1p (12 series), ridge_harmonic_log1p (16 series), seasonal_mean_3y (1 series), seasonal_mean_5y (1 series), seasonal_median_3y (1 series), seasonal_median_5y (1 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate 6d86ba00f245284b519d44a9983272afb2e57a3167ff82fb889420125740a31e). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
