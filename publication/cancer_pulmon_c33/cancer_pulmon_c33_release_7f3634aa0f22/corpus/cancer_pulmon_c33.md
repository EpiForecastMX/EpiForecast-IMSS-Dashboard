# Tumor maligno de tráquea, bronquios y pulmón — release cancer_pulmon_c33_release_7f3634aa0f22

Tumor maligno de tráquea, bronquios y pulmón (C33, C34) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W41.

Motores del portafolio: seasonal_mean_2y (14 series), seasonal_naive_lag52 (50 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate 171429b1acbbc11e0ea614a7c928e103b2faff68f637f66e9ef7df228eb06ad0). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
