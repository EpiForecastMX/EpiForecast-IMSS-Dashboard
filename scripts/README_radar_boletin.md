# Radar del boletín: actualización semanal

`boletin.html` (https://epiforecast.mx/boletin) muestra una foto del boletín epidemiológico
semanal del SINAVE y las curvas históricas desde 2013. La foto vigente se declara en un solo
lugar, `assets/boletin/actual.json`; la página, sus pruebas y los scripts del histórico la leen
de ahí. Ninguna semana queda escrita en el código.

## Requisitos

- Python 3.11 o posterior (sólo la biblioteca estándar).
- Poppler (`pdftotext`, `pdftoppm`) y Tesseract, para leer el PDF y los encabezados que el
  boletín imprime como imagen.
- Node 18 o posterior, que calcula los textos de la página con `assets/boletin/textos.mjs`.

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
7. Escribe `assets/boletin/<año>-w<NN>/` con `data.json`, `catalogo.csv`,
   `verification.json`, `boletin.txt` (`pdftotext -layout`), `encabezados-ocr.json` y una
   copia del PDF con el nombre del archivo oficial en minúsculas.
8. Agrega la semana al histórico (`assets/boletin/history/`).
9. Activa la foto: reescribe `actual.json` y el texto estático de `boletin.html` (cifras,
   fechas, páginas y enlaces marcados con `data-radar`, `data-radar-enlace`,
   `data-radar-plantilla` y `data-radar-content`).

Después hay que revisar el diff, subir el cache-bust de `radar.js`/`curves.js` sólo si
cambió su código, y comprobar la página servida.

### Cuándo se detiene (código 1, sin escribir nada)

- Un bloque cuyas columnas no reconcilian con sus 32 entidades, o una celda ilegible.
- Un bloque o una fila nacional exclusiva sin identidad única, o una identidad de la foto
  anterior que no aparece.
- Un corte ilegible, fuera de la semana del boletín y la anterior, o cuyos acumulados son de
  otro año que el corte.
- Rótulos de año distintos entre las dos páginas del resumen nacional.
- Falta la tabla de miasis.
- La semana ya existe (`--reemplazar` para regenerarla) o el histórico ya llega a ella.

Cada problema se lista con su página y su identidad. No hay opción para publicar con un bloque
que no reconcilia: una discrepancia de la fuente exige una decisión explícita.

### Avisos que no detienen

- `nota_con_pagina`: una nota heredada (`source_note`) cita una página distinta de la actual
  del bloque o del resumen nacional. Hay que corregir el texto a mano en la foto nueva.
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
python3 scripts/boletin_semana_activa.py   # resincroniza boletin.html con actual.json
npm run test:boletin
```

El texto de `.coverage-foot` («F50, isquémica, ... control estacional publicado») sigue
siendo prosa a mano.

## Histórico de curvas

### Cada semana

`scripts/boletin_semana.py` agrega la semana con `scripts/boletin_semana_historia.py`: un punto
por categoría en su semana observada, con sus 32 entidades, más la fuente en `index.json`, el
periodo, los conteos y `nacional-2013-2026.csv` regenerado. La prueba
`test_boletin_semana.Historico` retira la semana 42 y la vuelve a agregar: el resultado es
idéntico byte a byte al histórico publicado.

### Reconstrucción completa (sólo si cambia el método de extracción)

Los scripts del histórico ya no fijan la semana: el catálogo de identidades, la semana final
y el rezago de cada cuadro salen de la foto declarada en `actual.json`
(`scripts/boletin_foto_actual.py`). Entradas necesarias, fuera del repositorio:

- `<trabajo-reciente>/sources.json`: lista de los PDF de 2025 en adelante con `year`, `week`,
  `url`, `filename`, `path` (ruta local) y `sha256`; se le agrega una entrada por semana nueva.
- Los ZIP anuales oficiales de 2013 a 2024 (o la carpeta `data/raw_PDFs` del backend).

Secuencia exacta:

```bash
# 1. 2025 en adelante (escribe un índice intermedio v1 en assets/boletin/history)
export BOLETIN_WORK_DIR=<trabajo-reciente> BOLETIN_FRONTEND=.
python3 scripts/boletin_history_extract.py
python3 scripts/boletin_history_headers.py
python3 scripts/boletin_history_build.py --comprobado AAAA-MM-DD   # --anio/--semana opcionales

# 2. Archivo 2013-2024 y fusión
python3 scripts/boletin_archive_sources.py --work-dir <trabajo-archivo> \
  --raw-pdf-dir <backend>/data/raw_PDFs [--download]
export BOLETIN_WORK_DIR=<trabajo-archivo>
python3 scripts/boletin_archive_extract.py
python3 scripts/boletin_archive_national.py
python3 scripts/boletin_archive_verify_cuts.py
python3 scripts/boletin_archive_headers.py
BOLETIN_ARCHIVE_OUT=<staging-vacío> BOLETIN_CHECKED_DATE=AAAA-MM-DD \
  python3 scripts/boletin_archive_build.py

# 3. Copiar <staging-vacío>/* a assets/boletin/history/ (conserva audit*.json y
#    headers-2013-2024.json, que la fusión no produce).

# 4. Obligatorio: los extractores de la reconstrucción todavía leen «-» como 0. Restituir el
#    guion cotejando cada punto con su PDF (ver «Guiones y ceros») y correr las pruebas.
python3 scripts/boletin_marcadores_migra.py --foto <foto vigente> --fuentes <carpeta> \
  --informe <informe.json> --escribir
```

Estado de las entradas (8-nov-2026): la extracción auditada 2025-2026 se conserva comprimida
en el trabajo de Codex (`radar-boletin-42/historico-2025-2026/extraccion-auditada.json.gz`) y
con ella `boletin_history_build.py` parametrizado reproduce los 188 fragmentos de 2025-2026.
La extracción nacional 2013-2024 (`national-extraction.json`) no se conservó: la fusión
completa exige volver a correr el paso 2 sobre los ZIP oficiales.

### Corrección de hipotermia (p57b1)

El cuadro 13.10 dice «hasta la semana epidemiológica N−1; ESAVI hasta la semana N». La lectura
OCR de la primera publicación no reconoció «epidemtolégica» y aplicó a hipotermia el corte de
ESAVI, así que sus puntos de 2025-2026 quedaron una semana después de la observada y los dos
boletines de la semana 1 aparecían con año contradictorio. Se recolocaron con
`scripts/boletin_history_fix_cut.py --id p57b1 --rezago 1 --extraccion <extraccion-auditada>`,
que comprueba las cifras contra las publicadas antes de escribir.

## Guiones y ceros

El boletín imprime cifras y símbolos. Su simbología (Cuadro 1, páginas 9 y 10 en 2026) define
«( - ) : no se presentaron casos», «n.d. : información no disponible», «n.a. : no aplica» y
«s.n. : sin notificación por la entidad federativa». Hasta el 11-nov-2026 los tres extractores
guardaban el guion como 0. Ahora:

- Cada celda es la cifra impresa (entero) o el símbolo tal como se imprimió («-», «n.d.»). Nunca
  se convierte uno en otro. `meta.symbols` guarda la simbología leída del PDF (si una edición no
  la imprime, se hereda la anterior con un aviso).
- Si el PDF trae guiones y no imprime su simbología ni la foto anterior la trae, el comando se
  detiene: no se infiere «sin casos» por omisión.
- Para calcular (sumas, orden, puntaje, curvas) la única regla está en `scripts/boletin_celdas.py`
  y `assets/boletin/celdas.mjs`: un guion vale 0 sólo bajo la simbología; n.d., n.a. y s.n. no
  tienen valor; lo que no tiene valor queda fuera de sumas y rankings y como hueco en las curvas.
- La reconciliación compara sólo lo comparable: un guion no aporta cifra impresa; un TOTAL con
  guion exige guiones; un n.d. o s.n. en la columna la deja sin comprobar y el comando se detiene.
- Excepción con evidencia, campo `guion` de la categoría (se hereda por identidad, como la
  cobertura): sarampión (`p10b2`) y paludismo por P. falciparum (`p33b1`) imprimen guiones en
  todas sus columnas, también en el acumulado de 2025, mientras las notas de sus cuadros registran
  casos confirmados (2025_sem53: 6,152 de sarampión, p. 11, y siete de P. falciparum, p. 34).
  Desde 2025 su guion es una cifra no publicada: no vale 0 en ningún cálculo. Sus filas del
  resumen nacional llevan la misma semántica (`filas_nacionales`). Sólo se declara otra excepción
  con la cita, la página y el sha256 de la fuente.

### Revisión corregida de la semana 43

`assets/boletin/2026-w43/` es la foto publicada el 9-nov-2026 y no se modifica. La vigente es
`assets/boletin/2026-w43-r1/`, generada con este mismo comando desde el mismo PDF; su
`correccion.json` registra los sha256 de ambas, la regla y la evidencia. Pasada por
`boletin_celdas.foto_legada` reproduce la original; sólo cambia `score_parts.carga` de sarampión y
falciparum (0.0 → null). Una revisión es la misma semana: no agrega una fuente al histórico.

### Migración del histórico

`scripts/boletin_marcadores_migra.py` restituye el guion en las curvas de 2013 a 2026 cotejando
cada punto con su PDF fuente, cuyo sha256 recalcula y compara con `index.json` (la bandera del
manifiesto no basta). Exige evidencia positiva: que en la página se reconozcan las 32 entidades
(«Distrito Federal» antes de 2017) y TOTAL, o las filas con código del resumen nacional; que
imprima al menos tantos guiones como ceros se restituyen, y que no imprima ningún 0 literal en
sus filas de datos. Una página vacía o no reconocida deja el punto como estaba, con su motivo.
`--cache-textos` guarda el texto de cada página para no releer los PDF. El 11-nov-2026, con las 723
fuentes verificadas (2013 y la edición alterna de 2023 extraídas de los ZIP oficiales), restituyó
2,309,527 celdas en 84,685 puntos. No se tocaron los puntos de 2020_sem25 p. 15 (`p12b1`,
`p12b2`), cuya página imprime ceros literales, ni 26 puntos con valores negativos publicados.
Con «-» → 0 el histórico migrado es idéntico al anterior. Para repetirla se necesitan las fuentes
y sus manifiestos (`--fuentes <carpeta>` con `manifiesto.json`).

## Archivos

| Archivo | Papel |
| --- | --- |
| `scripts/boletin_semana.py` | comando semanal, herencia de cobertura, escritura de la foto |
| `scripts/boletin_semana_extrae.py` | lectura del PDF: bloques estatales, resumen nacional, miasis, OCR |
| `scripts/boletin_semana_cortes.py` | corte observado de cada bloque a partir del título del cuadro |
| `scripts/boletin_semana_historia.py` | agregado incremental al histórico de curvas |
| `scripts/boletin_semana_activa.py` | `actual.json` y texto estático de `boletin.html` |
| `scripts/boletin_foto_actual.py` | foto vigente para los scripts del histórico |
| `scripts/boletin_celdas.py` / `assets/boletin/celdas.mjs` | cifra o símbolo impreso y la única regla para calcular con ellos |
| `scripts/boletin_marcadores_migra.py` | restitución del guion en el histórico, cotejada con cada PDF |
| `scripts/test_boletin_marcadores.py`, `tests/boletin_marcadores.test.mjs` | regresión de guiones y ceros con la fuente real |
| `scripts/test_boletin_semana.py` | regresión contra la semana 42 y pruebas de cierre |
| `assets/boletin/actual.json` | foto vigente: carpeta, PDF y volumen |
| `assets/boletin/textos.mjs` | textos semanales de la página (navegador y HTML estático) |

## Límites conocidos

- La semana 1 de cada año: el boletín 2026-W01 imprimió años distintos en las dos páginas del
  resumen nacional y una discrepancia de origen en infecciones respiratorias agudas; el
  generador se detiene en ambos casos.
- Los boletines de 2026 anteriores a la tabla de miasis no se pueden generar con este comando.
- El recorte del OCR está calibrado para los títulos en imagen de la semana 42; cuando el PDF
  trae el título como texto, se usa el texto.
- Las notas de la fuente en «Fuentes y método» sólo actualizan sus números de página; los
  códigos que citan son prosa a mano.
- El CSV del histórico conserva el nombre `nacional-2013-2026.csv` aunque cambie el año.
- Puntos del histórico que siguen sin distinguir guion de cero (ver «Guiones y ceros»): los de
  la página 15 de 2020_sem25 (imprime un 0 literal en sus filas) y 26 puntos con valores
  negativos publicados.
