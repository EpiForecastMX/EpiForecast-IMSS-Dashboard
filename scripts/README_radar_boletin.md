# Radar del boletín: actualización semanal

`boletin.html` (https://epiforecast.mx/boletin) muestra una foto del boletín epidemiológico
semanal del SINAVE y las curvas históricas desde 2013. La foto vigente se declara en un solo
lugar, `assets/boletin/actual.json`; la página, sus pruebas y los scripts del histórico la leen
de ahí. Ninguna semana queda escrita en el código.

## Requisitos

- Python 3.11 o posterior (sólo la biblioteca estándar).
- Poppler (`pdftotext`, `pdftoppm`) y Tesseract, para leer el PDF y los encabezados que el
  boletín imprime como imagen.
- Node 18 o posterior, que valida artefactos y calcula textos con `assets/boletin/textos.mjs`.

## El comando semanal

Desde la raíz del sitio, con el PDF oficial descargado del índice de la DGE:

```bash
python3 scripts/boletin_semana.py \
  --pdf ~/Downloads/Boletin-4326.pdf \
  --url-fuente https://www.gob.mx/cms/uploads/attachment/file/<id>/Boletin-4326.pdf \
  --publicacion 2026-11-09
npm run test:boletin
python3 -m unittest discover -s scripts -p 'test_boletin*.py'
```

La semana y el año salen del membrete del PDF («Semana 43, 2026»); `--anio` y `--semana`
sólo sirven para comprobarlos. `--comprobado AAAA-MM-DD` fija la fecha de comprobación (hoy
por omisión). El comando:

1. Lee la foto anterior indicada por `actual.json` (o `--anterior <carpeta>`).
2. Extrae del PDF los bloques estatales (cada columna debe reconciliar exactamente con la
   suma de sus 32 entidades), las filas del resumen nacional y la tabla de miasis.
3. Asigna a cada bloque su identidad estable (`p70b1`, `p61b1`, ...) por nombre y código
   impresos: las páginas cambian entre boletines, las identidades no.
4. Lee el corte observado de cada cuadro de su título (texto del PDF o, si es imagen, OCR) y
   exige que sea la semana del boletín o la anterior.
5. Hereda de la foto anterior, por identidad, los campos de cobertura y recalcula sólo las
   cifras (tabla inferior).
6. Prepara en memoria la semana nueva del histórico de curvas; si algo no cuadra, se detiene
   sin escribir nada.
7. Escribe la foto en carpeta temporal (`data.json`, `catalogo.csv`, `verification.json`,
   `boletin.txt`, `encabezados-ocr.json` y el PDF en minúsculas), ejecuta `verificarMiasis(data,
   verification)` con Node antes de renombrarla a `assets/boletin/<año>-w<NN>/`, y aborta sin
   mutar destino, histórico ni puntero si falla.
8. Agrega la semana al histórico (`assets/boletin/history/`).
9. Activa la foto con `boletin_semana_activa.py`, que ejecuta preflight completo (`verificarMiasis`
   y validación de plantillas en memoria) antes de actualizar `actual.json` y `boletin.html`.

Después hay que revisar el diff, subir el cache-bust de `radar.js`/`curves.js` sólo si
cambió su código, y comprobar la página servida.

### Cuándo se detiene (código 1, sin escribir nada)

- Un bloque cuyas columnas no reconcilian con sus 32 entidades, o una celda ilegible.
- Un bloque o una fila nacional exclusiva sin identidad única, o una identidad de la foto
  anterior que no aparece.
- Un corte ilegible, fuera de la semana del boletín y la anterior, o cuyos acumulados son de
  otro año que el corte.
- Rótulos de año distintos entre las dos páginas del resumen nacional.
- Falta la tabla de miasis, trae conteos no enteros, rompe identidades horizontales sin
  disposición válida o aparece más de una página compatible con ella.
- La semana ya existe (`--reemplazar` para regenerarla) o el histórico ya llega a ella.

Cada problema se lista con su página y su identidad. No hay opción para publicar con un bloque
estatal ni con una fila del resumen nacional que no reconcilie: toda discrepancia de la fuente
exige una decisión explícita.

### Disposición nominal excepcional en la tabla complementaria de miasis

Únicamente cuando el cuadro complementario de miasis presenta una discrepancia interna impresa
en el PDF oficial y existe decisión nominal explícita del autor registrada por escrito, puede
pasarse `--discrepancias-fuente <archivo.json>` (`schema: boletin_discrepancias_fuente.v1`,
obligatorio tanto en la forma con `discrepancias: [...]` como en la forma de registro único),
conservando ese JSON completo y el acta de autorización exclusivamente en local **fuera de toda
raíz pública del sitio y fuera de `--salida`**. La guarda comprueba `--raiz` y cualquier ancestro
que porte los marcadores del sitio (`boletin.html` + `assets/boletin/actual.json`) mediante
`samefile` (cubriendo enlaces simbólicos y variantes de mayúsculas en APFS, sin recorrer el
sistema de archivos global):

- El cargador local valida la coincidencia exacta de `pdf_sha256` (SHA-256 de 64 hex calculado
  del PDF leído), `pagina`, `cuadro: "miasis"`, `columna`, `nombre_columna`, `suma_estados`,
  `total_impreso`, `delta`, `filas_con_identidad_rota` (canonicalizado en orden de claves),
  `estado: "NO_RECONCILIADO"`, `celdas_modificadas: 0` y `decision` (`autor`, `fecha` ISO,
  `texto_literal`, `enlace_evidencia`, `evidencia_sha256`). `disposition_file_sha256` se calcula
  sobre los bytes leídos de `--discrepancias-fuente`; en cambio, `decision.evidencia_sha256`
  (proyectado como `authorization_sha256`) es un **identificador declarado de provenancia**
  (`^[0-9a-f]{64}$`): el cargador no abre `enlace_evidencia` ni verifica automáticamente el hash
  del acta local ni inventa firmas criptográficas humanas.
- La disposición nunca se hereda entre semanas ni aplica a bloques estatales ni al resumen
  nacional; si cualquier campo difiere o si la disposición sobra (el PDF sí reconcilia), el
  comando se detiene con código 1 sin escribir nada. Un registro `solo_pruebas` / `TEST_ONLY`
  exige `--sin-activar` y `--sin-historia` y **tiene prohibida toda salida bajo `--raiz` o bajo
  cualquier otro árbol de sitio detectado**. Esta guarda es una salvaguarda acotada de operador,
  no una certificación universal: como la proyección pública elimina `solo_pruebas` y `TEST_ONLY`,
  una salida externa de prueba jamás debe copiarse ni publicarse manualmente dentro del sitio.
- Las celdas y totales impresos se conservan intactos (incluidos decimales impresos en columnas
  de porcentaje total, sin truncarlos). La garantía de privacidad reside en la **proyección por
  lista cerrada de 13 claves** del generador (`proyectar_discrepancia_publica`: los 11 campos
  técnicos exactos más `authorization_sha256` y `disposition_file_sha256`), que jamás lee ni
  copia a `data.json` ni a `verification.json` (`myiasis_reconciled: false`) los campos de
  `decision`, rutas locales ni metadatos de sesión. `verificarMiasis` se ejecuta antes del rename
  en `boletin_semana.py`, antes de mutar `actual.json`/`boletin.html` en `boletin_semana_activa.py`,
  en `radar.js` (`init()`, respetando fotos históricas congeladas como W42/W43) y en la suite de
  pruebas: exige los esquemas cerrados de 3 y 13 claves, conteos enteros sin truncar y
  coincidencia aritmética/estructural exacta, más una defensa heurística secundaria contra claves
  de disposición y rutas conocidas (que no pretende ser un detector universal de metadatos
  arbitrarios fuera de esos esquemas). En JSON el enum técnico permanece `"NO_RECONCILIADO"`; en
  la interfaz humana se muestra literalmente `NO RECONCILIADO` con espacio.

### Avisos que no detienen

- `nota_con_pagina`: una nota heredada (`source_note`) cita una página distinta de la actual
  del bloque o del resumen nacional. Hay que corregir el texto a mano en la foto nueva.
- `simbologia_heredada`: cuando la corrida no detecta un bloque de simbología en el PDF nuevo,
  reutiliza `meta.symbols` de la foto inmediata anterior marcando `origen: "HEREDADO"` y
  `heredada_de: {periodo, pdf_sha256}` tanto en `data.json` como en la interfaz (sin afirmar que
  el PDF carezca de simbología impresa ni cómo la obtuvo originalmente la foto previa).
- Periodo ya observado: si un cuadro cambia de rezago y repite una semana, la edición nueva
  gobierna y la anterior queda en `revisions`, igual que en la reconstrucción completa.

## Qué se hereda y qué se recalcula

| Campo de `data.json` | Origen |
| --- | --- |
| `name`, `code`, `page`, `columns`, `totals`, `states`, `weekly`, `cumulative`, `previous`, `active_states` | PDF de la semana |
| `observed_week`, `cut_text` | título del cuadro (texto u OCR) |
| `group`, `aggregate`, `platform_id`, `status`, `source_note`, `reason`, `score_parts.afinidad` | foto anterior, por identidad |
| `score_parts.carga`, `dispersion`, `crecimiento` | recalculados con las cifras nuevas |
| `priority`, `score` | regla del radar si la categoría sigue «Por incorporar»; si no, se hereda `priority` y `score` se recalcula sólo si la foto anterior lo tenía |
| `meta.week`, `year`, `period`, `pdf_sha256` | PDF |
| `meta.publication`, `checked`, `source_url` | argumentos |
| `meta.index_url`, `registry_sha256` | foto anterior (`--registro <backend>/config/padecimientos.yaml` recalcula la huella) |
| `meta.territorial_blocks`, `national_rows`, `categories`, `aggregate_rows`, `platform_published`, `reconciliation` | recontados |
| `myiasis` | tabla de miasis del PDF, incluidos `reclassified_to_discarded` y `notes` |

## Al publicar o retirar un padecimiento

La cobertura no cambia con el boletín: se edita en la foto vigente
(`assets/boletin/<año>-w<NN>/data.json`: `status`, `platform_id`, `source_note`, `reason`,
`priority`, `score`, `meta.platform_published`, `meta.registry_sha256` y
`verification.json`), y la semana siguiente la hereda. Después:

```bash
python3 scripts/boletin_semana_activa.py   # valida con verificarMiasis y resincroniza boletin.html
npm run test:boletin
```

El texto de `.coverage-foot` («F50, isquémica, ... control estacional publicado») sigue
siendo prosa a mano.

## Opción «Pronóstico» de cada categoría

Junto a la serie observada, cada categoría no agregada tiene la opción «Pronóstico»
(`assets/boletin/pronostico.mjs` y `assets/boletin/pronostico_vista.mjs`):

- con release del runner, la serie nacional de `publication/<id>/vista.json` y su etiqueta;
- legacy (depresión, Parkinson, Alzheimer y dengue), los datos publicados en `hero_series.json`;
- sin release (no modelables y rechazadas), el «Pronóstico exploratorio, no validado» de
  `<foto>/pronostico_exploratorio.json`: media de la misma semana en los tres años anteriores
  impresos (o uno solo si no hay más), sin prueba de desempeño ni intervalos. Si el último periodo
  impreso no tiene cifra o alguna de las 52 semanas no tiene año base, se usa el respaldo
  «nivel reciente sin estacionalidad»: valor plano igual a la media de las últimas semanas con
  cifra de toda la serie (hasta ocho), con semanas y periodos declarados. Sólo una categoría que
  nunca tuvo una cifra semanal impresa queda sin pronóstico, con ese motivo.

Sarampión y P. falciparum, cuyo cuadro estatal no publica la cifra, usan el acumulado nacional que
imprimen las notas del boletín (`assets/boletin/history/notas_acumulados.json`, con archivo, página y
frase por boletín; `node scripts/radar_notas_acumulados.mjs --txt-dir <dir de AAAA_semNN.txt>` lo
reconstruye): casos semanales por diferencia en el tramo consistente más reciente y nivel reciente.

`boletin_semana_activa.py` lo regenera al activar cada foto
(`node scripts/radar_pronostico_exploratorio.mjs`); `--check` comprueba que esté al día.

## Histórico de curvas y migración de guiones

- `scripts/boletin_semana.py` agrega cada semana con `scripts/boletin_semana_historia.py` y la
  prueba `test_boletin_semana.Historico` verifica ida y vuelta byte a byte sobre la semana 42.
- Para reconstrucción completa desde 2013–2024 y 2025+, usar `boletin_history_*`,
  `boletin_archive_*` y después restituir guiones con `boletin_marcadores_migra.py`.
- Cada celda guarda la cifra impresa o el símbolo («-», «n.d.», «n.a.», «s.n.»); la regla única
  de cálculo vive en `scripts/boletin_celdas.py` y `assets/boletin/celdas.mjs` (con excepción
  documentada `guion.semantica == "no_publicado"` en sarampión `p10b2` y P. falciparum `p33b1`).
- `assets/boletin/2026-w43/` permanece congelada y `assets/boletin/2026-w43-r1/` registra la
  revisión con `correccion.json`.

## Archivos

| Archivo | Papel |
| --- | --- |
| `scripts/boletin_semana.py` | comando semanal, herencia, preflight `verificarMiasis` y escritura |
| `scripts/boletin_semana_extrae.py` | lectura del PDF: bloques estatales, resumen nacional, miasis, OCR |
| `scripts/boletin_discrepancias_fuente.py` / `scripts/boletin_miasis_reglas.py` | carga, validación exacta fail-closed y proyección pública de 13 claves en miasis |
| `scripts/boletin_guardas_radar.py` | guardas de raíces públicas (`samefile`/marcadores), preflight Node y simbología heredada |
| `scripts/boletin_semana_activa.py` | preflight y actualización atómica de `actual.json` y `boletin.html` |
| `assets/boletin/textos.mjs` / `assets/boletin/miasis_verificacion.mjs` | textos semanales y verificador `verificarMiasis` compartido (CLI, pruebas y navegador) |
| `scripts/test_boletin_discrepancias_fuente.py`, `scripts/test_boletin_fable_*.py`, `tests/radar_*.test.mjs` | pruebas de disposición nominal, guardas F1–F8 / N1–N5 y aviso `NO RECONCILIADO` |

## Límites conocidos

- En 2026-W01 el resumen nacional imprimió años distintos entre sus dos páginas y una discrepancia
  en IRA; el generador se detiene en ambos casos.
- Boletines anteriores a la tabla de miasis no se generan con este comando.
- El CSV histórico conserva el nombre `nacional-2013-2026.csv` y los puntos de 2020_sem25 p. 15
  más 26 puntos con negativos publicados mantienen su representación previa.
