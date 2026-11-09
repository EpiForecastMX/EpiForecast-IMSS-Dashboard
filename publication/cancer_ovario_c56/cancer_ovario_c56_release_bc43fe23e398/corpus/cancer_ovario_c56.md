# Tumor maligno del ovario — release cancer_ovario_c56_release_bc43fe23e398

Tumor maligno del ovario (C56) tiene 32 modelos finales, uno por serie base (entidad; el boletín no desglosa sexo). De esas 32 series base se derivan por suma 5 productos agregados, hasta un total de 37 productos. Los modelos y los productos NO son lo mismo: hay 32 modelos y 37 productos.

El pronóstico cubre 52 semanas desde 2026-W41.

Motores del portafolio: seasonal_mean_2y (13 series), seasonal_naive_lag52 (19 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate dbffcac8196b387c2cd0a8b16999e9b00faa15bcedfe2329006a943fd66c0333). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
