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
#    headers-2013-2024.json, que la fusión no produce) y correr las pruebas.
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

## Archivos

| Archivo | Papel |
| --- | --- |
| `scripts/boletin_semana.py` | comando semanal, herencia de cobertura, escritura de la foto |
| `scripts/boletin_semana_extrae.py` | lectura del PDF: bloques estatales, resumen nacional, miasis, OCR |
| `scripts/boletin_semana_cortes.py` | corte observado de cada bloque a partir del título del cuadro |
| `scripts/boletin_semana_historia.py` | agregado incremental al histórico de curvas |
| `scripts/boletin_semana_activa.py` | `actual.json` y texto estático de `boletin.html` |
| `scripts/boletin_foto_actual.py` | foto vigente para los scripts del histórico |
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
- Los guiones del boletín se guardan como 0. En el boletín 43 (10-nov-2026) el Cuadro 3.4 imprime
  guiones para sarampión y rubéola (vigilancia especial, «información preliminar de casos
  confirmados»), y `data.json` los registra en cero en todas sus columnas, también en 2025. El dato
  sellado de la foto no se cambia: EPI avisa que un cuadro con todas sus columnas en cero no se lee
  como ausencia de casos (`epibot/js/radar_boletin.js`, `sinCifras`). Distinguir guion de cero en
  el extractor es trabajo pendiente y cambiaría la foto de semanas futuras, no la sellada.
