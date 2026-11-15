# Desnutrición severa — release desnutricion_severa_e40_release_2a04bbc9573a

Desnutrición severa (E40, E41, E42, E43) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W42.

Motores del portafolio: seasonal_naive_lag52 (64 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — sin validación: Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos. El gate de aceptación RECHAZÓ el portafolio y lo publicado es el control: comparar con el mismo control no valida nada. Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
