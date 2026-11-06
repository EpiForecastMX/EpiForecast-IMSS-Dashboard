# Anorexia, bulimia y otros trastornos alimentarios — release anorexia_f50_release_173404ea4ef0

Anorexia, bulimia y otros trastornos alimentarios (F50) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W41.

Motores del portafolio: seasonal_naive_lag52 (64 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate e9728d49fe146fb679d6a360d9374b7d0fe6fe7b314b4edde02e10b073af9a04). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
