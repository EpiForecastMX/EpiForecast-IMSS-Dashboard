/**
 * release_catalog.js — catálogo único de los padecimientos publicados desde un release del runner.
 *
 * Es un script clásico a propósito: lo cargan con <script> la portada y la galería, y como módulo
 * `release_config.js` y `rag.mjs`. De aquí salen marcadores, alias, handlers de alias, galería,
 * filtro y Figura 1. Lo que escribe una persona (página, tarjeta de portada, metas y noticia) sigue
 * fuera: la guía está en el skill padecimiento-epiforecast.
 *
 * `alias` son palabras normalizadas que identifican al padecimiento. Va vacío cuando sus subtipos
 * los resuelve `diabetesEnConsulta`, porque «diabetes» a secas no basta para elegir uno.
 * `prefijos` solo los usa el detector de rag.mjs. Alias y prefijos se comparan al INICIO de palabra
 * con `nombraAlias`, nunca como subcadena: «depresion alta» contiene «presion alta».
 */
(function (g) {
  const T1 = 'Diabetes tipo I';
  const T2 = 'Diabetes tipo II';

  const releases = Object.freeze([
    {
      id: 'obesidad', pad: 'Obesidad', nombre: 'Obesidad', nombreCorto: 'Obesidad',
      etiqueta: 'Obesidad (E66)', dataKey: 'obesidad', marca: 'OBESIDAD', pagina: 'obesidad.html',
      consulta: 'obesidad', cie: 'E66', color: '#D97706',
      alias: ['obesidad', 'obesidades', 'obeso', 'obesa', 'obesos', 'obesas', 'sobrepeso', 'e66',
        'obesity', 'overweight'],
      prefijos: ['obes'],
    },
    {
      id: 'anorexia_f50', pad: 'Anorexia F50', nombre: 'Anorexia, bulimia y otros trastornos alimentarios',
      nombreCorto: 'Trastornos alimentarios', etiqueta: 'Anorexia, bulimia y otros trastornos alimentarios (F50)',
      dataKey: 'anorexia_f50', marca: 'ANOREXIA_F50', pagina: 'anorexia_f50.html',
      consulta: 'anorexia', cie: 'F50', color: '#A78BFA',
      alias: ['anorexia', 'anorexica', 'anorexico', 'anorexicas', 'anorexicos', 'bulimia',
        'bulimica', 'bulimico', 'bulimicas', 'bulimicos', 'trastornos alimentarios',
        'trastorno alimentario', 'trastornos de la conducta alimentaria',
        'trastorno de la conducta alimentaria', 'tca', 'f50', 'eating disorder',
        'eating disorders'],
      prefijos: ['anorex', 'anorec', 'bulimi', 'trastornos alimentarios', 'trastorno alimentario',
        'conducta alimentaria', 'eating disorder'],
    },
    {
      id: 'diabetes_t1', pad: T1, nombre: T1, nombreCorto: 'Diabetes I',
      etiqueta: 'Diabetes tipo I (E10)', dataKey: 'diabetes_t1', marca: 'DIABETES_T1',
      pagina: 'diabetes_t1.html', consulta: 'diabetes tipo 1', cie: 'E10', color: '#22D3EE',
      alias: [], prefijos: [],
    },
    {
      id: 'diabetes_t2', pad: T2, nombre: T2, nombreCorto: 'Diabetes II',
      etiqueta: 'Diabetes tipo II (E11-E14)', dataKey: 'diabetes_t2', marca: 'DIABETES_T2',
      pagina: 'diabetes_t2.html', consulta: 'diabetes tipo 2', cie: 'E11-E14', color: '#F472B6',
      alias: [], prefijos: [],
    },
    {
      id: 'hipertension_i10', pad: 'Hipertensión arterial', nombre: 'Hipertensión arterial',
      nombreCorto: 'Hipertensión', etiqueta: 'Hipertensión arterial (I10-I15)',
      dataKey: 'hipertension_i10', marca: 'HIPERTENSION_I10', pagina: 'hipertension_i10.html',
      consulta: 'hipertension', cie: 'I10-I15', color: '#F87171',
      alias: ['hipertension', 'hipertension arterial', 'presion alta', 'presion arterial',
        'tension alta', 'tension arterial', 'hipertenso', 'hipertensa', 'i10', 'hypertension',
        'high blood pressure'],
      prefijos: ['hipertens', 'hypertens'],
    },
    {
      id: 'isquemica_i20', pad: 'Enfermedad isquémica del corazón',
      nombre: 'Enfermedad isquémica del corazón', nombreCorto: 'Isquémica',
      etiqueta: 'Enfermedad isquémica del corazón (I20, I25)', dataKey: 'isquemica_i20',
      marca: 'ISQUEMICA_I20', pagina: 'isquemica_i20.html', consulta: 'enfermedad isquemica',
      cie: 'I20, I25', color: '#FB923C',
      alias: ['isquemica', 'isquemia', 'enfermedad coronaria', 'enfermedades coronarias',
        'angina de pecho', 'i20', 'i25', 'ischemic heart disease', 'coronary heart disease',
        'coronary artery disease'],
      prefijos: ['isquemi', 'ischemic heart', 'coronary heart', 'coronary artery'],
    },
    {
      id: 'cerebrovascular_i60', pad: 'Enfermedad cerebrovascular',
      nombre: 'Enfermedad cerebrovascular', nombreCorto: 'Cerebrovascular',
      etiqueta: 'Enfermedad cerebrovascular (I60-I67, I69)', dataKey: 'cerebrovascular_i60',
      marca: 'CEREBROVASCULAR_I60', pagina: 'cerebrovascular_i60.html',
      consulta: 'enfermedad cerebrovascular', cie: 'I60-I67, I69', color: '#FBBF24',
      alias: ['cerebrovascular', 'derrame cerebral', 'ictus', 'apoplejia', 'evc', 'acv', 'i60',
        'stroke'],
      prefijos: ['cerebrovasc'],
    },
    {
      id: 'intestinales_a04', pad: 'Infecciones intestinales por otros organismos y las mal definidas',
      nombre: 'Infecciones intestinales por otros organismos y las mal definidas',
      nombreCorto: 'Infecciones intestinales',
      etiqueta: 'Infecciones intestinales por otros organismos y las mal definidas (A04, A08-A09 excepto A08.0)',
      dataKey: 'intestinales_a04', marca: 'INTESTINALES_A04', pagina: 'intestinales_a04.html',
      consulta: 'infecciones intestinales', cie: 'A04, A08.1-A08.5, A09', color: '#38BDF8',
      alias: ['infecciones intestinales', 'infeccion intestinal', 'infecciones gastrointestinales',
        'infeccion gastrointestinal', 'gastroenteritis', 'a04', 'a09', 'intestinal infections',
        'intestinal infection'],
      prefijos: ['infecciones intestinales', 'infeccion intestinal', 'gastrointestinal',
        'gastroenteritis'],
    },
    {
      id: 'ira_j00', pad: 'Infecciones respiratorias agudas', nombre: 'Infecciones respiratorias agudas',
      nombreCorto: 'IRA', etiqueta: 'Infecciones respiratorias agudas (J00-J06, J20, J21 excepto J02, J03.0)',
      dataKey: 'ira_j00', marca: 'IRA_J00', pagina: 'ira_j00.html',
      consulta: 'infecciones respiratorias agudas', cie: 'J00-J06, J20, J21', color: '#818CF8',
      // «ira » e «iras » con espacio final: palabra completa, para no capturar «Irapuato».
      alias: ['infecciones respiratorias agudas', 'infeccion respiratoria aguda',
        'infecciones respiratorias', 'infeccion respiratoria', 'ira ', 'iras ', 'resfriado comun',
        'catarro', 'rinofaringitis', 'laringitis', 'j00', 'j06', 'acute respiratory infections',
        'acute respiratory infection'],
      prefijos: ['infecciones respiratorias', 'infeccion respiratoria', 'acute respiratory'],
    },
    {
      id: 'ivu_n39', pad: 'Infección de vías urinarias', nombre: 'Infección de vías urinarias',
      nombreCorto: 'Vías urinarias', etiqueta: 'Infección de vías urinarias (N30, N34, N39.0)',
      dataKey: 'ivu_n39', marca: 'IVU_N39', pagina: 'ivu_n39.html',
      consulta: 'infeccion de vias urinarias', cie: 'N30, N34, N39.0', color: '#2DD4BF',
      alias: ['infeccion de vias urinarias', 'infecciones de vias urinarias', 'infeccion urinaria',
        'infecciones urinarias', 'vias urinarias', 'ivu', 'cistitis', 'n30', 'n34',
        'urinary tract infection', 'urinary tract infections'],
      prefijos: ['vias urinarias', 'infeccion urinaria', 'infecciones urinarias', 'cistitis',
        'urinary tract'],
    },
    {
      id: 'gingivitis_k05', pad: 'Gingivitis y enfermedad periodontal',
      nombre: 'Gingivitis y enfermedad periodontal', nombreCorto: 'Gingivitis',
      etiqueta: 'Gingivitis y enfermedad periodontal (K05)', dataKey: 'gingivitis_k05',
      marca: 'GINGIVITIS_K05', pagina: 'gingivitis_k05.html', consulta: 'gingivitis', cie: 'K05',
      color: '#F472B6',
      alias: ['gingivitis', 'enfermedad periodontal', 'enfermedades periodontales', 'periodontitis',
        'k05', 'periodontal disease', 'gum disease'],
      prefijos: ['gingivit', 'periodont', 'gum disease'],
    },
    {
      id: 'asma_j45', pad: 'Asma', nombre: 'Asma', nombreCorto: 'Asma',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W42'],
      etiqueta: 'Asma (J45, J46)', dataKey: 'asma_j45', marca: 'ASMA_J45', pagina: 'asma_j45.html',
      consulta: 'asma', cie: 'J45, J46', color: '#7DD3FC',
      alias: ['asma', 'asmatico', 'asmatica', 'asmaticos', 'asmaticas', 'estado asmatico',
        'crisis asmatica', 'azma', 'j45', 'j46', 'asthma', 'asthmatic'],
      // «azma» va como alias: el corrector de typos sólo cubre palabras de cinco letras o más.
      prefijos: ['asma', 'asmatic', 'azma', 'asthma'],
      // Cronología que acota la validación prospectiva: la dicen el bot, el RAG y la página.
      cronologia: 'El boletín 43, que trae la semana 2026-W42, se publicó el 9 de noviembre de 2026, horas '
        + 'antes de emitir este pronóstico. No se usó para entrenar, pero esa semana no cuenta como '
        + 'prospectiva respecto de la información; las tres siguientes del gate (W43 a W45) sí.',
    },
    {
      id: 'neumonias_j12', pad: 'Neumonías y bronconeumonías', nombre: 'Neumonías y bronconeumonías',
      nombreCorto: 'Neumonías', etiqueta: 'Neumonías y bronconeumonías (J12-J18 excepto J18.2, J13 y J14)',
      dataKey: 'neumonias_j12', marca: 'NEUMONIAS_J12', pagina: 'neumonias_j12.html',
      consulta: 'neumonias', cie: 'J12-J18', color: '#34D399',
      alias: ['neumonias y bronconeumonias', 'neumonia', 'neumonias', 'bronconeumonia',
        'bronconeumonias', 'pulmonia', 'pulmonias', 'j12', 'j18', 'pneumonia', 'pneumonias',
        'bronchopneumonia'],
      prefijos: ['neumoni', 'bronconeumoni', 'pulmoni', 'pneumoni', 'bronchopneumoni'],
    },
    {
      id: 'ulceras_k25', pad: 'Úlceras, gastritis y duodenitis',
      nombre: 'Úlceras, gastritis y duodenitis', nombreCorto: 'Úlceras y gastritis',
      etiqueta: 'Úlceras, gastritis y duodenitis (K25-K29)', dataKey: 'ulceras_k25',
      marca: 'ULCERAS_K25', pagina: 'ulceras_k25.html', consulta: 'gastritis', cie: 'K25-K29',
      color: '#C084FC',
      alias: ['gastritis', 'duodenitis', 'ulcera gastrica', 'ulceras gastricas', 'ulcera peptica',
        'ulceras pepticas', 'ulcera duodenal', 'ulceras duodenales', 'k25', 'k26', 'k27', 'k28',
        'k29', 'peptic ulcer', 'stomach ulcer', 'gastric ulcer'],
      prefijos: ['gastritis', 'duodenitis', 'ulcera gastric', 'ulceras gastric', 'ulcera peptic',
        'ulceras peptic', 'ulcera duoden', 'ulceras duoden', 'peptic ulcer'],
    },
    {
      id: 'cancer_mama_c50', pad: 'Tumor maligno de la mama', nombre: 'Tumor maligno de la mama',
      nombreCorto: 'Cáncer de mama', etiqueta: 'Tumor maligno de la mama (C50)',
      dataKey: 'cancer_mama_c50', marca: 'CANCER_MAMA_C50', pagina: 'cancer_mama_c50.html',
      consulta: 'cancer de mama', cie: 'C50', color: '#FB7185',
      alias: ['tumor maligno de la mama', 'tumores malignos de la mama', 'tumor maligno de mama',
        'cancer de mama', 'cancer de mamas', 'cancer de seno', 'cancer mamario', 'carcinoma de mama',
        'neoplasia maligna de mama', 'c50', 'breast cancer'],
      prefijos: ['cancer de mama', 'cancer de seno', 'cancer mamario', 'tumor maligno de la mama',
        'breast cancer'],
    },
    {
      id: 'cancer_cuello_utero_c53', pad: 'Tumor maligno del cuello del útero',
      nombre: 'Tumor maligno del cuello del útero', nombreCorto: 'Cáncer de cuello del útero',
      etiqueta: 'Tumor maligno del cuello del útero (C53)', dataKey: 'cancer_cuello_utero_c53',
      marca: 'CANCER_CUELLO_UTERO_C53', pagina: 'cancer_cuello_utero_c53.html',
      consulta: 'cancer cervicouterino', cie: 'C53', color: '#A3E635',
      alias: ['tumor maligno del cuello del utero', 'cancer cervicouterino', 'cancer de cuello uterino',
        'cancer de cuello del utero', 'cancer del cuello del utero', 'cancer cervical', 'c53',
        'cervical cancer'],
      prefijos: ['cancer cervicouterino', 'cancer de cuello uterino', 'cancer de cuello del utero',
        'tumor maligno del cuello del utero', 'cervical cancer'],
    },
    {
      id: 'cancer_pulmon_c33', pad: 'Tumor maligno de tráquea, bronquios y pulmón', nombre: 'Tumor maligno de tráquea, bronquios y pulmón', nombreCorto: 'Cáncer de pulmón', etiqueta: 'Tumor maligno de tráquea, bronquios y pulmón (C33-C34)',
      dataKey: 'cancer_pulmon_c33', marca: 'CANCER_PULMON_C33', pagina: 'cancer_pulmon_c33.html', consulta: 'cancer de pulmon', cie: 'C33-C34', color: '#94A3B8',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno de traquea bronquios y pulmon', 'tumor maligno de pulmon', 'cancer de pulmon', 'cancer pulmonar', 'cancer de bronquios', 'c33', 'c34', 'lung cancer'],
      prefijos: ['cancer de pulmon', 'cancer pulmonar', 'tumor maligno de pulmon', 'lung cancer'],
    },
    {
      id: 'cancer_estomago_c16', pad: 'Tumor maligno del estómago', nombre: 'Tumor maligno del estómago', nombreCorto: 'Cáncer de estómago', etiqueta: 'Tumor maligno del estómago (C16)',
      dataKey: 'cancer_estomago_c16', marca: 'CANCER_ESTOMAGO_C16', pagina: 'cancer_estomago_c16.html', consulta: 'cancer de estomago', cie: 'C16', color: '#FCD34D',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del estomago', 'cancer de estomago', 'cancer gastrico', 'c16', 'stomach cancer', 'gastric cancer'],
      prefijos: ['cancer de estomago', 'cancer gastrico', 'stomach cancer', 'gastric cancer'],
    },
    {
      id: 'cancer_colon_c18', pad: 'Tumor maligno del colon y recto', nombre: 'Tumor maligno del colon y recto', nombreCorto: 'Cáncer de colon y recto', etiqueta: 'Tumor maligno del colon y recto (C18-C21)',
      dataKey: 'cancer_colon_c18', marca: 'CANCER_COLON_C18', pagina: 'cancer_colon_c18.html', consulta: 'cancer de colon', cie: 'C18-C21', color: '#FDBA74',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del colon y recto', 'cancer de colon y recto', 'cancer de colon', 'cancer de recto', 'cancer colorrectal', 'c18', 'colorectal cancer', 'colon cancer'],
      prefijos: ['cancer de colon', 'cancer colorrectal', 'cancer de recto', 'colorectal cancer', 'colon cancer'],
    },
    {
      id: 'linfoma_hodgkin_c81', pad: 'Linfoma de Hodgkin', nombre: 'Linfoma de Hodgkin', nombreCorto: 'Linfoma de Hodgkin', etiqueta: 'Linfoma de Hodgkin (C81)',
      dataKey: 'linfoma_hodgkin_c81', marca: 'LINFOMA_HODGKIN_C81', pagina: 'linfoma_hodgkin_c81.html', consulta: 'linfoma de hodgkin', cie: 'C81', color: '#67E8F9',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['linfoma de hodgkin', 'linfoma hodgkin', 'enfermedad de hodgkin', 'c81', 'hodgkin lymphoma'],
      prefijos: ['linfoma de hodgkin', 'linfoma hodgkin', 'hodgkin lymphoma'],
    },
    {
      id: 'linfoma_no_hodgkin_c82', pad: 'Linfoma no Hodgkin', nombre: 'Linfoma no Hodgkin', nombreCorto: 'Linfoma no Hodgkin', etiqueta: 'Linfoma no Hodgkin (C82-C85)',
      dataKey: 'linfoma_no_hodgkin_c82', marca: 'LINFOMA_NO_HODGKIN_C82', pagina: 'linfoma_no_hodgkin_c82.html', consulta: 'linfoma no hodgkin', cie: 'C82-C85', color: '#22D3EE',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['linfoma no hodgkin', 'linfomas no hodgkin', 'c82', 'c85', 'non hodgkin lymphoma'],
      prefijos: ['linfoma no hodgkin', 'linfomas no hodgkin', 'non hodgkin'],
    },
    {
      id: 'leucemia_c91', pad: 'Leucemia', nombre: 'Leucemia', nombreCorto: 'Leucemia', etiqueta: 'Leucemia (C91-C95)',
      dataKey: 'leucemia_c91', marca: 'LEUCEMIA_C91', pagina: 'leucemia_c91.html', consulta: 'leucemia', cie: 'C91-C95', color: '#F43F5E',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['leucemia', 'leucemias', 'c91', 'c95', 'leukemia'],
      prefijos: ['leucemia', 'leukemia'],
    },
    {
      id: 'cancer_pancreas_c26', pad: 'Tumor maligno del páncreas', nombre: 'Tumor maligno del páncreas', nombreCorto: 'Cáncer de páncreas', etiqueta: 'Tumor maligno del páncreas (C26)',
      dataKey: 'cancer_pancreas_c26', marca: 'CANCER_PANCREAS_C26', pagina: 'cancer_pancreas_c26.html', consulta: 'cancer de pancreas', cie: 'C26', color: '#86EFAC',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del pancreas', 'cancer de pancreas', 'c26', 'pancreatic cancer'],
      prefijos: ['cancer de pancreas', 'pancreatic cancer'],
    },
    {
      id: 'cancer_encefalo_c70', pad: 'Tumores malignos del encéfalo y otras partes del sistema nervioso central', nombre: 'Tumores malignos del encéfalo y otras partes del sistema nervioso central', nombreCorto: 'Cáncer de encéfalo y SNC', etiqueta: 'Tumores malignos del encéfalo y otras partes del sistema nervioso central (C70-C72)',
      dataKey: 'cancer_encefalo_c70', marca: 'CANCER_ENCEFALO_C70', pagina: 'cancer_encefalo_c70.html', consulta: 'cancer cerebral', cie: 'C70-C72', color: '#C4B5FD',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumores malignos del encefalo', 'tumor maligno del encefalo', 'cancer cerebral', 'cancer de cerebro', 'cancer del sistema nervioso central', 'tumor cerebral maligno', 'c70', 'c71', 'c72', 'brain cancer'],
      prefijos: ['cancer cerebral', 'cancer de cerebro', 'tumores malignos del encefalo', 'brain cancer'],
    },
    {
      id: 'cancer_cuerpo_utero_c54', pad: 'Tumor maligno del cuerpo del útero', nombre: 'Tumor maligno del cuerpo del útero', nombreCorto: 'Cáncer del cuerpo del útero', etiqueta: 'Tumor maligno del cuerpo del útero (C54)',
      dataKey: 'cancer_cuerpo_utero_c54', marca: 'CANCER_CUERPO_UTERO_C54', pagina: 'cancer_cuerpo_utero_c54.html', consulta: 'cancer de endometrio', cie: 'C54', color: '#E879F9',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del cuerpo del utero', 'cancer del cuerpo del utero', 'cancer de endometrio', 'cancer endometrial', 'c54', 'endometrial cancer'],
      prefijos: ['cancer de endometrio', 'cancer endometrial', 'cancer del cuerpo del utero', 'endometrial cancer'],
    },
    {
      id: 'cancer_ovario_c56', pad: 'Tumor maligno del ovario', nombre: 'Tumor maligno del ovario', nombreCorto: 'Cáncer de ovario', etiqueta: 'Tumor maligno del ovario (C56)',
      dataKey: 'cancer_ovario_c56', marca: 'CANCER_OVARIO_C56', pagina: 'cancer_ovario_c56.html', consulta: 'cancer de ovario', cie: 'C56', color: '#F0ABFC',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del ovario', 'cancer de ovario', 'cancer ovarico', 'c56', 'ovarian cancer'],
      prefijos: ['cancer de ovario', 'cancer ovarico', 'ovarian cancer'],
    },
    {
      id: 'cancer_rinon_c64', pad: 'Tumor maligno del riñón', nombre: 'Tumor maligno del riñón', nombreCorto: 'Tumor maligno del riñón', etiqueta: 'Tumor maligno del riñón (C64)',
      dataKey: 'cancer_rinon_c64', marca: 'CANCER_RINON_C64', pagina: 'cancer_rinon_c64.html', consulta: 'cancer de rinon', cie: 'C64', color: '#4ADE80',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del rinon', 'cancer de rinon', 'cancer renal', 'c64', 'kidney cancer'],
      prefijos: ['cancer de rinon', 'cancer renal', 'kidney cancer'],
    },
    {
      id: 'cancer_prostata_c61', pad: 'Tumor maligno de la próstata', nombre: 'Tumor maligno de la próstata', nombreCorto: 'Tumor maligno de la próstata', etiqueta: 'Tumor maligno de la próstata (C61)',
      dataKey: 'cancer_prostata_c61', marca: 'CANCER_PROSTATA_C61', pagina: 'cancer_prostata_c61.html', consulta: 'cancer de prostata', cie: 'C61', color: '#60A5FA',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno de la prostata', 'cancer de prostata', 'cancer prostatico', 'c61', 'prostate cancer'],
      prefijos: ['cancer de prostata', 'cancer prostatico', 'prostate cancer'],
    },
    {
      id: 'cancer_huesos_c40', pad: 'Tumores malignos de los huesos y de los cartílagos articulares', nombre: 'Tumores malignos de los huesos y de los cartílagos articulares', nombreCorto: 'Tumores malignos de los huesos y de los cartílagos articulares', etiqueta: 'Tumores malignos de los huesos y de los cartílagos articulares (C40-C41)',
      dataKey: 'cancer_huesos_c40', marca: 'CANCER_HUESOS_C40', pagina: 'cancer_huesos_c40.html', consulta: 'cancer de hueso', cie: 'C40-C41', color: '#E5E7EB',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumores malignos de los huesos', 'cancer de hueso', 'cancer de huesos', 'cancer oseo', 'osteosarcoma', 'c40', 'c41', 'bone cancer'],
      prefijos: ['cancer de hueso', 'cancer oseo', 'bone cancer'],
    },
    {
      id: 'cancer_higado_c22', pad: 'Tumor maligno del hígado y de las vías biliares intrahepáticas', nombre: 'Tumor maligno del hígado y de las vías biliares intrahepáticas', nombreCorto: 'Tumor maligno del hígado y de las vías biliares intrahepáticas', etiqueta: 'Tumor maligno del hígado y de las vías biliares intrahepáticas (C22)',
      dataKey: 'cancer_higado_c22', marca: 'CANCER_HIGADO_C22', pagina: 'cancer_higado_c22.html', consulta: 'cancer de higado', cie: 'C22', color: '#EAB308',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del higado', 'cancer de higado', 'cancer hepatico', 'c22', 'liver cancer'],
      prefijos: ['cancer de higado', 'cancer hepatico', 'liver cancer'],
    },
    {
      id: 'cancer_esofago_c15', pad: 'Tumor maligno del esófago', nombre: 'Tumor maligno del esófago', nombreCorto: 'Tumor maligno del esófago', etiqueta: 'Tumor maligno del esófago (C15)',
      dataKey: 'cancer_esofago_c15', marca: 'CANCER_ESOFAGO_C15', pagina: 'cancer_esofago_c15.html', consulta: 'cancer de esofago', cie: 'C15', color: '#FDE68A',
      seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['tumor maligno del esofago', 'cancer de esofago', 'c15', 'esophageal cancer'],
      prefijos: ['cancer de esofago', 'esophageal cancer'],
    },
    {
      id: 'otitis_h65', pad: 'Otitis media aguda', nombre: 'Otitis media aguda', nombreCorto: 'Otitis media aguda',
      etiqueta: 'Otitis media aguda (H65.0-H65.1)', dataKey: 'otitis_h65', marca: 'OTITIS_H65',
      pagina: 'otitis_h65.html', consulta: 'otitis media aguda', cie: 'H65.0-H65.1', color: '#0EA5E9',
      // Sólo nombres del bloque H65.0-H65.1: «infección de oído» no implica otitis media aguda.
      alias: ['otitis media aguda', 'otitis media', 'otitis aguda', 'otitis', 'h65', 'acute otitis media'],
      prefijos: ['otitis'],
    },
    {
      id: 'conjuntivitis_h10', pad: 'Conjuntivitis', nombre: 'Conjuntivitis', nombreCorto: 'Conjuntivitis',
      etiqueta: 'Conjuntivitis (H10)', dataKey: 'conjuntivitis_h10', marca: 'CONJUNTIVITIS_H10',
      pagina: 'conjuntivitis_h10.html', consulta: 'conjuntivitis', cie: 'H10', color: '#93C5FD',
      // «ojo rojo» no implica conjuntivitis H10; la viral y la hemorrágica (B30) son ajenas.
      alias: ['conjuntivitis', 'h10', 'conjunctivitis'],
      prefijos: ['conjuntivit', 'conjunctivit'],
    },
    {
      id: 'amebiasis_a06', pad: 'Amebiasis intestinal', nombre: 'Amebiasis intestinal',
      nombreCorto: 'Amebiasis intestinal', etiqueta: 'Amebiasis intestinal (A06.0-A06.3, A06.9)',
      dataKey: 'amebiasis_a06', marca: 'AMEBIASIS_A06', pagina: 'amebiasis_a06.html',
      consulta: 'amebiasis intestinal', cie: 'A06.0-A06.3, A06.9', color: '#B45309',
      alias: ['amebiasis intestinal', 'amebiasis', 'amibiasis', 'disenteria amebiana', 'a06',
        'intestinal amoebiasis', 'amoebiasis', 'amebic dysentery'],
      prefijos: ['amebiasis', 'amibiasis', 'amoebiasis', 'disenteria amebiana'],
    },
    {
      id: 'vehiculos_v20', pad: 'Accidente de transporte en vehículos con motor',
      nombre: 'Accidente de transporte en vehículos con motor', nombreCorto: 'Accidentes en vehículos con motor',
      etiqueta: 'Accidente de transporte en vehículos con motor (V20-V29, V40-V79)', dataKey: 'vehiculos_v20',
      marca: 'VEHICULOS_V20', pagina: 'vehiculos_v20.html', consulta: 'accidentes en vehiculos con motor',
      cie: 'V20-V29, V40-V79', color: '#64748B',
      // Sólo el bloque V20-V29, V40-V79: «accidente de tránsito» a secas incluye peatones (V01-V09),
      // ciclistas (V10-V19) y otros transportes, que el bloque no cubre.
      alias: ['accidente de transporte en vehiculos con motor', 'accidentes de transporte en vehiculos con motor',
        'accidentes en vehiculos con motor', 'accidente en vehiculo con motor', 'vehiculos con motor',
        'vehiculos de motor', 'v20', 'motor vehicle accidents', 'motor vehicle accident'],
      prefijos: ['vehiculos con motor', 'vehiculos de motor', 'motor vehicle accident'],
    },
    {
      id: 'embarazo_hipertensivos_o10',
      pad: 'Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio',
      nombre: 'Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio',
      nombreCorto: 'Hipertensión en el embarazo',
      etiqueta: 'Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio (O10-O16)',
      dataKey: 'embarazo_hipertensivos_o10', marca: 'EMBARAZO_HIPERTENSIVOS_O10',
      pagina: 'embarazo_hipertensivos_o10.html', consulta: 'trastornos hipertensivos del embarazo',
      cie: 'O10-O16', color: '#BE123C',
      // Toda consulta con un término de hipertensión y otro del embarazo llega aquí como
      // «trastornos hipertensivos del embarazo» (canonClinico), sin dejar el término de hipertensión.
      alias: ['trastornos hipertensivos del embarazo', 'trastornos hipertensivos en el embarazo',
        'preeclampsia', 'eclampsia', 'o10', 'o16', 'hypertensive disorders of pregnancy'],
      prefijos: ['trastornos hipertensivos del embarazo', 'trastornos hipertensivos en el embarazo',
        'preeclamps', 'eclamps', 'hypertensive disorders of pregnancy'],
    },
    {
      id: 'alimentaria_a05', pad: 'Intoxicación alimentaria bacteriana', nombre: 'Intoxicación alimentaria bacteriana',
      nombreCorto: 'Intoxicación alimentaria', etiqueta: 'Intoxicación alimentaria bacteriana (A05)',
      dataKey: 'alimentaria_a05', marca: 'ALIMENTARIA_A05', pagina: 'alimentaria_a05.html',
      consulta: 'intoxicacion alimentaria bacteriana', cie: 'A05', color: '#F59E0B',
      alias: ['intoxicacion alimentaria bacteriana', 'intoxicaciones alimentarias bacterianas',
        'intoxicacion alimentaria', 'intoxicaciones alimentarias', 'a05', 'bacterial food poisoning'],
      prefijos: ['intoxicacion alimentaria', 'intoxicaciones alimentarias', 'bacterial food poisoning'],
    },
    {
      id: 'shigelosis_a03', pad: 'Shigelosis', nombre: 'Shigelosis', nombreCorto: 'Shigelosis',
      etiqueta: 'Shigelosis (A03)', dataKey: 'shigelosis_a03', marca: 'SHIGELOSIS_A03', pagina: 'shigelosis_a03.html',
      consulta: 'shigelosis', cie: 'A03', color: '#84CC16',
      alias: ['shigelosis', 'shigellosis', 'disenteria bacilar', 'a03', 'bacillary dysentery'],
      prefijos: ['shigelosis', 'shigellosis', 'disenteria bacilar'],
    },
    {
      id: 'erisipela_a46', pad: 'Erisipela', nombre: 'Erisipela', nombreCorto: 'Erisipela',
      etiqueta: 'Erisipela (A46)', dataKey: 'erisipela_a46', marca: 'ERISIPELA_A46', pagina: 'erisipela_a46.html',
      consulta: 'erisipela', cie: 'A46', color: '#EF4444',
      // Sin prefijo «erisipel»: el erisipeloide (A26) es otra enfermedad.
      alias: ['erisipela', 'erisipelas', 'a46', 'erysipelas'],
      prefijos: [],
    },
    {
      id: 'candidiasis_b37', pad: 'Candidiasis urogenital', nombre: 'Candidiasis urogenital',
      nombreCorto: 'Candidiasis urogenital', etiqueta: 'Candidiasis urogenital (B37.3-B37.4)',
      dataKey: 'candidiasis_b37', marca: 'CANDIDIASIS_B37', pagina: 'candidiasis_b37.html',
      consulta: 'candidiasis urogenital', cie: 'B37.3-B37.4', color: '#C084FC',
      // B37.3 es la de vulva y vagina; «candidiasis» a secas incluye la oral, la cutánea y la sistémica.
      alias: ['candidiasis urogenital', 'candidiasis vaginal', 'candidiasis vulvovaginal',
        'candidiasis de vulva y vagina', 'candidiasis genital', 'b37 3', 'b37 4', 'urogenital candidiasis',
        'vaginal candidiasis'],
      prefijos: ['candidiasis urogenital', 'candidiasis vaginal', 'candidiasis vulvovaginal',
        'candidiasis genital'],
    },
    {
      id: 'embarazo_diabetes_o24', pad: 'Diabetes mellitus en el embarazo', nombre: 'Diabetes mellitus en el embarazo',
      nombreCorto: 'Diabetes en el embarazo', etiqueta: 'Diabetes mellitus en el embarazo (O24.4)',
      dataKey: 'embarazo_diabetes_o24', marca: 'EMBARAZO_DIABETES_O24', pagina: 'embarazo_diabetes_o24.html',
      consulta: 'diabetes mellitus en el embarazo', cie: 'O24.4', color: '#0D9488',
      // O24.4 es la diabetes que se origina en el embarazo (gestacional); la preexistente es O24.0-O24.3.
      alias: ['diabetes mellitus en el embarazo', 'diabetes en el embarazo', 'diabetes del embarazo',
        'diabetes gestacional', 'diabetes mellitus gestacional', 'o24 4', 'gestational diabetes'],
      prefijos: ['diabetes mellitus en el embarazo', 'diabetes gestacional', 'gestational diabetes'],
    },
    // Diez controles estacionales publicados tras el rechazo de 2025 por autorización nominal del autor
    // (12-nov-2026): nunca validados. `controlEstatalPocoInformativo` marca los tres cuyo error del
    // control en las series base en esa prueba fue muy alto (sMAPE 97.3, 84.8 y 71.0).
    {
      id: 'quemaduras_t20', pad: 'Quemaduras', nombre: 'Quemaduras', nombreCorto: 'Quemaduras',
      etiqueta: 'Quemaduras (T20-T32)', dataKey: 'quemaduras_t20', marca: 'QUEMADURAS_T20', pagina: 'quemaduras_t20.html',
      consulta: 'quemaduras', cie: 'T20-T32', color: '#FB923C',
      alias: ['quemaduras', 'quemadura', 't20', 't31', 'burns', 'burn injuries'],
      prefijos: ['quemadura', 'burn injur'],
    },
    {
      id: 'ivp_i87', pad: 'Insuficiencia venosa periférica', nombre: 'Insuficiencia venosa periférica',
      nombreCorto: 'Insuficiencia venosa periférica', etiqueta: 'Insuficiencia venosa periférica (I87.2)',
      dataKey: 'ivp_i87', marca: 'IVP_I87', pagina: 'ivp_i87.html', consulta: 'insuficiencia venosa periferica',
      cie: 'I87.2', color: '#7C3AED',
      alias: ['insuficiencia venosa periferica', 'insuficiencia venosa', 'i87 2', 'venous insufficiency'],
      prefijos: ['insuficiencia venosa', 'venous insufficiency'],
    },
    {
      id: 'hiperplasia_prostata_n40', pad: 'Hiperplasia de la próstata', nombre: 'Hiperplasia de la próstata',
      nombreCorto: 'Hiperplasia de la próstata', etiqueta: 'Hiperplasia de la próstata (N40)',
      dataKey: 'hiperplasia_prostata_n40', marca: 'HIPERPLASIA_PROSTATA_N40', pagina: 'hiperplasia_prostata_n40.html',
      consulta: 'hiperplasia de la prostata', cie: 'N40', color: '#0284C7',
      alias: ['hiperplasia de la prostata', 'hiperplasia de prostata', 'hiperplasia prostatica', 'hiperplasia benigna de prostata',
        'hiperplasia prostatica benigna', 'n40', 'benign prostatic hyperplasia', 'prostatic hyperplasia'],
      prefijos: ['hiperplasia de la prostata', 'hiperplasia prostatica', 'hiperplasia benigna', 'prostatic hyperplasia'],
    },
    {
      id: 'escabiosis_b86', pad: 'Escabiosis', nombre: 'Escabiosis', nombreCorto: 'Escabiosis',
      etiqueta: 'Escabiosis (B86)', dataKey: 'escabiosis_b86', marca: 'ESCABIOSIS_B86', pagina: 'escabiosis_b86.html',
      consulta: 'escabiosis', cie: 'B86', color: '#78716C',
      alias: ['escabiosis', 'sarna', 'b86', 'scabies'],
      prefijos: ['escabiosis', 'scabies'],
    },
    {
      id: 'protozoarios_a07', pad: 'Otras infecciones intestinales debidas a protozoarios',
      nombre: 'Otras infecciones intestinales debidas a protozoarios', nombreCorto: 'Otras protozoosis intestinales',
      etiqueta: 'Otras infecciones intestinales debidas a protozoarios (A07.0, A07.2, A07.9)',
      dataKey: 'protozoarios_a07', marca: 'PROTOZOARIOS_A07', pagina: 'protozoarios_a07.html',
      consulta: 'otras infecciones intestinales debidas a protozoarios', cie: 'A07.0, A07.2, A07.9', color: '#CA8A04',
      controlEstatalPocoInformativo: true,
      // La giardiasis (A07.1) y las demás protozoosis con código propio quedan fuera del bloque.
      alias: ['otras protozoosis intestinales', 'balantidiasis',
        'criptosporidiosis', 'a07 0', 'a07 2', 'a07 9', 'intestinal protozoal infections'],
      prefijos: ['otras protozoosis intestinales'],
    },
    {
      id: 'faringitis_j02', pad: 'Faringitis y amigdalitis estreptocócicas', nombre: 'Faringitis y amigdalitis estreptocócicas',
      nombreCorto: 'Faringitis estreptocócica', etiqueta: 'Faringitis y amigdalitis estreptocócicas (J02.0, J03.0)',
      dataKey: 'faringitis_j02', marca: 'FARINGITIS_J02', pagina: 'faringitis_j02.html',
      consulta: 'faringitis y amigdalitis estreptococicas', cie: 'J02.0, J03.0', color: '#FB7185',
      alias: ['faringitis y amigdalitis estreptococicas', 'faringitis estreptococica', 'faringitis estreptococicas',
        'amigdalitis estreptococica', 'amigdalitis estreptococicas', 'faringoamigdalitis estreptococica',
        'faringitis por estreptococo', 'j02 0', 'j03 0', 'strep throat', 'streptococcal pharyngitis',
        'streptococcal tonsillitis'],
      prefijos: ['faringitis estreptococ', 'amigdalitis estreptococ', 'faringoamigdalitis estreptococ',
        'streptococcal pharyngitis', 'streptococcal tonsillitis'],
    },
    {
      id: 'peaton_v01', pad: 'Peatón lesionado en accidente de transporte', nombre: 'Peatón lesionado en accidente de transporte',
      nombreCorto: 'Peatón lesionado', etiqueta: 'Peatón lesionado en accidente de transporte (V01-V09)',
      dataKey: 'peaton_v01', marca: 'PEATON_V01', pagina: 'peaton_v01.html',
      consulta: 'peaton lesionado en accidente de transporte', cie: 'V01-V09', color: '#475569',
      controlEstatalPocoInformativo: true,
      alias: ['peaton lesionado en accidente de transporte', 'peatones lesionados en accidentes de transporte',
        'peaton lesionado', 'peatones lesionados', 'peatones atropellados', 'peaton atropellado',
        'atropellamientos', 'atropellamiento', 'atropellados', 'atropellado', 'v01', 'pedestrian injured',
        'pedestrians injured', 'pedestrian injuries'],
      prefijos: ['peaton lesionado', 'peatones lesionados', 'atropell', 'pedestrian injur'],
    },
    {
      id: 'displasia_leve_n87', pad: 'Displasia cervical leve y moderada', nombre: 'Displasia cervical leve y moderada',
      nombreCorto: 'Displasia cervical leve y moderada', etiqueta: 'Displasia cervical leve y moderada (N87.0-N87.1)',
      dataKey: 'displasia_leve_n87', marca: 'DISPLASIA_LEVE_N87', pagina: 'displasia_leve_n87.html',
      consulta: 'displasia cervical leve y moderada', cie: 'N87.0-N87.1', color: '#F9A8D4',
      alias: ['displasia cervical leve y moderada', 'displasia cervical leve', 'displasia cervical moderada',
        'displasia leve y moderada', 'displasia leve', 'displasia moderada', 'n87 0', 'n87 1',
        'mild cervical dysplasia', 'moderate cervical dysplasia'],
      prefijos: ['displasia cervical leve', 'displasia cervical moderada', 'mild cervical dysplasia',
        'moderate cervical dysplasia'],
    },
    {
      id: 'varicela_b01', pad: 'Varicela', nombre: 'Varicela', nombreCorto: 'Varicela',
      etiqueta: 'Varicela (B01)', dataKey: 'varicela_b01', marca: 'VARICELA_B01', pagina: 'varicela_b01.html',
      consulta: 'varicela', cie: 'B01', color: '#D946EF',
      alias: ['varicela', 'b01', 'chickenpox', 'chicken pox', 'varicella'],
      prefijos: ['varicela', 'chickenpox', 'varicella'],
    },
    {
      id: 'parotiditis_b26', pad: 'Parotiditis infecciosa', nombre: 'Parotiditis infecciosa', nombreCorto: 'Parotiditis',
      etiqueta: 'Parotiditis infecciosa (B26)', dataKey: 'parotiditis_b26', marca: 'PAROTIDITIS_B26',
      pagina: 'parotiditis_b26.html', consulta: 'parotiditis infecciosa', cie: 'B26', color: '#C084FC',
      controlEstatalPocoInformativo: true,
      alias: ['parotiditis infecciosa', 'parotiditis', 'paperas', 'b26', 'mumps'],
      prefijos: ['parotiditis', 'paperas', 'mumps'],
    },
    // Aceptados en la prueba única de 2025 con la política de cinco motores (lote alta10b, 12-nov-2026).
    {
      id: 'ascariasis_b77', pad: 'Ascariasis', nombre: 'Ascariasis', nombreCorto: 'Ascariasis',
      etiqueta: 'Ascariasis (B77)', dataKey: 'ascariasis_b77', marca: 'ASCARIASIS_B77', pagina: 'ascariasis_b77.html',
      consulta: 'ascariasis', cie: 'B77', color: '#9333EA',
      alias: ['ascariasis', 'ascaridiasis', 'ascaris', 'b77'],
      prefijos: ['ascariasis', 'ascaridiasis', 'ascaris'],
    },
    {
      id: 'hepatitis_a_b15', pad: 'Hepatitis vírica A', nombre: 'Hepatitis vírica A', nombreCorto: 'Hepatitis A',
      etiqueta: 'Hepatitis vírica A (B15)', dataKey: 'hepatitis_a_b15', marca: 'HEPATITIS_A_B15',
      pagina: 'hepatitis_a_b15.html', consulta: 'hepatitis virica a', cie: 'B15', color: '#DC2626',
      // La letra suelta va con espacio final: nombraAlias compara por prefijo y «hepatitis virica a»
      // capturaría «hepatitis virica aguda».
      alias: ['hepatitis virica a ', 'b15'],
      prefijos: ['hepatitis virica a '],
    },
    {
      id: 'calor_t67', pad: 'Efectos del calor y de la luz', nombre: 'Efectos del calor y de la luz',
      nombreCorto: 'Efectos del calor', etiqueta: 'Efectos del calor y de la luz (T67, X30)',
      dataKey: 'calor_t67', marca: 'CALOR_T67', pagina: 'calor_t67.html',
      consulta: 'efectos del calor y de la luz', cie: 'T67, X30', color: '#EA580C',
      alias: ['efectos del calor y de la luz', 'efectos del calor', 'golpe de calor', 'golpes de calor',
        'insolacion', 'agotamiento por calor', 'sincope por calor', 'calor natural excesivo', 't67', 'x30',
        'heat stroke', 'heatstroke', 'heat exhaustion', 'effects of heat'],
      prefijos: ['efectos del calor', 'golpe de calor', 'golpes de calor', 'insolacion', 'agotamiento por calor',
        'heat stroke', 'heatstroke', 'heat exhaustion'],
    },
    {
      id: 'otras_hepatitis_b17', pad: 'Otras hepatitis víricas', nombre: 'Otras hepatitis víricas',
      nombreCorto: 'Otras hepatitis víricas', etiqueta: 'Otras hepatitis víricas (B17-B19, excepto B17.1 y B18.2)',
      dataKey: 'otras_hepatitis_b17', marca: 'OTRAS_HEPATITIS_B17', pagina: 'otras_hepatitis_b17.html',
      consulta: 'otras hepatitis viricas', cie: 'B17.0, B17.2-B17.9, B18.0-B18.1, B18.8-B18.9, B19', color: '#4F46E5',
      // Incluye la hepatitis B crónica (B18.0-B18.1) y la D y E agudas (B17.0, B17.2); la B aguda (B16) es otro
      // bloque del boletín, con su propio control estacional (hepatitis_b_b16).
      alias: ['otras hepatitis viricas', 'otras hepatitis virales', 'hepatitis virica d ', 'hepatitis virica e ',
        'hepatitis viral no especificada', 'b17 0', 'b17 2', 'b17 8', 'b17 9',
        'b18 0', 'b18 1', 'b18 8', 'b18 9', 'b19'],
      prefijos: ['otras hepatitis viricas', 'otras hepatitis virales'],
    },
    // Controles estacionales del lote alta10b (12-nov-2026): rechazo de 2025 en el total nacional y
    // publicación del control por autorización nominal del autor (A6), nunca validados.
    {
      id: 'desnutricion_leve_e441', pad: 'Desnutrición leve', nombre: 'Desnutrición leve', nombreCorto: 'Desnutrición leve',
      etiqueta: 'Desnutrición leve (E44.1)', dataKey: 'desnutricion_leve_e441', marca: 'DESNUTRICION_LEVE_E441',
      pagina: 'desnutricion_leve_e441.html', consulta: 'desnutricion leve', cie: 'E44.1', color: '#A16207',
      alias: ['desnutricion leve', 'desnutricion grado leve', 'desnutricion de grado leve', 'e44 1',
        'mild malnutrition', 'mild undernutrition'],
      prefijos: ['desnutricion leve', 'desnutricion grado leve', 'mild malnutrition', 'mild undernutrition'],
    },
    {
      id: 'salmonelosis_a02', pad: 'Otras salmonelosis', nombre: 'Otras salmonelosis', nombreCorto: 'Otras salmonelosis',
      etiqueta: 'Otras salmonelosis (A02)', dataKey: 'salmonelosis_a02', marca: 'SALMONELOSIS_A02',
      pagina: 'salmonelosis_a02.html', consulta: 'otras salmonelosis', cie: 'A02', color: '#0891B2',
      controlEstatalPocoInformativo: true,
      // La fiebre tifoidea (A01.0) y la paratifoidea (A01.1-A01.4) son bloques propios, fuera de A02.
      alias: ['otras salmonelosis', 'salmonelosis', 'salmonella', 'salmonela', 'a02', 'salmonellosis'],
      prefijos: ['salmonelosis', 'salmonella', 'salmonela', 'salmonellosis'],
    },
    {
      id: 'tifoidea_a01', pad: 'Fiebre tifoidea', nombre: 'Fiebre tifoidea', nombreCorto: 'Fiebre tifoidea',
      etiqueta: 'Fiebre tifoidea (A01.0)', dataKey: 'tifoidea_a01', marca: 'TIFOIDEA_A01',
      pagina: 'tifoidea_a01.html', consulta: 'fiebre tifoidea', cie: 'A01.0', color: '#E11D48',
      controlEstatalPocoInformativo: true,
      alias: ['fiebre tifoidea', 'tifoidea', 'tifoidea abdominal', 'a01 0', 'typhoid fever', 'typhoid'],
      prefijos: ['fiebre tifoidea', 'tifoidea', 'typhoid'],
    },
    {
      id: 'escarlatina_a38', pad: 'Escarlatina', nombre: 'Escarlatina', nombreCorto: 'Escarlatina',
      etiqueta: 'Escarlatina (A38)', dataKey: 'escarlatina_a38', marca: 'ESCARLATINA_A38',
      pagina: 'escarlatina_a38.html', consulta: 'escarlatina', cie: 'A38', color: '#7E22CE',
      controlEstatalPocoInformativo: true,
      alias: ['escarlatina', 'fiebre escarlatina', 'a38', 'scarlet fever', 'scarlatina'],
      prefijos: ['escarlatina', 'scarlet fever', 'scarlatina'],
    },
    {
      id: 'hepatitis_c_b17', pad: 'Hepatitis vírica C', nombre: 'Hepatitis vírica C', nombreCorto: 'Hepatitis C',
      etiqueta: 'Hepatitis vírica C (B17.1, B18.2)', dataKey: 'hepatitis_c_b17', marca: 'HEPATITIS_C_B17',
      pagina: 'hepatitis_c_b17.html', consulta: 'hepatitis virica c', cie: 'B17.1, B18.2', color: '#BE185D',
      controlEstatalPocoInformativo: true,
      // Las demás hepatitis víricas tienen código propio (B15, B16, B17.0, B17.2-B17.9): no reciben estas cifras.
      alias: ['hepatitis virica c ', 'b17 1', 'b18 2'],
      prefijos: ['hepatitis virica c '],
    },
    {
      id: 'displasia_severa_n87', pad: 'Displasia cervical severa y CaCu in situ',
      nombre: 'Displasia cervical severa y CaCu in situ', nombreCorto: 'Displasia cervical severa y CaCu in situ',
      etiqueta: 'Displasia cervical severa y CaCu in situ (N87.2, D06)', dataKey: 'displasia_severa_n87',
      marca: 'DISPLASIA_SEVERA_N87', pagina: 'displasia_severa_n87.html',
      consulta: 'displasia cervical severa', cie: 'N87.2, D06', color: '#65A30D',
      controlEstatalPocoInformativo: true,
      alias: ['displasia cervical severa y cacu in situ', 'displasia cervical severa', 'displasia cervical grave',
        'displasia severa', 'displasia grave', 'cacu in situ', 'carcinoma in situ del cuello del utero',
        'n87 2', 'd06', 'severe cervical dysplasia'],
      prefijos: ['displasia cervical severa', 'displasia cervical grave', 'displasia severa', 'displasia grave',
        'cacu in situ', 'severe cervical dysplasia'],
    },
    // Controles estacionales de alta20c (15-nov-2026): rechazo de 2025 en el total nacional y publicación del control
    // por un dictamen tomado bajo delegación del autor (controlDelegado), nunca validados.
    {
      id: 'brucelosis_a23', controlDelegado: true, pad: 'Brucelosis', nombre: 'Brucelosis', nombreCorto: 'Brucelosis',
      etiqueta: 'Brucelosis (A23)', dataKey: 'brucelosis_a23', marca: 'BRUCELOSIS_A23', pagina: 'brucelosis_a23.html',
      consulta: 'brucelosis', cie: 'A23', color: '#4D7C0F',
      alias: ['brucelosis', 'fiebre de malta', 'fiebre ondulante', 'fiebre mediterranea', 'a23', 'brucellosis',
        'malta fever', 'undulant fever'],
      prefijos: ['brucelosis', 'fiebre de malta', 'fiebre ondulante', 'fiebre mediterranea', 'brucellosis'],
    },
    {
      id: 'reumatica_i00', controlDelegado: true, pad: 'Fiebre reumática aguda', nombre: 'Fiebre reumática aguda', nombreCorto: 'Fiebre reumática',
      etiqueta: 'Fiebre reumática aguda (I00-I02)', dataKey: 'reumatica_i00', marca: 'REUMATICA_I00',
      pagina: 'reumatica_i00.html', consulta: 'fiebre reumatica aguda', cie: 'I00-I02', color: '#BE123C',
      // La cardiopatía reumática crónica (I05-I09) tiene código propio y no está en este bloque.
      alias: ['fiebre reumatica aguda', 'fiebre reumatica', 'corea de sydenham', 'i00', 'i01', 'i02',
        'acute rheumatic fever', 'rheumatic fever'],
      prefijos: ['fiebre reumatica', 'corea de sydenham', 'acute rheumatic fever', 'rheumatic fever'],
    },
    {
      id: 'bocio_e01', controlDelegado: true, pad: 'Bocio endémico', nombre: 'Bocio endémico', nombreCorto: 'Bocio endémico',
      etiqueta: 'Bocio endémico (E01)', dataKey: 'bocio_e01', marca: 'BOCIO_E01', pagina: 'bocio_e01.html',
      consulta: 'bocio endemico', cie: 'E01', color: '#0F766E',
      alias: ['bocio endemico', 'bocio por deficiencia de yodo', 'e01', 'endemic goiter', 'endemic goitre'],
      prefijos: ['bocio endemico', 'bocio por deficiencia de yodo', 'endemic goiter', 'endemic goitre'],
    },
    {
      id: 'hepatitis_b_b16', controlDelegado: true, pad: 'Hepatitis vírica B', nombre: 'Hepatitis vírica B', nombreCorto: 'Hepatitis B',
      etiqueta: 'Hepatitis vírica B aguda (B16)', dataKey: 'hepatitis_b_b16', marca: 'HEPATITIS_B_B16',
      pagina: 'hepatitis_b_b16.html', consulta: 'hepatitis virica b aguda', cie: 'B16', color: '#EA580C',
      // Sólo la aguda (B16). La crónica (B18.0-B18.1) se cuenta dentro de otras hepatitis víricas; «hepatitis B» a
      // secas pide precisar (ALIAS_AMBIGUOS).
      alias: ['hepatitis virica b aguda', 'hepatitis virica b', 'b16', 'acute hepatitis b'],
      prefijos: ['hepatitis virica b'],
    },
    {
      id: 'rotavirus_a080', controlDelegado: true, pad: 'Enteritis debida a rotavirus', nombre: 'Enteritis debida a rotavirus',
      nombreCorto: 'Rotavirus', etiqueta: 'Enteritis debida a rotavirus (A08.0)', dataKey: 'rotavirus_a080',
      marca: 'ROTAVIRUS_A080', pagina: 'rotavirus_a080.html', consulta: 'enteritis por rotavirus', cie: 'A08.0',
      color: '#B91C1C',
      alias: ['enteritis debida a rotavirus', 'enteritis por rotavirus', 'rotavirus', 'a08 0', 'rotaviral enteritis'],
      prefijos: ['enteritis debida a rotavirus', 'enteritis por rotavirus', 'rotavirus', 'rotaviral enteritis'],
    },
    {
      id: 'absceso_hepatico_a064', controlDelegado: true, pad: 'Absceso hepático amebiano', nombre: 'Absceso hepático amebiano',
      nombreCorto: 'Absceso hepático amebiano', etiqueta: 'Absceso hepático amebiano (A06.4)',
      dataKey: 'absceso_hepatico_a064', marca: 'ABSCESO_HEPATICO_A064', pagina: 'absceso_hepatico_a064.html',
      consulta: 'absceso hepatico amebiano', cie: 'A06.4', color: '#9A3412',
      alias: ['absceso hepatico amebiano', 'absceso hepatico amibiano', 'absceso amebiano del higado',
        'absceso amebiano hepatico', 'a06 4', 'amebic liver abscess', 'amoebic liver abscess'],
      prefijos: ['absceso hepatico amebiano', 'absceso hepatico amibiano', 'absceso amebiano', 'amebic liver abscess',
        'amoebic liver abscess'],
    },
    {
      id: 'leptospirosis_a27', controlDelegado: true, pad: 'Leptospirosis', nombre: 'Leptospirosis', nombreCorto: 'Leptospirosis',
      etiqueta: 'Leptospirosis (A27)', dataKey: 'leptospirosis_a27', marca: 'LEPTOSPIROSIS_A27',
      pagina: 'leptospirosis_a27.html', consulta: 'leptospirosis', cie: 'A27', color: '#0E7490',
      alias: ['leptospirosis', 'enfermedad de weil', 'a27', 'weil disease'],
      prefijos: ['leptospirosis', 'enfermedad de weil', 'weil disease'],
    },
    {
      id: 'helmintiasis_b65', controlDelegado: true, pad: 'Otras helmintiasis', nombre: 'Otras helmintiasis', nombreCorto: 'Otras helmintiasis',
      etiqueta: 'Otras helmintiasis (B65-B67, B70-B76, B78, B79, B81-B83, excepto B73 y B75)',
      dataKey: 'helmintiasis_b65', marca: 'HELMINTIASIS_B65', pagina: 'helmintiasis_b65.html',
      consulta: 'otras helmintiasis', cie: 'B65-B67, B70-B72, B74, B76, B78-B79, B81-B83', color: '#65A30D',
      // La ascariasis (B77) y la enterobiasis (B80) son bloques propios; «helmintiasis» o «lombrices» a secas piden precisar.
      alias: ['otras helmintiasis', 'b65', 'b66', 'b67', 'b70', 'b71', 'b72', 'b74', 'b76', 'b78', 'b79', 'b81', 'b82', 'b83'],
      prefijos: ['otras helmintiasis'],
    },
    {
      id: 'desnutricion_moderada_e440', controlDelegado: true, pad: 'Desnutrición moderada', nombre: 'Desnutrición moderada',
      nombreCorto: 'Desnutrición moderada', etiqueta: 'Desnutrición moderada (E44.0)',
      dataKey: 'desnutricion_moderada_e440', marca: 'DESNUTRICION_MODERADA_E440', pagina: 'desnutricion_moderada_e440.html',
      consulta: 'desnutricion moderada', cie: 'E44.0', color: '#B45309', controlEstatalPocoInformativo: true,
      alias: ['desnutricion moderada', 'desnutricion grado moderado', 'desnutricion de grado moderado', 'e44 0',
        'moderate malnutrition', 'moderate undernutrition'],
      prefijos: ['desnutricion moderada', 'desnutricion grado moderado', 'moderate malnutrition', 'moderate undernutrition'],
    },
    {
      id: 'desnutricion_severa_e40', controlDelegado: true, pad: 'Desnutrición severa', nombre: 'Desnutrición severa',
      nombreCorto: 'Desnutrición severa', etiqueta: 'Desnutrición severa (E40-E43)',
      dataKey: 'desnutricion_severa_e40', marca: 'DESNUTRICION_SEVERA_E40', pagina: 'desnutricion_severa_e40.html',
      consulta: 'desnutricion severa', cie: 'E40-E43', color: '#92400E', controlEstatalPocoInformativo: true,
      alias: ['desnutricion severa', 'desnutricion grave', 'desnutricion calorico proteica severa', 'kwashiorkor',
        'marasmo', 'marasmus', 'e40', 'e41', 'e42', 'e43', 'severe malnutrition', 'severe undernutrition'],
      prefijos: ['desnutricion severa', 'desnutricion grave', 'kwashiorkor', 'marasmo', 'marasmus', 'severe malnutrition',
        'severe undernutrition'],
    },
    {
      id: 'enterobiasis_b80', controlDelegado: true, pad: 'Enterobiasis', nombre: 'Enterobiasis', nombreCorto: 'Enterobiasis',
      etiqueta: 'Enterobiasis (B80)', dataKey: 'enterobiasis_b80', marca: 'ENTEROBIASIS_B80',
      pagina: 'enterobiasis_b80.html', consulta: 'enterobiasis', cie: 'B80', color: '#84CC16',
      controlEstatalPocoInformativo: true,
      alias: ['enterobiasis', 'oxiuriasis', 'oxiuros', 'b80', 'pinworm', 'pinworms'],
      prefijos: ['enterobiasis', 'oxiuriasis', 'oxiuros', 'pinworm'],
    },
    {
      id: 'giardiasis_a071', controlDelegado: true, pad: 'Giardiasis', nombre: 'Giardiasis', nombreCorto: 'Giardiasis',
      etiqueta: 'Giardiasis (A07.1)', dataKey: 'giardiasis_a071', marca: 'GIARDIASIS_A071',
      pagina: 'giardiasis_a071.html', consulta: 'giardiasis', cie: 'A07.1', color: '#BEF264',
      controlEstatalPocoInformativo: true,
      alias: ['giardiasis', 'giardia', 'lambliasis', 'a07 1', 'giardiosis'],
      prefijos: ['giardiasis', 'giardia', 'lambliasis', 'giardiosis'],
    },
    // Aceptada en su prueba única de 2025 (alta20c, 15-nov-2026): validación prospectiva en curso, nunca PASS.
    {
      id: 'paratifoidea_a011', pad: 'Fiebre paratifoidea', nombre: 'Fiebre paratifoidea', nombreCorto: 'Fiebre paratifoidea',
      etiqueta: 'Fiebre paratifoidea (A01.1-A01.4)', dataKey: 'paratifoidea_a011', marca: 'PARATIFOIDEA_A011',
      pagina: 'paratifoidea_a011.html', consulta: 'fiebre paratifoidea', cie: 'A01.1-A01.4', color: '#B45309',
      // «Tifoidea» a secas es A01.0 (fiebre tifoidea) y «salmonelosis» es A02: no reciben estas cifras.
      alias: ['fiebre paratifoidea', 'paratifoidea', 'a01 1', 'a01 2', 'a01 3', 'a01 4', 'paratyphoid fever', 'paratyphoid'],
      prefijos: ['fiebre paratifoidea', 'paratifoidea', 'paratyphoid'],
    },
    {
      id: 'mal_del_pinto_a67', pad: 'Mal del pinto', nombre: 'Mal del pinto', nombreCorto: 'Mal del pinto',
      etiqueta: 'Mal del pinto (A67)', dataKey: 'mal_del_pinto_a67', marca: 'MAL_DEL_PINTO_A67',
      pagina: 'mal_del_pinto_a67.html', consulta: 'mal del pinto', cie: 'A67', color: '#155E75',
      // Sin «pinta» suelta: es una palabra común («¿cómo pinta…?»).
      alias: ['mal del pinto', 'a67'],
      prefijos: ['mal del pinto'],
    },
    {
      id: 'vulvovaginitis_n76', pad: 'Vulvovaginitis', nombre: 'Vulvovaginitis', nombreCorto: 'Vulvovaginitis',
      etiqueta: 'Vulvovaginitis (N76)', dataKey: 'vulvovaginitis_n76', marca: 'VULVOVAGINITIS_N76',
      pagina: 'vulvovaginitis_n76.html', consulta: 'vulvovaginitis', cie: 'N76', color: '#DB2777',
      // Sin desglose por sexo (37 series). «Vaginitis» y la vulvovaginitis con agente nombrado piden precisar: la
      // candidiasis urogenital (B37.3-B37.4) es otro bloque publicado y la tricomoniasis no se modela.
      alias: ['vulvovaginitis', 'vulvovaginitis inespecifica', 'n76'],
      prefijos: ['vulvovaginitis'],
    },
    // Cinco controles nuevos de alta20c (dictamen delegado complementario, 15-nov-2026), nunca validados.
    {
      id: 'coqueluchoide_u99', controlDelegado: true, pad: 'Síndrome coqueluchoide', nombre: 'Síndrome coqueluchoide',
      nombreCorto: 'Síndrome coqueluchoide', etiqueta: 'Síndrome coqueluchoide (U99)', dataKey: 'coqueluchoide_u99',
      marca: 'COQUELUCHOIDE_U99', pagina: 'coqueluchoide_u99.html', consulta: 'sindrome coqueluchoide', cie: 'U99', color: '#5B21B6',
      controlEstatalPocoInformativo: true,
      // Definición sindrómica, distinta de la tos ferina confirmada (A37): series distintas, no se suman.
      alias: ['sindrome coqueluchoide', 'coqueluchoide', 'u99', 'pertussis like syndrome'],
      prefijos: ['sindrome coqueluchoide', 'coqueluchoide'],
    },
    {
      id: 'plaguicidas_t60', controlDelegado: true, pad: 'Intoxicación por plaguicidas', nombre: 'Intoxicación por plaguicidas',
      nombreCorto: 'Plaguicidas', etiqueta: 'Intoxicación por plaguicidas (T60)', dataKey: 'plaguicidas_t60',
      marca: 'PLAGUICIDAS_T60', pagina: 'plaguicidas_t60.html', consulta: 'intoxicacion por plaguicidas', cie: 'T60', color: '#3F6212',
      controlEstatalPocoInformativo: true,
      // D7: la serie no distingue intención; las consultas de riesgo personal ganan la respuesta de crisis.
      alias: ['intoxicacion por plaguicidas', 'intoxicaciones por plaguicidas', 'plaguicidas', 'plaguicida', 'pesticidas',
        't60', 'pesticide poisoning'],
      prefijos: ['intoxicacion por plaguicidas', 'intoxicaciones por plaguicidas', 'plaguicida', 'pesticida', 'pesticide poisoning'],
    },
    {
      id: 'tos_ferina_a37', controlDelegado: true, pad: 'Tos ferina', nombre: 'Tos ferina', nombreCorto: 'Tos ferina',
      etiqueta: 'Tos ferina (A37)', dataKey: 'tos_ferina_a37', marca: 'TOS_FERINA_A37', pagina: 'tos_ferina_a37.html',
      consulta: 'tos ferina', cie: 'A37', color: '#155E75',
      alias: ['tos ferina', 'tosferina', 'pertussis', 'coqueluche', 'a37', 'whooping cough'],
      prefijos: ['tos ferina', 'tosferina', 'pertussis', 'coqueluche', 'whooping cough'],
    },
    {
      id: 'sindrome_meningeo_g00', controlDelegado: true, pad: 'Síndrome meníngeo', nombre: 'Síndrome meníngeo',
      nombreCorto: 'Síndrome meníngeo', etiqueta: 'Síndrome meníngeo (G00-G03, excepto G00.0 y G00.1)',
      dataKey: 'sindrome_meningeo_g00', marca: 'SINDROME_MENINGEO_G00', pagina: 'sindrome_meningeo_g00.html',
      consulta: 'sindrome meningeo', cie: 'G00.2-G00.9, G01-G03', color: '#0E7490',
      // No es la meningitis meningocócica, por Haemophilus (G00.0), por neumococo (G00.1) ni tuberculosa: «meningitis»
      // a secas pide precisar (ALIAS_AMBIGUOS).
      alias: ['sindrome meningeo', 'g00 2', 'g00 3', 'g00 8', 'g00 9', 'g01', 'g02', 'g03'],
      prefijos: ['sindrome meningeo'],
    },
    {
      id: 'monoxido_t58', controlDelegado: true, pad: 'Intoxicación por monóxido de carbono',
      nombre: 'Intoxicación por monóxido de carbono', nombreCorto: 'Monóxido de carbono',
      etiqueta: 'Intoxicación por monóxido de carbono (T58)', dataKey: 'monoxido_t58', marca: 'MONOXIDO_T58',
      pagina: 'monoxido_t58.html', consulta: 'intoxicacion por monoxido de carbono', cie: 'T58', color: '#52525B',
      // D7: la serie no distingue intención; las consultas de riesgo personal ganan la respuesta de crisis.
      alias: ['intoxicacion por monoxido de carbono', 'monoxido de carbono', 'monoxido', 't58', 'carbon monoxide'],
      prefijos: ['intoxicacion por monoxido', 'monoxido', 'carbon monoxide'],
    },
    // Control estacional autorizado nominalmente por el autor tras el rechazo de la prueba única de 2025 (16-nov-2026):
    // nunca validado, sin validación prospectiva propia.
    {
      id: 'sifilis_adquirida_a51', pad: 'Sífilis adquirida', nombre: 'Sífilis adquirida',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      nombreCorto: 'Sífilis adquirida', etiqueta: 'Sífilis adquirida (A51-A53)',
      dataKey: 'sifilis_adquirida_a51', marca: 'SIFILIS_ADQUIRIDA_A51', pagina: 'sifilis_adquirida_a51.html',
      consulta: 'sifilis adquirida', cie: 'A51-A53', color: '#0F766E',
      controlEstatalPocoInformativo: true,
      // Sin «sífilis» ni «lúes» a secas: abarcan la sífilis congénita (A50), que el boletín reporta aparte y no se modela,
      // y la sífilis en el embarazo (O98.1). «ALIAS_AMBIGUOS» pide precisar y «SUBTIPOS_AJENOS» excluye A50 y vecinos.
      alias: [
        'sifilis adquirida', 'sifilis precoz', 'sifilis temprana', 'sifilis primaria', 'sifilis secundaria',
        'sifilis tardia', 'sifilis terciaria', 'sifilis latente', 'sifilis cardiovascular', 'neurosifilis',
        'sifilis no especificada', 'otras sifilis',
        'lues adquirida', 'lues precoz', 'lues primaria', 'lues secundaria', 'lues tardia', 'lues terciaria',
        'a51', 'a52', 'a53',
        'acquired syphilis', 'early syphilis', 'primary syphilis', 'secondary syphilis',
        'late syphilis', 'tertiary syphilis', 'latent syphilis', 'cardiovascular syphilis', 'neurosyphilis',
        'unspecified syphilis', 'acquired lues',
      ],
      prefijos: [
        'sifilis adquirida', 'sifilis precoz', 'sifilis temprana', 'sifilis primaria', 'sifilis secundaria',
        'sifilis tardia', 'sifilis terciaria', 'sifilis latente', 'sifilis cardiovascular', 'neurosifilis',
        'acquired syphilis', 'early syphilis', 'primary syphilis', 'secondary syphilis',
        'late syphilis', 'tertiary syphilis', 'latent syphilis', 'neurosyphilis',
      ],
      // Cronología real del corte y emisión: la dicen el bot, el corpus RAG y la página.
      cronologia: 'Se entrenó con datos hasta 2026-W42 (boletín 43, dataset sifilis_adquirida_a51_0cc942faddb8) '
        + 'y su único pronóstico congelado se creó el 2026-11-17T01:32:25.156213+00:00 (16 de noviembre de 2026 en '
        + 'Ciudad de México), para 52 semanas desde el origen (2026-W43 a 2027-W42, no 52 semanas futuras). El '
        + 'boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya '
        + 'era público antes de emitir y antes de congelar el gate técnico (5987a061): no se usó para entrenar y se '
        + 'registró por separado en sifilis_adquirida_a51_eaca7efc1a11, así que el primer objetivo (2026-W43) no es '
        + 'prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el '
        + 'registro técnico de cuatro semanas (W43 a W46 de 2026; 1/4 INCOMPLETE al corte del boletín 44) pasa a '
        + 'CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    // Lote alta_b44 (19-nov-2026): 58 releases del boletín 44. Controles estacionales tras rechazo (orden nominal
    // del autor por id), diez controles sin alternativa con un año de historia (rolling_cv_historia_corta_2024_v1,
    // portafolio igual al control: `controlSinAlternativa`) y aceptados en su prueba única. Los sensibles (`sensible`)
    // sólo se reconocen por su rótulo técnico completo o su código: los términos genéricos dan la respuesta de crisis.
    {
      id: 'alacran_t63', pad: 'Intoxicación por picadura de alacrán', nombre: 'Intoxicación por picadura de alacrán', nombreCorto: 'Picadura de alacrán', etiqueta: 'Intoxicación por picadura de alacrán (T63.2, X22)', dataKey: 'alacran_t63', marca: 'ALACRAN_T63', pagina: 'alacran_t63.html', consulta: 'intoxicacion por picadura de alacran', cie: 'T63.2, X22', color: '#92400E',
      alias: ['intoxicacion por picadura de alacran', 'picadura de alacran', 'picaduras de alacran', 'piquete de alacran', 'alacranismo', 'alacran', 'alacranes', 't63 2', 'x22', 'scorpion sting', 'scorpion stings'],
      prefijos: ['picadura de alacran', 'picaduras de alacran', 'alacran', 'scorpion sting'],
    },
    {
      id: 'mordedura_perro_w54', pad: 'Mordeduras por perro', nombre: 'Mordeduras por perro', nombreCorto: 'Mordeduras por perro', etiqueta: 'Mordeduras por perro (W54)', dataKey: 'mordedura_perro_w54', marca: 'MORDEDURA_PERRO_W54', pagina: 'mordedura_perro_w54.html', consulta: 'mordeduras por perro', cie: 'W54', color: '#57534E',
      alias: ['mordeduras por perro', 'mordedura de perro', 'mordedura por perro', 'mordeduras de perro', 'w54', 'dog bite', 'dog bites'],
      prefijos: ['mordedura de perro', 'mordeduras de perro', 'mordedura por perro', 'mordeduras por perro', 'dog bite'],
    },
    {
      id: 'mordedura_mamiferos_w55', pad: 'Mordeduras por otros mamíferos', nombre: 'Mordeduras por otros mamíferos', nombreCorto: 'Mordeduras por otros mamíferos', etiqueta: 'Mordeduras por otros mamíferos (W55)', dataKey: 'mordedura_mamiferos_w55', marca: 'MORDEDURA_MAMIFEROS_W55', pagina: 'mordedura_mamiferos_w55.html', consulta: 'mordeduras por otros mamiferos', cie: 'W55', color: '#A8A29E',
      alias: ['mordeduras por otros mamiferos', 'mordedura de otros mamiferos', 'mordedura por otros mamiferos', 'mordeduras de otros mamiferos', 'w55', 'other mammal bites'],
      prefijos: ['mordedura de otros mamiferos', 'mordeduras de otros mamiferos', 'mordedura por otros mamiferos', 'mordeduras por otros mamiferos'],
    },
    {
      id: 'toxoplasmosis_b58', pad: 'Toxoplasmosis', nombre: 'Toxoplasmosis', nombreCorto: 'Toxoplasmosis', etiqueta: 'Toxoplasmosis (B58)', dataKey: 'toxoplasmosis_b58', marca: 'TOXOPLASMOSIS_B58', pagina: 'toxoplasmosis_b58.html', consulta: 'toxoplasmosis', cie: 'B58', color: '#854D0E',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['toxoplasmosis', 'b58'],
      prefijos: ['toxoplasm'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:16.735688+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en toxoplasmosis_b58_57c2305d7e99, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'teniasis_b68', pad: 'Teniasis', nombre: 'Teniasis', nombreCorto: 'Teniasis', etiqueta: 'Teniasis (B68)', dataKey: 'teniasis_b68', marca: 'TENIASIS_B68', pagina: 'teniasis_b68.html', consulta: 'teniasis', cie: 'B68', color: '#3F6212',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['teniasis', 'taeniasis', 'b68'],
      prefijos: ['teniasis', 'taeniasis'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:30.068368+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en teniasis_b68_5df03584bac6, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'cisticercosis_b69', pad: 'Cisticercosis', nombre: 'Cisticercosis', nombreCorto: 'Cisticercosis', etiqueta: 'Cisticercosis (B69)', dataKey: 'cisticercosis_b69', marca: 'CISTICERCOSIS_B69', pagina: 'cisticercosis_b69.html', consulta: 'cisticercosis', cie: 'B69', color: '#166534',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['cisticercosis', 'neurocisticercosis', 'b69', 'cysticercosis'],
      prefijos: ['cisticercosis', 'neurocisticercosis', 'cysticercosis'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:21.600870+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en cisticercosis_b69_fe1c2b19bed3, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'triquinosis_b75', pad: 'Triquinosis', nombre: 'Triquinosis', nombreCorto: 'Triquinosis', etiqueta: 'Triquinosis (B75)', dataKey: 'triquinosis_b75', marca: 'TRIQUINOSIS_B75', pagina: 'triquinosis_b75.html', consulta: 'triquinosis', cie: 'B75', color: '#7F1D1D',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['triquinosis', 'triquinelosis', 'b75', 'trichinosis', 'trichinellosis'],
      prefijos: ['triquinosis', 'triquinelosis', 'trichinosis', 'trichinellosis'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:34.120104+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en triquinosis_b75_248ad10f21a7, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'conjuntivitis_hemorragica_b303', pad: 'Conjuntivitis epidémica aguda hemorrágica', nombre: 'Conjuntivitis epidémica aguda hemorrágica', nombreCorto: 'Conjuntivitis epidémica aguda hemorrágica', etiqueta: 'Conjuntivitis epidémica aguda hemorrágica (B30.3)', dataKey: 'conjuntivitis_hemorragica_b303', marca: 'CONJUNTIVITIS_HEMORRAGICA_B303', pagina: 'conjuntivitis_hemorragica_b303.html', consulta: 'hemorragica conjuntival epidemica', cie: 'B30.3', color: '#BE185D',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['hemorragica conjuntival epidemica', 'b30 3'],
      prefijos: ['hemorragica conjuntival epidemica'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:11.713796+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en conjuntivitis_hemorragica_b303_f0c4a3215b7e, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'tracoma_a71', pad: 'Tracoma', nombre: 'Tracoma', nombreCorto: 'Tracoma', etiqueta: 'Tracoma (A71)', dataKey: 'tracoma_a71', marca: 'TRACOMA_A71', pagina: 'tracoma_a71.html', consulta: 'tracoma', cie: 'A71', color: '#4338CA',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['tracoma', 'a71', 'trachoma'],
      prefijos: ['tracoma', 'trachoma'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:38.036780+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en tracoma_a71_e19dc92ac6d6, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'hipotermia_t68', pad: 'Hipotermia', nombre: 'Hipotermia', nombreCorto: 'Hipotermia', etiqueta: 'Hipotermia (T68)', dataKey: 'hipotermia_t68', marca: 'HIPOTERMIA_T68', pagina: 'hipotermia_t68.html', consulta: 'hipotermia', cie: 'T68', color: '#1E40AF',
      // Semanas observadas cuyo boletín ya era público al emitir (bulletin_provenance.json): no son prospectivas.
      no_prospectivas: ['2026-W43'],
      alias: ['hipotermia', 't68', 'hypothermia'],
      prefijos: ['hipotermia', 'hypothermia'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:25.994619+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en hipotermia_t68_18d7d58ccaa7, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'tetanos_a34', pad: 'Tétanos', nombre: 'Tétanos', nombreCorto: 'Tétanos', etiqueta: 'Tétanos (A34, A35)', dataKey: 'tetanos_a34', marca: 'TETANOS_A34', pagina: 'tetanos_a34.html', consulta: 'tetanos a34', cie: 'A34, A35', color: '#7C2D12',
      alias: ['tetanos obstetrico', 'otros tetanos', 'tetanos no neonatal', 'a34', 'a35', 'obstetrical tetanus'],
      prefijos: ['tetanos obstetrico', 'otros tetanos', 'tetanos no neonatal'],
    },
    {
      id: 'viruela_simica_b04', pad: 'Viruela símica', nombre: 'Viruela símica', nombreCorto: 'Viruela símica', etiqueta: 'Viruela símica (B04)', dataKey: 'viruela_simica_b04', marca: 'VIRUELA_SIMICA_B04', pagina: 'viruela_simica_b04.html', consulta: 'viruela simica', cie: 'B04', color: '#A16207', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['viruela simica', 'viruela del mono', 'viruela de los monos', 'mpox', 'monkeypox', 'b04'],
      prefijos: ['viruela simica', 'viruela del mono', 'mpox', 'monkeypox'],
    },
    {
      id: 'vph_b97', pad: 'Infección por virus de papiloma humano', nombre: 'Infección por virus de papiloma humano', nombreCorto: 'Virus de papiloma humano', etiqueta: 'Infección por virus de papiloma humano (B97.7)', dataKey: 'vph_b97', marca: 'VPH_B97', pagina: 'vph_b97.html', consulta: 'infeccion por virus de papiloma humano', cie: 'B97.7', color: '#BE185D',
      alias: ['infeccion por virus de papiloma humano', 'virus de papiloma humano', 'virus del papiloma humano', 'papiloma humano', 'papilomavirus', 'vph', 'b97 7', 'hpv', 'human papillomavirus'],
      prefijos: ['virus de papiloma humano', 'virus del papiloma humano', 'papiloma humano', 'papilomavirus', 'human papillomavirus'],
    },
    {
      id: 'gonococica_a54', pad: 'Infección gonocócica del tracto genitourinario', nombre: 'Infección gonocócica del tracto genitourinario', nombreCorto: 'Infección gonocócica', etiqueta: 'Infección gonocócica del tracto genitourinario (A54.0-A54.2)', dataKey: 'gonococica_a54', marca: 'GONOCOCICA_A54', pagina: 'gonococica_a54.html', consulta: 'infeccion gonococica del tracto genitourinario', cie: 'A54.0-A54.2', color: '#9D174D',
      alias: ['infeccion gonococica del tracto genitourinario', 'infeccion gonococica genitourinaria', 'gonorrea genitourinaria', 'gonorrea urogenital', 'a54 0', 'a54 1', 'a54 2', 'genitourinary gonococcal infection'],
      prefijos: ['infeccion gonococica del tracto genitourinario', 'infeccion gonococica genitourinaria', 'gonorrea genitourinaria', 'gonorrea urogenital'],
    },
    {
      id: 'linfogranuloma_a55', pad: 'Linfogranuloma venéreo por Clamidias', nombre: 'Linfogranuloma venéreo por Clamidias', nombreCorto: 'Linfogranuloma venéreo', etiqueta: 'Linfogranuloma venéreo por Clamidias (A55)', dataKey: 'linfogranuloma_a55', marca: 'LINFOGRANULOMA_A55', pagina: 'linfogranuloma_a55.html', consulta: 'linfogranuloma venereo por clamidias', cie: 'A55', color: '#7C2D12',
      alias: ['linfogranuloma venereo por clamidias', 'linfogranuloma venereo', 'linfogranuloma', 'a55', 'lymphogranuloma venereum'],
      prefijos: ['linfogranuloma', 'lymphogranuloma'],
    },
    {
      id: 'chancro_blando_a57', pad: 'Chancro blando', nombre: 'Chancro blando', nombreCorto: 'Chancro blando', etiqueta: 'Chancro blando (A57)', dataKey: 'chancro_blando_a57', marca: 'CHANCRO_BLANDO_A57', pagina: 'chancro_blando_a57.html', consulta: 'chancro blando', cie: 'A57', color: '#A21CAF',
      alias: ['chancro blando', 'chancroide', 'a57', 'chancroid'],
      prefijos: ['chancro blando', 'chancroide', 'chancroid'],
    },
    {
      id: 'herpes_genital_a600', pad: 'Herpes genital', nombre: 'Herpes genital', nombreCorto: 'Herpes genital', etiqueta: 'Herpes genital (A60.0)', dataKey: 'herpes_genital_a600', marca: 'HERPES_GENITAL_A600', pagina: 'herpes_genital_a600.html', consulta: 'herpes genital', cie: 'A60.0', color: '#4C1D95',
      alias: ['herpes genital', 'a60 0', 'genital herpes'],
      prefijos: ['herpes genital', 'genital herpes'],
    },
    {
      id: 'tricomoniasis_a590', pad: 'Tricomoniasis urogenital', nombre: 'Tricomoniasis urogenital', nombreCorto: 'Tricomoniasis urogenital', etiqueta: 'Tricomoniasis urogenital (A59.0)', dataKey: 'tricomoniasis_a590', marca: 'TRICOMONIASIS_A590', pagina: 'tricomoniasis_a590.html', consulta: 'tricomoniasis urogenital', cie: 'A59.0', color: '#0369A1',
      alias: ['tricomoniasis urogenital', 'tricomoniasis', 'a59 0', 'urogenital trichomoniasis', 'trichomoniasis'],
      prefijos: ['tricomoniasis urogenital', 'tricomoniasis', 'trichomoniasis'],
    },
    {
      id: 'paralisis_flacida_u98', pad: 'Parálisis flácida aguda (menores de 15 años)', nombre: 'Parálisis flácida aguda (menores de 15 años)', nombreCorto: 'Parálisis flácida aguda', etiqueta: 'Parálisis flácida aguda en menores de 15 años (U98)', dataKey: 'paralisis_flacida_u98', marca: 'PARALISIS_FLACIDA_U98', pagina: 'paralisis_flacida_u98.html', consulta: 'paralisis flacida aguda', cie: 'U98', color: '#7C3AED',
      alias: ['paralisis flacida aguda', 'paralisis flacida aguda en menores de 15 anos', 'paralisis flacida', 'u98', 'acute flaccid paralysis'],
      prefijos: ['paralisis flacida', 'acute flaccid paralysis'],
    },
    {
      id: 'iaas_sc', pad: 'Infección asociada a la atención de la salud', nombre: 'Infección asociada a la atención de la salud', nombreCorto: 'Infección asociada a la atención de la salud', etiqueta: 'Infección asociada a la atención de la salud (sin código CIE)', dataKey: 'iaas_sc', marca: 'IAAS_SC', pagina: 'iaas_sc.html', consulta: 'infeccion asociada a la atencion de la salud', cie: 'S/C', color: '#0E7490',
      alias: ['infeccion asociada a la atencion de la salud', 'infecciones asociadas a la atencion de la salud', 'iaas', 'infeccion nosocomial', 'infecciones nosocomiales', 'afeccion nosocomial', 'y95', 'healthcare associated infection', 'healthcare associated infections', 'nosocomial infection'],
      prefijos: ['infeccion asociada a la atencion', 'infecciones asociadas a la atencion', 'infeccion nosocomial', 'infecciones nosocomiales', 'healthcare associated infection', 'nosocomial infection'],
    },
    {
      id: 'intox_alcohol_f100', sensible: true, pad: 'Intoxicación aguda por alcohol', nombre: 'Intoxicación aguda por alcohol', nombreCorto: 'Intoxicación por alcohol', etiqueta: 'Intoxicación aguda por alcohol (F10.0)', dataKey: 'intox_alcohol_f100', marca: 'INTOX_ALCOHOL_F100', pagina: 'intox_alcohol_f100.html', consulta: 'intoxicacion aguda por alcohol', cie: 'F10.0', color: '#9A3412',
      alias: ['intoxicacion aguda por alcohol', 'intoxicacion por alcohol', 'intoxicacion alcoholica', 'f10 0', 'acute alcohol intoxication'],
      prefijos: ['intoxicacion aguda por alcohol', 'intoxicacion por alcohol', 'intoxicacion alcoholica', 'acute alcohol intoxication'],
    },
    {
      id: 'alcoholica_higado_k70', pad: 'Enfermedad alcohólica del hígado', nombre: 'Enfermedad alcohólica del hígado', nombreCorto: 'Enfermedad alcohólica del hígado', etiqueta: 'Enfermedad alcohólica del hígado (K70 excepto K70.3)', dataKey: 'alcoholica_higado_k70', marca: 'ALCOHOLICA_HIGADO_K70', pagina: 'alcoholica_higado_k70.html', consulta: 'enfermedad alcoholica del higado', cie: 'K70.0-K70.2, K70.4-K70.9', color: '#854D0E',
      alias: ['enfermedad alcoholica del higado', 'hepatopatia alcoholica', 'k70 0', 'k70 2', 'k70 4', 'k70 9', 'alcoholic liver disease'],
      prefijos: ['enfermedad alcoholica del higado', 'hepatopatia alcoholica', 'alcoholic liver disease'],
    },
    {
      id: 'anencefalia_q00', pad: 'Anencefalia', nombre: 'Anencefalia', nombreCorto: 'Anencefalia', etiqueta: 'Anencefalia (Q00)', dataKey: 'anencefalia_q00', marca: 'ANENCEFALIA_Q00', pagina: 'anencefalia_q00.html', consulta: 'anencefalia', cie: 'Q00', color: '#BE185D',
      alias: ['anencefalia', 'q00', 'anencephaly'],
      prefijos: ['anencefalia', 'anencephaly'],
    },
    {
      id: 'encefalocele_q01', pad: 'Encefalocele', nombre: 'Encefalocele', nombreCorto: 'Encefalocele', etiqueta: 'Encefalocele (Q01)', dataKey: 'encefalocele_q01', marca: 'ENCEFALOCELE_Q01', pagina: 'encefalocele_q01.html', consulta: 'encefalocele', cie: 'Q01', color: '#9D174D',
      alias: ['encefalocele', 'q01', 'encephalocele'],
      prefijos: ['encefalocele', 'encephalocele'],
    },
    {
      id: 'microcefalia_q02', pad: 'Microcefalia', nombre: 'Microcefalia', nombreCorto: 'Microcefalia', etiqueta: 'Microcefalia (Q02)', dataKey: 'microcefalia_q02', marca: 'MICROCEFALIA_Q02', pagina: 'microcefalia_q02.html', consulta: 'microcefalia', cie: 'Q02', color: '#831843', seleccion: 'en pliegues de 2023 y 2024',
      alias: ['microcefalia', 'q02', 'microcephaly'],
      prefijos: ['microcefalia', 'microcephaly'],
    },
    {
      id: 'espina_bifida_q05', pad: 'Espina bífida', nombre: 'Espina bífida', nombreCorto: 'Espina bífida', etiqueta: 'Espina bífida (Q05)', dataKey: 'espina_bifida_q05', marca: 'ESPINA_BIFIDA_Q05', pagina: 'espina_bifida_q05.html', consulta: 'espina bifida', cie: 'Q05', color: '#A21CAF',
      alias: ['espina bifida', 'q05', 'spina bifida'],
      prefijos: ['espina bifida', 'spina bifida'],
    },
    {
      id: 'labio_paladar_q35', pad: 'Labio y paladar hendido', nombre: 'Labio y paladar hendido', nombreCorto: 'Labio y paladar hendido', etiqueta: 'Labio y paladar hendido (Q35-Q37)', dataKey: 'labio_paladar_q35', marca: 'LABIO_PALADAR_Q35', pagina: 'labio_paladar_q35.html', consulta: 'labio y paladar hendido', cie: 'Q35-Q37', color: '#86198F',
      alias: ['labio y paladar hendido', 'labio hendido', 'paladar hendido', 'labio leporino', 'fisura palatina', 'q35', 'q36', 'q37', 'cleft lip', 'cleft palate'],
      prefijos: ['labio y paladar hendido', 'labio hendido', 'paladar hendido', 'labio leporino', 'cleft lip', 'cleft palate'],
    },
    {
      id: 'viuda_negra_u602', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 80.8, smape_all: 79.1, smape_nacional_general: 26.7 }, pad: 'Mordedura de araña viuda negra', nombre: 'Mordedura de araña viuda negra', nombreCorto: 'Araña viuda negra', etiqueta: 'Mordedura de araña viuda negra (U60.2)', dataKey: 'viuda_negra_u602', marca: 'VIUDA_NEGRA_U602', pagina: 'viuda_negra_u602.html', consulta: 'mordedura de arana viuda negra', cie: 'U60.2', color: '#3F3F46', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['mordedura de arana viuda negra', 'picadura de arana viuda negra', 'arana viuda negra', 'viuda negra', 'latrodectismo', 'u60 2', 'black widow'],
      prefijos: ['arana viuda negra', 'viuda negra', 'black widow'],
    },
    {
      id: 'violinista_u603', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 58.9, smape_all: 72.9, smape_nacional_general: 34.9 }, pad: 'Mordedura de araña violinista', nombre: 'Mordedura de araña violinista', nombreCorto: 'Araña violinista', etiqueta: 'Mordedura de araña violinista (U60.3)', dataKey: 'violinista_u603', marca: 'VIOLINISTA_U603', pagina: 'violinista_u603.html', consulta: 'mordedura de arana violinista', cie: 'U60.3', color: '#78350F', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['mordedura de arana violinista', 'picadura de arana violinista', 'arana violinista', 'arana reclusa', 'loxoscelismo', 'u60 3', 'brown recluse'],
      prefijos: ['arana violinista', 'arana reclusa', 'loxoscel', 'brown recluse'],
    },
    {
      id: 'otras_aranas_t633', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 93.0, smape_all: 84.7, smape_nacional_general: 17.8 }, pad: 'Mordedura de otras arañas', nombre: 'Mordedura de otras arañas', nombreCorto: 'Otras arañas', etiqueta: 'Mordedura de otras arañas (T63.3, X21 excepto U60.2 y U60.3)', dataKey: 'otras_aranas_t633', marca: 'OTRAS_ARANAS_T633', pagina: 'otras_aranas_t633.html', consulta: 'mordedura de otras aranas', cie: 'T63.3, X21', color: '#57534E', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['mordedura de otras aranas', 'picadura de otras aranas', 'otras aranas', 't63 3', 'x21'],
      prefijos: ['otras aranas'],
    },
    {
      id: 'abeja_u604', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 77.0, smape_all: 63.5, smape_nacional_general: 20.8 }, pad: 'Picadura de abeja', nombre: 'Picadura de abeja', nombreCorto: 'Picadura de abeja', etiqueta: 'Picadura de abeja (U60.4)', dataKey: 'abeja_u604', marca: 'ABEJA_U604', pagina: 'abeja_u604.html', consulta: 'picadura de abeja', cie: 'U60.4', color: '#CA8A04', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['picadura de abeja', 'picaduras de abeja', 'piquete de abeja', 'u60 4', 'bee sting', 'bee stings'],
      prefijos: ['picadura de abeja', 'picaduras de abeja', 'piquete de abeja', 'bee sting'],
    },
    {
      id: 'avispa_u605', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 92.6, smape_all: 86.2, smape_nacional_general: 25.5 }, pad: 'Picadura de avispa', nombre: 'Picadura de avispa', nombreCorto: 'Picadura de avispa', etiqueta: 'Picadura de avispa (U60.5)', dataKey: 'avispa_u605', marca: 'AVISPA_U605', pagina: 'avispa_u605.html', consulta: 'picadura de avispa', cie: 'U60.5', color: '#B45309', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['picadura de avispa', 'picaduras de avispa', 'piquete de avispa', 'u60 5', 'wasp sting', 'wasp stings'],
      prefijos: ['picadura de avispa', 'picaduras de avispa', 'piquete de avispa', 'wasp sting'],
    },
    {
      id: 'otros_artropodos_t634', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 93.2, smape_all: 87.6, smape_nacional_general: 21.9 }, pad: 'Picadura por otros artrópodos', nombre: 'Picadura por otros artrópodos', nombreCorto: 'Otros artrópodos', etiqueta: 'Picadura por otros artrópodos (T63.4 excepto U60.4 y U60.5)', dataKey: 'otros_artropodos_t634', marca: 'OTROS_ARTROPODOS_T634', pagina: 'otros_artropodos_t634.html', consulta: 'picadura por otros artropodos', cie: 'T63.4', color: '#4D7C0F', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['picadura por otros artropodos', 'picadura de otros artropodos', 'otros artropodos', 't63 4'],
      prefijos: ['otros artropodos'],
    },
    {
      id: 'otros_ponzonosos_t631', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 88.2, smape_all: 78.1, smape_nacional_general: 18.1 }, pad: 'Picadura o intoxicación por otros animales ponzoñosos', nombre: 'Picadura o intoxicación por otros animales ponzoñosos', nombreCorto: 'Otros animales ponzoñosos', etiqueta: 'Picadura o intoxicación por otros animales ponzoñosos (T63.1, T63.5-T63.9, X27, U60.8)', dataKey: 'otros_ponzonosos_t631', marca: 'OTROS_PONZONOSOS_T631', pagina: 'otros_ponzonosos_t631.html', consulta: 'picadura o intoxicacion por otros animales ponzonosos', cie: 'T63.1, T63.5-T63.9, X27, U60.8', color: '#7E22CE', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['picadura o intoxicacion por otros animales ponzonosos', 'intoxicacion por otros animales ponzonosos', 'otros animales ponzonosos', 'u60 8', 'x27'],
      prefijos: ['otros animales ponzonosos'],
    },
    {
      id: 'mordedura_cascabel_u600', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 62.8, smape_all: 74.4, smape_nacional_general: 44.3 }, pad: 'Mordedura por serpiente de cascabel', nombre: 'Mordedura por serpiente de cascabel', nombreCorto: 'Mordedura por serpiente de cascabel', etiqueta: 'Mordedura por serpiente de cascabel (U60.0)', dataKey: 'mordedura_cascabel_u600', marca: 'MORDEDURA_CASCABEL_U600', pagina: 'mordedura_cascabel_u600.html', consulta: 'mordedura por serpiente de cascabel', cie: 'U60.0', color: '#8A6A3B', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['mordedura por serpiente de cascabel', 'mordedura de serpiente de cascabel', 'mordedura de cascabel', 'serpiente de cascabel', 'vibora de cascabel', 'u60 0', 'rattlesnake bite'],
      prefijos: ['serpiente de cascabel', 'vibora de cascabel', 'mordedura de cascabel', 'rattlesnake'],
    },
    {
      id: 'mordedura_coral_u601', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 9.3, smape_all: 9.3, smape_nacional_general: 84.7 }, pad: 'Mordedura por serpiente coral', nombre: 'Mordedura por serpiente coral', nombreCorto: 'Mordedura por serpiente coral', etiqueta: 'Mordedura por serpiente coral (U60.1)', dataKey: 'mordedura_coral_u601', marca: 'MORDEDURA_CORAL_U601', pagina: 'mordedura_coral_u601.html', consulta: 'mordedura por serpiente coral', cie: 'U60.1', color: '#7C5E3C', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['mordedura por serpiente coral', 'mordedura de serpiente coral', 'mordedura de coralillo', 'serpiente coral', 'coralillo', 'u60 1', 'coral snake bite'],
      prefijos: ['serpiente coral', 'coralillo', 'coral snake'],
    },
    {
      id: 'mordedura_otras_serpientes_t630', controlSinAlternativa: true, pruebaSinAlternativa: { fold: 'test_2026', semanas: 43, smape_bases: 67.4, smape_all: 72.1, smape_nacional_general: 32.5 }, pad: 'Mordedura por otras serpientes', nombre: 'Mordedura por otras serpientes', nombreCorto: 'Mordedura por otras serpientes', etiqueta: 'Mordedura por otras serpientes (T63.0, X20 excepto U60.0 y U60.1)', dataKey: 'mordedura_otras_serpientes_t630', marca: 'MORDEDURA_OTRAS_SERPIENTES_T630', pagina: 'mordedura_otras_serpientes_t630.html', consulta: 'mordedura por otras serpientes', cie: 'T63.0, X20', color: '#6B4F2A', seleccion: 'en un pliegue de 2025 (la serie empieza en 2024)',
      alias: ['mordedura por otras serpientes', 'mordedura de otras serpientes', 'otras serpientes', 't63 0', 'x20'],
      prefijos: ['otras serpientes'],
    },
    {
      id: 'cirrosis_alcoholica_k703', pad: 'Cirrosis hepática alcohólica', nombre: 'Cirrosis hepática alcohólica', nombreCorto: 'Cirrosis alcohólica', etiqueta: 'Cirrosis hepática alcohólica (K70.3)', dataKey: 'cirrosis_alcoholica_k703', marca: 'CIRROSIS_ALCOHOLICA_K703', pagina: 'cirrosis_alcoholica_k703.html', consulta: 'cirrosis hepatica alcoholica', cie: 'K70.3', color: '#713F12',
      alias: ['cirrosis hepatica alcoholica', 'cirrosis alcoholica', 'k70 3', 'alcoholic cirrhosis'],
      prefijos: ['cirrosis hepatica alcoholica', 'cirrosis alcoholica', 'alcoholic cirrhosis'],
    },
    {
      id: 'chikungunya_a920', pad: 'Enfermedad por virus Chikungunya', nombre: 'Enfermedad por virus Chikungunya', nombreCorto: 'Chikungunya', etiqueta: 'Enfermedad por virus Chikungunya (A92.0)', dataKey: 'chikungunya_a920', marca: 'CHIKUNGUNYA_A920', pagina: 'chikungunya_a920.html', consulta: 'enfermedad por virus chikungunya', cie: 'A92.0', color: '#B91C1C',
      alias: ['enfermedad por virus chikungunya', 'chikungunya', 'chikunguna', 'fiebre chikungunya', 'a92 0'],
      prefijos: ['chikungun', 'chikunguna'],
    },
    {
      id: 'envenenamiento_analgesicos_x60', sensible: true, pad: 'Envenenamiento autoinfligido intencionalmente por analgésicos no narcóticos, antipiréticos y antirreumáticos', nombre: 'Envenenamiento autoinfligido intencionalmente por analgésicos no narcóticos, antipiréticos y antirreumáticos', nombreCorto: 'Envenenamiento autoinfligido por analgésicos', etiqueta: 'Envenenamiento autoinfligido intencionalmente por analgésicos no narcóticos, antipiréticos y antirreumáticos (X60)', dataKey: 'envenenamiento_analgesicos_x60', marca: 'ENVENENAMIENTO_ANALGESICOS_X60', pagina: 'envenenamiento_analgesicos_x60.html', consulta: 'envenenamiento autoinfligido intencionalmente por analgesicos no narcoticos antipireticos y antirreumaticos', cie: 'X60', color: '#7C3AED', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['envenenamiento autoinfligido intencionalmente por analgesicos no narcoticos antipireticos y antirreumaticos', 'x60'],
      prefijos: ['envenenamiento autoinfligido intencionalmente por analgesicos'],
    },
    {
      id: 'envenenamiento_psicotropicos_x61', sensible: true, pad: 'Envenenamiento autoinfligido intencionalmente por drogas antiepilépticas, sedantes, hipnóticas, antiparkinsonianas y psicotrópicas', nombre: 'Envenenamiento autoinfligido intencionalmente por drogas antiepilépticas, sedantes, hipnóticas, antiparkinsonianas y psicotrópicas', nombreCorto: 'Envenenamiento autoinfligido por psicotrópicos', etiqueta: 'Envenenamiento autoinfligido intencionalmente por drogas antiepilépticas, sedantes, hipnóticas, antiparkinsonianas y psicotrópicas (X61)', dataKey: 'envenenamiento_psicotropicos_x61', marca: 'ENVENENAMIENTO_PSICOTROPICOS_X61', pagina: 'envenenamiento_psicotropicos_x61.html', consulta: 'envenenamiento autoinfligido intencionalmente por drogas antiepilepticas sedantes hipnoticas antiparkinsonianas y psicotropicas', cie: 'X61', color: '#6D28D9', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['envenenamiento autoinfligido intencionalmente por drogas antiepilepticas sedantes hipnoticas antiparkinsonianas y psicotropicas', 'x61'],
      prefijos: ['envenenamiento autoinfligido intencionalmente por drogas'],
    },
    {
      id: 'ahorcamiento_x70', sensible: true, pad: 'Lesión autoinfligida intencionalmente por ahorcamiento, estrangulamiento o sofocación', nombre: 'Lesión autoinfligida intencionalmente por ahorcamiento, estrangulamiento o sofocación', nombreCorto: 'Lesión autoinfligida por ahorcamiento', etiqueta: 'Lesión autoinfligida intencionalmente por ahorcamiento, estrangulamiento o sofocación (X70)', dataKey: 'ahorcamiento_x70', marca: 'AHORCAMIENTO_X70', pagina: 'ahorcamiento_x70.html', consulta: 'lesion autoinfligida intencionalmente por ahorcamiento estrangulamiento o sofocacion', cie: 'X70', color: '#5B21B6', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['lesion autoinfligida intencionalmente por ahorcamiento estrangulamiento o sofocacion', 'x70'],
      prefijos: ['lesion autoinfligida intencionalmente por ahorcamiento'],
    },
    {
      id: 'disparo_arma_corta_x72', sensible: true, pad: 'Lesión autoinfligida intencionalmente por disparo de arma corta', nombre: 'Lesión autoinfligida intencionalmente por disparo de arma corta', nombreCorto: 'Lesión autoinfligida por arma corta', etiqueta: 'Lesión autoinfligida intencionalmente por disparo de arma corta (X72)', dataKey: 'disparo_arma_corta_x72', marca: 'DISPARO_ARMA_CORTA_X72', pagina: 'disparo_arma_corta_x72.html', consulta: 'lesion autoinfligida intencionalmente por disparo de arma corta', cie: 'X72', color: '#4C1D95', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['lesion autoinfligida intencionalmente por disparo de arma corta', 'x72'],
      prefijos: ['lesion autoinfligida intencionalmente por disparo'],
    },
    {
      id: 'objeto_cortante_x78', sensible: true, pad: 'Lesión autoinfligida intencionalmente por objeto cortante', nombre: 'Lesión autoinfligida intencionalmente por objeto cortante', nombreCorto: 'Lesión autoinfligida por objeto cortante', etiqueta: 'Lesión autoinfligida intencionalmente por objeto cortante (X78)', dataKey: 'objeto_cortante_x78', marca: 'OBJETO_CORTANTE_X78', pagina: 'objeto_cortante_x78.html', consulta: 'lesion autoinfligida intencionalmente por objeto cortante', cie: 'X78', color: '#8B5CF6', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['lesion autoinfligida intencionalmente por objeto cortante', 'x78'],
      prefijos: ['lesion autoinfligida intencionalmente por objeto cortante'],
    },
    {
      id: 'salto_lugar_elevado_x80', sensible: true, pad: 'Lesión autoinfligida intencionalmente al saltar desde un lugar elevado', nombre: 'Lesión autoinfligida intencionalmente al saltar desde un lugar elevado', nombreCorto: 'Lesión autoinfligida al saltar', etiqueta: 'Lesión autoinfligida intencionalmente al saltar desde un lugar elevado (X80)', dataKey: 'salto_lugar_elevado_x80', marca: 'SALTO_LUGAR_ELEVADO_X80', pagina: 'salto_lugar_elevado_x80.html', consulta: 'lesion autoinfligida intencionalmente al saltar desde un lugar elevado', cie: 'X80', color: '#A78BFA', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['lesion autoinfligida intencionalmente al saltar desde un lugar elevado', 'x80'],
      prefijos: ['lesion autoinfligida intencionalmente al saltar'],
    },
    {
      id: 'intento_suicidio_z915', sensible: true, pad: 'Historia personal de lesión autoinfligida intencionalmente (intento de suicidio)', nombre: 'Historia personal de lesión autoinfligida intencionalmente (intento de suicidio)', nombreCorto: 'Historia personal de lesión autoinfligida', etiqueta: 'Historia personal de lesión autoinfligida intencionalmente (intento de suicidio) (Z91.5)', dataKey: 'intento_suicidio_z915', marca: 'INTENTO_SUICIDIO_Z915', pagina: 'intento_suicidio_z915.html', consulta: 'historia personal de lesion autoinfligida intencionalmente', cie: 'Z91.5', color: '#9333EA', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['historia personal de lesion autoinfligida intencionalmente', 'z91 5'],
      prefijos: ['historia personal de lesion autoinfligida'],
    },
    {
      id: 'ideacion_suicida_r458', sensible: true, pad: 'Otros síntomas y signos que involucran el estado emocional (ideación suicida)', nombre: 'Otros síntomas y signos que involucran el estado emocional (ideación suicida)', nombreCorto: 'Síntomas del estado emocional (R45.8)', etiqueta: 'Otros síntomas y signos que involucran el estado emocional (ideación suicida) (R45.8)', dataKey: 'ideacion_suicida_r458', marca: 'IDEACION_SUICIDA_R458', pagina: 'ideacion_suicida_r458.html', consulta: 'otros sintomas y signos que involucran el estado emocional', cie: 'R45.8', color: '#A855F7', seleccion: 'en un pliegue de 2025 (la serie empieza en 2023)',
      alias: ['otros sintomas y signos que involucran el estado emocional', 'r45 8'],
      prefijos: ['otros sintomas y signos que involucran el estado emocional'],
    },
    {
      id: 'violencia_intrafamiliar_y07', sensible: true, pad: 'Violencia intrafamiliar', nombre: 'Violencia intrafamiliar', nombreCorto: 'Violencia intrafamiliar', etiqueta: 'Violencia intrafamiliar (Y07.0-Y07.2)', dataKey: 'violencia_intrafamiliar_y07', marca: 'VIOLENCIA_INTRAFAMILIAR_Y07', pagina: 'violencia_intrafamiliar_y07.html', consulta: 'violencia intrafamiliar', cie: 'Y07.0-Y07.2', color: '#B91C1C',
      alias: ['violencia intrafamiliar', 'y07 0', 'y07 1', 'y07 2', 'y07'],
      prefijos: ['violencia intrafamiliar'],
    },
    {
      id: 'tuberculosis_otras_formas_a171', pad: 'Tuberculosis otras formas', nombre: 'Tuberculosis otras formas', nombreCorto: 'Tuberculosis otras formas', etiqueta: 'Tuberculosis otras formas (A17.1, A17.8, A17.9, A18-A19)', dataKey: 'tuberculosis_otras_formas_a171', marca: 'TUBERCULOSIS_OTRAS_FORMAS_A171', pagina: 'tuberculosis_otras_formas_a171.html', consulta: 'tuberculosis otras formas', cie: 'A17.1, A17.8-A17.9, A18-A19', color: '#7F1D1D',
      alias: ['tuberculosis otras formas', 'otras formas de tuberculosis', 'tuberculosis extrapulmonar', 'a18', 'a19', 'extrapulmonary tuberculosis'],
      prefijos: ['tuberculosis otras formas', 'otras formas de tuberculosis', 'tuberculosis extrapulmonar', 'extrapulmonary tuberculosis'],
    },
    {
      id: 'chagas_aguda_b570', pad: 'Tripanosomiasis americana (enfermedad de Chagas) aguda', nombre: 'Tripanosomiasis americana (enfermedad de Chagas) aguda', nombreCorto: 'Chagas aguda', etiqueta: 'Tripanosomiasis americana (enfermedad de Chagas) aguda (B57.0-B57.1)', dataKey: 'chagas_aguda_b570', marca: 'CHAGAS_AGUDA_B570', pagina: 'chagas_aguda_b570.html', consulta: 'tripanosomiasis americana aguda', cie: 'B57.0-B57.1', color: '#9A3412', seleccion: 'en pliegues de 2023 y 2024',
      alias: ['tripanosomiasis americana aguda', 'enfermedad de chagas aguda', 'chagas aguda', 'chagas agudo', 'b57 0', 'b57 1', 'acute chagas'],
      prefijos: ['chagas aguda', 'chagas agudo', 'enfermedad de chagas aguda', 'tripanosomiasis americana aguda', 'acute chagas'],
    },
    {
      id: 'tifo_murino_a752', pad: 'Tifo murino', nombre: 'Tifo murino', nombreCorto: 'Tifo murino', etiqueta: 'Tifo murino (A75.2)', dataKey: 'tifo_murino_a752', marca: 'TIFO_MURINO_A752', pagina: 'tifo_murino_a752.html', consulta: 'tifo murino', cie: 'A75.2', color: '#A16207',
      alias: ['tifo murino', 'tifus murino', 'tifo endemico', 'a75 2', 'murine typhus'],
      prefijos: ['tifo murino', 'tifus murino', 'tifo endemico', 'murine typhus'],
    },
    {
      id: 'sifilis_congenita_a50', pad: 'Sífilis congénita', nombre: 'Sífilis congénita', nombreCorto: 'Sífilis congénita', etiqueta: 'Sífilis congénita (A50)', dataKey: 'sifilis_congenita_a50', marca: 'SIFILIS_CONGENITA_A50', pagina: 'sifilis_congenita_a50.html', consulta: 'sifilis congenita', cie: 'A50', color: '#BE185D',
      alias: ['sifilis congenita', 'lues congenita', 'a50', 'congenital syphilis'],
      prefijos: ['sifilis congenita', 'lues congenita', 'congenital syphilis'],
    },
    {
      id: 'esavi_y58', pad: 'Eventos supuestamente asociados a la vacunación (ESAVI)', nombre: 'Eventos supuestamente asociados a la vacunación (ESAVI)', nombreCorto: 'ESAVI', etiqueta: 'Eventos supuestamente asociados a la vacunación, ESAVI (Y58, Y59)', dataKey: 'esavi_y58', marca: 'ESAVI_Y58', pagina: 'esavi_y58.html', consulta: 'eventos supuestamente asociados a la vacunacion', cie: 'Y58, Y59', color: '#4338CA',
      alias: ['eventos supuestamente asociados a la vacunacion', 'evento supuestamente asociado a la vacunacion', 'esavi', 'efectos adversos temporalmente asociados a vacunas', 'y58', 'y59'],
      prefijos: ['eventos supuestamente asociados', 'evento supuestamente asociado', 'esavi'],
    },
    {
      id: 'meningococica_a39', pad: 'Meningitis meningocócica', nombre: 'Meningitis meningocócica', nombreCorto: 'Meningitis meningocócica', etiqueta: 'Meningitis meningocócica (A39.0)', dataKey: 'meningococica_a39', marca: 'MENINGOCOCICA_A39', pagina: 'meningococica_a39.html', consulta: 'meningitis meningococica', cie: 'A39.0', color: '#9F1239',
      alias: ['meningitis meningococica', 'a39 0', 'meningococcal meningitis'],
      prefijos: ['meningitis meningococica', 'meningococcal meningitis'],
    },
    {
      id: 'neumococo_a40', pad: 'Enfermedad invasiva por neumococo', nombre: 'Enfermedad invasiva por neumococo', nombreCorto: 'Neumococo invasivo', etiqueta: 'Enfermedad invasiva por neumococo (A40.3, G00.1, J13)', dataKey: 'neumococo_a40', marca: 'NEUMOCOCO_A40', pagina: 'neumococo_a40.html', consulta: 'enfermedad invasiva por neumococo', cie: 'A40.3, G00.1, J13', color: '#1E3A8A',
      alias: ['enfermedad invasiva por neumococo', 'enfermedad neumococica invasiva', 'neumococo invasivo', 'a40 3', 'invasive pneumococcal disease'],
      prefijos: ['enfermedad invasiva por neumococo', 'enfermedad neumococica invasiva', 'neumococo invasivo', 'invasive pneumococcal'],
    },
    {
      id: 'haemophilus_a41', pad: 'Infecciones invasivas por Haemophilus influenzae', nombre: 'Infecciones invasivas por Haemophilus influenzae', nombreCorto: 'Haemophilus influenzae invasivo', etiqueta: 'Infecciones invasivas por Haemophilus influenzae (A41.3, G00.0, J14)', dataKey: 'haemophilus_a41', marca: 'HAEMOPHILUS_A41', pagina: 'haemophilus_a41.html', consulta: 'infecciones invasivas por haemophilus influenzae', cie: 'A41.3, G00.0, J14', color: '#4C1D95',
      alias: ['infecciones invasivas por haemophilus influenzae', 'infeccion invasiva por haemophilus influenzae', 'haemophilus influenzae', 'h influenzae', 'haemophilus', 'hemophilus', 'a41 3', 'invasive haemophilus influenzae'],
      prefijos: ['haemophilus', 'hemophilus', 'h influenzae'],
    },
    {
      id: 'herida_arma_fuego_w32', sensible: true, pad: 'Herida por arma de fuego', nombre: 'Herida por arma de fuego', nombreCorto: 'Herida por arma de fuego', etiqueta: 'Herida por arma de fuego (W32-W34)', dataKey: 'herida_arma_fuego_w32', marca: 'HERIDA_ARMA_FUEGO_W32', pagina: 'herida_arma_fuego_w32.html', consulta: 'herida por arma de fuego', cie: 'W32-W34', color: '#7F1D1D',
      alias: ['herida por arma de fuego', 'heridas por arma de fuego', 'w32', 'w33', 'w34'],
      prefijos: ['herida por arma de fuego', 'heridas por arma de fuego'],
    },
    {
      id: 'chagas_cronica_b572', pad: 'Tripanosomiasis americana (enfermedad de Chagas) crónica', nombre: 'Tripanosomiasis americana (enfermedad de Chagas) crónica', nombreCorto: 'Chagas crónica', etiqueta: 'Tripanosomiasis americana (enfermedad de Chagas) crónica (B57.2-B57.5)', dataKey: 'chagas_cronica_b572', marca: 'CHAGAS_CRONICA_B572', pagina: 'chagas_cronica_b572.html', consulta: 'tripanosomiasis americana cronica', cie: 'B57.2-B57.5', color: '#7C2D12', seleccion: 'en pliegues de 2023 y 2024',
      alias: ['tripanosomiasis americana cronica', 'enfermedad de chagas cronica', 'chagas cronica', 'chagas cronico', 'b57 2', 'b57 3', 'b57 4', 'b57 5', 'chronic chagas'],
      prefijos: ['chagas cronica', 'chagas cronico', 'enfermedad de chagas cronica', 'tripanosomiasis americana cronica', 'chronic chagas'],
    },
    {
      id: 'vih_b20', sensible: true, pad: 'Infección por el virus de la inmunodeficiencia humana', nombre: 'Infección por el virus de la inmunodeficiencia humana', nombreCorto: 'VIH', etiqueta: 'Infección por el virus de la inmunodeficiencia humana (B20-B24, Z21)', dataKey: 'vih_b20', marca: 'VIH_B20', pagina: 'vih_b20.html', consulta: 'infeccion por el virus de la inmunodeficiencia humana', cie: 'B20-B24, Z21', color: '#7C2D12', seleccion: 'en pliegues de 2023 y 2024',
      alias: ['infeccion por el virus de la inmunodeficiencia humana', 'virus de la inmunodeficiencia humana', 'infeccion por vih', 'vih', 'b20', 'b21', 'b22', 'b23', 'b24', 'z21', 'hiv', 'hiv infection'],
      prefijos: ['infeccion por el virus de la inmunodeficiencia humana', 'virus de la inmunodeficiencia humana', 'infeccion por vih', 'hiv infection'],
    },
    // Lote 6 de alta_b44 (19-nov-2026): tuberculosis respiratoria (aceptada en su prueba única) y cinco controles estacionales
    // tras rechazo por orden nominal del autor (meningitis tuberculosa, lepra, otras rickettsiosis, fiebre manchada y
    // leishmaniasis cutánea), nunca validados.
    {
      id: 'tuberculosis_respiratoria_a15', pad: 'Tuberculosis respiratoria', nombre: 'Tuberculosis respiratoria', nombreCorto: 'Tuberculosis respiratoria', etiqueta: 'Tuberculosis respiratoria (A15-A16)', dataKey: 'tuberculosis_respiratoria_a15', marca: 'TUBERCULOSIS_RESPIRATORIA_A15', pagina: 'tuberculosis_respiratoria_a15.html', consulta: 'tuberculosis respiratoria', cie: 'A15-A16', color: '#9F1239',
      alias: ['tuberculosis respiratoria', 'tuberculosis pulmonar', 'tb pulmonar', 'tb respiratoria', 'a15', 'a16', 'respiratory tuberculosis', 'pulmonary tuberculosis'],
      prefijos: ['tuberculosis respiratoria', 'tuberculosis pulmonar', 'respiratory tuberculosis', 'pulmonary tuberculosis'],
    },
    {
      id: 'meningitis_tuberculosa_a170', pad: 'Meningitis tuberculosa', nombre: 'Meningitis tuberculosa', nombreCorto: 'Meningitis tuberculosa', etiqueta: 'Meningitis tuberculosa (A17.0)', dataKey: 'meningitis_tuberculosa_a170', marca: 'MENINGITIS_TUBERCULOSA_A170', pagina: 'meningitis_tuberculosa_a170.html', consulta: 'meningitis tuberculosa', cie: 'A17.0', color: '#881337',
      alias: ['meningitis tuberculosa', 'meningitis por tuberculosis', 'tuberculosis meningea', 'a17 0', 'tuberculous meningitis'],
      prefijos: ['meningitis tuberculosa', 'meningitis por tuberculosis', 'tuberculosis meningea', 'tuberculous meningitis'],
    },
    {
      id: 'lepra_a30', pad: 'Lepra', nombre: 'Lepra', nombreCorto: 'Lepra', etiqueta: 'Lepra (A30)', dataKey: 'lepra_a30', marca: 'LEPRA_A30', pagina: 'lepra_a30.html', consulta: 'lepra', cie: 'A30', color: '#78350F',
      alias: ['lepra', 'enfermedad de hansen', 'hansen', 'a30', 'leprosy', 'hansen disease'],
      prefijos: ['lepra', 'enfermedad de hansen', 'leprosy'],
    },
    {
      id: 'otras_rickettsiosis_a79', pad: 'Otras rickettsiosis', nombre: 'Otras rickettsiosis', nombreCorto: 'Otras rickettsiosis', etiqueta: 'Otras rickettsiosis (A79)', dataKey: 'otras_rickettsiosis_a79', marca: 'OTRAS_RICKETTSIOSIS_A79', pagina: 'otras_rickettsiosis_a79.html', consulta: 'otras rickettsiosis', cie: 'A79', color: '#A16207', seleccion: 'en pliegues de 2023 y 2024',
      alias: ['otras rickettsiosis', 'rickettsiosis sin clasificacion de especie', 'a79', 'other rickettsioses'],
      prefijos: ['otras rickettsiosis', 'other rickettsioses'],
    },
    {
      id: 'fiebre_manchada_a770', pad: 'Fiebre manchada', nombre: 'Fiebre manchada', nombreCorto: 'Fiebre manchada', etiqueta: 'Fiebre manchada (A77.0)', dataKey: 'fiebre_manchada_a770', marca: 'FIEBRE_MANCHADA_A770', pagina: 'fiebre_manchada_a770.html', consulta: 'fiebre manchada', cie: 'A77.0', color: '#B45309',
      alias: ['fiebre manchada', 'fiebre manchada de las montanas rocosas', 'rickettsia rickettsii', 'a77 0', 'rocky mountain spotted fever', 'spotted fever'],
      prefijos: ['fiebre manchada', 'rocky mountain spotted fever', 'spotted fever'],
    },
    {
      id: 'leishmaniasis_cutanea_b551', pad: 'Leishmaniasis cutánea', nombre: 'Leishmaniasis cutánea', nombreCorto: 'Leishmaniasis cutánea', etiqueta: 'Leishmaniasis cutánea (B55.1)', dataKey: 'leishmaniasis_cutanea_b551', marca: 'LEISHMANIASIS_CUTANEA_B551', pagina: 'leishmaniasis_cutanea_b551.html', consulta: 'leishmaniasis cutanea', cie: 'B55.1', color: '#4D7C0F',
      alias: ['leishmaniasis cutanea', 'ulcera de los chicleros', 'b55 1', 'cutaneous leishmaniasis'],
      prefijos: ['leishmaniasis cutanea', 'ulcera de los chicleros', 'cutaneous leishmaniasis'],
    },
    // Último id de alta_b44 (19-nov-2026): paludismo por P. vivax, control estacional tras rechazo (sólo por 0 frente a 0 en
    // las series), autorizado por el autor; sin desglose por sexo (32 bases, 37 series).
    {
      id: 'paludismo_vivax_b51', pad: 'Paludismo por Plasmodium vivax', nombre: 'Paludismo por Plasmodium vivax', nombreCorto: 'Paludismo por P. vivax', etiqueta: 'Paludismo por Plasmodium vivax (B51)', dataKey: 'paludismo_vivax_b51', marca: 'PALUDISMO_VIVAX_B51', pagina: 'paludismo_vivax_b51.html', consulta: 'paludismo por plasmodium vivax', cie: 'B51', color: '#115E59',
      alias: ['paludismo por plasmodium vivax', 'paludismo por vivax', 'paludismo vivax', 'malaria por vivax', 'malaria vivax', 'plasmodium vivax', 'p vivax', 'b51', 'vivax malaria', 'plasmodium vivax malaria'],
      prefijos: ['paludismo por plasmodium vivax', 'paludismo por vivax', 'paludismo vivax', 'malaria vivax', 'plasmodium vivax', 'vivax malaria'],
    },
  ]);

  // Auditoría Codex de alta_b44 (19-nov-2026): los ejemplos visibles («pregunta por «…»») salían de `consulta`, que va sin
  // tildes porque es la forma normalizada que detectan los alias. Cada palabra se acentúa desde los nombres de
  // presentación del catálogo (nombre, etiqueta, pad y nombre corto); `consulta` sigue intacta para la detección.
  const TILDES = new Map();
  const sinTildeMin = (t) => String(t).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const r of releases) {
    for (const w of [r.nombre, r.etiqueta, r.pad, r.nombreCorto].join(' ').split(/[^A-Za-zÀ-ÿ]+/)) {
      if (w && sinTildeMin(w) !== w.toLowerCase()) TILDES.set(sinTildeMin(w), w.toLowerCase());
    }
  }
  /** Texto normalizado con las tildes de los nombres de presentación del catálogo. */
  function conTildes(texto) {
    return String(texto).replace(/[a-z]+/g, (w) => TILDES.get(w) || w);
  }
  for (const r of releases) r.consultaVisible = conTildes(r.consulta);

  /**
   * Subtipos de diabetes que nombra la consulta (ya normalizada), o null si no habla de los que se
   * modelan. Diabetes insípida y prediabetes no se modelan; la gestacional y la del embarazo son el release
   * O24.4 (no tipo 1 ni tipo 2): las tres quedan fuera de este detector.
   * modelados. Devuelve `{ pads, generica }`; `generica` indica que no se nombró ningún subtipo.
   */
  function diabetesEnConsulta(qn) {
    const q = ` ${String(qn)} `;
    if (!/ (diabet|dm ?[12] |e1[0-4] )/.test(q)) return null;
    if (/ (prediabet|pre diabet|gestacional|gestational|insipida|insipidus|embarazo|pregnancy)/.test(q)) return null;
    const sinNegada = q.replace(/ no insulinodependiente/g, ' dm2');
    const ambos = /(tipos? (1|i|uno) y (2|ii|dos)|types? (1|i|one) and (2|ii|two)|ambos tipos|los dos tipos|both types)/.test(sinNegada);
    const t1 = ambos || / ((tipo|type) (1|i|uno|one) |dm ?1 |e10 |juvenil|juvenile|insulinodependiente)/.test(sinNegada);
    const t2 = ambos || / ((tipo|type) (2|ii|dos|two) |dm ?2 |e1[1-4] )/.test(sinNegada);
    if (t1 && t2) return { pads: [T1, T2], generica: false };
    if (t1) return { pads: [T1], generica: false };
    return { pads: [T2], generica: !t2 };
  }

  const SUBTIPO_DIABETES = /\b(tipo (?:1|i|uno|2|ii|dos)|type (?:1|i|one|2|ii|two)|dm ?[12]|e1[0-4]|gestacional|gestational|insipida|insipidus)\b/;

  /**
   * «¿y tipo 2?» o «¿y gestacional?» tras una respuesta de diabetes: el seguimiento nombra otro
   * subtipo sin decir «diabetes», y heredar el padecimiento anterior respondería el subtipo
   * equivocado. Devuelve la consulta normalizada con la palabra añadida, o la misma si no aplica.
   */
  function conDiabetesNombrada(qn, padPrevio) {
    if (padPrevio !== T1 && padPrevio !== T2) return qn;
    if (/diabet/.test(qn) || !/^(y|pero|tambien|que hay de|ahora|and|what about)\b/.test(qn)) return qn;
    return qn.replace(SUBTIPO_DIABETES, 'diabetes $1');
  }

  /**
   * Seguimiento elíptico dentro de una familia con bloques hermanos: tras «hepatitis A en Jalisco», «¿y la C?»
   * nombra la C, no hereda la A; tras desnutrición leve, «¿y la severa?» nombra la severa, y
   * tras una displasia, «¿y la severa?» o «¿y la leve?» nombra el bloque hermano.
   */
  const FAMILIAS = [
    { pads: ['Hepatitis vírica A', 'Hepatitis vírica B', 'Hepatitis vírica C', 'Otras hepatitis víricas'], ya: /hepatitis/,
      de: /\b(?:(?:la|el|tipo|de la) )?([abcde])\s*$/, a: ' hepatitis virica $1' },
    { pads: ['Hepatitis vírica A', 'Hepatitis vírica B', 'Hepatitis vírica C', 'Otras hepatitis víricas'], ya: /hepatitis/,
      de: /\b(?:las )?otras\s*$/, a: ' otras hepatitis viricas' },
    { pads: ['Desnutrición leve', 'Desnutrición moderada', 'Desnutrición severa'], ya: /desnutric|malnutri/, de: /\b(?:la )?(leve|moderada|severa|grave)\s*$/,
      a: ' desnutricion $1' },
    { pads: ['Displasia cervical leve y moderada', 'Displasia cervical severa y CaCu in situ'], ya: /displasia/,
      de: /\b(?:la )?(leve|moderada|severa|grave)\s*$/, a: ' displasia cervical $1' },
    { pads: ['Sífilis adquirida'], ya: /\b(sifilis|syphilis|lues|neurosifilis|neurosyphilis)\b/,
      de: /^(?:y|pero|tambien|que hay de|ahora|and|what about)\b.*\b(congenit[a-z]*|neonatal\w*|connatal\w*|perinatal\w*|vertical|materno ?infantil|fetal\w*|mortinat\w*|stillbirth\w*)\b.*$/,
      a: 'y sifilis congenita' },
    { pads: ['Sífilis adquirida'], ya: /\b(sifilis|syphilis|lues|neurosifilis|neurosyphilis)\b/,
      de: /^(?:y|pero|tambien|que hay de|ahora|and|what about)\b.*\b(gestacional|gestational|gestantes?|matern[ao]s?|maternal|embaraz\w*|pregnan\w*|puerper\w*|parto|childbirth)\b.*$/,
      a: 'y sifilis en el embarazo' },
    { pads: ['Sífilis adquirida'], ya: /\b(sifilis|syphilis|lues|neurosifilis|neurosyphilis)\b/,
      de: /^(?:y|pero|tambien|que hay de|ahora|and|what about)\b.*\b(recien nacid[oa]s?|newborns?|neonat[oa]s?|bebes?|babies|baby|lactantes?|infants?|nin[oa]s?|children|child|menores?(?: de \d{1,3}(?: anos?)?| de edad)?|adolescentes?|teenagers?|teens?|pediatric[oa]?s?|paediatric\w*|(?:menores?|mayores?) de \d{1,3}(?: anos?)?|under \d{1,3}(?: years?(?: old)?)?)\b.*$/,
      a: 'y sifilis en menores' },
  ];
  FAMILIAS.push(
    { pads: ['Tripanosomiasis americana (enfermedad de Chagas) aguda', 'Tripanosomiasis americana (enfermedad de Chagas) crónica'],
      ya: /chagas|tripanosomiasis/, de: /\b(?:la |el )?(aguda|agudo|cronica|cronico)\s*$/, a: ' chagas $1' },
  );
  function conFamiliaNombrada(qn, padPrevio) {
    if (!/^(y|pero|tambien|que hay de|ahora|and|what about)\b/.test(qn)) return qn;
    const f = FAMILIAS.find((x) => x.pads.includes(padPrevio) && !x.ya.test(qn) && x.de.test(qn));
    return f ? qn.replace(f.de, f.a).replace(/\s+/g, ' ').trim() : qn;
  }

  /**
   * Formas que describen un padecimiento publicado con palabras que, leídas sueltas, apuntan a otro:
   * «isquemia cerebral» es cerebrovascular y «cardiopatía isquémica» no es una cardiopatía sin modelar.
   */
  const CANON_CLINICO = [
    [/\bcerebro vascular(es)?\b/g, 'cerebrovascular'],
    [/\benfermedad(es)? vascular(es)? cerebral(es)?\b/g, 'enfermedad cerebrovascular'],
    [/\b(isquemia|isquemica|isquemico|infarto|embolia|ataque|evento|accidente)( vascular)? cerebral(es)?\b/g,
      'enfermedad cerebrovascular'],
    [/\bcardiopatias? isquemicas?\b/g, 'enfermedad isquemica'],
    // Hepatitis víricas: la letra va sola tras «hepatitis» y nombraAlias compara por prefijo («hepatitis e»
    // capturaría «hepatitis en»). Se reescriben a una forma canónica con la letra como palabra completa.
    // «a» puede ser preposición («hepatitis a nivel nacional», «a partir de 2020») y «e» conjunción ante i/hi
    // («hepatitis e influenza»): en esos casos no es la letra del virus. Abreviaturas sólo como palabra completa
    // (`hav` era prefijo de «have»).
    [/\b(hav|vha|hep a)\b/g, 'hepatitis virica a'],
    [/\b(hcv|vhc|hep c)\b/g, 'hepatitis virica c'],
    [/\b(hbv|vhb|hep b)\b/g, 'hepatitis virica b'],
    [/\bhepatitis (cronica (virica |viral )?b|(virica |viral |por (el )?virus (de la )?)?b (en (fase|etapa) )?cronica)\b/g, 'hepatitis virica b cronica'],
    [/\bhepatitis delta\b/g, 'hepatitis virica d'],
    [/\bhepatitis (tipo |virica |viral |por (el )?virus (de la )?)?([bcd]|a(?! (nivel|partir|la|las|lo|los|el|traves|pesar|mediados|finales|principios|inicios|fin|corto|largo|mediano|futuro|que|su|sus|mi|mis|cada|escala|diario|semana|semanas|mes|meses|ano|anos|un|una|dos|tres|cuatro|cinco|detalle|fondo|tiempo|dia|hoy|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b| ?[0-9])|e(?! h?i))\b/g,
      'hepatitis virica $4'],
    [/\bhepatitis virica ([abcde]) (y|e|o) (la |el )?([abcde])\b/g, 'hepatitis virica $1 $2 hepatitis virica $4'],
    [/\bhepatitis virica b (en (fase|etapa) )?cronica\b/g, 'hepatitis virica b cronica'],
    // «Salmonelosis no tifoidea» es el bloque A02: la palabra «tifoidea» negada no nombra A01.0.
    [/\b(salmonelosis|salmonell?a|salmonellosis)( no| non)[ -]?(tifoid(ea|ica|eas|icas)?|typhoid(al)?)\b|\bnon[ -]?typhoid(al)? salmonell?(a|osis)\b/g,
      'otras salmonelosis'],
    // Neoplasia intraepitelial cervical: grado III es el bloque severo (N87.2), grados I y II el leve (N87.0-N87.1).
    [/\bneoplasias? intraepitelial(es)? cervical(es)?( de)?( grado)? (3|iii|tres)\b|\b(nic|cin) ?(3|iii)\b/g, 'displasia cervical severa'],
    [/\bneoplasias? intraepitelial(es)? cervical(es)?( de)?( grado)? (1|2|i|ii|uno|dos)\b|\b(nic|cin) ?(1|2|i|ii)\b/g, 'displasia cervical leve'],
    // Salmonella Typhi causa la fiebre tifoidea (A01.0) y Paratyphi la paratifoidea (A01.1-A01.4), no el bloque A02.
    [/\bsalmonell?a (enterica )?(serovar )?typhi\b|\bs typhi\b/g, 'fiebre tifoidea'],
    [/\bsalmonell?a (enterica )?(serovar )?paratyphi\b|\bs paratyphi\b/g, 'paratifoidea'],
    // La gastroenteritis o diarrea por rotavirus es el bloque A08.0, no el de infecciones intestinales (A04, A08-A09).
    [/\b(gastro ?enteritis|diarreas?|infecci(on|ones) intestinal(es)?|infecci(on|ones) gastrointestinal(es)?) (debidas? a|por) (el )?rotavirus\b|\brotavirus (gastroenteritis|diarrhea|diarrhoea)\b/g,
      'enteritis por rotavirus'],
    // La amebiasis del hígado es el absceso hepático amebiano (A06.4), con bloque propio fuera de la intestinal.
    [/\b(amebiasis|amibiasis|amoebiasis)( del| de)? (hepatica|higado)\b|\bhepatic (amebiasis|amoebiasis)\b/g, 'absceso hepatico amebiano'],
    // «a06» es alias de la amebiasis intestinal y captaría «a06.4»: el código del absceso se nombra por su bloque.
    [/\ba06(\.4|4| 4(?! ?(semanas?|sem|dias?|meses|mes|anos?|weeks?|days?|months?|years?)\b))\b/g, 'absceso hepatico amebiano'],
    // El cáncer cervicouterino in situ (D06) es parte del bloque de displasia severa, no del C53 invasor.
    [/\b(cancer|carcinoma|ca|tumor|neoplasia)( maligno| maligna)?( de| del)?( cuello( del)? (utero|uterino)| cervicouterino| cervical| cervix)( in situ)\b|\b(cancer|carcinoma|tumor|neoplasia)( maligno| maligna)? in situ( de| del)?( cuello( del)? (utero|uterino)| cervicouterino| cervical| cervix)\b|\bcervical carcinoma in situ\b/g,
      'cacu in situ'],
    // El nombre del bloque A07 contiene «infecciones intestinales», alias de A04: se reduce a un término
    // propio para que la consulta no nombre los dos releases.
    // «Otras infecciones intestinales debidas a protozoarios» es el bloque (A07.0, A07.2, A07.9); sin «otras»,
    // o con «protozoos», la consulta abarca la giardiasis y otras protozoosis con código propio.
    [/\botras infecci(on|ones) intestinal(es)? (debidas? a|por) protozo(arios?|os?)\b/g, 'otras protozoosis intestinales'],
    [/(?<!otras )\b(infecci(on|ones) intestinal(es)? (debidas? a|por) protozo(arios?|os?|a)|intestinal infections? due to protozoa|protozoos|protozoarios|protozoosis( intestinal(es)?)?)\b/g,
      'protozoosis intestinal'],
    // Formas clínicas y subcódigos pegados de sífilis adquirida (A51-A53): A51.0 y A51.1 nombran el sitio entre «sífilis» y «primaria».
    [/\bsifilis (genital|anal) primaria\b/g, 'sifilis primaria'],
    [/\bprimary (genital|anal) syphilis\b/g, 'primary syphilis'],
    [/\bchancros? (sifilitic[oa]s?|duros?)\b|\bsyphilitic chancres?\b/g, 'sifilis primaria'],
    [/\btabes dorsal(is)?\b/g, 'neurosifilis'],
    [/\b(a5[123])([0-9])\b/g, '$1.$2'],
    // alta_b44 (19-nov-2026). La sífilis neonatal, connatal, perinatal o juvenil es la congénita (A50), con su propio control.
    [/\b(sifilis|lues) (neonatal|connatal|perinatal|vertical|materno ?infantil|congenita (precoz|tardia|latente))\b|\bneurosifilis (juvenil|congenita)\b|\bsifilis juvenil\b/g, 'sifilis congenita'],
    [/\b(sifilis|lues) (adquirida|congenita) (y|e|o|vs|versus) (la )?(adquirida|congenita)\b/g, 'sifilis $2 y sifilis $5'],
    [/\b(early |late )?congenital neurosyphilis\b|\b(neonatal|fetal) syphilis\b|\b(early|late) congenital syphilis\b/g, 'congenital syphilis'],
    // «conjuntivitis» sola es H10: la epidémica aguda hemorrágica (B30.3) se reescribe a una forma que no empiece por «conjuntivit».
    [/\bconjuntivitis ((aguda|epidemica) )*hemorragica( (aguda|epidemica))*\b|\b((acute|epidemic) )*hemorrhagic conjunctivitis\b/g, 'hemorragica conjuntival epidemica'],
    // Rótulo técnico completo de Z91.5 y R45.8: el paréntesis del boletín («intento de suicidio», «ideación suicida») es parte
    // del nombre del bloque publicado, no una consulta genérica aparte.
    [/\b(historia personal de lesion autoinfligida intencionalmente)\W+intento de suicidio\b/g, '$1'],
    [/\b(otros sintomas y signos que involucran el estado emocional)\W+ideacion suicida\b/g, '$1'],
    // Códigos pegados de los bloques nuevos con decimal («t632», «z915», «r458», «a390»).
    [/\b(t63|u60|a54|a59|a60|a39|a40|a41|a92|a75|b57|k70|f10|z91|r45|y07|b97|b30)([0-9])\b/g, '$1.$2'],
  ];
  // Un término de hipertensión junto a uno del embarazo, parto o puerperio nombra el bloque O10-O16,
  // no la hipertensión arterial (I10-I15): se reescribe a su forma canónica y se retira el término de
  // hipertensión, para que ningún detector vea dos padecimientos.
  const HTA_TERMINO = /\b(hipertension( arterial)?|hipertens[ao]s?|presion( arterial)? alta|tension( arterial)? alta|presion arterial|tension arterial|hypertension|high blood pressure)\b/g;
  const EMBARAZO_TERMINO = /\b(embaraz\w*|gestacion\w*|gestacional|gestational|gravidez|puerperio|posparto|parto|pregnan\w*)\b/g;
  // Presión baja no es hipertensión, y «diabetes gestacional e hipertensión» o «hipertensión y diabetes
  // en el embarazo» pueden atar el embarazo a la diabetes: en esos casos no se reescribe nada, para que
  // el aviso de no modelado (hipotensión, diabetes del embarazo) siga viendo sus términos.
  const PRESION_BAJA = /\b(hipotension|hypotension|presion( arterial)? baja|tension( arterial)? baja|low blood pressure)\b/;
  function hipertensionDelEmbarazo(q) {
    if (PRESION_BAJA.test(q)) return q;
    const hta = new RegExp(HTA_TERMINO.source).exec(q);
    if (!hta || !new RegExp(EMBARAZO_TERMINO.source).test(q)) return q;
    // Con diabetes en la consulta, el término del embarazo puede ser de la diabetes («diabetes gestacional
    // e hipertensión»): sólo cuenta si va DESPUÉS de la hipertensión («hipertensión y diabetes en el
    // embarazo»), y entonces se reescribe sólo la hipertensión, sin quitar el término de la diabetes.
    if (/\bdiabet/.test(q)) {
      const despues = q.slice(hta.index + hta[0].length);
      if (!new RegExp(EMBARAZO_TERMINO.source).test(despues)) return q;
      return q.replace(HTA_TERMINO, ' trastornos hipertensivos del embarazo ').replace(/\s+/g, ' ').trim();
    }
    return `${q.replace(HTA_TERMINO, ' ').replace(EMBARAZO_TERMINO, ' ')} trastornos hipertensivos del embarazo`
      .replace(/\s+/g, ' ').trim();
  }
  function canonClinico(qn) {
    return hipertensionDelEmbarazo(CANON_CLINICO.reduce((q, [de, a]) => q.replace(de, a), String(qn)));
  }

  /** Alias al inicio de palabra; un código CIE («i10») debe coincidir completo, no como «i100». */
  function nombraAlias(qn, alias) {
    const q = ` ${String(qn).replace(/[^a-z0-9]+/g, ' ')} `;
    return q.includes(` ${alias}${/\d/.test(alias) ? ' ' : ''}`);
  }

  /**
   * Lista única del KB y de rag.mjs. Una consulta que nombra alguna no recibe cifras modeladas.
   * Se compara al inicio de palabra; una entrada que termina en espacio («ira ») exige la palabra
   * completa, para que una sigla no capture «Irapuato».
   */
  const noModeladas = Object.freeze([
    // Los términos genéricos de suicidio y autolesión dan la respuesta de crisis (`respuestaCrisis`) antes de llegar
    // aquí; siguen en la lista para que ningún otro detector los lea como padecimiento (alta_b44, 19-nov-2026).
    'intento de suicidio', 'ideacion suicida', 'autolesion', 'lesion autoinfligida', 'self harm',
    'suicidio', 'suicida', 'suicide', 'suicidal',
    // Categorías del boletín sobre autolesión y violencias: sin cifras en EPI, y sin caer en la tabla
    // neuro del estado («violencia intrafamiliar en jalisco» la mostraba).
    'lesiones autoinfligidas', 'envenenamiento autoinfligido', 'autoinfligid',
    'violencia', 'abuso sexual', 'agresion sexual', 'violacion', 'maltrato', 'arma de fuego',
    'herida de bala', 'heridas de bala', 'balazo', 'domestic violence', 'gunshot',
    'hipotension', 'hypotension', 'presion baja', 'presion arterial baja', 'tension baja',
    'tension arterial baja',
    'cancer', 'hipertension pulmonar', 'prediabetes', 'diabetes insipida', 'epilepsia',
    'esquizofrenia', 'ansiedad', 'bipolar', 'autismo', 'tdah',
    // alta_b44: el VIH (B20-B24, Z21, desde 2020-W28) está publicado; «sida» es otra definición y sigue sin modelarse.
    'influenza', 'covid', 'sida', 'colera',
    'sarampion', 'rubeola', 'hepatitis', 'zika', 'malaria',
    'linfoma', 'tumor', 'neoplasia', 'cardiopatia congenita', 'cardiopatia', 'infarto',
    'ataque al corazon', 'ataque cardiaco',
    'embolia', 'bronquitis', 'enfisema', 'artritis',
    'lupus', 'fibromialgia', 'esclerosis', 'huntington', 'ela ',
    'insuficiencia renal', 'insuficiencia cardiaca',
    // En inglés: sin esto, «epilepsy in jalisco» caería en la tabla neuro del estado.
    'diabetes insipidus', 'prediabetic',
    'epilepsy', 'schizophrenia', 'anxiety', 'aids', 'measles',
    'lymphoma', 'heart attack', 'bronchitis', 'arthritis',
    'kidney failure', 'heart failure',
  ]);

  const HIPERTENSION = /\b(hipertens|hypertens|presion alta|presion arterial|tension alta|tension arterial|high blood pressure)/;
  /** Hipertensiones con código propio, fuera de I10-I15: nunca reciben sus cifras. */
  const HIPERTENSION_AJENA = [
    [/\b(pulmonar|pulmonary)/, 'hipertension pulmonar'],
    [/\bportal\b/, 'hipertension portal'],
    [/\b(intracraneal|intracranial|endocraneal)/, 'hipertension intracraneal'],
    [/\b(ocular|intraocular)\b/, 'hipertension ocular'],
  ];

  /**
   * Formas de los cánceres publicados (mama y cuello del útero). Se retiran antes de buscar no
   * modelados para que «cáncer» no los tape; cualquier otro cáncer sigue sin modelarse.
   */
  const CANCER_MAMA = /\b(cancer|tumor(es)? malign[oa]s?|neoplasias? malignas?|carcinomas?)( de| del| en)?( la| las| el| los)? (mamas?|senos?|cuello( del)? (utero|uterino)|cervix)\b|\bcancer (mamario|cervicouterino|cervical)\b|\b(breast|cervical) cancer\b/g;

  // Alias de releases publicados, del más largo al más corto: se retiran antes de buscar no modelados
  // para que «cáncer», «tumor» o «linfoma» genéricos no tapen un cáncer publicado.
  const ALIAS_PUBLICADOS = releases.flatMap((r) => r.alias).filter((a) => a.trim().length > 3)
    .sort((a, b) => b.length - a.length);
  function sinAliasPublicados(q) {
    return ALIAS_PUBLICADOS.reduce((t, a) => t.split(` ${a.trim()} `).join(' '), q);
  }

  /**
   * Formas con código propio vecinas de un bloque publicado: no reciben sus cifras. Cada entrada lleva
   * la consulta normalizada que la reconoce, el término de no modelado, su nombre visible y el release
   * vecino cuyo alias la capturaría. Los códigos se comparan con o sin punto («a06 4», «a06.4»): el
   * alias «a06» abarca «a06 4» porque nombraAlias cambia la puntuación por espacios.
   */
  // Un código con espacio («a06 4») se lee como subcódigo salvo que el número cuente semanas, días o
  // meses («a06 4 semanas»).
  const NO_UNIDAD = '(?! ?(semanas?|sem|dias?|meses|mes|anos?|weeks?|days?|months?|years?)\\b)';
  const subcodigo = (base, digitos) => new RegExp(`\\b${base}(\\.[${digitos}]|[${digitos}]| [${digitos}]${NO_UNIDAD})\\b`);
  // Peatones y ciclistas sólo son un subtipo ajeno cuando la consulta habla de un accidente o de
  // transporte: «obesidad en ciclistas» o «asma en peatones» no preguntan por V01-V19.
  const TRANSPORTE = /\b(accident\w*|atropell\w*|lesion\w*|choques?|colision\w*|transporte|transito|trafico|vial(es)?|crash\w*|collision\w*|injur\w*|traffic|v[0-9][0-9])\b/;
  const SUBTIPOS_AJENOS = [
    [subcodigo('a06', '5-8'), 'otra amebiasis extraintestinal',
      'otras amebiasis fuera del intestino (A06.5-A06.8)', 'amebiasis_a06'],
    [/\b(amebiasis|amibiasis|amoebiasis|amebic|amoebic)( (del|de|en el|en la|of the))? (extraintestinal|cutanea|pulmonar|cerebral|skin|lung|brain)\b|\bextraintestinal (amebiasis|amibiasis|amoebiasis)\b/,
      'otra amebiasis extraintestinal', 'otras amebiasis fuera del intestino (A06.5-A06.8)', 'amebiasis_a06'],
    [subcodigo('h65', '2-9'), 'otitis media cronica', 'otitis media crónica (H65.2-H65.9)', 'otitis_h65'],
    [/\bh66\b|\botitis( [a-z]+){0,3} (no aguda|cronic[ao]s?|chronic|supurativ[ao]s?|suppurative|purulent[ao]s?|purulent)\b|\b(chronic|suppurative|purulent) otitis\b/,
      'otitis media cronica o supurativa',
      'otitis media crónica (H65.2-H65.9) ni supurativa o purulenta (H66)', 'otitis_h65'],
    [/\botitis externa\b|\botitis del nadador\b|\b(external otitis|otitis externa|swimmer s ear)\b|\bh60\b/, 'otitis externa',
      'otitis externa (H60)', 'otitis_h65'],
    [/\botitis interna\b|\binternal otitis\b/, 'otitis interna', 'otitis interna, que no forma parte de H65.0-H65.1',
      'otitis_h65'],
    // La epidémica aguda hemorrágica (B30.3) tiene su propio control desde alta_b44 (CANON_CLINICO la reescribe antes).
    [/\bconjuntivitis( [a-z]+){0,3} (viral(es)?|viricas?|virus|adenovir[a-z]*|epidemicas?|gonococ[a-z]*|neonatal(es)?|recien nacidos?|herpetic[a-z]*|clamidi[a-z]*|chlamydi[a-z]*)\b|\b(viral|adenoviral|epidemic|gonococcal|neonatal|chlamydial|herpetic) conjunctivitis\b|\bb30(?![ .]?3\b)([ .]?[0-9])?\b/,
      'conjuntivitis fuera de h10',
      'conjuntivitis viral fuera de la epidémica aguda hemorrágica (B30, excepto B30.3, que tiene su propio control estacional), ni las conjuntivitis gonocócica, por clamidia, herpética o neonatal, que tienen código propio fuera de H10',
      'conjuntivitis_h10'],
    [/\b(bicicletas?|ciclistas?|bicycles?|cyclists?)\b|\bv1[0-9]\b/, 'ciclista lesionado',
      'ciclista lesionado en accidente de transporte (V10-V19)', 'vehiculos_v20', TRANSPORTE],
    [subcodigo('b37', '0-25-9'), 'candidiasis fuera de b37.3-b37.4',
      'candidiasis fuera de la urogenital (B37.0-B37.2, B37.5-B37.9)', 'candidiasis_b37'],
    [/\b(candidiasis|candida|candidosis|moniliasis)( [a-z]+){0,2} (oral|orales|bucal|boca|esofagica|esofago|cutanea|piel|unas|ungueal|pulmonar|sistemica|invasiva|diseminada|meningea|septicemia|sepsis|endocarditis)\b|\b(algodoncillo|muguet|oral thrush|thrush)\b|\b(oral|esophageal|cutaneous|invasive|systemic) candidiasis\b/,
      'candidiasis fuera de b37.3-b37.4', 'candidiasis fuera de la urogenital (B37.0-B37.2, B37.5-B37.9)', 'candidiasis_b37'],
    [subcodigo('o24', '0-35-9'), 'diabetes preexistente en el embarazo',
      'diabetes preexistente en el embarazo (O24.0-O24.3) ni la no especificada (O24.9)', 'embarazo_diabetes_o24'],
    [/\bdiabetes( mellitus)? (pregestacional|preexistente|previa)\b|\bdiabetes( mellitus)? (tipo|type) ?(1|2|i|ii|uno|dos|one|two)\b.*\b(embaraz|gestac|pregnan)|\b(embaraz|gestac|pregnan)[a-z]* .*\bdiabetes( mellitus)? (tipo|type) ?(1|2|i|ii|uno|dos|one|two)\b/,
      'diabetes preexistente en el embarazo', 'diabetes preexistente en el embarazo (O24.0-O24.3)', 'embarazo_diabetes_o24'],
    [/\berisipeloide\b|\ba26\b|\berysipeloid\b/, 'erisipeloide', 'erisipeloide (A26)', 'erisipela_a46'],
    // Auditoría Codex de alta_b44 (19-nov-2026): «alcohol» capturaba por prefijo el metílico y el isopropílico, que son
    // intoxicaciones por otros alcoholes (T51.1-T51.9) y no la intoxicación aguda por alcohol etílico (F10.0).
    [/\b(alcohol(es)? (metilic[oa]s?|isopropilic[oa]s?|de madera|desnaturalizad[oa]s?|de curacion|para curar|no etilic[oa]s?|industrial(es)?|de quemar)|otros alcoholes|metanol|isopropanol|propanol|etilenglicol|methanol|isopropanol|(methyl|isopropyl|rubbing|wood|denatured) alcohol|other alcohols|t51( [0-9])?)\b/,
      'alcohol no etilico',
      'la intoxicación por alcohol metílico, isopropílico ni por otros alcoholes no etílicos (T51.1-T51.9)', 'intox_alcohol_f100'],
    // Subtipos con código propio fuera de los bloques de los diez controles (12-nov-2026). La giardiasis (A07.1)
    // tiene su propio control desde alta20c (15-nov-2026).
    [/\bisosporiasis\b|\bciclosporiasis\b|\btricomoniasis intestinal\b/,
      'otra protozoosis intestinal con codigo propio',
      'otras protozoosis intestinales con código propio (A07.3, A07.8)', 'protozoarios_a07'],
    [subcodigo('a07', '38'), 'otra protozoosis intestinal con codigo propio',
      'otras protozoosis intestinales con código propio (A07.3, A07.8)', 'protozoarios_a07'],
    [/\bfaringitis( aguda)? (viral(es)?|no estreptococic[ao]s?|por virus|bacteriana no estreptococica)\b|\bviral pharyngitis\b/,
      'faringitis no estreptococica', 'faringitis aguda no estreptocócica (J02.8-J02.9)', 'faringitis_j02'],
    [subcodigo('j02', '89'), 'faringitis no estreptococica', 'faringitis aguda no estreptocócica (J02.8-J02.9)',
      'faringitis_j02'],
    [subcodigo('n87', '9'), 'displasia cervical no especificada', 'displasia cervical no especificada (N87.9)',
      'displasia_leve_n87'],
    // Subtipos con código propio vecinos de los seis controles de alta10b (12-nov-2026). La desnutrición moderada y
    // la severa tienen su propio control desde alta20c (15-nov-2026).
    [/\bparvovirus\b|\beritema infeccioso\b|\bquinta enfermedad\b/, 'parvovirus b19',
      'infección por parvovirus B19 (B08.3, B34.3), que no es una hepatitis', 'otras_hepatitis_b17'],
    // La hepatitis alcohólica (K70.1) se cuenta dentro de la enfermedad alcohólica del hígado (ACLARACIONES, alta_b44).
    [/\bhepatitis (autoinmune|toxica|medicamentosa|autoimmune|toxic|drug induced)\b|\bk7[1-5]\b/,
      'hepatitis no virica', 'hepatitis no vírica (autoinmune o tóxica), con código propio fuera de B15-B19',
      'hepatitis_c_b17'],
    [/\b(herpes zoster|culebrilla|shingles)\b|(?<!varicela )\bzoster\b|\bb02\b/, 'herpes zoster', 'herpes zóster (B02)', 'varicela_b01'],
    [/\bparotiditis (no infecciosa|bacteriana|supurativa|cronica|purulenta)\b|\bk11\b/, 'parotiditis no debida al virus de las paperas',
      'parotiditis no debida al virus de las paperas ni otras enfermedades de las glándulas salivales (K11)', 'parotiditis_b26'],
    [/\bquemaduras? (solar(es)?|de sol|por (el )?sol)\b|\bsunburns?\b|\bl55\b/, 'quemaduras solares',
      'quemaduras solares (L55), que el boletín reporta aparte', 'quemaduras_t20'],
    [subcodigo('i87', '0189'), 'otra enfermedad venosa', 'otras enfermedades de las venas fuera de I87.2 (I87.0, I87.1, I87.8, I87.9)', 'ivp_i87'],
    [/\bsindromes? (postromboticos?|post tromboticos?|postfleb[a-z]*|post fleb[a-z]*)\b|\bpost ?thrombotic syndrome\b/, 'sindrome postrombotico',
      'síndrome postrombótico (I87.0)', 'ivp_i87'],
    [/\bvarices\b|\bvenas varicosas\b|\bvaricose veins\b|\bi83\b|\btrombosis venosa\b|\bflebitis\b|\bi80\b/,
      'varices o trombosis venosa', 'várices (I83) ni flebitis o trombosis venosa (I80)', 'ivp_i87'],
    [/\bv(3[0-9]|8[0-9]|9[0-9])\b/, 'otro accidente de transporte',
      'accidentes de transporte fuera de V20-V29 y V40-V79', 'vehiculos_v20'],
    // Categorías vecinas de Sífilis adquirida (A51-A53) en el Cuadro 6 y códigos relacionados fuera de los bloques publicados.
    // Desde alta_b44 (19-nov-2026) tienen release propio la sífilis congénita (A50), la gonocócica genitourinaria
    // (A54.0-A54.2), el linfogranuloma (A55), el chancro blando (A57), la tricomoniasis urogenital (A59.0) y el herpes
    // genital (A60.0): sólo quedan aquí sus códigos hermanos fuera de esos bloques.
    [new RegExp(`\\bo98(?:\\.1|1| 1${NO_UNIDAD})?\\b|\\b(sifilis|syphilis|lues|neurosifilis|neurosyphilis|sifilitic[oa]s?|syphilitic)\\b.*\\b(embaraz\\w*|gestacion\\w*|gestantes?|gestational|matern[ao]s?|maternal|puerper\\w*|parto|pregnan\\w*|childbirth)\\b|\\b(matern[ao]s?|maternal|gestacion\\w*|gestantes?|gestational|embaraz\\w*|pregnan\\w*|puerper\\w*|parto|childbirth)\\b.*\\b(sifilis|syphilis|lues|neurosifilis|neurosyphilis|sifilitic[oa]s?|syphilitic)\\b`),
      'sifilis en el embarazo', 'sífilis que complica el embarazo, el parto y el puerperio (O98.1), ni desglosa A51-A53 por embarazo', 'sifilis_adquirida_a51'],
    [new RegExp(`\\ba65(?:\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})?\\b|\\b(sifilis|syphilis|lues) (no venere[ao]s?|non ?venereal|endemic[ao]s?)\\b|\\b(non ?venereal|endemic) (syphilis|lues)\\b|\\bbejel\\b`),
      'sifilis no venerea', 'sífilis no venérea o bejel (A65)', 'sifilis_adquirida_a51'],
    [new RegExp(`\\ba66(?:\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})?\\b|\\b(frambesia|pian|yaws)\\b`),
      'frambesia', 'frambesia o pian (A66)', 'sifilis_adquirida_a51'],
    [new RegExp(`\\ba54(?:\\.[3-9]|[3-9]| [3-9]${NO_UNIDAD})\\b|\\b(gonorrea|gonorrhea|infeccion gonococica|gonococ[a-z]*) (faringea|de (la )?garganta|anorrectal|rectal|anal|ocular|oftalmica|articular|diseminada|musculoesqueletica)\\b|\\b(faringitis|proctitis|artritis|oftalmia) gonococica\\b|\\bgonococcal (pharyngitis|proctitis|arthritis)\\b`),
      'otra infeccion gonococica', 'infecciones gonocócicas fuera del tracto genitourinario (A54.3-A54.9)', 'gonococica_a54'],
    [new RegExp(`\\ba56(?:\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})?\\b|^(?!.*\\b(linfogranuloma|lymphogranuloma)\\b).*\\b(clamidia|clamidias|clamidiasis|chlamydia)\\b`),
      'infeccion por clamidias', 'otras infecciones de transmisión sexual por clamidias (A56), fuera del linfogranuloma venéreo (A55)', 'linfogranuloma_a55'],
    [new RegExp(`\\ba59(?:\\.[89]|[89]| [89]${NO_UNIDAD})\\b`),
      'otra tricomoniasis', 'otras tricomoniasis fuera de la urogenital (A59.8-A59.9)', 'tricomoniasis_a590'],
    [new RegExp(`\\ba60(?:\\.[19]|[19]| [19]${NO_UNIDAD})\\b|\\bherpes (perianal|anorrectal)\\b`),
      'otra infeccion herpetica anogenital', 'infección herpética perianal o anogenital no especificada (A60.1, A60.9)', 'herpes_genital_a600'],
    [new RegExp(`\\ba(58|63|64)(?:\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})?\\b|\\bgranuloma inguinal\\b|\\bdonovanosis\\b|\\bverrugas? (anogenital(es)?|venereas?)\\b|\\bcondilomas?( acuminados?)?\\b`),
      'otra infeccion de transmision sexual', 'otras infecciones de transmisión sexual con código propio (A58, A63, A64)', 'sifilis_adquirida_a51'],
    // Vecinos de los bloques nuevos de alta_b44 con código propio, sin cifras.
    [new RegExp(`\\ba33\\b|\\btetanos (neonatal|del recien nacido)\\b|\\bneonatal tetanus\\b`), 'tetanos neonatal',
      'tétanos neonatal (A33), que el boletín notifica aparte', 'tetanos_a34'],
    // Lote 6: la tuberculosis respiratoria (A15-A16) y la meningitis tuberculosa (A17.0) tienen ya su propio release.
    [new RegExp(`\\b(plasmodium )?falciparum\\b|\\bb50(?:\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})?\\b`),
      'paludismo por falciparum', 'el paludismo por Plasmodium falciparum (B50), que el boletín notifica aparte', 'paludismo_vivax_b51'],
    [/\bleishmaniasis visceral\b|\bkala ?azar\b|\bvisceral leishmaniasis\b|\bb55 ?[.]?0\b/,
      'leishmaniasis visceral', 'leishmaniasis visceral (B55.0), que el boletín notifica aparte', 'leishmaniasis_cutanea_b551'],
    [new RegExp(`\\ba39(?:\\.[1-9]|[1-9]| [1-9]${NO_UNIDAD})\\b|\\b(meningococemia|meningococcemia)\\b`),
      'otra infeccion meningococica', 'infecciones meningocócicas fuera de la meningitis (A39.1-A39.9, como la meningococemia)', 'meningococica_a39'],
    [/\b(tifo|tifus) (epidemico|exantematico|transmitido por piojos)\b|\bepidemic typhus\b|\ba75 ?[.]?0\b/,
      'tifo epidemico', 'tifo epidémico (A75.0), que el boletín notifica aparte', 'tifo_murino_a752'],
    [/\bcirrosis (biliar|no alcoholica|hepatica no alcoholica|criptogenica)\b|\bk74\b/,
      'otra cirrosis', 'cirrosis no alcohólica (K74), con código propio fuera de K70.3', 'cirrosis_alcoholica_k703'],
  ];

  // Códigos CIE explícitos: una letra, dos dígitos y, opcional, un decimal con punto, espacio o pegado.
  const CODIGO_CIE = new RegExp(`\\b([a-z])(\\d{2})(?:(?:\\.|(?=\\d)| )(\\d)${NO_UNIDAD})?\\b`, 'g');
  const claveCie = (letra, num, dec) => (letra.charCodeAt(0) - 97) * 1000 + Number(num) * 10 + Number(dec);
  /** Intervalos [desde, hasta] que cubre el `cie` de un release («T20-T32», «A07.0, A07.2», «I87.2»). */
  function intervalosCie(cie) {
    return String(cie).toLowerCase().split(',').map((parte) => {
      const [d, h = d] = parte.trim().split('-').map((x) => x.trim().match(/^([a-z])(\d{2})(?:\.(\d))?$/));
      if (!d || !h) return null;
      return [claveCie(d[1], d[2], d[3] ?? 0), claveCie(h[1], h[2], h[3] ?? 9)];
    }).filter(Boolean);
  }
  /**
   * Un código CIE explícito que el release nombrado no cubre («hiperplasia de próstata N41», «escabiosis
   * B85»): se aclara sin cifras. Sólo cuentan las letras del propio bloque, para que «w42» (una semana)
   * no se lea como código.
   */
  function codigoAjeno(canon) {
    const nombrado = releasesEnConsulta(canon, { codigos: false }).find((r) => r.cie);
    if (!nombrado) return null;
    const ints = intervalosCie(nombrado.cie);
    const letras = new Set(String(nombrado.cie).toLowerCase().match(/[a-z]/g));
    for (const m of canon.matchAll(CODIGO_CIE)) {
      const [, letra, num, dec] = m;
      if (!letras.has(letra)) continue;
      const decs = dec != null ? [dec] : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const dentro = (x) => ints.some(([lo, hi]) => claveCie(letra, num, x) >= lo && claveCie(letra, num, x) <= hi);
      // Una categoría de tres caracteres que el bloque cubre sólo en parte («H65», «A06») es un nombre
      // genérico: la aclara ALIAS_AMBIGUOS. Aquí sólo cuenta lo que queda entero fuera del bloque.
      const cubierto = dec != null ? dentro(dec) : decs.some(dentro);
      // Si el código es de otro bloque publicado, no es «no modelado»: lo aclara contradiccionCie.
      if (!cubierto && !releaseQueCubre(letra, num, dec)) {
        const codigo = `${letra.toUpperCase()}${num}${dec != null ? `.${dec}` : ''}`;
        return [null, `codigo ${codigo}`, `el código ${codigo}, que no forma parte de ${nombrado.etiqueta}`, nombrado.id];
      }
    }
    return null;
  }

  // Códigos de los cuatro padecimientos originales (Depresión F32, Parkinson G20, Alzheimer G30, Dengue A90, A91 y A97).
  const CIE_LEGACY = new Set(['f32', 'g20', 'g30', 'a90', 'a91', 'a97']);
  /**
   * Novena auditoría Codex: cualquier código con forma CIE (letra + dos dígitos, con o sin decimal) que no resuelve a un
   * padecimiento publicado se responde como no modelado, nunca con la tabla neuro ni con el resumen por estado. Quedan fuera
   * los códigos que algún release cubre entero o en parte (los aclaran contradiccionCie y ALIAS_AMBIGUOS), los de los cuatro
   * originales y «W» más dos dígitos sin decimal fuera de un bloque publicado, que es una semana epidemiológica («2026-W43»).
   */
  function codigoNoPublicado(canon) {
    for (const m of canon.matchAll(CODIGO_CIE)) {
      const [, letra, num, dec] = m;
      if (CIE_LEGACY.has(`${letra}${num}`)) continue;
      const decs = dec != null ? [dec] : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const alguno = decs.some((x) => releases.some((r) => r.cie && intervalosCie(r.cie)
        .some(([lo, hi]) => claveCie(letra, num, x) >= lo && claveCie(letra, num, x) <= hi)));
      if (alguno) continue;
      if (letra === 'w' && dec == null) continue;
      const codigo = `${letra.toUpperCase()}${num}${dec != null ? `.${dec}` : ''}`;
      return [null, `codigo ${codigo}`, `el código ${codigo}, que no corresponde a ningún padecimiento publicado`, null];
    }
    return null;
  }

  /** Release publicado cuyo `cie` cubre el código (entero, si no trae decimal), o null. */
  function releaseQueCubre(letra, num, dec) {
    const decs = dec != null ? [dec] : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return releases.find((r) => r.cie && decs.every((x) => intervalosCie(r.cie)
      .some(([lo, hi]) => claveCie(letra, num, x) >= lo && claveCie(letra, num, x) <= hi))) || null;
  }

  const COMPARA = /\b(y|vs|versus|contra|frente|compar\w*|entre)\b/;
  /**
   * Nombre de un bloque con el código de otro bloque publicado («escabiosis B01», «insuficiencia venosa
   * N40»), sin pedir una comparación: se aclara la correspondencia sin cifras y sin decir que el código
   * no se modela. Devuelve el texto o null.
   */
  function contradiccionCie(canon) {
    if (COMPARA.test(canon)) return null;
    const nombrado = releasesEnConsulta(canon, { codigos: false, soloNombres: true }).find((r) => r.cie);
    if (!nombrado) return null;
    for (const m of canon.matchAll(CODIGO_CIE)) {
      const [, letra, num, dec] = m;
      const otro = releaseQueCubre(letra, num, dec);
      if (!otro || otro.id === nombrado.id) continue;
      const codigo = `${letra.toUpperCase()}${num}${dec != null ? `.${dec}` : ''}`;
      return `El nombre «${nombrado.nombreCorto.toLowerCase()}» corresponde a **${nombrado.etiqueta}**; el código ${codigo} ` +
        `corresponde a otro bloque publicado, **${otro.etiqueta}**. No doy cifras hasta saber cuál consultas: ` +
        `pregunta por «${nombrado.consultaVisible}» o por «${otro.consultaVisible}».`;
    }
    return null;
  }

  /** El subtipo ajeno que nombra la consulta (normalizada): `{ termino, nombre, release }`, o null. */
  function subtipoAjeno(qn) {
    qn = sinTildeMin2(qn);
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    // Re-auditoría Codex (19-nov-2026): F10.0 sólo para «alcohol» sin calificativo o con etílico, etanol o aguda; cualquier
    // otro calificativo (butílico, amílico, metílico…) es un alcohol que no se modela.
    if (alcoholCalificado(canon)) {
      return { termino: 'alcohol no etilico', nombre: ALCOHOL_NO_ETILICO, release: 'intox_alcohol_f100', pad: 'Intoxicación aguda por alcohol' };
    }
    const hit = SUBTIPOS_AJENOS.find(([re, , , , ctx]) => re.test(canon) && (!ctx || ctx.test(canon))) || codigoAjeno(canon) ||
      codigoNoPublicado(canon);
    if (!hit) return null;
    const r = releases.find((x) => x.id === hit[3]);
    return { termino: hit[1], nombre: hit[2], release: hit[3], pad: r ? r.pad : null };
  }

  /**
   * Nombres genéricos que abarcan más que el bloque publicado: «otitis» incluye la externa y la crónica,
   * y «amebiasis» incluye el absceso hepático. Sin el nombre del bloque no se dan cifras: se aclara qué
   * se pronostica y se pide precisar.
   */
  const ALIAS_AMBIGUOS = [
    { release: 'ivp_i87', generico: /\bi87\b(?![ .]?[0-9])/, especifico: /(?!)/,
      abarca: '«I87» abarca otras enfermedades de las venas con código propio, como el síndrome postrombótico (I87.0) y la compresión de vena (I87.1).' },
    { release: 'protozoarios_a07', generico: /\bprotozoosis intestinal\b|\ba07\b(?![ .][0-9])/, especifico: /(?!)/,
      abarca: '«Infecciones intestinales por protozoarios» abarca la giardiasis (A07.1), con su propio control estacional, y otras protozoosis con código propio (A07.3, A07.8), que el boletín reporta aparte.' },
    { release: 'faringitis_j02', generico: /\b(faringitis|amigdalitis|faringoamigdalitis|anginas|j02|j03)\b/,
      especifico: new RegExp(`\\b(faringitis|amigdalitis|faringoamigdalitis)( y amigdalitis)? (estreptococic[ao]s?|por estreptococos?)\\b|${subcodigo('j02', '0').source}|${subcodigo('j03', '0').source}`),
      abarca: '«Faringitis» o «amigdalitis» abarcan formas virales y no estreptocócicas con otro código: la faringitis no estreptocócica (J02.8-J02.9) no está en ningún bloque publicado y la amigdalitis no estreptocócica (J03.8-J03.9) se cuenta dentro de las infecciones respiratorias agudas.' },
    // Ambiguo si no nombra exactamente uno de los dos bloques publicados (ninguno, o ambos a la vez).
    { release: 'displasia_leve_n87', otro: 'displasia_severa_n87', generico: /\b(displasia (cervical|del cuello)|n87)\b/,
      especifico: /(?!)/,
      uno: new RegExp(`\\b(leve|moderada)s?\\b|${subcodigo('n87', '01').source}`),
      otroEsp: new RegExp(`\\b(severa|grave)s?\\b|\\bcacu in situ\\b|\\bd06\\b|${subcodigo('n87', '2').source}`),
      abarca: '«Displasia cervical» abarca dos bloques publicados con su propio pronóstico: la leve y moderada (N87.0-N87.1) y la severa con el cáncer cervicouterino in situ (N87.2, D06).' },
    { release: null, bloques: ['tifoidea_a01', 'paratifoidea_a011'], generico: /\ba01\b(?![ .]?[0-9])/, especifico: /(?!)/,
      abarca: '«A01» abarca dos bloques del boletín, cada uno con su propio pronóstico: la fiebre tifoidea (A01.0) y la paratifoidea (A01.1-A01.4).' },
    // Varios helmintos con bloque propio: ambiguo si no nombra exactamente uno de los tres.
    { release: null, bloques: ['ascariasis_b77', 'enterobiasis_b80', 'helmintiasis_b65', 'teniasis_b68'],
      generico: /\b(lombri(z|ces)|gusanos( intestinales)?|parasitos intestinales|parasitosis intestinal(es)?|helmint[a-z]*|geohelmint[a-z]*)\b/,
      especifico: /(?!)/,
      abarca: '«Lombrices», «helmintiasis» o «parásitos intestinales» abarcan varios bloques del boletín con código propio. Se publican cuatro: la ascariasis (B77), la enterobiasis (B80), la teniasis (B68) y otras helmintiasis (B65-B67, B70-B76, B78, B79, B81-B83, excepto B73 y B75); la cisticercosis (B69) y la triquinosis (B75) tienen además su propio control estacional, y los parásitos intestinales incluyen protozoarios como la amebiasis y la giardiasis.' },
    { release: null, bloques: ['desnutricion_leve_e441', 'desnutricion_moderada_e440', 'desnutricion_severa_e40'],
      generico: /\b(desnutricion|malnutrition|undernutrition|e4[0-6])\b/,
      especifico: /(?!)/,
      abarca: '«Desnutrición» abarca tres bloques del boletín, cada uno con su propio control estacional: la leve (E44.1), la moderada (E44.0) y la severa (E40-E43).' },
    { release: null, bloques: ['hepatitis_a_b15', 'hepatitis_b_b16', 'hepatitis_c_b17', 'otras_hepatitis_b17'],
      generico: /\bhepatitis( viricas?| virales?| viral)?\b(?! virica [abcde]\b)|\bb1[78]\b(?![ .]?[0-9])/,
      especifico: /\botras hepatitis (viricas|virales)\b|\bhepatitis (alcoholica|autoinmune|toxica|medicamentosa)\b/,
      abarca: '«Hepatitis» abarca varios bloques del boletín con código propio. Se pronostican cuatro: la hepatitis vírica A (B15), la B aguda (B16), la C (B17.1, B18.2) y las otras hepatitis víricas (B17-B19, excepto B17.1 y B18.2).' },
    // «Hepatitis B» sin decir aguda ni crónica: la aguda (B16) y la crónica (B18.0-B18.1, dentro de otras hepatitis
    // víricas) son bloques distintos.
    { release: 'hepatitis_b_b16', otro: 'otras_hepatitis_b17', generico: /\bhepatitis virica b\b/, especifico: /(?!)/,
      uno: /\b(aguda|acute)\b|\bb16\b/, otroEsp: /\bcronica\b|\bb18[ .]?[01]\b/,
      abarca: '«Hepatitis B» abarca la aguda (B16), con su propio control estacional, y la crónica (B18.0-B18.1), que se cuenta dentro de las otras hepatitis víricas.' },
    { release: 'bocio_e01', generico: /\b(bocio|goiter|goitre)\b/,
      especifico: /\bbocio endemico\b|\bendemic goit(er|re)\b|\be01\b|\bdeficiencia de yodo\b|\biodine deficiency\b/,
      abarca: '«Bocio» abarca formas con código propio fuera de E01, como el bocio no tóxico (E04) y el tóxico (E05), que no se pronostican.' },
    { release: 'absceso_hepatico_a064', generico: /\babscesos? (hepaticos?|del higado)\b|\bliver abscess\b/,
      especifico: /\b(amebian[oa]s?|amibian[oa]s?|amebic|amoebic)\b|\ba06[ .]?4\b/,
      abarca: '«Absceso hepático» abarca el absceso del hígado no amebiano, piógeno o bacteriano (K75.0), con código propio fuera de A06.4.' },
    // «Vaginitis» o una vulvovaginitis con agente nombrado: varios bloques, aunque la consulta nombre «vulvovaginitis».
    { release: null, bloques: ['vulvovaginitis_n76', 'candidiasis_b37', 'tricomoniasis_a590'], siempre: true,
      generico: /\bvaginitis\b|\bvulvovaginitis (candidiasica|candidosica|micotica|por (candida|hongos|tricomonas|trichomonas)|tricomoniasica)\b|\binfecci(on|ones) vaginal(es)?\b/,
      especifico: /(?!)/,
      abarca: '«Vaginitis», o una vulvovaginitis con el agente nombrado, abarca bloques distintos del boletín: la vulvovaginitis (N76), con su propio pronóstico; la candidiasis urogenital (B37.3-B37.4), también publicada; y la tricomoniasis urogenital (A59.0), con su propio pronóstico.' },
    // «Meningitis» a secas abarca renglones distintos del boletín; los tipos nombrados los resuelven sus guardas.
    { release: null, bloques: ['sindrome_meningeo_g00', 'meningococica_a39'], generico: /\bmeningitis\b/,
      especifico: /\b(meningococ[a-z]*|tuberculos[a-z]*|haemophilus|hemophilus|influenzae|neumococ[a-z]*|pneumococ[a-z]*)\b|\bsindrome meningeo\b/,
      abarca: '«Meningitis» abarca renglones distintos del boletín: el síndrome meníngeo (G00-G03, excepto G00.0 y G00.1) y la meningitis meningocócica (A39.0) tienen cada uno su control estacional; la meningitis por Haemophilus influenzae (G00.0) y la neumocócica (G00.1) se cuentan dentro de las infecciones invasivas de su agente, y la meningitis tuberculosa (A17.0) tiene su propio control estacional.' },
    { release: 'meningococica_a39', generico: /\b(meningococ[a-z]*|enfermedad meningococica|meningococcal|a39)\b(?![ .]?[0-9])/,
      especifico: /\bmeningitis meningococica\b|\bmeningococcal meningitis\b/,
      abarca: '«Meningococo» abarca la meningitis meningocócica (A39.0) y otras infecciones meningocócicas con código propio (A39.1-A39.9, como la meningococemia), que no se pronostican.' },
    { release: 'neumococo_a40', generico: /\b(neumococ[a-z]*|pneumococ[a-z]*|streptococcus pneumoniae)\b/,
      especifico: /\b(invasiv[ao]s?|invasive)\b|\bmeningitis\b|\bneumonia\b|\bpneumonia\b/,
      abarca: '«Neumococo» abarca infecciones no invasivas, como la otitis o la sinusitis neumocócica, que no forman parte del bloque publicado de enfermedad invasiva por neumococo (A40.3, G00.1, J13).' },
    { release: null, bloques: ['gonococica_a54'], siempre: true,
      generico: /\b(gonorrea|gonorrhea|gonorrhoea|gonococ[a-z]*|a54)\b(?![ .]?[0-9])(?!.*\b(genitourinari[ao]|urogenital|tracto genitourinario|genitourinary)\b)/,
      especifico: /\b(genitourinari[ao]|urogenital|tracto genitourinario|genitourinary)\b/,
      abarca: '«Gonorrea» abarca formas con código propio fuera del tracto genitourinario (faríngea, anorrectal u ocular, A54.3-A54.9), que no se pronostican; el bloque publicado es la infección gonocócica del tracto genitourinario (A54.0-A54.2).' },
    { release: null, bloques: ['tetanos_a34'], siempre: true,
      generico: /\b(tetanos|tetanus)\b(?!.*\b(obstetric[oa]|otros tetanos|no neonatal|a3[45])\b)/, especifico: /(?!)/,
      abarca: '«Tétanos» abarca el tétanos neonatal (A33), que el boletín notifica aparte y no se pronostica, y el tétanos (A34, A35), con su control estacional.' },
    { release: null, bloques: ['tuberculosis_respiratoria_a15', 'meningitis_tuberculosa_a170', 'tuberculosis_otras_formas_a171'], siempre: true,
      generico: /^(?!.*\b(otras formas|extrapulmonar|extrapulmonary|respiratoria|pulmonar|respiratory|pulmonary|meningea|meningitis|tuberculosa|tuberculous)\b).*\b(tuberculosis|tb|tbc)\b|\ba17\b(?![ .]?[0-9])/, especifico: /(?!)/,
      abarca: '«Tuberculosis» abarca tres bloques del boletín: la tuberculosis respiratoria (A15-A16), con su propio pronóstico, y la meningitis tuberculosa (A17.0) y la tuberculosis otras formas (A17.1, A17.8, A17.9, A18-A19), cada una con su control estacional.' },
    // Lote 6: «rickettsiosis» a secas abarca tres bloques; «leishmaniasis» a secas abarca la visceral (B55.0).
    { release: null, bloques: ['otras_rickettsiosis_a79', 'fiebre_manchada_a770', 'tifo_murino_a752'], siempre: true,
      generico: /(?<!\b(otras|other) )\b(rickettsiosis|rickettsiasis|rickettsioses)\b/, especifico: /(?!)/,
      abarca: '«Rickettsiosis» abarca bloques distintos del boletín, cada uno con su control estacional: la fiebre manchada (A77.0), el tifo murino (A75.2) y las otras rickettsiosis (A79); el tifo epidémico (A75.0) se notifica aparte y no se pronostica.' },
    // «Paludismo» o «malaria» a secas abarcan el paludismo por P. falciparum (B50), que no se pronostica.
    { release: 'paludismo_vivax_b51', generico: /\b(paludismo|malaria)\b/,
      especifico: /\bvivax\b|\bb51\b|\bfalciparum\b/,
      abarca: '«Paludismo» o «malaria» abarcan el paludismo por Plasmodium falciparum (B50), que el boletín notifica aparte y no se pronostica, y el paludismo por Plasmodium vivax (B51), con su control estacional.' },
    { release: 'leishmaniasis_cutanea_b551', generico: /\b(leishmaniasis|leishmaniosis)\b/,
      especifico: /\bleishmaniasis cutanea\b|\bulcera de los chicleros\b|\bcutaneous leishmaniasis\b|\b(leishmaniasis|leishmaniosis) visceral\b|\bvisceral leishmaniasis\b/,
      abarca: '«Leishmaniasis» abarca la leishmaniasis visceral (B55.0), que el boletín notifica aparte y no se pronostica, y la leishmaniasis cutánea (B55.1), con su control estacional.' },
    { release: null, bloques: ['chagas_aguda_b570', 'chagas_cronica_b572'],
      generico: /\b(chagas|tripanosomiasis americana|trypanosomiasis|b57)\b(?![ .]?[0-9])/, especifico: /(?!)/,
      abarca: '«Chagas» abarca dos bloques del boletín, cada uno con su propio pronóstico: la enfermedad de Chagas aguda (B57.0-B57.1) y la crónica (B57.2-B57.5).' },
    { release: null, bloques: ['alcoholica_higado_k70', 'cirrosis_alcoholica_k703'],
      generico: /\bk70\b(?![ .]?[0-9])|\b(hepatopatia|higado|liver)\b.*\balcohol\w*|\balcohol\w*\b.*\b(hepatopatia|higado|liver)\b/, especifico: /(?!)/,
      abarca: '«K70» y la enfermedad hepática por alcohol abarcan dos bloques del boletín, cada uno con su propio control estacional: la enfermedad alcohólica del hígado (K70, excepto K70.3) y la cirrosis hepática alcohólica (K70.3).' },
    { release: null, bloques: ['cirrosis_alcoholica_k703'], siempre: true,
      generico: /\b(cirrosis|cirrhosis)\b(?!.*\b(alcoholica|alcoholic|k70 ?[.]?3)\b)/, especifico: /(?!)/,
      abarca: '«Cirrosis» abarca la cirrosis hepática alcohólica (K70.3), con su control estacional, y otras cirrosis con código propio (K74), que no se pronostican.' },
    { release: null, bloques: ['mordedura_cascabel_u600', 'mordedura_coral_u601', 'mordedura_otras_serpientes_t630'],
      generico: /\b(serpientes?|viboras?|culebras?|ofidi[a-z]*|snakes?|snakebites?)\b/, especifico: /(?!)/,
      abarca: '«Mordedura de serpiente» abarca tres bloques del boletín, cada uno con su propio control estacional: la serpiente de cascabel (U60.0), la serpiente coral (U60.1) y otras serpientes (T63.0, X20, excepto U60.0 y U60.1).' },
    { release: null, bloques: ['viuda_negra_u602', 'violinista_u603', 'otras_aranas_t633'],
      generico: /\b(aranas?|aracnidos?|spiders?)\b/, especifico: /(?!)/,
      abarca: '«Araña» abarca tres bloques del boletín, cada uno con su propio control estacional: la viuda negra (U60.2), la violinista (U60.3) y otras arañas (T63.3, X21, excepto U60.2 y U60.3).' },
    { release: null, bloques: ['alacran_t63', 'abeja_u604', 'avispa_u605', 'otros_artropodos_t634', 'otros_ponzonosos_t631'],
      generico: /\b(picaduras?|piquetes?|stings?|ponzon[a-z]*|venenos? animal(es)?)\b(?!.*\b(aranas?|spiders?|serpientes?|viboras?|culebras?|coral|coralillo|cascabel|viuda|violinista|snakes?)\b)(?<!\b(aranas?|spiders?|serpientes?|viboras?|viuda negra|violinista)\b.*)/, especifico: /(?!)/,
      abarca: '«Picadura» abarca varios bloques del boletín con su propio pronóstico: el alacrán (T63.2, X22), la abeja (U60.4), la avispa (U60.5), otros artrópodos (T63.4) y otros animales ponzoñosos (T63.1, T63.5-T63.9, X27, U60.8); las arañas y las serpientes tienen bloques aparte.' },
    { release: null, bloques: ['mordedura_perro_w54', 'mordedura_mamiferos_w55'],
      generico: /\b(mordeduras?|mordidas?|bites?)\b(?!.*\b(serpiente|vibora|culebra|coral|cascabel|arana|snake|spider)\w*)/, especifico: /(?!)/,
      abarca: '«Mordedura» abarca varios bloques del boletín con su propio control estacional: por perro (W54), por otros mamíferos (W55), por serpientes (cascabel, coral y otras) y por arañas.' },
    { release: null, bloques: ['tifo_murino_a752'], siempre: true,
      generico: /\b(tifo|tifus|typhus)\b(?!.*\b(murino|endemico|murine)\b)/, especifico: /(?!)/,
      abarca: '«Tifo» abarca el tifo epidémico (A75.0), que se notifica aparte y no se pronostica, y el tifo murino (A75.2), con su control estacional; la fiebre tifoidea (A01.0) es otra enfermedad.' },
    { release: null, bloques: ['intox_alcohol_f100', 'alcoholica_higado_k70', 'cirrosis_alcoholica_k703'],
      generico: /\b(alcohol|alcoholismo|alcoholic[oa]s?|alcoholism)\b/, especifico: /(?!)/,
      abarca: '«Alcohol» abarca tres bloques del boletín, cada uno con su propio pronóstico: la intoxicación aguda por alcohol (F10.0), la enfermedad alcohólica del hígado (K70, excepto K70.3) y la cirrosis hepática alcohólica (K70.3).' },
    { release: 'candidiasis_b37', generico: /\b(candidiasis|candida|candidosis|moniliasis|b37)\b/,
      especifico: new RegExp(`\\b(candidiasis|candida|candidosis|moniliasis) (urogenital|vaginal|vulvovaginal|genital|de vulva|de la vulva)\\b|\\b(urogenital|vaginal|vulvovaginal|genital) candidiasis\\b|${subcodigo('b37', '34').source}`),
      abarca: '«Candidiasis» abarca varias localizaciones con código propio: la oral, la cutánea, la esofágica y la sistémica (B37.0-B37.2, B37.5-B37.9).' },
    { release: 'otitis_h65', generico: /\b(otitis|h65)\b/,
      especifico: new RegExp(`\\botitis media aguda\\b|\\bacute otitis media\\b|${subcodigo('h65', '01').source}`),
      abarca: '«Otitis» abarca varias categorías con código propio: la externa (H60), la media crónica (H65.2-H65.9) y la supurativa (H66).' },
    { release: 'amebiasis_a06', generico: new RegExp(`\\b(amebiasis|amibiasis|amoebiasis)\\b|\\ba06\\b(?!\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})`),
      especifico: new RegExp(`\\b(amebiasis|amibiasis|amoebiasis) intestinal\\b|\\bintestinal (amebiasis|amoebiasis)\\b|\\bdisenteria amebiana\\b|\\bamebic dysentery\\b|${subcodigo('a06', '0-39').source}`),
      abarca: '«Amebiasis» incluye formas fuera del intestino: el absceso hepático amebiano (A06.4), con su propio control estacional, y otras amebiasis extraintestinales (A06.5-A06.8).' },
    { release: null, bloques: ['sifilis_adquirida_a51', 'sifilis_congenita_a50'],
      generico: /\b(sifilis|syphilis|lues|treponema pallidum)\b/,
      // Ambiguo si no nombra exactamente uno de los dos bloques (ninguno, o ambos a la vez).
      especifico: /(?!)/,
      abarca: '«Sífilis» abarca renglones distintos del boletín con código propio: la sífilis adquirida (A51-A53) y la sífilis congénita (A50), cada una con su control estacional, además de la sífilis en el embarazo (O98.1) y la sífilis no venérea (A65), que no se pronostican.' },
    { release: null, bloques: ['sifilis_adquirida_a51', 'chancro_blando_a57'],
      generico: /\bchancros?\b/,
      especifico: /(?!)/,
      abarca: '«Chancro» puede referirse al chancro sifilítico de la sífilis primaria (A51.0) o al chancro blando (A57), que es otra infección; cada una tiene su control estacional.' },
    { release: null, bloques: ['sifilis_adquirida_a51', 'sifilis_congenita_a50', 'mal_del_pinto_a67'],
      generico: /\btreponematosis\b/, especifico: /(?!)/,
      abarca: '«Treponematosis» abarca varias infecciones por espiroquetas del género Treponema: se publican la sífilis adquirida (A51-A53), la congénita (A50) y el mal del pinto (A67); la no venérea (A65) y la frambesia (A66) tienen código propio y no se pronostican.' },
  ];

  /**
   * Aclaraciones que se evalúan antes de los subtipos: el término no permite elegir el código, o la
   * categoría está contada dentro de otro bloque sin serie propia.
   */
  const ACLARACIONES = [
    { release: 'otras_hepatitis_b17', re: /\bhepatitis virica b cronica\b|\bhepatitis virica b\b.*\bb18[ .]?[01]\b/,
      abarca: 'La hepatitis B crónica (B18.0-B18.1) se cuenta dentro de las otras hepatitis víricas, sin una serie propia; la hepatitis B aguda (B16) es otro bloque, con su propio control estacional («hepatitis virica b aguda»).' },
    { release: 'varicela_b01', re: /\b(varicela zoster|virus (de la )?varicela|vzv|varicella zoster)\b/,
      abarca: '«Varicela zóster» es el nombre del virus, que causa la varicela (B01) y el herpes zóster (B02); el término no dice cuál de las dos.' },
    { release: 'ira_j00', re: /\b(amigdalitis|tonsillitis)( aguda)? (viral(es)?|no estreptococic[ao]s?|por virus)\b|\bviral tonsillitis\b|\bj03[ .]?[89]\b/,
      abarca: 'La amigdalitis viral o no estreptocócica (J03.8-J03.9) está dentro del bloque de infecciones respiratorias agudas, sin una serie propia.' },
    { release: 'sifilis_adquirida_a51',
      re: /^(?!.*\b(?:congenit[a-z]*|neonatal\w*|connatal\w*|perinatal\w*|materno ?infantil|vertical|fetal\w*|mortinat\w*|stillbirth\w*|juvenil|juvenile|a50|o98|embaraz\w*|gestacion\w*|gestantes?|gestational|matern[ao]s?|maternal|puerper\w*|parto|pregnan\w*|childbirth)\b)(?=.*\b(?:sifilis|syphilis|lues|neurosifilis|neurosyphilis|treponema pallidum|a5[123])\b).*\b(recien nacid[oa]s?|newborns?|neonat[oa]s?|bebes?|babies|baby|lactantes?|infants?|nin[oa]s?|children|child|menores?(?: de \d{1,3}(?: anos?)?| de edad)?|adolescentes?|teenagers?|teens?|pediatric[oa]?s?|paediatric\w*|(?:menores?|mayores?) de \d{1,3}(?: anos?)?|under \d{1,3}(?: years?(?: old)?)?|\d{1,3} anos? de edad)\b/,
      abarca: 'Las series publicadas de sífilis adquirida (A51-A53) sólo desglosan por entidad y sexo (sin estratificación por edad ni por embarazo), y no debe clasificarse automáticamente toda consulta en recién nacidos, bebés, lactantes o menores como sífilis congénita: el boletín reporta aparte la sífilis congénita explícita (A50, con su propio control estacional), mientras que la sífilis adquirida (A51-A53) también puede presentarse en menores.' },
    // alta_b44: subtipos contados dentro de otro bloque publicado, sin serie propia.
    { release: 'alcoholica_higado_k70', re: /\bhepatitis alcoholica\b|\balcoholic hepatitis\b|\bk70 ?[.]?1\b/,
      abarca: 'La hepatitis alcohólica (K70.1) se cuenta dentro de la enfermedad alcohólica del hígado (K70, excepto K70.3), sin una serie propia; pregunta por «enfermedad alcohólica del hígado».' },
    { release: 'neumococo_a40', re: /\b(neumonia|neumonias|pneumonia) (neumococic[ao]s?|por neumococos?|por streptococcus pneumoniae|pneumococcal)\b|\bpneumococcal pneumonia\b|\bj13\b/,
      abarca: 'La neumonía por neumococo (J13) no forma parte del bloque de neumonías y bronconeumonías: se cuenta dentro de la enfermedad invasiva por neumococo (A40.3, G00.1, J13), sin una serie propia; pregunta por «enfermedad invasiva por neumococo».' },
    { release: 'haemophilus_a41', re: /\b(neumonia|neumonias|pneumonia) (por )?(haemophilus|hemophilus|h influenzae)\b|\bj14\b/,
      abarca: 'La neumonía por Haemophilus influenzae (J14) no forma parte del bloque de neumonías y bronconeumonías: se cuenta dentro de las infecciones invasivas por Haemophilus influenzae (A41.3, G00.0, J14), sin una serie propia; pregunta por «haemophilus influenzae».' },
  ];

  /** Aclaración ante un nombre genérico que no basta para elegir el bloque publicado, o null. */
  function aliasAmbiguo(qn) {
    // Decimoctava auditoría: NFKC y minúsculas también aquí (RAG pasa la consulta cruda: «K70», «Ｋ７０»).
    qn = sinTildeMin2(qn);
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    // Una aclaración («hepatitis B crónica B18.1») explica mejor que la contradicción entre nombre y código.
    const previa = ACLARACIONES.find((a) => a.re.test(canon));
    const contradiccion = previa ? null : contradiccionCie(canon);
    if (contradiccion) return { release: null, pad: null, texto: contradiccion };
    const hitPrevio = previa ? { release: previa.release, abarca: previa.abarca } : null;
    if (!hitPrevio && subtipoAjeno(qn)) return null;
    const porNombre = releasesEnConsulta(canon, { codigos: false }).map((r) => r.id);
    const nombrados = (a) => a.bloques.filter((id) => porNombre.includes(id)).length;
    const hit = hitPrevio || ALIAS_AMBIGUOS.find((a) => a.generico.test(canon) && !a.especifico.test(canon) &&
      (!a.uno || a.uno.test(canon) === a.otroEsp.test(canon)) && (!a.bloques || a.siempre || nombrados(a) !== 1));
    if (!hit) return null;
    if (hit.bloques) {
      const rs = hit.bloques.map((id) => releases.find((x) => x.id === id));
      return {
        release: null, pad: null,
        texto: `${hit.abarca} No doy cifras hasta saber cuál consultas: ` +
          `${rs.map((x) => `«${x.consultaVisible}»`).join(', ').replace(/, ([^,]*)$/, ' o $1')}; por ejemplo, «${rs[0].consultaVisible} en Jalisco».`,
      };
    }
    const r = releases.find((x) => x.id === hit.release);
    const otro = hit.otro ? releases.find((x) => x.id === hit.otro) : null;
    if (otro) {
      return {
        release: null, pad: null,
        texto: `${hit.abarca} No doy cifras hasta saber cuál consultas: pregunta por «${r.consultaVisible}» ` +
          `(**${r.etiqueta}**) o por «${otro.consultaVisible}» (**${otro.etiqueta}**); por ejemplo, «${r.consultaVisible} en Jalisco».`,
      };
    }
    return {
      release: r.id, pad: r.pad,
      texto: `${hit.abarca} EpiForecast-MX sólo pronostica **${r.etiqueta}**, así que no doy cifras hasta saber ` +
        `si te refieres a ese bloque. Si es así, pregunta por «${r.consultaVisible}»; por ejemplo, «${r.consultaVisible} en Jalisco».`,
    };
  }

  /** La enfermedad no modelada que nombra la consulta (normalizada), o null. Compara al inicio de palabra. */
  function mencionaNoModelada(qn) {
    qn = sinTildeMin2(qn);
    const canon = canonClinico(qn);
    const ajeno = subtipoAjeno(qn);
    if (ajeno) return ajeno.termino;
    // Antes de retirar alias: «presión arterial» es alias de hipertensión y taparía «presión arterial baja».
    const baja = canon.match(PRESION_BAJA);
    if (baja) return baja[0];
    const q = sinAliasPublicados(` ${canon.replace(CANCER_MAMA, ' ')} `);
    // Un término genérico que forma parte del nombre de un release nombrado («hepatitis B15») no lo niega.
    const sinTilde = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nombrados = releasesEnConsulta(canon, { codigos: false });
    const directa = noModeladas.find((e) => q.includes(e.endsWith(' ') ? ` ${e}` : ` ${e.trim()}`) &&
      !(e.trim() === 'hepatitis' && nombrados.some((r) => sinTilde(r.nombre).includes('hepatitis'))));
    if (directa) return directa;
    if (!HIPERTENSION.test(canon)) return null;
    const ajena = HIPERTENSION_AJENA.find(([re]) => re.test(canon));
    return ajena ? ajena[1] : null;
  }

  /** «¿y gestacional?» tras una respuesta de hipertensión nombra otra categoría, no un filtro. */
  function conHipertensionNombrada(qn, padPrevio) {
    if (padPrevio !== 'Hipertensión arterial' || HIPERTENSION.test(qn)) return qn;
    if (!/^(y|pero|tambien|que hay de|ahora|and|what about)\b/.test(qn)) return qn;
    // «¿y gestacional?» nombra el bloque del embarazo: con «hipertension» delante, canonClinico lo
    // resuelve a O10-O16 en vez de heredar I10-I15.
    const delEmbarazo = new RegExp(EMBARAZO_TERMINO.source).test(qn);
    return delEmbarazo || HIPERTENSION_AJENA.some(([re]) => re.test(qn)) ? `hipertension ${qn}` : qn;
  }

  const CRISIS_ES = /\b(suicidarme|suicidarse|matarme|matarse|quitarme la vida|quitarse la vida|acabar con mi vida|terminar con mi vida|(me|se) quier[eo] (morir|matar|suicidar)|me voy a (matar|morir|suicidar)|quiero (morir|morirme)|quisiera (morir|morirme|estar muert)|ganas de (morir|morirme|matarme|suicidarme)|(ya )?no quiero (vivir|seguir viviendo|seguir con vida|estar viv[oa]s?|seguir viv[oa]s?|existir)|no vale la pena vivir|hacerme dano|lastimarme|cortarme las venas|autolesionarme|(tengo|con) (pensamientos|ideas) suicidas|tengo ideacion suicida)\b/;
  // Deuda del detector (b): riesgo dicho de otra persona o sin la primera persona de la lista («mi compañera dice que no
  // quiere llegar a mañana», «no está a salvo», «she is not safe tonight»). Sólo añade crisis.
  // Ronda 1 (Codex Sol y Fable): «a salvo del dengue», «vivir en Jalisco» y «the water is safe now» no son señal; «no aguanta
  // más», «quiere desaparecer», «no quiere seguir», «está en peligro» o «is unsafe» de alguien cercano sí.
  // Ronda 2 (Fable): la persona excluye lugares, instituciones, datos y animales («mi estado», «mis datos», «mi pueblo»).
  const NO_PERSONA = '(?!(estado|ciudad|municipio|pais|region|zona|comunidad|colonia|casa|pueblo|poblacion|gente|datos|informacion|' +
    'pronostico|modelo|perro|perra|gato|gata|mascota|hospital|clinica|sistema|state|city|country|town|area|home|data|information|forecast|model|' +
    'dog|cat|pet|hospital|people|tendencia|curva|grafica|serie|casos|trend|chart|equipo|trabajo|empresa|team|job|escuela|internet|conexion|senal|luz|school|connection)\\b)';
  // Ronda 3 (Codex Sol y Fable): «de/del/por» sólo excluyen el peligro cuando sigue una enfermedad («a salvo del dengue»); «en
  // peligro por mi pareja» o «a salvo de su papá» son riesgo.
  const ENF_T = '(el |la |los |las |the |a |an )?(dengue|covid|coronavirus|influenza|gripa|gripe|virus|epidemia|brote|brotes|enfermedad|' +
    'enfermedades|contagio|contagios|tos|tos ferina|sarampion|zika|chikungunya|paludismo|malaria|tuberculosis|hepatitis|diabetes|asma|calor|pandemia|' +
    'varicela|neumonia|rotavirus|rubeola|paperas|parotiditis|tosferina|bronquitis|infeccion|infecciones|bacteria|bacterias|parasitos?|chagas|lepra|vih|sida|cancer|measles|pneumonia|' +
    'neumonias|infecciones|contaminacion|smog|humo|polvo|polen|disease|diseases|outbreak|flu|epidemic|pandemic|heat|mosquitos?|zancudos?|moscos?|mosquitoes|(que )?(me |nos |le |les )?(contagi|enferm|infect)[a-z]*)\\b';
  const NO_ENF_ES = '(?!( en [a-z]+( [a-z]+){0,3})? (de|del|por|con|ante|frente a) ' + ENF_T + ')';
  const NO_ENF_EN = '(?! (from|of|due to|because of) ' + ENF_T + ')';
  const PERSONA_T = '(mi|mis|tu|tus|su|sus|my|your|his|her|their) ' + NO_PERSONA + '[a-z]+( [a-z]+){0,4}';
  const SUJETO_T = '(' + PERSONA_T + '|ella|alguien|she|he|they|someone|somebody)';
  const RIESGO_TERCERO_ES = new RegExp('\\b((ya )?no (quiere|quieren|queria|querian|quisiera|quiero|queremos) (llegar a manana|llegar al dia siguiente|ver el dia de manana|amanecer|despertar(se)?(?! (temprano|tarde|a|al|a la|a los|a las)\\b)(?! (por|con) ' + ENF_T + ')|seguir aqui|seguir viv[oa]s?|seguir viviendo|seguir con vida|vivir(?! (en|con|cerca|lejos|solo|sola|conmigo|contigo)\\b)(?!( aqui| ahi| alla)? (por|con) ' + ENF_T + ')|vivir mas|estar viv[oa]s?|estar aqui|existir)\\b|' +
    '(?:(?<=^ )|(?<= (que|yo|y|ya|hoy|creo|siento|pienso|neta|verdad)) |' + SUJETO_T + ' )(ya )?no ((llega|llegara|llego|llegue) a manana|(voy|vamos) a (llegar a manana|amanecer))\\b(?! (el|la|los|las|este|esta|con) )|no (le|me|les|nos) (queda|quedan) (razones|ganas|fuerzas|motivos)( para| de)? (seguir|vivir)\\b|(?<!(datos|informacion|archivos|registros|cifras|numeros|data|resultados|curva|grafica|serie|modelo|pronostico) )no (esta|estan|este|esten|estaba|estoy|estamos|estas) a salvo' + NO_ENF_ES + '|no me siento (a salvo|segur[oa](?! (de|del|si|que)\\b(?! (seguir|querer|estar) (viv|con vida|aqui)))(?! con (el|la|los|las|este|esta|estos|estas|ese|esa) (pronostico|modelo|dato|datos|grafica|resultado|resultados|cifra|cifras|informacion|reporte|boletin)\\b))\\b|(estoy|estamos) en peligro' + NO_ENF_ES + '|' +
    '(quiere|quieren|piensa|piensan|planea|planean) (quitarse la vida|acabar con su vida|terminar con su vida)\\b|se va a (matar|suicidar|quitar la vida)\\b|' +
    SUJETO_T + ' (ya )?no (aguanta|aguantan|puede|pueden) mas\\b(?!( con)? ' + ENF_T + ')(?! con (el|la|los|las) (reporte|reportes|trabajo|tarea|tareas|dato|datos|informe|informes|carga|pendientes|cuentas)\\b)|' + SUJETO_T + ' (quiere|quieren) desaparecer\\b(?! (el|la|los|las|un|una) (grafica|dato|datos|archivo|archivos|registro|registros|reporte|tabla|boton|pagina|pronostico|modelo|columna|fila|filtro|filtros|mapa|linea)\\b)|' + SUJETO_T + ' no (quiere|quieren) seguir( adelante| asi)? $|' +
    // Ronda 5 (Fable): «quiere morir», «se corta», «puede hacerse daño» y «ella está en peligro» de alguien cercano.
    SUJETO_T + ' (quiere|quieren) (morir|morirse|matarse|hacerse dano|lastimarse|suicidarse)\\b(?! de (risa|ganas|hambre|sueno|frio|calor|aburrimiento|envidia)\\b)|' + SUJETO_T + ' se (corta|cortan|lastima|lastiman|hace dano|hacen dano|quiere hacer dano)\\b(?! (el |la |las |los |su |sus )?(pelo|cabello|unas|barba|fleco|flequillo|luz|senal|internet|conexion|llamada|video|leche|salsa|mayonesa|pagina|sesion)\\b)' +
    '(?! (jugando|haciendo|entrenando|al (jugar|correr|caer|cocinar)|en (el|la) (cancha|escuela|partido)|con (papel|una hoja|un papel|el papel))\\b)|' +
    '(puede|pueden|podria|podrian) hacerse dano\\b(?! (el|la|los|las|en|con)\\b)|' +
    SUJETO_T + ' (esta|estan|corre|corren|anda) (en )?peligro' + NO_ENF_ES + '\\b|' + PERSONA_T + ' no (esta|se siente|estan|se sienten) (segur[oa]s?(?! (de|del|si|que)\\b(?! (seguir|querer|estar) (viv|con vida|aqui)))(?! con (el|la|los|las|este|esta|estos|estas|ese|esa) (pronostico|modelo|dato|datos|grafica|resultado|resultados|cifra|cifras|informacion|reporte|boletin)\\b)|a salvo' + NO_ENF_ES + ')\\b)');
  const RIESGO_TERCERO_EN = new RegExp('\\b(((i|i m|im|he|she|they|we|you|someone|somebody)|' + PERSONA_T + ')( is| are| am| m| s| re| feel| feels| was| were)? (not safe|unsafe|in danger)' + NO_ENF_EN + '|' +
    '(' + SUJETO_T + ' (isn t|isnt|aren t|wasn t)|im not|i m not) safe' + NO_ENF_EN + '|(don t|dont|do not|doesn t|does not) feel safe|(doesn t|does not|don t|do not) want to (live(?! (in|with|near) )|be alive|wake up(?! (the|my|her|his|their|early|at|in)\\b)|be here|exist|see tomorrow|make it to tomorrow)|' +
    '(wants|want) to (die|end it all|end (his|her|their) life|kill (himself|herself|themselves)|disappear(?! (the|a|this|that|my|her|his) ))|(is|are|s|re) going to kill (himself|herself|themselves))\\b');
  const CRISIS_EN = /\b(kill(ing)? myself|want to die|wanna die|end my life|take my own life|hurt myself|harm myself|suicidal thoughts|im suicidal|i am suicidal)\b/;
  // alta_b44 (19-nov-2026): violencia vivida en primera persona («me pegan», «mi pareja me golpea»).
  const VIOLENCIA_ES = /\b(me (pega|pegan|pego|pegaron|golpea|golpean|golpeo|golpearon|maltrata|maltratan|amenaza|amenazan|viola|violan|violo|violaron|abusa|abusan|abuso|abusaron|lastima|lastiman|agrede|agreden|encierra|encierran)|(abusa|abusan|abuso|abusaron) de mi|me (esta|estan|estaba|estaban) (pegando|golpeando|maltratando|lastimando|amenazando|violando|abusando|agrediendo|madreando)|me (madrea|madrean|madreo|madrearon|putea|putean|puteo|partio la madre|partieron la madre|surte|surten|cachetea|cachetean|patea|patean|pateo|ahorca|ahorco)|sufro (violencia|maltrato|abuso)|vivo violencia|tengo miedo de mi (pareja|esposo|esposa|novio|novia|papa|mama|padre|madre))\b/;
  const VIOLENCIA_EN = /\b((he|she|they) (hits|beats|hurts|abuses|rapes) me|my (partner|husband|wife|boyfriend|girlfriend|father|mother|dad|mom) (hits|beats|hurts|abuses) me|i am being (abused|hit|beaten)|im being (abused|hit|beaten)|(is|are|was|were) (beating|hitting|hurting|abusing|choking|kicking|threatening) me|(beats|beat|hit|hits|hurt|hurts|kicked|kicks|chokes|choked) me)\b/;
  // Temas sensibles a secas («suicidio en jalisco», «intento de suicidio», «autolesiones»): respuesta de crisis, sin cifras.
  // Sólo el rótulo técnico completo o el código de un release sensible (X60, X61, X70, X72, X78, X80, Z91.5, R45.8)
  // abre su ficha, y nunca si la consulta trae además una señal de riesgo personal.
  const SENSIBLE_ES = /\b(suicid\w*|intento de suicidio|ideacion suicida|autolesion\w*|autoinflig\w*|lesiones autoinfligidas)\b/;
  const SENSIBLE_EN = /\b(suicide|suicidal|self ?harm|self injury|self inflicted)\b/;
  function nombraReleaseSensible(qn) {
    return releasesEnConsulta(qn, { prefijos: true }).some((r) => r.sensible);
  }

  const CRISIS_TEXTO_ES = 'Lamento que estés pasando por esto. No tienes que enfrentarlo a solas.\n\n' +
    'Si tú o alguien cercano está en peligro inmediato, llama al **911**.\n\n' +
    'En México, la **Línea de la Vida** atiende gratis, las 24 horas, todos los días: **800 911 2000**. ' +
    'Te contesta un profesional de salud mental.\n\n' +
    'Soy un asistente de datos epidemiológicos y no puedo darte atención. Hablar hoy con ese servicio ' +
    'o con una persona de confianza puede ayudar.\n<!--SIN_GRAFICA-->';
  const CRISIS_TEXTO_EN = 'I am sorry you are going through this. You do not have to face it alone.\n\n' +
    'If you or someone near you is in immediate danger, call **911**.\n\n' +
    'In Mexico, **Línea de la Vida** is free and open 24 hours a day, every day: **800 911 2000**. ' +
    'A mental health professional answers.\n\n' +
    'I am an epidemiological data assistant and cannot provide care. Calling that service or talking ' +
    'to someone you trust today can help.\n<!--SIN_GRAFICA-->';

  // Auditoría Codex de alta_b44 (19-nov-2026): una señal de riesgo personal tiene precedencia ABSOLUTA sobre cualquier
  // alias técnico o código («Tengo 15 años y pienso en ahorcarme, X70 en Jalisco» devolvía la ficha con 42 casos).
  // Métodos en primera persona, autolesión, ingestiones, dosis, ideación con un tema sensible y menores en peligro.
  const METODO_PROPIO_ES = /\b(ahorcarme|colgarme|ahorcar me|envenenarme|cortarme|rajarme las venas|dispararme|balacearme|pegarme un (tiro|balazo)|darme un (tiro|balazo)|volarme la cabeza|(tirarme|aventarme|lanzarme|arrojarme|echarme) (de|desde|del|al|a la|a las|por|bajo|frente)|sofocarme|asfixiarme|ahogarme|apunalarme|acuchillarme|autolesionarme|herirme|tomarme (todas |unas |muchas |varias |un frasco de |una caja de |las )?(pastillas|pildoras|tabletas|medicinas|medicamentos|veneno|cloro|raticida))\b/;
  const AUTOLESION_ES = /\b(me (corte|cortaba|corto|ahorque|colgue|envenene|intoxique|dispare|lastime|lastimo|lesione|autolesione|autolesiono|hice dano|hago dano|quise (matar|suicidar|morir)|trate de (matar|suicidar)|intente (matar|suicidar|quitar))|intente (suicidarme|matarme|quitarme la vida))\b/;
  const CANTIDAD = '(todas|muchas|varias|un frasco|una caja|un monton|un puno|demasiadas|[0-9]+|diez|veinte|treinta|cincuenta|cien)';
  const FARMACO = '(pastillas|pildoras|tabletas|capsulas|medicamentos|medicinas)';
  const TOXICO = '(veneno|cloro|raticida|matarratas|insecticida|plaguicidas?|pesticidas?|acido|sosa|anticongelante|metanol|alcohol metilico|thinner)';
  // Ingestión de una cantidad de fármacos o de un tóxico, propia o de alguien cercano («mi hijo se tomó veneno»).
  const INGESTION_ES = new RegExp(`\\b((me|se|te) (tome|tomo|trague|trago|bebi|bebio|tomaste|tragaste)|tome|trague|ingeri|ingirio|bebi|bebio)( [a-z]+){0,3} (${CANTIDAD}( [a-z]+){0,3} ${FARMACO}|${TOXICO})\\b`);
  const DOSIS_ES = /\b(cuant[oa]s (pastillas|pildoras|tabletas|capsulas)|cuant[oa]s? [a-z ]{0,40}(necesito|me tomo|tomarme|hace falta|se necesita[n]?) (para|de)|para (morir|morirme|matarme|suicidarme|quitarme la vida)|cuanto (veneno|cloro|raticida))\b/;
  const INTENCION_ES = /\b(pienso en|pensando en|he pensado en|pense en|quiero|quisiera|voy a|planeo|estoy planeando|estoy por|me dan ganas de|tengo ganas de|me gustaria|deseo|necesito|ayudame a)\b/;
  // Verbos de consulta: «quiero ver X60 en Jalisco» pide datos, no expresa intención de dañarse.
  const CONSULTA_DATOS_ES = /\b(quiero|quisiera|necesito|me gustaria|deseo) (ver|saber|conocer|consultar|revisar|comparar|entender|descargar|los datos|las cifras|el pronostico|la grafica|informacion|info)\b/g;
  const METODO_TEMA_ES = /\b(ahorc\w*|colgar\w*|soga|cuerda|veneno|envenen\w*|intoxicarme|intoxicarse|pastillas|pildoras|sobredosis|arma|pistola|disparo|dispararme|navaja|cuchillo|cortarme|saltar|tirarme|sobredosis|aventarme|puente|azotea|morir|morirme|muerte|matarme|suicid\w*|autolesion\w*|lastimarme|desaparecer)\b/;
  const MENOR_ES = /\b(tengo (1[0-7]|[1-9]) anos|soy (menor|un nino|una nina|nino|nina|adolescente|menor de edad)|(mi|mis) (hijo|hija|hijos|hermano|hermana|sobrino|sobrina|alumno|alumna) (de|tiene) (1[0-7]|[1-9]) anos)\b/;
  const PELIGRO_ES = /\b(peligro|miedo|me (hacen|tocan|obligan|amenazan)|me quiero ir de mi casa|no quiero volver a mi casa)\b/;
  const METODO_PROPIO_EN = /\b(hang myself|cut myself|shoot myself|poison myself|stab myself|drown myself|suffocate myself|jump off|overdose|od on)\b/;
  const AUTOLESION_EN = /\b(i (cut|hurt|harmed|poisoned) myself|i tried to (kill myself|die|end my life)|i attempted suicide)\b/;
  const INGESTION_EN = /\b(i|she|he|they) (took|swallowed|drank|ingested)( [a-z0-9]+){0,5} (pills|tablets|poison|bleach|pesticide|rat poison|methanol|antifreeze)\b/;
  const DOSIS_EN = /\b(how many (pills|tablets|capsules)|how much [a-z ]{0,30}(to die|to kill myself|do i need)|enough to die)\b/;
  const INTENCION_EN = /\b(thinking (about|of)|i want to|i wanna|i am going to|im going to|i will|planning to|plan to)\b/;
  const METODO_TEMA_EN = /\b(hang\w*|rope|poison|pills|overdose|gun|shoot|knife|cut|jump|bridge|die|death|kill|suicid\w*|self ?harm)\b/;
  const MENOR_EN = /\b(i am (1[0-7]|[1-9])( years old)?|im (1[0-7]|[1-9])( years old)?|i m (1[0-7]|[1-9])|my (son|daughter|brother|sister) is (1[0-7]|[1-9]))\b/;

  // ── Lista blanca de ids sensibles (re-auditoría Codex de alta_b44, 19-nov-2026) ──────────────────────────────────────
  // Los parches por lista de frases dejaban variantes abiertas («Me he tomado 30 pastillas, X60 en Jalisco», «X70 en Jalisco,
  // hoy me colgaré»). Diseño único para el EpiBot y la función RAG (los dos leen este módulo): cuando la consulta nombra un id
  // sensible, sólo se dan cifras si TODOS sus tokens pertenecen a un vocabulario técnico cerrado. Cualquier otro token da la
  // respuesta de crisis exclusiva.
  const IDS_LISTA_BLANCA = new Set([
    'envenenamiento_analgesicos_x60', 'envenenamiento_psicotropicos_x61', 'ahorcamiento_x70', 'disparo_arma_corta_x72',
    'objeto_cortante_x78', 'salto_lugar_elevado_x80', 'intento_suicidio_z915', 'ideacion_suicida_r458',
    'violencia_intrafamiliar_y07', 'herida_arma_fuego_w32', 'intox_alcohol_f100', 'alcoholica_higado_k70',
    'cirrosis_alcoholica_k703', 'vih_b20',
  ]);
  const ESTADOS = [
    ['aguascalientes', 'Aguascalientes'], ['baja california sur', 'Baja California Sur'], ['baja california', 'Baja California'],
    ['campeche', 'Campeche'], ['coahuila', 'Coahuila'], ['colima', 'Colima'], ['chiapas', 'Chiapas'], ['chihuahua', 'Chihuahua'],
    ['ciudad de mexico', 'Ciudad de México'], ['cdmx', 'Ciudad de México'], ['durango', 'Durango'], ['guanajuato', 'Guanajuato'],
    ['guerrero', 'Guerrero'], ['hidalgo', 'Hidalgo'], ['jalisco', 'Jalisco'], ['estado de mexico', 'Estado de México'],
    ['edomex', 'Estado de México'], ['michoacan', 'Michoacán'], ['morelos', 'Morelos'], ['nayarit', 'Nayarit'],
    ['nuevo leon', 'Nuevo León'], ['oaxaca', 'Oaxaca'], ['puebla', 'Puebla'], ['queretaro', 'Querétaro'],
    ['quintana roo', 'Quintana Roo'], ['san luis potosi', 'San Luis Potosí'], ['sinaloa', 'Sinaloa'], ['sonora', 'Sonora'],
    ['tabasco', 'Tabasco'], ['tamaulipas', 'Tamaulipas'], ['tlaxcala', 'Tlaxcala'], ['veracruz', 'Veracruz'],
    ['yucatan', 'Yucatán'], ['zacatecas', 'Zacatecas'],
  ];
  const VOCAB_NEUTRO = new Set((
    // geografía
    ESTADOS.map(([e]) => e).join(' ') + ' coahuila de zaragoza michoacan de ocampo veracruz de ignacio de la llave queretaro de arteaga ' +
    'distrito federal df mexico mexicana republica pais nacional nacionales national nationwide country entidad entidades estado ' +
    'estados region regiones regional noroeste noreste norte centro occidente sur sureste' +
    // sexo
    ' sexo sexos hombre hombres mujer mujeres masculino femenino general ambos varones men women male female males females' +
    // consulta neutra
    ' casos caso cuantos cuantas cuanto cuantos numero total totales promedio pronostico pronosticos pronosticado pronosticados' +
    ' prediccion proyeccion tendencia tendencias semana semanas semanal semanales ano anos anual mes meses en de del y e o u la el' +
    ' los las lo al a por para con sobre que cual cuales como es son fue hay hubo habra sera seran esta estan va van se espera' +
    ' esperan esperados esperado notificados notificadas reportados registrados observado observados historico historica' +
    ' historia datos dato cifra cifras grafica grafico serie series ficha pagina informacion info fuente boletin modelo motor' +
    ' modelos motores control estacional validacion validado validada error smape mase metricas proximas proximos siguientes' +
    ' ultima ultimas ultimo ultimos actual mas menos mayor menor tiene tienen comparar compara comparacion vs ver mostrar' +
    ' muestra muestrame dame dime consulta consultar tasa incidencia' +
    // inglés
    ' what is are the of for in and how many much cases case forecast forecasts trend week weeks year years total show data' +
    ' state states region by'
  ).split(/\s+/).filter(Boolean));
  // Palabras genéricas de riesgo que sólo aparecen dentro del rótulo completo de Z91.5 y R45.8: canonClinico retira ese
  // paréntesis cuando acompaña al rótulo; sueltas no son vocabulario técnico.
  const RIESGO_EN_ROTULO = new Set(['suicidio', 'suicida', 'suicidas', 'ideacion', 'intento', 'suicide', 'attempt']);
  const NOMBRES_LEGACY = ['depresion', 'parkinson', 'alzheimer', 'dengue', 'f32', 'g20', 'g30', 'a97'];
  /** Decimoquinta auditoría: normalización ÚNICA de entrada (NFKC) que aplican kb.js, app.js y rag.mjs a la consulta y al
   * historial antes de cualquier otra cosa; el catálogo la repite (idempotente) para quien lo llame directamente. */
  // Rediseño conversacional (24-nov-2026): los caracteres de ancho cero se retiran tras NFKC; una palabra partida con ellos
  // («ma\u200btar») queda unida y el detector de riesgo la ve.
  // Deuda del detector (27-nov-2026, deuda a′ del PR #163): si se retiró alguno, se deja al final la marca « ¡», que la
  // gramática estricta de la variante neutra y de su seguimiento rechaza (falla hacia la crisis completa) y que el resto de
  // las rutas ignora. Idempotente: una segunda pasada ya no encuentra invisibles y conserva la marca.
  const INVISIBLES = /[\u00AD\u180E\u200B-\u200F\u2060-\u2064\uFEFF]/g;
  const MARCA_INVISIBLE = ' ¡';
  const normalizaEntrada = (t) => {
    const s = String(t ?? '').normalize('NFKC');
    const limpio = s.replace(INVISIBLES, '');
    return limpio === s ? s : `${limpio}${MARCA_INVISIBLE}`;
  };
  // Decimocuarta auditoría: NFKC antes de todo (ancho completo y formas compatibles pasan a ASCII y el riesgo las ve).
  const sinTildeMin2 = (t) => String(t).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Vocabulario técnico: palabras de los rótulos, nombres y alias de todos los releases y de los cuatro legacy.
  const VOCAB_TECNICO = new Set(releases.flatMap((r) => [r.nombre, r.etiqueta, r.pad, r.nombreCorto, r.consulta, ...r.alias]
    .flatMap((t) => sinTildeMin2(t).split(/[^a-z0-9]+/))).filter((w) => w && !/^\d+$/.test(w) && !RIESGO_EN_ROTULO.has(w))
    .concat(NOMBRES_LEGACY));
  /** Normalización de la lista blanca: minúsculas sin tildes, sólo [a-z0-9] separados por un espacio. */
  const normLB = (q) => sinTildeMin2(q).replace(/[^a-z0-9]+/g, ' ').trim();
  /** Tokens que quedan tras retirar códigos CIE, años y semanas, que son técnicos. */
  function tokensLibres(q) {
    return canonClinico(normLB(q)).replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(semanas?|sem|weeks?) \d{1,2}\b|\b\d{1,2} (semanas|weeks)\b/g, ' ')
      .replace(/\b(19|20)\d{2}( w\d{1,2})?\b|\bw\d{1,2}\b/g, ' ')
      .replace(/\b[a-z]\d{2}( \d{1,2})?\b/g, ' ')
      .split(' ').filter(Boolean);
  }
  const ALCOHOL_PERMITIDO = new Set(['etilico', 'etilica', 'etanol', 'aguda', 'agudo', 'ethyl', 'ethanol', 'acute', 'intoxication']);
  const ALCOHOL_NO_ETILICO = 'la intoxicación por alcohol metílico, isopropílico ni por otros alcoholes no etílicos (T51.1-T51.9)';
  /** «alcohol» con un calificativo fuera de la lista blanca (etílico, etanol, aguda): no es F10.0. */
  function alcoholCalificado(q) {
    const t = normLB(q).split(' ');
    for (let i = 0; i < t.length; i++) {
      if (!/^alcohol(es)?$/.test(t[i])) continue;
      if (t[i] === 'alcoholes' && t[i - 1] === 'otros') return true;
      const permitido = (w) => !w || ALCOHOL_PERMITIDO.has(w) || NOMBRES_LEGACY.includes(w) || (VOCAB_NEUTRO.has(w) && !/^\d/.test(w));
      if (!permitido(t[i + 1])) return true;
      // «alcohol de 96», «alcohol de caña», «alcohol para curar»: el calificativo va tras la preposición.
      if (['de', 'del', 'para'].includes(t[i + 1]) && t[i + 2] && (/^\d/.test(t[i + 2]) || !permitido(t[i + 2]))) return true;
    }
    return /\b(metanol|isopropanol|propanol|butanol|etilenglicol|methanol|isopropanol)\b/.test(normLB(q));
  }
  /** Releases de la lista blanca que nombra la consulta (F10.0 no cuenta si el alcohol está calificado). */
  function idsSensiblesEn(q) {
    // Decimoséptima auditoría: por el resolutor único (alias, prefijos y códigos con subcódigos, también compactos «X600»).
    return releasesEnConsulta(q, { prefijos: true }).filter((r) => IDS_LISTA_BLANCA.has(r.id) &&
      !(r.id === 'intox_alcohol_f100' && alcoholCalificado(q)));
  }
  // Tercera auditoría Codex: léxico de riesgo por formas verbales (futuro, infinitivo, pronominal), independiente de que se
  // resuelva un padecimiento («X7O en Jalisco, hoy me colgaré» caía en la tabla legacy). Se evalúa tras retirar los rótulos y
  // alias de los releases («…al saltar desde un lugar elevado» es el nombre de X80, no una intención).
  // alta_b44 (no modelables): asfixia, ahogamiento y quemaduras entran al radar sin pronóstico; los verbos de método
  // propio («me quiero asfixiar», «ahogarme») siguen dando la crisis, nunca cifras.
  // Novena auditoría Codex: también el desbordamiento («no puedo más», «ya no aguanto», «no soporto», «estoy harto de vivir»,
  // «can't take it anymore», «I can't go on») activa la respuesta de apoyo y queda registrado como estado de ayuda.
  const RIESGO_LEX_ES = /\b(quemar(me|se|te)?|quemare|prenderme fuego|asfixiar(me|se|te)?|asfixiare|ahogar(me|se|te)?|ahogare|sofocar(me|se|te)?|lesionar(me|se)|herir(me|se)|colgar(me|se|te)?|colgare|colgaria|ahorcar(me|se|te)?|ahorcare|ahorcaria|matar(me|se|te)|matare|mataria|morir(me|se)|morire|moriria|cortar(me|se)?|cortare|me voy a (cortar|colgar|ahorcar|matar|tirar|aventar|lanzar|envenenar|disparar|morir|lesionar|herir|lastimar|quemar|asfixiar|ahogar)|saltar(e|ia)?|aventar(me|se)|aventare|tirar(me|se)|tirare|lanzar(me|se)|lanzare|envenenar(me|se)?|envenenare|intoxicar(me|se)|disparar(me|se)|dispararia|suicid[a-z]*|no quiero vivir|no quiero seguir|(ya )?no (puedo|podemos|aguanto|aguantamos|soporto|soportamos) (mas|seguir|con esto|con todo|con mi vida|con la vida|vivir)|ya no (puedo|podemos|aguanto|aguantamos|soporto|soportamos)|ya no (quiero|queremos) (seguir|vivir|existir|estar aqui)|no (aguanto|soporto)|no lo (aguanto|soporto)|(estoy|estamos|ando|me siento|me tiene|me tienen) (harto|harta|hartos|hartas|cansado|cansada|cansados|cansadas) de (vivir|la vida|todo|existir)|(harto|harta|hartos|hartas|cansado|cansada|cansados|cansadas) de (vivir|la vida|existir)|me rindo|acabar con todo|acabar con mi vida|quitarme la vida|desaparecerme|(quiero|quisiera|me gustaria|ganas de) desaparecer|sobredosis)\b/;
  const RIESGO_LEX_EN = /\b(kill(ing)? myself|hang(ing)? myself|cut(ting)? myself|poison(ing)? myself|shoot(ing)? myself|overdos(e|ing)|suicid[a-z]*|die|dying|end it all|end my life|jump(ing)? off|want to die|can ?t take (it|this|any ?more)( any ?more)?|cannot take (it|this)( any ?more)?|can ?t go on|cannot go on|can ?t do this any ?more|can ?t cope|tired of (living|life)|sick of (living|life)|done with life|give up on life)\b/;
  const ALIAS_LARGOS = [...new Set(releases.flatMap((r) => [r.consulta, ...r.alias]).map((a) => sinTildeMin2(a).replace(/[^a-z0-9]+/g, ' ').trim())
    .filter((a) => a.includes(' ')))].sort((x, y) => y.length - x.length);
  function sinRotulos(q) {
    let n = ` ${canonClinico(normLB(q)).replace(/[^a-z0-9]+/g, ' ').trim()} `;
    for (const a of ALIAS_LARGOS) n = n.split(` ${a} `).join(' ');
    return n;
  }
  function lexicoRiesgo(q) {
    const n = sinRotulos(q);
    if (RIESGO_LEX_ES.test(n)) return 'es';
    return RIESGO_LEX_EN.test(n) ? 'en' : null;
  }
  // Emojis y símbolos: no se retiran antes de comprobar. Unos son señal explícita de riesgo; cualquier carácter fuera de
  // letras, dígitos, espacios y puntuación básica cuenta como token no técnico.
  const EMOJI_RIESGO = /\u{1F198}|\u{1F48A}|☠|\u{1FA62}|\u{1F52A}|\u{1F52B}|\u{1FA78}|⚰|\u{1F480}|\u{1FA93}/u;
  // Decimocuarta auditoría: tras NFKC, sólo valen letras latinas básicas (con tildes, ñ y ü), dígitos ASCII, espacio, tabulador
  // o salto de línea y la puntuación que trata el divisor. Cualquier otro carácter (otros alfabetos, homoglifos cirílicos o
  // griegos, caracteres invisibles o de ancho cero, marcas combinantes sueltas, símbolos) deja el turno fuera de vocabulario:
  // nunca se elimina en silencio.
  const simbolosNoTecnicos = (raw) => /[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ \t\n\r.,;:¿?¡!'"()\-\/«»%#+_\u2013\u2014\u2026\u2018\u2019\u201C\u201D]/u
    .test(String(raw).normalize('NFKC').normalize('NFC'));
  // ── Lista blanca GLOBAL (cuarta auditoría Codex, 19-nov-2026) ─────────────────────────────────────────────────────────
  // Un léxico de riesgo no puede ser exhaustivo (sinónimos, leetspeak, espaciado, inglés coloquial). Todo turno con un
  // token fuera del vocabulario cerrado no recibe cifras, gráfica ni ficha: recibe un apoyo fijo con la Línea de la Vida y
  // la invitación a reformular. Quinta auditoría: fragmentos completos (js/vocab_cerrado.js, generado desde el catálogo) y
  // lista curada corta (js/vocab_consulta.js, a mano); ver analizaTurno.
  // Rediseño conversacional (24-nov-2026, mesa redonda): la lista blanca global ya no rechaza las consultas naturales. Sólo
  // un turno personal (primera persona) que no nombra ningún dato reconocible recibe esta respuesta, una vez y sin estado
  // persistente: no entendimos y, por si la persona atraviesa un momento difícil, la Línea de la Vida.
  const APOYO_ES = 'No entendí bien tu mensaje y prefiero no adivinar.\n\n' +
    'Puedo contarte cómo va un padecimiento en tu estado; por ejemplo, «¿cómo va el dengue en Jalisco?» o ' +
    '«¿está subiendo la diabetes en Nuevo León?».\n\n' +
    'Si estás pasando por un momento difícil, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**. ' +
    'Si alguien está en peligro inmediato, llama al **911**.\n<!--SIN_GRAFICA-->';
  const APOYO_EN = 'I did not quite understand your message and I would rather not guess.\n\n' +
    'I can tell you how a condition is going in a Mexican state; for example, «dengue in Jalisco».\n\n' +
    'If you are going through a hard time, **Línea de la Vida** in Mexico is free and open 24 hours a day: ' +
    '**800 911 2000**. If someone is in immediate danger, call **911**.\n<!--SIN_GRAFICA-->';
  // Quinta auditoría Codex: el vocabulario ya no admite palabras sueltas del corpus ni de las pruebas. (a) Se RETIRAN del
  // turno los fragmentos que coinciden completos con nombres, alias y códigos de padecimientos, geografía reconocida
  // (js/vocab_cerrado.js, generado) y frases técnicas (js/vocab_consulta.js); (b) lo que queda debe estar en la lista curada
  // de palabras de consulta neutras (js/vocab_consulta.js, versionada a mano); (c) números sólo como año 2014-2027 o dentro
  // de una frase técnica. Sin los dos archivos la comprobación falla cerrada.
  const DATOS_RUTA = /\b(panorama|kpis|tablero nacional|nacional|national)\b/;
  // Sexta auditoría Codex: frases completas que reconocen las guardas y los detectores (nombres genéricos que piden precisar,
  // subtipos de familia en un seguimiento, vecinos clínicos), escritas a mano por guarda. Se consumen sólo como fragmento
  // completo; nunca habilitan sus palabras sueltas en otra frase.
  const FRASES_GUARDAS_EXTRA = [
    // diabetesEnConsulta / conDiabetesNombrada y ALIAS_AMBIGUOS genéricos de un bloque.
    'diabetes', 'sifilis', 'tuberculosis', 'rickettsiosis', 'leishmaniasis', 'leishmaniasis visceral', 'paludismo', 'malaria', 'hepatitis', 'otitis', 'amebiasis', 'candidiasis',
    'conjuntivitis', 'meningitis', 'desnutricion', 'displasia', 'displasia cervical', 'lombrices', 'mordedura', 'picadura',
    // conFamiliaNombrada / FAMILIAS: subtipos que nombra un seguimiento («¿y la severa?», «¿y las otras?»).
    'leve', 'moderada', 'severa', 'aguda', 'cronica', 'la severa', 'las otras', 'otras', 'congenita', 'gestacional',
    'pulmonar', 'perinatal', 'neonatal', 'fetal', 'embarazo', 'en el embarazo', 'durante el embarazo', 'congenital',
    // Vecinos clínicos de las guardas de subtipo y de transporte.
    'tracto genitourinario', 'gonococica', 'urogenital', 'cardiopatia reumatica', 'peatones', 'intoxicaciones por monoxido de carbono',
    'hepatitis virica', 'lombrices intestinales', 'parotiditis bacteriana', 'amigdalitis viral', 'faringitis viral', 'rare syndrome',
    // Subtipos y vecinos que nombran las pruebas de alcance (SUBTIPOS_AJENOS, ALIAS_AMBIGUOS y noModeladas).
    'amebiasis cutanea', 'amibiasis cutanea', 'amoebiasis cutanea', 'amebiasis cerebral', 'amibiasis cerebral',
    'amebiasis extraintestinal', 'amibiasis extraintestinal', 'conjuntivitis viral', 'conjuntivitis virica',
    'conjuntivitis por adenovirus', 'conjuntivitis adenoviral', 'ear infection', 'candidiasis oral', 'candidiasis esofagica',
    'candidiasis cutanea', 'algodoncillo', 'diabetes pregestacional', 'diabetes mellitus', 'maternal syphilis', 'bejel', 'yaws',
    'chlamydia', 'granuloma inguinal', 'verrugas anogenitales', 'mortalidad', 'depresion alta', 'salud publica',
    // Violencias genéricas no modeladas (noModeladas): la frase completa, nunca «familiar» suelto.
    'violencia familiar',
    // Letras de la familia de hepatitis en un seguimiento («¿y la B?»).
    'la a', 'la b', 'la c', 'la d', 'la e', 'y b', 'y c',
  ];
  // Frases completas de las guardas de alcance: el término y el rótulo de cada subtipo o vecino no modelado
  // (SUBTIPOS_AJENOS) y los vecinos de hipertensión, normalizados y sin paréntesis. Se consumen sólo completas.
  const FRAGMENTOS_GUARDAS = [...new Set([
    ...SUBTIPOS_AJENOS.flatMap(([, termino, nombre]) => [termino, ...String(nombre).replace(/\([^)]*\)/g, ',').split(/,| ni | y | o /)]),
    ...HIPERTENSION_AJENA.map(([, t]) => t),
  ].map((t) => normLB(String(t)).replace(/^(la|el|los|las|otra|otras|otro|otros) /, '').trim()).filter((t) => t.includes(' ') || t.length >= 6)),
  ...FRASES_GUARDAS_EXTRA.map((t) => normLB(t))]
    .sort((a, b) => b.length - a.length);
  // Fragmentos que reconocen las propias guardas de alcance y los detectores clínicos: el texto EXACTO que casa con su
  // expresión regular (por secuencia de tokens). Se omiten las expresiones que admiten palabras arbitrarias entre medias
  // («.*», «( [a-z]+)», «[a-z ]{…}») y todo fragmento que, solo o tras «me»/«quiero», dispara la crisis.
  let _guardasRe = null;
  function regexDeGuardas() {
    if (_guardasRe) return _guardasRe;
    const lista = [SUBTIPO_DIABETES, HTA_TERMINO, EMBARAZO_TERMINO, PRESION_BAJA, HIPERTENSION, CANCER_MAMA,
      ...CANON_CLINICO.map(([de]) => de), ...HIPERTENSION_AJENA.map(([re]) => re),
      ...SUBTIPOS_AJENOS.flatMap(([re, , , , ctx]) => [re, ctx]),
      ...ALIAS_AMBIGUOS.flatMap((a) => [a.generico, a.especifico, a.uno, a.otroEsp]),
      ...ACLARACIONES.map((a) => a.re)]
      .filter((re) => re instanceof RegExp && !/\.\*|\.\+|\( \[a-z\]\+\)|\[a-z \]\{|\(\?!|\^/.test(re.source) && re.source !== '(?!)');
    _guardasRe = lista.map((re) => new RegExp(re.source, 'g'));
    return _guardasRe;
  }
  function retiraFragmentosDeGuardas(n) {
    let t = n;
    for (const re of regexDeGuardas()) {
      // Tampoco cuentan formas pronominales de verbo («lesionarme», «quemarse»): nunca son el rótulo de una guarda.
      t = t.replace(re, (m) => (/[a-z]/.test(m) && !/(arme|erme|irme|arse|erse|irse|arte|erte|irte)\b/.test(m) &&
        !respuestaCrisis(m) && !respuestaCrisis(`me ${m}`) && !respuestaCrisis(`quiero ${m}`) ? ' ' : m));
    }
    return t;
  }
  let _fragmentosCache = null;
  function todosLosFragmentos() {
    if (_fragmentosCache && _fragmentosCache.base === globalThis.EPI_FRAGMENTOS) return _fragmentosCache.lista;
    const lista = [...new Set([...(globalThis.EPI_FRAGMENTOS || []), ...FRAGMENTOS_GUARDAS])].sort((a, b) => b.length - a.length);
    _fragmentosCache = { base: globalThis.EPI_FRAGMENTOS, lista };
    return lista;
  }
  // Décima auditoría Codex: verbos de petición o de segunda persona (`VERBOS_PETICION` de js/vocab_consulta.js). Con uno de
  // ellos la edad no se retira, un id sensible da la crisis y el turno nunca levanta la crisis.
  // Duodécima auditoría: el predicado técnico de estado de un pronóstico («¿está validada…?», «¿es confiable…?», «¿fue
  // rechazado…?») es una construcción fija sin sujeto personal, no un verbo de petición. Es la única excepción.
  const ESTADO_TECNICO = /\b(esta|estan|es|son|fue|fueron|sera|seran) (validad[oa]s?|confiables?|aceptad[oa]s?|rechazad[oa]s?|publicad[oa]s?)\b/g;
  const sinEstadoTecnico = (t) => normLB(t).replace(ESTADO_TECNICO, (m, v, adj) => adj);
  function peticionEn(texto) {
    const cur = globalThis.EPI_VOCAB_CONSULTA;
    if (!cur || !cur.verbosPeticion) return false;
    const limpio = sinEstadoTecnico(texto);
    const toks = new Set(limpio.split(' '));
    return cur.verbosPeticion.some((v) => toks.has(v)) || /\bme gustaria\b/.test(limpio);
  }
  /** Petición directa al bot: un verbo de petición propio («dame», «can you») o un verbo de la lista curada sin ancla. */
  function peticionDirecta(texto) {
    const cur = globalThis.EPI_VOCAB_CONSULTA;
    if (!cur || !cur.verbosPeticion) return false;
    const curados = new Set(cur.verbosCurados || []);
    const n = ` ${canonClinico(normLB(texto)).replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const toks = new Set(n.split(' '));
    return cur.verbosPeticion.some((v) => !curados.has(v) && toks.has(v)) || /\bme gustaria\b/.test(n) ||
      verbosSinAncla(texto).length > 0;
  }
  // Fragmentos de lesión o daño que, pedidos al bot sin un sustantivo de datos, se leen como una petición de daño.
  const DANO = /\b(herida|heridas|herir|lesion|lesiones|lesionar|dano|danos|golpe|golpes|intoxicacion|intoxicar|envenenamiento|envenenar|veneno|quemadura|quemaduras|asfixia|ahogamiento|ahorcamiento|sofocacion|estrangulamiento|disparo|arma|armas|bala|corte|cortante|navaja|cuchillo|sobredosis|mordedura|mordeduras|picadura|picaduras|intoxicaciones|envenenamientos|disparos|cortes|ahogamientos|wound|wounds|injury|injuries|harm|poison|poisoning|overdose|burn|burns|choking|gun|knife|bullet)\b/;
  /** Petición al bot que no va seguida de un sustantivo de datos y nombra un id sensible o un fragmento de daño. */
  // Rediseño conversacional (24-nov-2026): los verbos impersonales o de tercera persona («hay», «hubo», «tienen», «reporta»)
  // preguntan por datos; sólo una petición en primera o segunda persona o un imperativo («dame», «muéstrame», «quiero»,
  // «can you») junto a un término de daño se lee como petición de daño. «¿Cuántos golpes de calor hubo?» no lo es.
  const IMPERSONALES = new Set(['hay', 'hubo', 'habra', 'habria', 'hubiera', 'tiene', 'tienen', 'es', 'son', 'fue', 'ha', 'va', 'van',
    'esta', 'reporto', 'llega', 'llegan', 'llego', 'llegaron', 'afecta', 'sigue', 'viene', 'pasa', 'queda', 'quedo', 'suma', 'gana',
    'iba', 'iban', 'puede', 'podria', 'ser', 'haber', 'esperaba', 'esperan', 'estiman', 'dicen', 'decia', 'tuvieron', 'ocurrio',
    'equivale', 'predice', 'publica', 'cuesta', 'trata', 'pronostican', 'modela', 'modelan', 'usa', 'usan', 'llama', 'is', 'are']);
  function peticionPersonal(raw) {
    const cur = globalThis.EPI_VOCAB_CONSULTA;
    if (!cur || !cur.verbosPeticion) return false;
    const toks = new Set(sinEstadoTecnico(raw).split(' '));
    return cur.verbosPeticion.some((v) => !IMPERSONALES.has(v) && toks.has(v)) || /\bme gustaria\b/.test(sinEstadoTecnico(raw));
  }
  // Excepción acotada (decisión del autor, 25-nov-2026): con un verbo de COMPARACIÓN y sin primera persona ni verbos de
  // provocar, un término de lesión que forma parte del nombre completo de un padecimiento publicado NO sensible («compara
  // picaduras de alacrán en Puebla y Tlaxcala», «quemaduras compara», «mordeduras de perro vs …») es el objeto de la
  // comparación, no una petición de daño. Los ids sensibles siguen dando la crisis (se revisan antes) y el resto de los
  // detectores (riesgo personal, ingestión propia, léxico de riesgo) no cambia. Devuelve los índices de esos términos.
  const COMPARA_VERBO = /^(compara|comparar|comparalo|comparala|comparalos|comparalas|comparame|comparen|comparan|comparemos|contrasta|contrastar|vs|versus)$/;
  const PROPIO_O_PROVOCAR = /^(me|mi|mis|yo|conmigo|hacer|hacerme|hacerle|hacerte|provocar|provocarme|causar|causarme|hago|haces)$/;
  const NOMBRE_DE_UNA_PALABRA = new Set(['quemaduras', 'quemadura']);
  const INDEFINIDO = new Set(['un', 'una', 'unos', 'unas', 'alguna', 'algun', 'otra', 'otro']);
  const SINGULAR = { picaduras: 'picadura', mordeduras: 'mordedura', quemaduras: 'quemadura', heridas: 'herida', intoxicaciones: 'intoxicacion', lesiones: 'lesion' };
  function comparacionDePublicados(toks) {
    const fuera = new Set();
    if (!toks.some((t) => COMPARA_VERBO.test(t)) || toks.some((t) => PROPIO_O_PROVOCAR.test(t))) return fuera;
    const formas = [toks, toks.map((t) => SINGULAR[t] || t)];
    for (const f of todosLosFragmentos()) {
      if (!DANO.test(f) || idsSensiblesEn(f).length || nombraReleaseSensible(f)) continue;
      const fw = f.split(' ');
      // Sólo nombres completos (dos palabras o más, o «quemaduras»), y nunca tras un artículo indefinido: «una herida» o
      // «una picadura» se leen como algo personal (pruebas de la decimotercera auditoría).
      if (fw.length < 2 && !NOMBRE_DE_UNA_PALABRA.has(f)) continue;
      for (const tk of formas) {
        for (let i = 0; i + fw.length <= tk.length; i++) {
          if (INDEFINIDO.has(tk[i - 1])) continue;
          if (fw.every((x, j) => tk[i + j] === x)) for (let j = 0; j < fw.length; j++) fuera.add(i + j);
        }
      }
    }
    return fuera;
  }
  function peticionDeDano(raw) {
    if (!peticionPersonal(raw)) return false;
    raw = String(raw).replace(/golpes? de calor/gi, 'efectos del calor');
    if (academicoNoAutolesion(raw)) return false;
    // Decimotercera auditoría: con un verbo de petición en cualquier parte del turno, toda cláusula que nombre un id sensible
    // da la crisis, y en cada cláusula todo fragmento de lesión o daño debe ir inmediatamente tras un sustantivo de datos de
    // ESA cláusula («dame datos, una intoxicación…» no lo justifica «datos»). Sin exención por rótulo.
    return clausulasSignos(raw).some((toks) => {
      if (idsSensiblesEn(toks.join(' ')).length) return true;
      const benignos = comparacionDePublicados(toks);
      return toks.some((w, i) => {
        if (!DANO.test(w)) return false;
        if (benignos.has(i)) return false;
        // Sólo «sustantivo de datos + de/del/por/sobre (+ artículo) + daño» («casos de asfixia»); «datos una herida» no.
        let k = i - 1;
        if (['la', 'el', 'los', 'las', 'un', 'una'].includes(toks[k])) k--;
        if (!['de', 'del', 'por', 'sobre'].includes(toks[k])) return true;
        k--;
        return !(k >= 0 && SUSTANTIVO_DATOS.test(toks[k]));
      });
    });
  }

  // Undécima instrucción: petición o interrogativo de conocimiento seguido de «sobre/de/del/acerca de» y del fragmento
  // completo de un padecimiento. Sólo se retira si el padecimiento no es sensible y su nombre no lleva un término de lesión o
  // daño («dime sobre quemaduras» no vale; «dame los casos de quemaduras» sí, por el sustantivo de datos).
  const CONOCIMIENTO = / (dime|que sabes|hablame|cuentame|platicame|tell me|what do you know)( algo)? (sobre|acerca de|de|del|about)( (el|la|los|las|the))?(?= )/g;
  function retiraConocimiento(n) {
    return n.replace(CONOCIMIENTO, (m, ...args) => {
      const pos = args[args.length - 2];
      const resto = n.slice(pos + m.length);
      const f = todosLosFragmentos().find((x) => resto.startsWith(` ${x} `));
      if (!f || DANO.test(f) || idsSensiblesEn(f).length || nombraReleaseSensible(f)) return m;
      return ' ';
    });
  }
  // Undécima auditoría: los verbos de la lista curada (VERBOS_CURADOS, fuente única) sólo son vocabulario anclados: seguidos,
  // con artículos o preposiciones opcionales, de un sustantivo de datos; seguidos de «sobre/de/del/acerca de» y del fragmento
  // completo de un padecimiento no sensible ni de daño; o precedidos en el turno por un interrogativo o por «se» impersonal.
  const SUSTANTIVO_DATOS = /^(casos|caso|cifras|cifra|datos|dato|numero|numeros|pronostico|pronosticos|tendencia|tendencias|tasa|tasas|estadisticas|estadistica|informacion|serie|series|grafica|graficas|grafico|graficos|modelos|modelo|metricas|metrica|resultados|resultado|motores|motor|cases|data|numbers|forecast|forecasts|figures|stats|statistics)$/;
  const ENLACE_PAL = new Set(['los', 'las', 'el', 'la', 'un', 'una', 'unos', 'unas', 'de', 'del', 'sobre', 'con', 'contra', 'me',
    'mas', 'tus', 'sus', 'the', 'some', 'any', 'your', 'more', 'of', 'al', 'a', 'lo']);
  const INTERROGATIVO = new Set(['que', 'como', 'cual', 'cuales', 'cuantos', 'cuantas', 'cuanto', 'donde', 'cuando', 'quien',
    'quienes', 'what', 'how', 'which', 'who', 'when', 'where', 'why']);
  const REGION_GEO = /^(region|regiones|nacional|noroeste|noreste|norte|centro|occidente|sur|sureste|pais|republica|mexico|metropolitana)\b/;
  /** Fragmento completo de un padecimiento o de una geografía, no sensible y sin término de daño. */
  const fragmentoBenigno = (f) => Boolean(f) && !DANO.test(f) && !idsSensiblesEn(f).length && !nombraReleaseSensible(f);
  // Palabras funcionales y de cortesía: nunca anclan un verbo como objeto.
  const FUNCIONALES = new Set(['y', 'e', 'o', 'u', 'pero', 'no', 'si', 'tal', 'tan', 'tambien', 'solo', 'solamente', 'mas', 'menos',
    'algo', 'nada', 'otro', 'otra', 'uno', 'una', 'cada', 'hasta', 'desde', 'entre', 'para', 'por', 'segun', 'versus', 'vs',
    'hola', 'hey', 'gracias', 'favor', 'porfa', 'porfavor', 'saludos', 'buenas', 'buenos', 'tardes', 'noches', 'dia', 'dias',
    'ahora', 'hoy', 'siguiente', 'onda', 'and', 'for', 'in', 'of', 'the', 'excepto', 'frente', 'mismo', 'about']);
  function verboAnclado(toks, i) {
    let j = i + 1;
    while (j < toks.length && (ENLACE_PAL.has(toks[j]) || toks[j] === 'por' || toks[j] === 'en' || toks[j] === 'acerca')) j++;
    // (a) sustantivo de datos de la lista cerrada.
    if (j < toks.length && SUSTANTIVO_DATOS.test(toks[j])) return true;
    // (a') objeto: una palabra técnica de la lista curada que no es verbo ni palabra funcional («hay overfitting», «está
    // validado», «es confiable», «compara la semana 8»). Un fragmento de daño nunca es palabra curada y lo trata peticionDeDano.
    const cur = globalThis.EPI_VOCAB_CONSULTA;
    if (j < toks.length && cur && cur.palabras.has(toks[j]) && !(cur.verbosCurados || []).includes(toks[j]) &&
      !FUNCIONALES.has(toks[j]) && !INTERROGATIVO.has(toks[j])) return true;
    // (b) objeto: el fragmento completo de un padecimiento o una geografía no sensible ni de daño («compara depresión en
    // Jalisco», «describe el alzheimer», «háblame sobre la lepra»).
    const despues = ` ${toks.slice(j).join(' ')} `;
    if (fragmentoBenigno(todosLosFragmentos().find((x) => despues.startsWith(` ${x} `)))) return true;
    // (c) sujeto no personal inmediatamente antes: un sustantivo de datos o un fragmento benigno («la depresión ha crecido»,
    // «el pronóstico decía»).
    let k = i - 1;
    while (k >= 0 && ['el', 'la', 'los', 'las', 'no'].includes(toks[k])) k--;
    if (k >= 0 && SUSTANTIVO_DATOS.test(toks[k])) return true;
    // El sujeto es un padecimiento, nunca una geografía («asma en Jalisco, describe» no ancla el verbo).
    const antes = ` ${toks.slice(0, k + 1).join(' ')} `;
    const sujeto = todosLosFragmentos().find((x) => antes.endsWith(` ${x} `));
    if (fragmentoBenigno(sujeto) && !estadosEn(sujeto).length && !REGION_GEO.test(sujeto)) return true;
    // (d) construcción impersonal con «se» o pregunta con un interrogativo previo.
    if (toks[i - 1] === 'se') return true;
    return toks.slice(0, i).some((w) => INTERROGATIVO.has(w));
  }

  // Duodécima auditoría: el anclaje no cruza coma, punto, punto y coma, dos puntos, signos de interrogación o exclamación ni
  // conjunción coordinante; cada cláusula se evalúa por separado y el turno vale sólo si todas sus cláusulas valen.
  const CONJUNCION = new Set(['y', 'e', 'o', 'u', 'ni', 'pero', 'sino', 'and', 'or', 'but', 'nor']);
  // Decimotercera auditoría: DIVISOR ÚNICO de cláusulas, aplicado sobre el texto original antes de cualquier normalización.
  // Todo carácter que no sea letra (con tildes y ñ), dígito o espacio separa cláusulas («,», «.», «…», «—», «–», «-»,
  // comillas, paréntesis, barras, «:», «¿?», «¡!», saltos de línea…), salvo dentro de un fragmento completo reconocido: el
  // punto decimal de un código CIE («A54.0») o el rótulo de un padecimiento o categoría que lleva signos.
  // Decimoquinta auditoría: sin marcas de texto. El texto se divide en una LISTA de segmentos por los signos y la frontera
  // entre segmentos se representa con `null` en el arreglo de tokens: ninguna palabra que escriba el usuario puede hacerse
  // pasar por separador (una palabra desconocida, como cualquier otra, queda fuera de vocabulario).
  function segmentos(raw) {
    // Decimoctava auditoría: el subcódigo con punto se une en un solo token compacto («A54.0» → «a540»); un número separado
    // por espacio tras un código nunca forma parte de él.
    const conCodigo = normalizaEntrada(raw).replace(/([A-Za-z]\d{2})\.(\d)(?!\d)/g, '$1$2').replace(/([\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, '$1 ');
    const toks = [];
    for (const trozo of conCodigo.split(/[^\p{L}\p{N}\s]+/u)) {
      const palabras = canonClinico(sinEstadoTecnico(trozo)).replace(/([a-z]\d{2})\.(\d)(?!\d)/g, '$1$2').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
      if (toks.length) toks.push(null);
      toks.push(...palabras);
    }
    const palabrasIdx = toks.map((w, k) => k).filter((k) => toks[k] !== null);
    const txt = ` ${palabrasIdx.map((k) => toks[k]).join(' ')} `;
    const protegido = new Set();
    for (const f of todosLosFragmentos()) {
      if (!f.includes(' ')) continue;
      let desde = 0;
      for (;;) {
        const pos = txt.indexOf(` ${f} `, desde);
        if (pos < 0) break;
        const ini = txt.slice(0, pos + 1).trim().split(' ').filter(Boolean).length;
        const fin = ini + f.split(' ').length - 1;
        for (let k = palabrasIdx[ini]; k <= palabrasIdx[fin]; k++) protegido.add(k);
        // Si el rótulo abre un signo dentro («volumen (deshidratación)»), el signo que lo cierra justo después también es suyo.
        const abre = toks.slice(palabrasIdx[ini], palabrasIdx[fin] + 1).includes(null);
        if (abre && toks[palabrasIdx[fin] + 1] === null) protegido.add(palabrasIdx[fin] + 1);
        desde = pos + 1;
      }
    }
    return { toks, protegido };
  }
  /** Cláusulas separadas sólo por signos (lista de tokens normalizados por cláusula). */
  function clausulasSignos(raw) {
    const { toks, protegido } = segmentos(raw);
    const out = [];
    let actual = [];
    toks.forEach((w, k) => {
      if (w === null && !protegido.has(k)) { if (actual.length) out.push(actual); actual = []; } else if (w !== null) actual.push(w);
    });
    if (actual.length) out.push(actual);
    return out;
  }
  /** Cláusulas para el anclaje de verbos: signos y además conjunciones coordinantes (fuera de un rótulo protegido). */
  function clausulas(raw) {
    const { toks, protegido } = segmentos(raw);
    const out = [];
    let actual = [];
    toks.forEach((w, k) => {
      if (protegido.has(k)) { if (w !== null) actual.push(w); return; }
      if (w === null || CONJUNCION.has(w)) { if (actual.length) out.push(actual); actual = []; } else actual.push(w);
    });
    if (actual.length) out.push(actual);
    return out;
  }
  /** Verbos de la lista curada que aparecen sin ancla en alguna cláusula del turno. */
  function verbosSinAncla(raw) {
    const cur = globalThis.EPI_VOCAB_CONSULTA;
    if (!cur || !cur.verbosCurados) return [];
    const V = new Set(cur.verbosCurados);
    return clausulas(raw).flatMap((toks) => toks.filter((w, i) => V.has(w) && !verboAnclado(toks, i)));
  }
  const DATOS_RUTA_INTERFAZ = /\b(panorama|kpis|tablero nacional)\b/;
  function analizaTurno(raw) {
    // Decimotercera auditoría: el turno se analiza cláusula por cláusula (divisor único `clausulasSignos`); una frase de
    // petición, de edad o de consulta nunca se completa con palabras de otra cláusula.
    const turno = ` ${canonClinico(normLB(raw)).replace(/[^a-z0-9]+/g, ' ').trim()} `;
    // Sexta y novena auditorías: la edad sólo se retira en forma poblacional en tercera persona. Con una marca de primera o
    // segunda persona, de un familiar o un verbo de petición EN CUALQUIER CLÁUSULA las frases de edad no se aplican.
    const primeraPersona = /\b(tengo|tenia|tendre|soy|estoy|estaba|yo|me|conmigo|nosotros|nosotras|nos|nuestro|nuestra|nuestros|nuestras|estamos|tenemos|somos|vamos|podemos|queremos|cumplimos|cumplo|cumpli|tiene|tienen|mi|mis|my|we|our|us|i|im|i m|i ve|tienes|tenias|tendras|eres|estas|estes|estabas|te|tu|tus|ti|contigo|usted|ustedes|you|your|youre|you re)\b/.test(turno) || peticionEn(turno);
    const partes = clausulasSignos(raw);
    // Subcódigos escritos con punto («B50.0», «Z99.9»): son forma CIE aunque no los cubra un bloque publicado.
    const conPunto = new Set([...normalizaEntrada(raw).toLowerCase().matchAll(/([a-z]\d{2})\.(\d)(?!\d)/g)].map((m) => `${m[1]}${m[2]}`));
    const acc = { resto: [], todos: [], fragmentos: 0 };
    for (const p of (partes.length ? partes : [[]])) {
      const r = analizaClausula(` ${p.join(' ')} `, primeraPersona, conPunto);
      acc.resto.push(...r.resto); acc.todos.push(...r.todos); acc.fragmentos += r.fragmentos;
    }
    for (const v of verbosSinAncla(raw)) if (!acc.resto.includes(v)) acc.resto.push(v);
    return acc;
  }
  function analizaClausula(texto, primeraPersona, conPunto = new Set()) {
    let n = texto;
    const cur = globalThis.EPI_VOCAB_CONSULTA;
    let fragmentosCie = 0;
    n = retiraConocimiento(n);
    for (const re of (cur ? cur.frases : [])) if (!(primeraPersona && cur.frasesEdad && cur.frasesEdad.includes(re))) n = n.replace(re, ' ');
    // Códigos con forma CIE («h66 0», «a06 8», «a510», «n87»): técnicos aunque no sean de un bloque publicado.
    // Decimoctava auditoría: sólo el token del código válido: «b54», «x60» (forma CIE de tres caracteres) o un subcódigo compacto
    // («x600», «a540») que el resolutor reconoce. Nunca números sueltos tras el código («x600 30»): siguen las reglas normales.
    n = n.replace(/ ([a-z]\d{2})(\d)?(?= )/g, (m, cod, sub) => {
      if (sub != null && !conPunto.has(`${cod}${sub}`)) {
        const r = padecimientosEnConsulta(`${cod}.${sub}`, { parcial: false });
        if (!r.legacy.length && !r.releases.length) return m;
      }
      fragmentosCie++;
      return ' ';
    });
    let fragmentos = 0;
    // Fragmentos completos del catálogo (generados) y de las guardas de alcance, de más largo a más corto, por secuencia de
    // tokens: nunca palabra por palabra.
    for (const f of todosLosFragmentos()) {
      if (n.includes(` ${f} `)) { n = n.split(` ${f} `).join('  '); fragmentos++; }
    }
    n = retiraFragmentosDeGuardas(n);
    const todos = n.split(' ').filter(Boolean).filter((w) => !(/^\d{4}$/.test(w) && +w >= 2014 && +w <= 2027));
    const resto = todos.filter((w) => !(cur && cur.palabras.has(w)) && !ALCOHOL_PERMITIDO.has(w));
    return { resto, todos, fragmentos: fragmentos + fragmentosCie };
  }
  /** Tokens que quedan fuera del vocabulario cerrado tras retirar fragmentos y frases técnicas. */
  function restoFuera(raw) { return analizaTurno(raw).resto; }
  /** El turno nombra un dato (padecimiento, código, estado, región, «nacional» o «panorama»). */
  function tieneFragmentoDeDatos(raw) { return analizaTurno(raw).fragmentos > 0 || DATOS_RUTA.test(normLB(raw)); }
  /** El turno trae algún token fuera del vocabulario cerrado (o un símbolo no técnico o una palabra partida). */
  function fueraDeVocabulario(raw) {
    if (simbolosNoTecnicos(raw)) return true;
    const toks = normLB(raw).split(' ').filter(Boolean);
    // Palabras partidas letra a letra («s.u.i.c.i.d.i.o», «m-a-t-a-r-m-e»): cinco o más letras sueltas seguidas.
    if (/(^| )([a-z] ){4,}[a-z]( |$)/.test(` ${toks.join(' ')} `)) return true;
    return restoFuera(raw).length > 0;
  }
  /**
   * Rediseño conversacional (24-nov-2026): turno personal que no se entiende. Trae algún token fuera del vocabulario cerrado,
   * habla en primera persona y no nombra ningún dato (padecimiento, código, estado, región o «nacional»). Es el único caso,
   * aparte de la crisis y de los padecimientos sensibles, en que no se cede a los handlers con datos ni al modelo.
   */
  function apoyoSuave(raw) {
    if (!normLB(raw) && !escrituraNoLatina(raw)) return false;
    // Primera persona explícita (yo, me, mi, tengo, estoy…); la regla general de «-mos» y enclíticos («¿le atinamos?»,
    // «muéstrame algo») ya no basta para negar la respuesta: con ella se bloqueaban preguntas conversacionales.
    return apoyoInmediato(raw) || (fueraDeVocabulario(raw) && PRIMERA_PERSONA_LEX.test(` ${normLB(raw)} `) && !tieneFragmentoDeDatos(raw));
  }
  /** La respuesta lleva cifras o una gráfica (fuera de teléfonos de ayuda, códigos CIE, semanas y años). */
  function respuestaConDatos(md) {
    const t = String(md || '');
    if (/<!--[A-Z0-9_]+:\{/.test(t)) return true;
    return /\d/.test(t.replace(/<!--[\s\S]*?-->/g, '').replace(/\]\([^)]*\)/g, ']').replace(/800 911 2000|\b911\b|\b24 (horas|hours)\b|CIE-10|\b[A-Z]\d{2}(\.\d+)?\b|\bW\d{1,2}\b|\b20[12]\d\b/g, ''));
  }
  /**
   * Respuesta de ayuda (crisis, seguimiento de crisis, apoyo fijo o consulta mixta sensible): lleva la Línea de la Vida, no
   * lleva cifras ni marcador de datos y no enlaza a ninguna página. Es lo único que puede emitirse ante un token fuera del
   * vocabulario o una señal de riesgo (auditoría Codex de no modelables).
   */
  function esRespuestaDeAyuda(md) {
    const t = String(md || '');
    return /800 911 2000/.test(t) && !respuestaConDatos(t) && !/\]\([^)]*\)|\.html\b|href=/.test(t);
  }
  // Formas de 1.ª o 2.ª persona (presente, pretérito, imperfecto, futuro y subjuntivo de 2.ª y de 1.ª plural) de los verbos
  // comunes; las de subjuntivo de 1.ª singular que coinciden con la 3.ª («sea», «tenga», «dé») no cuentan, salvo «este».
  const CONJUGACIONES_COMUNES = Object.freeze({
    estar: 'estoy estas estamos estais estuve estuviste estuvimos estabas estabamos estare estaras estaremos estes estemos este',
    ser: 'soy eres somos sois fui fuiste fuimos eras eramos sere seras seremos seas seamos sea',
    tener: 'tengo tienes tenemos teneis tuve tuviste tuvimos tenias teniamos tendre tendras tendremos tengas tengamos tenga',
    poder: 'puedo puedes podemos podeis pude pudiste pudimos podias podiamos podre podras podremos puedas podamos pueda podrias podriamos',
    querer: 'quiero quieres queremos quereis quise quisiste quisimos querias queriamos querre querras querremos quieras queramos quiera quisiera quisieras',
    ir: 'voy vas vamos vais fui fuiste fuimos ibas ibamos ire iras iremos vayas vayamos vaya',
    hacer: 'hago haces hacemos haceis hice hiciste hicimos hacias haciamos hare haras haremos hagas hagamos haga haz',
    saber: 'se sabes sabemos sabeis supe supiste supimos sabias sabiamos sabre sabras sabremos sepas sepamos sepa',
    dar: 'doy das damos dais di diste dimos dabas dabamos dare daras daremos des demos de',
    ver: 'veo ves vemos veis vi viste vimos veias veiamos vere veras veremos veas veamos vea',
    decir: 'digo dices decimos decis dije dijiste dijimos decias deciamos dire diras diremos digas digamos diga di',
  });

  // Primera persona plural por regla general (verificación final de no modelables): todo token normalizado de cinco letras
  // o más que termina en «mos» (-amos, -emos, -imos, -íamos, -ríamos, -remos, -semos…: estamos, estaríamos, tendríamos,
  // vivimos, sentimos) cuenta como primera persona plural. Cuarta verificación: también los pronombres enclíticos de primera
  // persona, todo token de cinco letras o más en «nos», «me», «melo/mela/melos/melas» o «noslo/nosla/noslos/noslas»
  // (ayúdanos, cuídame, dímelo, vámonos, cuidémonos, tranquilicémonos, matarme, ayudarnos). Excepciones (NO_VERBALES_MOS):
  // palabras no verbales o que no son de primera persona con esas terminaciones. Criterio: se revisaron todas las palabras
  // con esas terminaciones del vocabulario cerrado (vocab_consulta.js, vocab_cerrado.js), del corpus RAG, de knowledge.json
  // y de las consultas de prueba; entran sustantivos, adjetivos, términos en inglés y formas de tercera persona («imprime»,
  // «comprime»), más los adjetivos de orden o medida y los indefinidos que una consulta de datos puede usar. Una forma
  // verbal de primera persona nunca entra en esta lista.
  const NO_VERBALES_MOS = new Set([
    // «-mos»
    'mismos', 'ultimos', 'proximos', 'maximos', 'minimos', 'optimos', 'extremos', 'supremos', 'intimos', 'legitimos',
    'organismos', 'mecanismos', 'algoritmos', 'logaritmos', 'ritmos', 'tramos', 'ramos', 'cosmos', 'primos', 'animos',
    'racimos', 'septimos',
    // «-nos»
    'menos', 'buenos', 'algunos', 'ningunos', 'unos', 'cercanos', 'malignos', 'benignos', 'pequenos', 'planos', 'signos',
    'terminos', 'tetanos', 'trastornos', 'transtornos', 'vecinos', 'ninos', 'monos', 'chronos', 'humanos', 'hermanos',
    'sanos', 'ancianos', 'mexicanos', 'internos', 'externos', 'urbanos', 'medianos', 'tempranos', 'plenos',
    'llenos', 'ajenos',
    // «-me»
    'informe', 'enorme', 'uniforme', 'conforme', 'deforme', 'firme', 'derrame', 'sindrome', 'syndrome',
    'imprime', 'comprime', 'regime', 'scheme', 'volume', 'become', 'dataframe', 'datetime', 'frame', 'welcome',
  ]);
  const PLURAL_MOS = (w) => w.length >= 5 && /(mos|nos|me|melo|mela|melos|melas|noslo|nosla|noslos|noslas)$/.test(w) &&
    !NO_VERBALES_MOS.has(w);
  // Primera persona: el turno habla de quien escribe («me quemé», «tengo 15 años», «estamos…», «I…», «we…»).
  const PRIMERA_PERSONA_LEX = /\b(me|mi|mis|yo|conmigo|nos|nosotros|nosotras|nuestro|nuestra|nuestros|nuestras|tengo|tenia|tuve|estoy|estaba|estuve|soy|siento|sentia|quiero|quisiera|puedo|ando|hice|i|im|ive|my|mine|myself|we|our|ours|us|ourselves)\b/;
  const primeraPersona = (raw) => {
    const n = ` ${normLB(raw)} `;
    return PRIMERA_PERSONA_LEX.test(n) || n.split(/[^a-z0-9]+/).some(PLURAL_MOS);
  };
  const BLOQUE_APOYO_ES = 'Si tú o alguien cercano necesita apoyo, la **Línea de la Vida** atiende gratis, las 24 horas, ' +
    'todos los días: **800 911 2000**. Si alguien está en peligro inmediato, llama al **911**.';
  const BLOQUE_APOYO_EN = 'If you or someone near you needs support, **Línea de la Vida** in Mexico is free and open 24 hours a ' +
    'day, every day: **800 911 2000**. If someone is in immediate danger, call **911**.';
  /** Texto de un enlace sin su destino (markdown o HTML): ante vocabulario desconocido no se enlaza ninguna página. */
  const sinEnlaces = (md) => String(md).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  /**
   * Re-auditoría Codex de no modelables: salida ÚNICA ante un turno con al menos un token fuera del vocabulario, en KB y RAG.
   * Nunca sale sin la Línea de la Vida. La respuesta de ayuda (crisis o apoyo) pasa tal cual; si la alternativa lleva cifras
   * o gráfica, está vacía o el turno habla en primera persona, sólo el apoyo fijo; en otro caso se conserva el texto
   * aclaratorio sin enlaces a páginas y se le añade el bloque de apoyo.
   */
  function salidaFueraDeVocabulario(raw, md) {
    const t = String(md ?? '');
    if (esRespuestaDeAyuda(t)) return t;
    const en = pareceIngles(raw);
    if (!t.replace(/<!--[\s\S]*?-->/g, '').trim() || respuestaConDatos(t) || primeraPersona(raw)) {
      return en ? APOYO_EN : APOYO_ES;
    }
    const limpio = sinEnlaces(t).replace(/\n?<!--SIN_GRAFICA-->/g, '').trim();
    return `${limpio}\n\n${en ? BLOQUE_APOYO_EN : BLOQUE_APOYO_ES}\n<!--SIN_GRAFICA-->`;
  }
  const pareceIngles = (raw) => {
    const q = ` ${normLB(raw)} `;
    return /\b(the|what|how|in|of|and|i|my|is|am|are|you|me|to)\b/.test(q) && !/\b(en|de|del|y|la|el|que|los|las|con|una|un|por|para|es|esta|estoy|como|mi|tu|se|lo|siento|hola|tengo|quiero)\b/.test(q);
  };
  /** Apoyo fijo ante un turno fuera del vocabulario cerrado, o null. */
  function respuestaFueraDeVocabulario(raw, { siempre = false } = {}) {
    if (!normLB(raw) && !simbolosNoTecnicos(raw)) return null;
    if (!apoyoSuave(raw)) return null;
    // La guarda posterior (kb.js y rag.mjs) revisa toda respuesta: si lleva cifras o gráfica y el turno está fuera del
    // vocabulario, la sustituye por este mismo apoyo.
    // Antes de responder sólo en las rutas de la interfaz que muestran datos sin pasar por un handler («panorama», «kpis»).
    // El resto lo decide la guarda posterior (kb.js y rag.mjs): sin cifras ni respuesta de datos de un padecimiento.
    if (!siempre && !DATOS_RUTA_INTERFAZ.test(normLB(raw))) return null;
    return pareceIngles(raw) ? APOYO_EN : APOYO_ES;
  }

  /** Todo el turno es vocabulario técnico cerrado (cualquier padecimiento), sin símbolos. */
  // Levantar la crisis o el apoyo exige el vocabulario técnico ESTRICTO (rótulos, alias, códigos, geografía, sexo y
  // palabras neutras de consulta), más estrecho que el global: «hoy», «me» o «gracias» lo mantienen.
  function turnoTecnico(raw) {
    // Levantar la crisis exige el vocabulario neutro estricto: «hoy», «me» o «gracias» la mantienen.
    return !fueraDeVocabulario(raw) &&
      analizaTurno(raw).todos.every((w) => VOCAB_NEUTRO.has(w) || ALCOHOL_PERMITIDO.has(w));
  }

  /** La consulta nombra un id sensible y trae algún token fuera del vocabulario técnico cerrado. */
  function fueraDeListaBlanca(q, contextoSensible = false) {
    if (!contextoSensible && !idsSensiblesEn(q).length) return false;
    if (simbolosNoTecnicos(q)) return true;
    // Con un id sensible, un verbo de deseo o necesidad nunca se lee como consulta neutra («quiero ver X70»): crisis.
    if (/\b(quiero|quisiera|queremos|necesito|necesitamos|deseo|deseamos|gustaria)\b/.test(normLB(q))) return true;
    // Décima auditoría: lo mismo con una petición directa («dame», «can you give me» o un verbo curado sin ancla).
    if (peticionDirecta(q)) return true;
    // Quinta auditoría: los términos de un rótulo sólo cuentan dentro del fragmento completo (analizaTurno).
    // Con un id sensible sólo vale el vocabulario neutro estricto (VOCAB_NEUTRO): ni primera persona ni «quiero».
    return analizaTurno(q).todos.some((w) => !VOCAB_NEUTRO.has(w) && !ALCOHOL_PERMITIDO.has(w));
  }
  // Ingestión explícita en primera persona de cualquier sustancia, modelada o no.
  // Tercera auditoría Codex: cualquier verbo de consumo en primera persona da la crisis, sin exclusiones por objeto
  // («me tomé agua con cianuro»). Falso positivo aceptado y documentado: «me tomé un café», «tomé nota» o «tome en cuenta»
  // (sin tilde, «tomé» y «tome» se normalizan igual) también reciben la respuesta de crisis.
  const INGESTION_PROPIA_ES = /\b(me (bebi|tome|trague|inyecte|meti|zampe|empine|he tomado|he bebido|he tragado|he inyectado|acabo de tomar|acabo de beber|acabo de tragar)|he (tomado|bebido|tragado|ingerido|consumido)|(acabo|acababa) de (tomar|beber|tragar|ingerir|consumir|inyectar)|(estoy|estaba|voy a|sigo) (tomando|bebiendo|tragando|ingiriendo|consumiendo|inyectando|tomar|beber|tragar|ingerir|consumir)|ingeri|trague|bebi|tome|consumi|zampe)\b/;
  const INGESTION_PROPIA_EN = /\bi (drank|swallowed|ingested|injected|took|consumed|just (took|drank|swallowed|ingested)|(have|ve) (taken|drunk|swallowed|ingested|consumed|injected)|(am|m) (taking|drinking|swallowing|ingesting))\b/;
  function ingestionPropia(q) {
    // Rediseño conversacional: «me tomé la presión», «tomé nota» o «me tomé un café» no son ingestión de riesgo.
    const n = normLB(q).replace(/\b(se|no se|que se|le|les) tomen? (las cosas |la cosa |esto |eso )?(en serio|en cuenta)?/g, ' ').replace(/\b(me )?(tome|tomo|tomamos|bebi) (la |el |una |un |mi |unos |unas )?(presion|temperatura|nota|notas|foto|fotos|tiempo|glucosa|azucar|muestra|muestras|medida|medidas|en cuenta|decision|vacuna|vacunas|prueba|pruebas|signos vitales)\b/g, ' ');
    if (INGESTION_PROPIA_ES.test(n)) return 'es';
    return INGESTION_PROPIA_EN.test(n) ? 'en' : null;
  }
  /** Estados nombrados, con su nombre de presentación. */
  function estadosEn(q) {
    const n = ` ${normLB(q)} `;
    const out = [];
    for (const [e, nombre] of ESTADOS) if (n.includes(` ${e} `) && !out.includes(nombre)) out.push(nombre);
    return out.filter((x) => !(x === 'Baja California' && out.includes('Baja California Sur')));
  }
  /**
   * Consulta mixta con un id sensible y sin riesgo: no se combinan cifras. Texto fijo con el aviso y la Línea de la Vida,
   * que respeta el estado pedido (nunca el nacional cuando se pidió un estado), o null.
   */
  // Decimosexta auditoría: resolutor ÚNICO de menciones de padecimientos para las guardas (KB y RAG) y para entities.js.
  // Alias de los cuatro originales: nombres en español e inglés, typos y códigos (con subcódigos, «F32.1», «A97.0»).
  const ALIAS_LEGACY = Object.freeze({
    depresion: 'Depresion', depression: 'Depresion', depre: 'Depresion', deprecion: 'Depresion', depresiva: 'Depresion',
    depresivo: 'Depresion', 'trastorno depresivo': 'Depresion', f32: 'Depresion',
    parkinson: 'Parkinson', parkinsons: 'Parkinson', parquinson: 'Parkinson', parkison: 'Parkinson',
    'enfermedad de parkinson': 'Parkinson', g20: 'Parkinson',
    alzheimer: 'Alzheimer', alzaimer: 'Alzheimer', arzheimer: 'Alzheimer', alzheimers: 'Alzheimer', alzhaimer: 'Alzheimer',
    'enfermedad de alzheimer': 'Alzheimer', demencia: 'Alzheimer', g30: 'Alzheimer',
    dengue: 'Dengue', dengues: 'Dengue', denge: 'Dengue', dengeu: 'Dengue', arbovirosis: 'Dengue', a97: 'Dengue',
  });
  const CODIGO_LEGACY = { f32: 'Depresion', g20: 'Parkinson', g30: 'Alzheimer', a97: 'Dengue', a90: 'Dengue', a91: 'Dengue' };
  /**
   * RESOLUTOR ÚNICO de menciones de padecimientos (decimosexta y decimoséptima auditorías). Toda detección (guardas,
   * crisis, levantamiento, consultas mixtas, entities.js, la función RAG y su vista) delega aquí; ningún otro código
   * compara alias. Devuelve { legacy: [pads], releases: [releases en orden de catálogo], coincidencias: Map(release → alias) }.
   * Opciones: `codigos` (códigos CIE de releases y de los originales, enteros, con subcódigo con o sin punto o compactos:
   * «X60», «X60.0», «X600»), `parcial` (un código cuenta para todo release que cubre alguno de sus subcódigos; si no, debe
   * cubrirlo entero o exacto), `soloNombres` (sólo alias sin dígitos) y `prefijos` (también los prefijos de typos).
   */
  function padecimientosEnConsulta(qn, { codigos = true, parcial = true, soloNombres = false, prefijos = false } = {}) {
    const canon = canonClinico(normLB(qn));
    const legacy = new Set();
    for (const [al, pad] of Object.entries(ALIAS_LEGACY)) {
      if ((!soloNombres || !/\d/.test(al)) && nombraAlias(canon, al)) legacy.add(pad);
    }
    const coincidencias = new Map();
    for (const r of releases) {
      const als = [...r.alias, ...(prefijos ? (r.prefijos || []) : [])].filter((al) => (!soloNombres || !/\d/.test(al)) && nombraAlias(canon, al));
      if (als.length) coincidencias.set(r, als);
    }
    // Barrido de cobertura (24-nov-2026): un release cuyos alias nombrados quedan todos dentro del alias más largo de otro
    // («accidentes de transporte» dentro de «peatones lesionados en accidentes de transporte») no es un segundo padecimiento.
    for (const [r, als] of [...coincidencias]) {
      const dentro = [...coincidencias].some(([r2, als2]) => r2 !== r && als.every((a) => als2.some((b) => b.length > a.length && ` ${b} `.includes(` ${a} `))));
      if (dentro) coincidencias.delete(r);
    }
    const rel = new Set(coincidencias.keys());
    if (codigos) {
      const conPunto = canonClinico(normalizaEntrada(qn).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
      for (const m of conPunto.matchAll(CODIGO_CIE)) {
        const [, letra, num, dec] = m;
        if (CODIGO_LEGACY[`${letra}${num}`]) { legacy.add(CODIGO_LEGACY[`${letra}${num}`]); continue; }
        const decs = dec != null ? [dec] : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const cubre = (r, x) => intervalosCie(r.cie).some(([lo, hi]) => claveCie(letra, num, x) >= lo && claveCie(letra, num, x) <= hi);
        for (const r of releases) if (r.cie && (parcial ? decs.some((x) => cubre(r, x)) : decs.every((x) => cubre(r, x)))) rel.add(r);
      }
    }
    return { legacy: [...legacy], releases: releases.filter((r) => rel.has(r)), coincidencias };
  }
  /** Releases que nombra la consulta (delegado del resolutor único). */
  const releasesEnConsulta = (qn, op) => padecimientosEnConsulta(qn, op).releases;
  function respuestaMixtaSensible(qn) {
    const sens = idsSensiblesEn(qn);
    if (!sens.length) return null;
    // Un código genérico que abarca varios bloques («K70») pide precisar, también sin cifras (ALIAS_AMBIGUOS).
    if (aliasAmbiguo(qn)) return null;
    const canon = canonClinico(normLB(qn));
    const menciones = padecimientosEnConsulta(qn);
    // Otro release nombrado (por alias o por código), salvo el que sólo aparece como parte del rótulo del sensible.
    const coinc = menciones.coincidencias;
    // Otro release cuya única mención es parte del rótulo del sensible («antiparkinsonianas» no es Parkinson) no cuenta.
    const otros = menciones.releases.filter((r) => !sens.includes(r) &&
      !(coinc.has(r) && sens.some((x) => (coinc.get(x) || []).some((al) => (coinc.get(r) || []).every((b) => al.includes(b))))));
    const legacy = menciones.legacy;
    if (!otros.length && !legacy.length && sens.length < 2) return null;
    const est = estadosEn(qn);
    const lugar = est.length ? ` en ${est.join(' y ')}` : '';
    const ejemplo = `«${sens[0].consultaVisible}${est.length ? ` en ${est[0]}` : ' en Jalisco'}»`;
    return `No combino en una misma respuesta las cifras de ${sens.map((r) => `**${r.etiqueta}**`).join(' y ')} con las de otros ` +
      `padecimientos${lugar}. Si necesitas esos datos, pregúntalos por separado; por ejemplo, ${ejemplo}.\n\n` +
      'Si tú o alguien cercano necesita apoyo, la **Línea de la Vida** atiende gratis, las 24 horas, todos los días: ' +
      '**800 911 2000**. Si alguien está en peligro inmediato, llama al **911**.\n<!--SIN_GRAFICA-->';
  }

  const temaSensible = (q) => nombraReleaseSensible(q) || SENSIBLE_ES.test(q) || SENSIBLE_EN.test(q);
  /** Riesgo personal en la consulta normalizada: idioma de la respuesta («es», «en») o null. */
  function riesgoPersonal(q) {
    const qsDatos = q.replace(CONSULTA_DATOS_ES, ' ');
    if (METODO_PROPIO_ES.test(q) || AUTOLESION_ES.test(q) || INGESTION_ES.test(q) || DOSIS_ES.test(q)) return 'es';
    // Un tema sensible que no es de autolesión (VIH, violencia…) pedido con un fin académico explícito no es intención de daño.
    const academico = academicoNoAutolesion(qsDatos);
    if (!academico && INTENCION_ES.test(qsDatos) && (temaSensible(qsDatos) || METODO_TEMA_ES.test(qsDatos))) return 'es';
    if (MENOR_ES.test(q) && (temaSensible(q) || METODO_TEMA_ES.test(q) || PELIGRO_ES.test(q))) return 'es';
    if (METODO_PROPIO_EN.test(q) || AUTOLESION_EN.test(q) || INGESTION_EN.test(q) || DOSIS_EN.test(q)) return 'en';
    if (INTENCION_EN.test(q) && (temaSensible(q) || METODO_TEMA_EN.test(q))) return 'en';
    if (MENOR_EN.test(q) && (temaSensible(q) || METODO_TEMA_EN.test(q))) return 'en';
    return null;
  }

  // ── Rediseño conversacional (24-nov-2026, mesa redonda) ────────────────────────────────────────────────────────────
  // Al retirar la lista blanca global, las frases de riesgo que sólo ella frenaba pasan a este detector explícito: jergas,
  // inglés coloquial, violencia vivida y escritura disfrazada (leet, letras repetidas, letras separadas).
  const RIESGO_JERGA_ES = /\b(petatear(me|se)?|desvivir(me|se)?|dar(me|le)? cuello|(echar|pegar|dar)(me)? un (tiro|plomazo|balazo)|me voy a echar un tiro|(aventar|tirar|lanzar)(me|se)? (del|de la|desde|por) |me quiero (aventar|tirar|lanzar)|ya vali|ya no (quiero|puedo) (mas|seguir)|mejor muert[oa]s?|estaria mejor muert[oa]|(?<!\b(pronostico|grafica|dato|datos|esto|eso|modelo|numero|bot|chatbot|respuesta|pagina) )(ya )?no le (veo|encuentro) (sentido|caso) (a nada|a la vida|a vivir|a seguir)|(seria|estaria|estarian|seria todo) mejor si (yo )?no (existiera|estuviera|hubiera nacido)(?! (el|la|los|las|ese|esa|este|esta|eso|esto|un|una)\b)|mejor no existir|no quisiera existir|ojala no hubiera nacido|quisiera no despertar|nadie me (extranaria|va a extranar)|(quiero|quisiera|voy a) tomar (veneno|venenos|cloro|raticida|matarratas)|(tomo|tome|tomare|voy a tomar|quiero tomar|me voy a tomar) (\d+|muchas|todas|un frasco de|una caja de) (pastillas|pildoras|tabletas|capsulas|sedantes))\b/;
  const RIESGO_JERGA_EN = /\b(off myself|unalive( myself)?|hopeless|nobody would miss me|no one would miss me|better off dead|end it|want to disappear|kms|kys)\b/;
  const VIOLENCIA_EXTRA_ES = /\b(me (da|dan|daba|daban|dio|dieron) (golpes|de golpes|una golpiza|cachetadas|patadas)|me (hace|hacen|hacia|hacian|hizo|hicieron) dano|me (causa|causan|causo) (asfixia|quemaduras|dano|golpes|heridas|moretones)|(mi|su) ([a-z]+ ){0,2}(me|la|lo|nos|les) (ahoga|ahogan|ahorca|ahorcan|quema|queman|golpea|golpean|pega|pegan|asfixia|asfixian))\b/;
  // Variante sin espacios: «me quiero ma tar», «s u i c i d i o».
  const RIESGO_SIN_ESPACIOS = /(suicid|matarme|quieromatar|quieromorir|voyamatar|voyamorir|ahorcarme|colgarme|envenenarme|desvivir|unalive|killmyself|offmyself)/;
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
  /** Versiones del turno para el detector: leet en palabras mixtas, letras repetidas colapsadas y letras sueltas unidas. */
  function variantesRiesgo(raw) {
    const base = String(raw).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const leet = base.replace(/[a-z0-9@$]+/g, (w) => (/[a-z]/.test(w) && /[0-9@$]/.test(w) ? w.replace(/[013457@$]/g, (c) => LEET[c]) : w));
    const plano = (t) => t.replace(/[^a-z0-9]+/g, ' ').trim();
    const unidas = (t) => ` ${t} `.replace(/(?: [a-z](?= [a-z] ))+ [a-z](?= )/g, (m) => ` ${m.replace(/ /g, '')}`).trim();
    const colapsa = (t) => t.replace(/([a-z])\1+/g, '$1');
    // Deuda del detector: erratas de «suicidio» («suisidio», «suizidio», «sucidio», «suicidio» con «y»).
    // Ronda 4 (Fable): «susidios» no es errata de «suicidio» (la «i» tras «su» es obligatoria salvo en «sucidio» y «suscidio»).
    const errata = (t) => t.replace(/su[iy](?:ss|sc|zc|s|z|c)[iy]d|suc[iy]d|susc[iy]d/g, 'suicid');
    const v1 = plano(leet);
    return [...new Set([v1, unidas(v1), colapsa(v1), colapsa(unidas(v1)), errata(v1), errata(colapsa(unidas(v1)))])];
  }
  function riesgoAmpliado(raw) {
    // Los rótulos técnicos completos («intento de suicidio», «envenenamiento autoinfligido…») no son señal.
    for (const v of variantesRiesgo(sinRotulos(raw))) {
      const n = ` ${v} `;
      if (RIESGO_JERGA_ES.test(n) || VIOLENCIA_EXTRA_ES.test(n)) return 'es';
      if (RIESGO_JERGA_EN.test(n)) return 'en';
      if (RIESGO_SIN_ESPACIOS.test(v.replace(/ /g, ''))) return /\b(i|my|myself|the)\b/.test(n) && !/\b(en|de|me|quiero)\b/.test(n) ? 'en' : 'es';
      // Sólo léxico y frases de riesgo: la lista blanca de sensibles ya se aplicó al texto original (aquí se pierden puntos).
      const r = riesgoPersonal(n) || lexicoRiesgo(v);
      if (r) return r;
      if (CRISIS_ES.test(n) || VIOLENCIA_ES.test(n)) return 'es';
      if (CRISIS_EN.test(n) || VIOLENCIA_EN.test(n)) return 'en';
    }
    return null;
  }
  // Señales débiles: palabras que en un turno de datos no tienen lectura técnica (sustancias, desbordamiento, el puente,
  // la muerte sin «de <padecimiento>», peligro en primera persona) y escritura no latina. No dan la crisis: dan una vez
  // el «no entendí» con la Línea de la Vida, sin cifras y sin estado persistente.
  const SENAL_DEBIL = /\b(sedantes?|pastillas?|pildoras?|tabletas?|capsulas?|frascos?|pastas|chelas|venenos?|pills?|poison|puente|siento|sentia|aguanto|soporto|no puedo|harto|harta|hartos|hartas|vivo sol[oa]|tomo|tomar$|me queme|me quemo|nos quemamos|se quemo|me corte|me lastime|con acido|ingerir|(morir|matar|morirme|matarme)$|alone|lonely|empty|worthless|quemamos|cortamos|cortariamos|saltamos|ingerimos|tomamos|tomariamos|tomabamos|tomaremos|tomemos|tomaramos|tomasemos|bebimos|sufrimos|sufriremos|sufriamos|lloramos|perdimos|quemarnos|cortarnos|lastimarnos|hiriendome|hiriendonos|lastimarme|ayudame|ayudanos|salvame|salvanos|cuidame|protegeme|protegenos|escondamonos|abrazame|olvidame|perdoname|perdonanos|escuchame|entiendeme|acompaname|calmame|tranquilicemonos|calmemonos)\b/;
  const PELIGRO_PROPIO = /\b(riesgo|peligro)\b.*\b(asfixia|ahog\w*|golpes?|dano|muerte|morir|vida|quemadura\w*)\b/;
  const escrituraNoLatina = (raw) => /[^\p{Script=Latin}\P{L}]/u.test(normalizaEntrada(raw));
  /** Turno con una señal débil o en escritura no latina: «no entendí» con la Línea de la Vida, sin cifras. */
  function apoyoInmediato(raw) {
    if (escrituraNoLatina(raw)) return true;
    const sin = sinRotulos(raw).replace(/\s+/g, ' ').trim().replace(/\bcapsulas? (de salud|informativas?|de radio|de video)\b/g, ' ');
    if (primeraPersona(raw) && PELIGRO_PROPIO.test(sin)) return true;
    // Accidente doméstico de un tercero («mi hijo se quemó con un cuete»): lo atiende la respuesta de síntomas, no el apoyo.
    if (/\b(cuete|cohete|polvora|aceite|agua caliente|estufa|plancha|comal|sol|vapor)\b/.test(sin) && !/\b(me queme|me quemo|quemarme|nos quemamos)\b/.test(sin)) return false;
    // Con síntomas («fiebre y tos, ¿qué me tomo?») «tomo» o «tomar» no son señal de ingestión.
    const conSintomas = /\b(fiebre|tos|dolor|gripa|gripe|diarrea|vomito|calentura|ronchas|garganta|cabeza|catarro|resfriado)\b/.test(sin);
    const sinTomar = conSintomas ? sin.replace(/\b(tomo|tomar|me tomo|que me tomo)\b/g, ' ') : sin;
    // Frases hechas sin señal: «no puedo creer», «si no tomo la medicina» (adherencia), «no se tome las cosas en serio».
    // «No, lo siento por eso. Quiero saber del cáncer de mama»: la disculpa junto a un dato no es una señal.
    const sinDisculpa = tieneFragmentoDeDatos(raw) ? sinTomar.replace(/\b(lo )?siento (por eso|por la confusion|mucho|el error)\b|\blo siento\b/g, ' ') : sinTomar;
    const sinFrases = sinDisculpa.replace(/\bme siento (un poco |algo |muy )?(nervios[oa]|preocupad[oa]|asustad[oa]|inquiet[oa]) (con|por) (tantas |las |la |los )?(enfermedad\w*|epidemia\w*|brotes?|contagios?|noticias)\b/g, ' ').replace(/\b(lo )?siento (preguntar|molestar|molestarte|la molestia|interrumpir|la tardanza|no saber)\b/g, ' ').replace(/\bno puedo (creer|entender|encontrar|abrir|descargar|ver la|ver el|ver las|ver los)\b/g, ' ')
      .replace(/\b(si )?no (tomo|tomar|me tomo) (la |el |mi |mis )?(medicina|medicinas|medicamento|medicamentos|tratamiento|insulina)\b/g, ' ');
    return [sinFrases, ...variantesRiesgo(sinFrases)].some((v) => SENAL_DEBIL.test(v.trim()));
  }

  // Una pregunta de datos en tercera persona sobre un tema sensible («¿cuántos casos de violencia intrafamiliar reporta el
  // boletín?») no es una crisis: sólo palabras de datos, sin símbolos, sin primera persona ni petición. Cualquier otra
  // palabra («desde el puente», «dosis letal», «mañana», «navaja», «bebo») mantiene la crisis.
  const DATOS_SENSIBLE = new Set(['cuantos', 'cuantas', 'casos', 'caso', 'hay', 'hubo', 'tienen', 'tiene', 'reporta', 'reportan', 'reporto',
    'boletin', 'datos', 'cifras', 'numero', 'notificados', 'notificaron', 'registrados', 'registra', 'registro', 'se', 'han', 'ha',
    'estado', 'nacional', 'pais', 'este', 'ano', 'semana', 'ultima', 'ultimas', 'mas', 'menos', 'que', 'cual', 'cuales', 'el', 'la',
    'los', 'las', 'de', 'del', 'en', 'por', 'a', 'y', 'o', 'edomex', 'cdmx', 'total', 'tendencia', 'como', 'va', 'van']);
  // Temas sensibles que no son de autolesión (VIH, intoxicación por alcohol, violencia, heridas por arma de fuego): con un fin
  // académico o de trabajo explícito («para un seminario», «para el informe») tampoco son una crisis.
  const SENSIBLES_NO_AUTOLESION = new Set(['vih_b20', 'intox_alcohol_f100', 'violencia_intrafamiliar_y07', 'herida_arma_fuego_w32']);
  function academicoNoAutolesion(raw) {
    const qn = ` ${normLB(raw)} `;
    const ids = idsSensiblesEn(qn);
    return ids.length > 0 && ids.every((r) => SENSIBLES_NO_AUTOLESION.has(r.id)) && FIN_ACADEMICO.test(qn) &&
      !SENSIBLE_ES.test(qn) && !METODO_TEMA_ES.test(qn) && !lexicoRiesgo(raw);
  }
  const FIN_ACADEMICO = /\b(seminario|tarea|clase|escuela|investigacion|tesis|informe|reporte|exposicion|presentacion|trabajo|nota|articulo|curso)\b/;
  function preguntaDeDatosSensible(raw) {
    const qn = ` ${normLB(raw)} `;
    const ids = idsSensiblesEn(qn);
    if (!simbolosNoTecnicos(raw) && academicoNoAutolesion(raw)) return true;
    if (simbolosNoTecnicos(raw) || primeraPersona(raw) || peticionPersonal(raw)) return false;
    return analizaTurno(raw).todos.every((w) => VOCAB_NEUTRO.has(w) || DATOS_SENSIBLE.has(w) || ALCOHOL_PERMITIDO.has(w));
  }
  const sensibleFuera = (raw, q) => Boolean((idsSensiblesEn(q).length && simbolosNoTecnicos(raw)) || fueraDeListaBlanca(raw));
  /** Tema sensible preguntado en tercera persona con palabras fuera del vocabulario neutro: texto neutral, sin cifras. */
  function respuestaTemaSensible(raw) {
    const q = ` ${String(raw).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
    if (!sensibleFuera(raw, q) || !preguntaDeDatosSensible(raw) || respuestaCrisis(raw)) return null;
    const r = idsSensiblesEn(q)[0];
    const ejemplo = r ? `«${r.consultaVisible || r.consulta} en Jalisco»` : '«X60 en Jalisco»';
    return 'Este es un tema sensible: sólo muestro sus cifras cuando la pregunta nombra el padecimiento y el estado, sin nada más; ' +
      `por ejemplo, ${ejemplo}.\n\n` +
      'Si tú o alguien cercano necesita apoyo, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**. ' +
      'Si alguien está en peligro inmediato, llama al **911**.\n<!--SIN_GRAFICA-->';
  }
  /** Texto fijo ante una señal de riesgo personal, o null. No pasa por ningún modelo. */
  function respuestaCrisis(qn, previos = []) {
    const r = respuestaCrisisBase(qn);
    if (r !== CRISIS_TEXTO_ES && r !== CRISIS_TEXTO_EN) return r;
    const idioma = soloTemaEnTercera(String(qn));
    if (!idioma) return r;
    // Cuarta ronda (Fable): la variante neutra sólo en una conversación de turnos técnicos. Una revelación, una señal o un
    // turno que no se entendió antes del tema conservan la crisis completa.
    if (!previosNeutros(previos)) return idioma === 'en' ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES;
    return idioma === 'en' ? CRISIS_TERCERA_EN : CRISIS_TERCERA_ES;
  }
  /** Texto de crisis completo en el idioma de una respuesta de crisis (para no rebajar una crisis personal activa). */
  const crisisTextoDe = (en) => (en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES);
  const esCrisisCompleta = (t) => t === CRISIS_TEXTO_ES || t === CRISIS_TEXTO_EN;
  const crisisPersonalDe = (t) => (t === CRISIS_TERCERA_EN || t === CRISIS_TEXTO_EN ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES);
  // Decisión 1, tras la auditoría ciega (Codex y Fable, NO_APTO con lista negra): LISTA BLANCA. La variante neutra sólo
  // aplica si, quitado el nombre del tema, TODO lo que queda es vocabulario de datos o de lugar (sin peticiones ni verbos),
  // hay al menos un ancla de datos, de lugar o de año, no hay símbolos ni emojis y la detección completa tampoco da crisis con
  // el tema sustituido. La palabra sola y cualquier otra palabra («hoy», «con gas», «de un compañero», «15 años», «vivo»)
  // conservan la crisis completa.
  // Tercera ronda (Codex Sol y Fable, NO_APTO con la lista por palabras sueltas: «de Luis», «hubo suicidio en Jalisco»,
  // «número de suicidio», «-_-»): GRAMÁTICA ESTRICTA. La variante neutra sólo para [petición de datos] + tema + lugar
  // completo (estado, México, el país, nacional) + [sexo] + [año], sin más palabras y sin signos fuera de «¿?.,».
  const LUGAR_T = '(' + ESTADOS.map(([e]) => e).join('|') + '|mexico|el pais|la republica( mexicana)?|todo el pais|todo mexico)';
  const TEMA_T = '(el |la |los |las )?(suicidios?|intentos? de suicidio|ideacion suicida|lesiones autoinfligidas|autolesion(es)?)';
  const TEMA_T_EN = '(the )?(suicides?|suicide attempts?|suicidal ideation|self harm)';
  const SEXO_T = '( (en|entre) (hombres|mujeres))?';
  // El año: hasta el actual (un año futuro con el tema puede ser una fecha, no un dato).
  const ANIO_ACTUAL = new Date().getFullYear();
  const ANIOS_T = '(19\\d\\d|' + Array.from({ length: ANIO_ACTUAL - 1999 }, (_, i) => String(2000 + i)).join('|') + ')';
  const ANIO_T = '( (en|durante) (el )?(ano )?' + ANIOS_T + ')?';
  // «hay» sólo tras «cuántos»/«cuántas» («cuántos suicidios hay en Jalisco»); «suicidio hubo en Jalisco» no es consulta.
  const RE_TERCERA_ES = new RegExp('^((cuantos |cuantas )(casos de |numero de casos de )?' + TEMA_T + '( hay)?|' +
    '(casos de |numero de casos de |tasa de |incidencia de |datos de |cifras de |pronostico de |tendencia de )?' + TEMA_T + ')' + SEXO_T + '( en (el estado de )?' + LUGAR_T + '| nacional| a nivel nacional)' +
    SEXO_T + ANIO_T + '$');
  const RE_TERCERA_EN = new RegExp('^(how many )?(cases of |the rate of |data on )?' + TEMA_T_EN + '( rates?| cases)?' +
    '( (among|in) (men|women))?( (in|across) ' + LUGAR_T + '| in the country| nationwide| nationally)( (among|in) (men|women))?' +
    '( in ' + ANIOS_T + ')?$');
  // Signos permitidos en una consulta neutra; cualquier otro (emoticonos, «...», «!!», «-_-», emojis) conserva la crisis.
  const SOLO_TEXTO = (raw) => /^[\p{L}\p{M}\d\s¿?.,]*$/u.test(raw) && !/[.?,¿]{2,}|suicid[oó]\p{M}|suicidió|suicidó/u.test(raw) &&
    !/[^\s]\.[^\s]|(^|\s)[.,]/u.test(raw.trim().replace(/[.?]$/, ''));
  // Deuda a′ del PR #163: en la gramática estricta, toda palabra con tilde o diéresis debe ser una forma bien escrita del
  // vocabulario de la plantilla («cuántos», «ideación», «Querétaro»). Una tilde fuera de lugar («suicidío», «mujéres»)
  // deja el turno fuera de la gramática y conserva la crisis completa.
  const ACENTUADAS_T = new Set(['cuántos', 'cuántas', 'número', 'pronóstico', 'ideación', 'autolesión', 'méxico', 'república', 'país',
    'qué', 'año', ...ESTADOS.flatMap(([, n]) => n.toLowerCase().split(' '))].filter((w) => /[áéíóúü]/.test(w)));
  const acentosEnSuSitio = (crudo) => String(crudo).normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}]+/u)
    .every((w) => !/[\p{M}áéíóúüàèìòùâêîôûäëïö]/u.test(w) || ACENTUADAS_T.has(w));
  const normTercera = (raw) => String(raw).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  // Décima ronda: una sola oración, sin coma («Autolesión. En Jalisco», «suicidio, en Jalisco» son el tema solo y un lugar).
  const unaOracion = (crudo) => !/[\r\n\t\u2028\u2029\u0085\v\f]/.test(crudo) && !/[.,;!?¿¡]/.test(crudo.trim().replace(/^¿/, '').replace(/[.?]$/, ''));
  function soloTemaEnTercera(raw) {
    const crudo = String(raw).normalize('NFKC').toLowerCase();
    if (!SOLO_TEXTO(crudo) || !unaOracion(crudo) || simbolosNoTecnicos(raw) || EMOJI_RIESGO.test(raw) || !acentosEnSuSitio(crudo)) return false;
    // Duodécima ronda (Fable): «él» e «intentó» con tilde son pronombre y verbo, no artículo ni sustantivo.
    if (/(^|[^\p{L}])(él|intentó)($|[^\p{L}])/u.test(crudo)) return false;
    const q = normTercera(raw);
    const idioma = RE_TERCERA_ES.test(q) ? 'es' : RE_TERCERA_EN.test(q) ? 'en' : null;
    if (!idioma || (q.match(/\b(hombres|mujeres|men|women)\b/g) || []).length > 1) return false;
    return respuestaCrisisBase(q.replace(new RegExp(TEMA_T), 'casos').replace(new RegExp(TEMA_T_EN), 'cases')) ? false : idioma;
  }
  // Un turno previo que permite la variante neutra: el tema en la gramática estricta, su seguimiento técnico, cortesía o
  // saludo, o una consulta técnica sin primera persona, sin revelación y sin señal.
  const SALUDO = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hi|hello|hey)$/;
  const PRIMERA_RE = /\b(yo|me|mi|mis|conmigo|tengo|estoy|soy|siento|ando|i|im|my|me|myself)\b/;
  // Quinta ronda (Fable): un turno técnico cuenta sólo si nombra un padecimiento, un lugar o un dato («es menor» o «es la
  // última semana» no son consultas).
  const ANCLA_TECNICA = /\b(casos|caso|cuantos|cuantas|tasa|incidencia|pronostico|tendencia|datos|cifras|semanal|boletin|ficha|grafica|cases|forecast|trend|data|dengue|depresion|parkinson|alzheimer)\b/;
  function conAncla(t) {
    const q = normTercera(t);
    return ANCLA_TECNICA.test(q) || ESTADOS.some(([e]) => ` ${q} `.includes(` ${e} `)) || / (mexico|cdmx|nacional|pais) /.test(` ${q} `) ||
      releasesEnConsulta(normLB(t), { prefijos: true }).length > 0;
  }
  // Sexta ronda (Codex Sol y Fable): el turno previo debe ser texto limpio (sin emoji ni emoticono), sin menores, sin «él/el»
  // con verbo, sin «tiene», «es», «último» ni «caso» con artículo, sin id sensible ni intoxicación, y nombrar un padecimiento
  // no sensible. Un saludo o la cortesía cuentan sólo como texto limpio.
  const SENAL_PREVIA = /\b(quemaduras?|alcohol|drogas?|lesion|lesiones|menor|menores|nino|nina|ninos|ninas|adolescente|adolescentes|hijo|hija|bebe|el es|el tiene|el esta|tiene|tienen|es|ultimo|ultima|el caso|un caso|la menor|el menor|intoxicacion|envenenamiento|plaguicidas?|monoxido|arma|armas|heridas?|minor|child|kid|he|she)\b/;
  // Décima ronda (Codex Sol y Fable): PLANTILLA de consulta, no bolsa de palabras. El turno previo es neutro si es un saludo o
  // una cortesía limpios, el tema en su gramática, su seguimiento, o exactamente [petición] + padecimiento + [lugar] + [sexo] +
  // [año], con un padecimiento de capítulo clínico no sensible (sin salud mental F, causas externas S-Y ni síntomas R).
  const RE_PREVIO = new RegExp('^(?:(?:cuantos|cuantas) (?:casos de )?|(?:casos|datos|cifras|pronostico|tendencia|tasa|incidencia|numero de casos) de |' +
    'como (?:va|van) (?:el |la |los |las )?)?(.+?)(?: hay)?(?: en (?:hombres|mujeres))?(?: en (?:el estado de )?' + LUGAR_T + '| nacional| en el pais)?' +
    '(?: en (?:hombres|mujeres))?(?: en (?:el )?(?:ano )?' + ANIOS_T + ')?$');
  const LEGACY_PREVIO = new Set(['dengue', 'parkinson', 'enfermedad de parkinson', 'alzheimer', 'enfermedad de alzheimer']);
  function turnoPrevioNeutro(t) {
    const crudo = String(t).normalize('NFKC').toLowerCase();
    if (!SOLO_TEXTO(crudo) || EMOJI_RIESGO.test(t) || simbolosNoTecnicos(t)) return false;
    if (/(^|[^\p{L}])él($|[^\p{L}])/u.test(crudo)) return false;
    if (soloTemaEnTercera(t)) return 'consulta';
    if (sigueTercera(t)) return 'fragmento';
    if (!unaOracion(crudo)) return false;
    const q = normTercera(t);
    if (SALUDO.test(q)) return 'saludo';
    if (/^(gracias|muchas gracias|thanks|thank you|ok|okay|vale|entendido|de acuerdo|perfecto)$/.test(q)) return 'fragmento';
    if (idsSensiblesEn(t).length || nombraReleaseSensible(normLB(t)) || saludMentalPropia(t) || respuestaCrisisBase(t)) return false;
    const m = q.match(RE_PREVIO);
    if (!m) return false;
    const p = m[1].replace(/^(el|la|los|las) /, '').trim();
    // Duodécima ronda (Codex Sol): sin petición de datos ni lugar, sexo o año, un nombre suelto no basta («Hansen», «Asthmatic»
    // pueden nombrar o describir a una persona); una intoxicación, picadura o mordedura puede ser una exposición propia.
    // Decimocuarta ronda (Codex Sol): «hay» no cuenta; hace falta una petición de datos o un lugar, sexo o año («Dengue hay»).
    const conPeticion = /^(cuantos|cuantas|casos de|datos de|cifras de|pronostico de|tendencia de|tasa de|incidencia de|numero de casos de|como va|como van) /.test(q);
    const conFiltro = new RegExp(' en (el estado de )?' + LUGAR_T + '( |$)| nacional$| en el pais| en (hombres|mujeres)| ' + ANIOS_T + '$').test(q);
    if (!conPeticion && !conFiltro) return false;
    if (/\b(intoxicacion|intoxicaciones|envenenamiento|poisoning|picadura|picaduras|mordedura|mordeduras)\b/.test(p)) return false;
    if (LEGACY_PREVIO.has(p)) return 'consulta';
    // Undécima ronda (Fable): alias que también son estado de ánimo o persona («ira», «obeso», «la asmática») no bastan.
    if (ALIAS_AMBIGUO_PREVIO.test(p)) return false;
    const canon = canonClinico(normLB(p)).trim();
    // Decimotercera ronda (Codex Sol): la exclusión de intoxicaciones, picaduras y mordeduras vale también por código («A05»).
    return releasesEnConsulta(normLB(p), { prefijos: true }).some((r) => !r.sensible && /^[A-EG-Q]/i.test(String(r.cie || '')) &&
      !/^A05/i.test(String(r.cie || '')) && !/intoxicacion|picadura|mordedura|alacran/.test(r.id) &&
      r.alias.map((al) => al.trim()).includes(canon)) ? 'consulta' : false;
  }
  const ALIAS_AMBIGUO_PREVIO = /^(ira|iras|obes[oa]s?|obese|hipertens[oa]s?|hypertensive|asmatic[oa]s?|asthmatic|diabetic[oa]s?|diabetic|epileptic[oa]s?|epileptic|cardiac[oa]s?|hansen)$/;
  // Undécima ronda (Codex Sol y Fable): un fragmento («para Guerrero», «el año pasado», «hombres») o una cortesía sólo cuentan
  // como neutros si antes hubo una consulta de plantilla o el tema; un saludo cuenta solo.
  function previosNeutros(previos) {
    let consulta = false;
    for (const t of previos || []) {
      const k = turnoPrevioNeutro(t);
      if (!k || (k === 'fragmento' && !consulta)) return false;
      if (k === 'consulta') consulta = true;
    }
    return true;
  }
  const DATOS_PREVIO = new Set(('en de del la el los las y e a al por para casos cuantos cuantas numero total tasa incidencia pronostico ' +
    'pronosticos tendencia datos cifras semana semanas semanal semanales hay hubo como va van esta estan grafica ficha boletin ano anos ' +
    'pasado actual cual que hombres mujeres general nacional pais mexico republica region regional estado sexo mas menos sube baja ' +
    'cases forecast trend data in of the how many men women country national state week weeks year').split(' '));
  // Tras la variante neutra, el seguimiento neutro sólo para un turno técnico de la misma gramática (otro lugar, sexo o año);
  // la cortesía recibe el seguimiento personal; CUALQUIER otro turno («con pastillas», «de un compañero», «I do not feel
  // safe», «esta noche») es una señal y recibe la crisis completa, que sube el estado a 'crisis'.
  // Deuda a′ del PR #163: un año suelto («2008», «1999») puede ser una fecha de nacimiento o una edad, no un filtro: sólo
  // cuenta con «en» o «in» delante (como antes); solo, recibe la crisis completa. Ronda 1 de la auditoría (Codex Sol y
  // Fable): «durante 2020» o «en el año 2020» no se añaden.
  const RE_SIGUE_TERCERA = new RegExp('^(y |and |what about |y que tal )?(((en|in|entre|among) )?' +
    '(' + LUGAR_T.slice(1, -1) + '|hombres|mujeres|men|women|nacional|el ano pasado|last year)' +
    '( (en|in) ' + ANIOS_T + ')?|(en|in) ' + ANIOS_T + ')$');
  const ACEPTA_OFERTA = new RegExp('^(si|claro|si por favor|yes|sure|yes please)( (en|in) (el estado de )?' +
    LUGAR_T + ')?$');
  const RE_CORTESIA = /^(ok|okay|vale|va|no|no gracias|no thanks|no thank you|mejor no|gracias|muchas gracias|thanks|thank you|entendido|de acuerdo|bien|listo|perfecto|entiendo|ya veo)$/;
  // Decimotercera ronda: el seguimiento y la cortesía rechazan «él» con tilde, emojis y letras de otro alfabeto.
  const textoLimpio = (raw) => { const c = String(raw).normalize('NFKC').toLowerCase();
    return !/(^|[^\p{L}])él($|[^\p{L}])/u.test(c) && !simbolosNoTecnicos(raw) && !EMOJI_RIESGO.test(raw) && /^[a-záéíóúüñ0-9\s¿?.,]*$/.test(c); };
  const sigueTercera = (raw) => textoLimpio(raw) && SOLO_TEXTO(String(raw).normalize('NFKC').toLowerCase()) && acentosEnSuSitio(raw) &&
    unaOracion(String(raw).normalize('NFKC').toLowerCase()) && RE_SIGUE_TERCERA.test(normTercera(raw));
  const cortesia = (raw) => textoLimpio(raw) && SOLO_TEXTO(String(raw).normalize('NFKC').toLowerCase()) && RE_CORTESIA.test(normTercera(raw));
  function respuestaCrisisBase(qn) {
    const r = respuestaCrisisTexto(String(qn));
    if (r) return r;
    const amp = riesgoAmpliado(String(qn));
    if (amp) return amp === 'en' ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES;
    // Decimotercera auditoría: el estado de crisis del turno es el OR de todas sus cláusulas.
    const partes = clausulasSignos(String(qn));
    if (partes.length < 2) return null;
    for (const p of partes) { const rc = respuestaCrisisTexto(p.join(' ')); if (rc) return rc; }
    return null;
  }
  function respuestaCrisisTexto(qn) {
    const raw = String(qn);
    const q = ` ${raw.normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const idioma = () => (/\b(the|what|how|in|of|and|i|my)\b/.test(q) && !/\b(en|de|del|y|la|el)\b/.test(q) ? 'en' : 'es');
    const riesgo = riesgoPersonal(q) || ingestionPropia(q) || lexicoRiesgo(raw) || (peticionDeDano(raw) ? idioma() : null) ||
      (EMOJI_RIESGO.test(raw) ? idioma() : null) ||
      // Rediseño conversacional: un tema sensible fuera del vocabulario neutro da la crisis sólo si el turno habla en primera
      // persona o pide algo; si no, respuestaTemaSensible da un texto neutral, sin cifras y sin estado persistente.
      (sensibleFuera(raw, q) && !preguntaDeDatosSensible(raw) ? idioma() : null);
    if (riesgo === 'es') return CRISIS_TEXTO_ES;
    if (riesgo === 'en') return CRISIS_TEXTO_EN;
    if (CRISIS_ES.test(q) || VIOLENCIA_ES.test(q) || RIESGO_TERCERO_ES.test(q)) return CRISIS_TEXTO_ES;
    if (CRISIS_EN.test(q) || VIOLENCIA_EN.test(q) || RIESGO_TERCERO_EN.test(q)) return CRISIS_TEXTO_EN;
    if (nombraReleaseSensible(q)) return null;
    if (SENSIBLE_ES.test(q)) return CRISIS_TEXTO_ES;
    return SENSIBLE_EN.test(q) ? CRISIS_TEXTO_EN : null;
  }
  // Decisión 1 del plan canónico (26-nov-2026, delegada por el autor): el tema preguntado en tercera persona («suicidio en
  // México», «ideación suicida en Jalisco») recibe una variante neutra, sin «lo que me contaste» ni «estés pasando por
  // esto», con la misma Línea de la Vida, el 911 y sin cifras. La detección no cambia (ver soloTemaEnTercera).
  const CRISIS_TERCERA_ES = 'Es un tema delicado: sobre él no muestro cifras ni gráficas en esta conversación.\n\n' +
    'Si tú o alguien cercano está en peligro inmediato, llama al **911**.\n\n' +
    'En México, la **Línea de la Vida** atiende gratis, las 24 horas, todos los días: **800 911 2000**. ' +
    'Te contesta un profesional de salud mental.\n\n' +
    'Soy un asistente de datos epidemiológicos y no doy atención. Si el tema te toca de cerca, hablar hoy con ese servicio ' +
    'o con una persona de confianza puede ayudar.\n<!--SIN_GRAFICA-->';
  const CRISIS_TERCERA_EN = 'This is a sensitive topic: I do not show figures or charts about it in this conversation.\n\n' +
    'If you or someone near you is in immediate danger, call **911**.\n\n' +
    'In Mexico, **Línea de la Vida** is free and open 24 hours a day, every day: **800 911 2000**. ' +
    'A mental health professional answers.\n\n' +
    'I am an epidemiological data assistant and cannot provide care. If this topic is close to you, calling that service ' +
    'or talking to someone you trust today can help.\n<!--SIN_GRAFICA-->';
  /** La respuesta de crisis es la variante neutra de tercera persona (decisión 1). */
  const esCrisisTercera = (t) => t === CRISIS_TERCERA_ES || t === CRISIS_TERCERA_EN;

  // Auditoría Codex de alta_b44 (19-nov-2026): la crisis persiste en la conversación. «X60 en Jalisco» → «me quiero
  // morir» → «¿y en Sonora?» devolvía cifras (4,203 casos legacy en el KB; X60 de Sonora en la función RAG). Tras una
  // respuesta de crisis, todo turno que no nombre por sí mismo un padecimiento no sensible recibe apoyo, sin cifras,
  // sin gráfica y sin heredar padecimiento ni estado.
  const CRISIS_SEGUIMIENTO_ES = 'Sigo aquí contigo. Por lo que me contaste, en esta conversación no voy a mostrar cifras ni gráficas.\n\n' +
    'Si tú o alguien cercano está en peligro inmediato, llama al **911**.\n\n' +
    'En México, la **Línea de la Vida** atiende gratis, las 24 horas, todos los días: **800 911 2000**. ' +
    'Te contesta un profesional de salud mental.\n\n' +
    'Hablar hoy con ese servicio o con una persona de confianza puede ayudar.\n<!--SIN_GRAFICA-->';
  const CRISIS_SEGUIMIENTO_EN = 'I am still here. Because of what you told me, I will not show figures or charts in this conversation.\n\n' +
    'If you or someone near you is in immediate danger, call **911**.\n\n' +
    'In Mexico, **Línea de la Vida** is free and open 24 hours a day, every day: **800 911 2000**. ' +
    'A mental health professional answers.\n\n' +
    'Calling that service or talking to someone you trust today can help.\n<!--SIN_GRAFICA-->';
  // Decisión 1: seguimiento tras la variante neutra, sin «lo que me contaste»; el mismo bloqueo de cifras y gráficas.
  const CRISIS_SEGUIMIENTO_TERCERA_ES = 'Por el tema que tocamos, en esta conversación no voy a mostrar cifras ni gráficas.\n\n' +
    'Si tú o alguien cercano está en peligro inmediato, llama al **911**.\n\n' +
    'En México, la **Línea de la Vida** atiende gratis, las 24 horas, todos los días: **800 911 2000**. ' +
    'Te contesta un profesional de salud mental.\n<!--SIN_GRAFICA-->';
  const CRISIS_SEGUIMIENTO_TERCERA_EN = 'Because of the topic we touched on, I will not show figures or charts in this conversation.\n\n' +
    'If you or someone near you is in immediate danger, call **911**.\n\n' +
    'In Mexico, **Línea de la Vida** is free and open 24 hours a day, every day: **800 911 2000**. ' +
    'A mental health professional answers.\n<!--SIN_GRAFICA-->';
  const TURNO_EN = /^\s*(and|what|how|in|for|about|men|women|last|next|show)\b/;
  // Deuda a′ del PR #163: un lugar, un año o un «no» aislados no tienen idioma; el seguimiento usa el del turno anterior más
  // reciente que lo tenga (la crisis o la variante que lo abrió).
  const SIN_IDIOMA = new RegExp('^(' + LUGAR_T.slice(1, -1) + '|nacional|cdmx|' + ANIOS_T + '|\\d+|no|ok|okay)$');
  const MARCAS_EN = /\b(i|im|ive|my|myself|the|is|are|am|have|has|and|in|of|what|how|about|men|women|not|safe|tonight|today|want|die|kill|help|please|thanks|suicide|suicidal|self|harm|depressed|depression|anxiety|cases|last|year|she|he|they|you|scared|alone|feel)\b/g;
  const MARCAS_ES = /\b(yo|mi|mis|el|la|los|las|en|de|del|y|que|tengo|estoy|quiero|esta|estas|noche|hoy|ayuda|por|con|para|hombres|mujeres|suicidio|suicidarme|morir|casos|ano|pasado|ella|el|ellos|siento|solo|sola|miedo|gracias)\b/g;
  /** Idioma de un turno por sus palabras exclusivas de cada lengua, o null si no tiene ninguna (lugar, año, «no»). */
  function idiomaDeTurno(t) {
    const q = normTercera(t);
    if (!q || SIN_IDIOMA.test(q)) return null;
    const en = (q.match(MARCAS_EN) || []).length, es = (q.match(MARCAS_ES) || []).length;
    return en > es ? 'en' : es > en ? 'es' : null;
  }
  /** Idioma del seguimiento: el del turno si lo tiene; si es un lugar, año o cortesía aislados, el del turno previo. */
  function idiomaSeguimiento(qn, previos, enTurno) {
    // Ronda 1 (Fable): «no thanks» es inglés aunque empiece por «no».
    // Ronda 4 (Fable): una cortesía («thanks», «no thanks») toma el idioma de la conversación; sin él, el suyo.
    if (cortesia(qn)) {
      for (const t of [...(previos || [])].reverse()) { const i = idiomaDeTurno(t); if (i) return i === 'en'; }
      return idiomaDeTurno(qn) ? idiomaDeTurno(qn) === 'en' : enTurno;
    }
    if (!SIN_IDIOMA.test(normTercera(qn))) return enTurno;
    for (const t of [...(previos || [])].reverse()) { const i = idiomaDeTurno(t); if (i) return i === 'en'; }
    return enTurno;
  }
  /**
   * Estado de crisis tras una secuencia de turnos del usuario (del más antiguo al más reciente). Una señal de riesgo lo
   * activa; sólo lo desactiva un turno que nombra por sí mismo un padecimiento no sensible (`nombraPadLimpio`).
   */
  function crisisEnTurnos(turnos, nombraPadLimpio) { return recorreTurnos(turnos, nombraPadLimpio).estado; }
  /** Ronda 5 (Codex Sol): ¿hubo una crisis personal en algún turno, venga del detector, de la revelación o del seguimiento? */
  // Ronda 6 (Fable): memoria acotada del recorrido, que el KB y RAG piden varias veces por turno con el mismo historial.
  // Una memoria por función de padecimiento: el KB y la función RAG usan detectores distintos.
  const MEMOS_HUBO = new WeakMap();
  // Se reanuda desde el prefijo ya recorrido (un turno nuevo cuesta un paso, no todo el historial).
  function huboCrisisEnTurnos(turnos, nombraPadLimpio) {
    if (!MEMOS_HUBO.has(nombraPadLimpio)) MEMOS_HUBO.set(nombraPadLimpio, new Map());
    const MEMO_HUBO = MEMOS_HUBO.get(nombraPadLimpio);
    const clave = (n) => JSON.stringify(turnos.slice(0, n));
    if (MEMO_HUBO.has(clave(turnos.length))) return MEMO_HUBO.get(clave(turnos.length)).hubo;
    // Ronda 7 (Fable): se vacía ANTES de elegir el prefijo, para no reanudar desde un estado que ya no está.
    if (MEMO_HUBO.size > 400) MEMO_HUBO.clear();
    let desde = turnos.length - 1;
    while (desde > 0 && !MEMO_HUBO.has(clave(desde))) desde--;
    // Cada prefijo recorrido queda en la memoria, así el turno siguiente sólo da un paso.
    const v = recorreTurnos(turnos, nombraPadLimpio, desde, desde ? MEMO_HUBO.get(clave(desde)) : null,
      (n, e) => MEMO_HUBO.set(clave(n), e));
    return v.hubo;
  }
  function recorreTurnos(turnos, nombraPadLimpio, desde = 0, inicio = null, anota = null) {
    // Estado: 'crisis' (señal de riesgo), 'apoyo' (turno fuera del vocabulario cerrado) o null.
    let estado = inicio ? inicio.estado : null;
    let hubo = inicio ? inicio.hubo : false;
    const previos = turnos.slice(0, desde);
    for (const t of turnos.slice(desde)) {
      const sm = saludMentalPropia(t);
      // Séptima ronda: tras un id sensible, una revelación de salud mental es crisis, igual que en el KB.
      const sensiblePrevio = (sm?.apoyo || sm?.prefijo) && previos.some((x) => idsSensiblesEn(x).length || nombraReleaseSensible(normLB(x)));
      const rc = respuestaCrisis(t, previos) || sm?.crisis || (sensiblePrevio ? CRISIS_TEXTO_ES : null);
      previos.push(t);
      // Decisión 1: una activación en tercera persona deja 'crisis_tercera'; una personal, 'crisis', que ya no baja.
      if (rc) estado = esCrisisTercera(rc) && estado !== 'crisis' ? 'crisis_tercera' : 'crisis';
      // Rediseño conversacional: un turno que no se entiende ya no deja un estado de apoyo persistente.
      // Cuarta ronda: el apoyo de salud mental deja 'apoyo_sm', que no se levanta; un turno que no es técnico, otra revelación
      // ni la aceptación de la oferta, o que nombra un id sensible, sube a 'crisis'.
      else if (estado === 'apoyo_sm') {
        // El cierre fijo tras una cortesía no sube el estado; sólo la crisis completa.
        if (esCrisisCompleta(respuestaCrisisSeguimiento(t, 'apoyo_sm', nombraPadLimpio, previos.slice(0, -1), hubo) || '')) estado = 'crisis';
      } else if (estado === 'tema_cerrado') {
        // Deuda del detector (b): tras levantar la variante neutra, el tema y los ids sensibles siguen cerrados.
        if (respuestaCrisisSeguimiento(t, 'tema_cerrado', nombraPadLimpio, previos.slice(0, -1), hubo)) estado = 'crisis';
        else if (sm?.apoyo || sm?.prefijo) estado = 'apoyo_sm';
      } else if (!estado && (sm?.apoyo || sm?.prefijo)) estado = 'apoyo_sm';
      // Sexta ronda: levantar una crisis personal deja el apoyo ('apoyo_sm', que cierra ids sensibles). Deuda del detector
      // (b): levantar la neutra deja 'tema_cerrado', que mantiene cerrados el tema y los ids sensibles sin más restricciones.
      else if (estado && levantaCrisis(t, nombraPadLimpio)) estado = estado === 'crisis' ? 'apoyo_sm' : 'tema_cerrado';
      // Tercera ronda: tras la variante neutra, un turno que no es técnico ni cortesía es una señal: sube a 'crisis'.
      else if (estado === 'crisis_tercera' && !sigueTercera(t)) estado = 'crisis';
      if (estado === 'crisis') hubo = true;
      if (anota) anota(previos.length, { estado, hubo });
    }
    return { estado, hubo };
  }
  /** Respuesta de apoyo para un seguimiento tras una crisis, o null si la crisis no sigue activa. */
  /**
   * Re-auditoría Codex: sólo levanta la crisis un turno que nombra EXCLUSIVAMENTE padecimientos no sensibles y no trae
   * riesgo. Cualquier turno que nombre un id de la lista blanca (también junto a otro padecimiento) la mantiene.
   */
  const SALUD_MENTAL_NOMBRE = /\b(f\d{2}(\d)?|depresion|depresiones|ansiedad|anorexia|bulimia|trastornos? (de la conducta )?alimentari[oa]s?|bipolar|esquizofrenia|depression|anxiety|eating disorders?)\b/;
  function levantaCrisis(t, nombraPadLimpio) {
    // Décima auditoría: un turno con una petición al bot nunca levanta la crisis, aunque la petición sea válida.
    // Cuarta ronda (Fable): un padecimiento de salud mental (depresión, ansiedad, anorexia…) no levanta la crisis: suele ser
    // el mismo que la persona acaba de revelar.
    return turnoTecnico(t) && !peticionEn(t) && !idsSensiblesEn(t).length && !nombraReleaseSensible(normLB(t)) && !respuestaCrisis(t) &&
      !SALUD_MENTAL_NOMBRE.test(normTercera(t)) && nombraPadLimpio(t);
  }
  // Deuda del detector (b): tras el apoyo de salud mental, una cortesía o un «no» reciben un cierre fijo (antes llegaban al
  // generador). Sin cifras ni contenido clínico.
  const CIERRE_APOYO_ES = 'Está bien. Aquí sigo si más adelante quieres consultar datos de algún padecimiento.\n\n' +
    'Si lo necesitas, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**. Si estás en peligro, llama al **911**.\n<!--SIN_GRAFICA-->';
  const CIERRE_APOYO_EN = 'All right. I am here if you want to look up data on a condition later.\n\n' +
    'If you need it, **Línea de la Vida** is free and open 24 hours: **800 911 2000**. If you are in danger, call **911**.\n<!--SIN_GRAFICA-->';
  const esCierreApoyo = (t) => t === CIERRE_APOYO_ES || t === CIERRE_APOYO_EN;
  /** Turno que reabre un tema cerrado: el tema, un id sensible o una causa externa que puede ser método (T, X, W32-W34). */
  function reabreSensible(qn) {
    const q = normTercera(qn);
    return idsSensiblesEn(qn).length > 0 || nombraReleaseSensible(normLB(qn)) ||
      // Ronda 2 (Fable): «intoxicación» a secas no reabre («intoxicación alimentaria», «por picadura de alacrán»); lo deciden
      // los códigos.
      /\b(suicid|autolesi|autoinflig|self harm|plaguicida|monoxido)/.test(q) ||
      variantesRiesgo(qn).some((v) => /suicid/.test(v)) ||
      // Ronda 1 (Fable): sólo lo que puede ser método (lesiones autoinfligidas X, armas W32-W34 e intoxicaciones T36-T65 salvo
      // animales venenosos T63); alacrán, calor o quemaduras siguen su curso.
      releasesEnConsulta(normLB(qn), { prefijos: true }).some((r) => /^(X|W3[2-4]|T3[6-9]|T[45]\d|T6[0-25])/i.test(String(r.cie || '')));
  }
  function respuestaCrisisSeguimiento(qn, crisisPrevia, nombraPadLimpio, previos = [], hubo = undefined) {
    if (!crisisPrevia) return null;
    const q = String(qn).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
    const en = idiomaSeguimiento(qn, previos, TURNO_EN.test(q) || pareceIngles(qn) || /\b(not|safe|thanks|thank|please|help|scared|afraid|alone|tonight|pills|friend|feel|want|die)\b/.test(q) && !/\b(que|no|se|mi|tu|ya|es|hago|tengo|estoy)\b/.test(q));
    // Decisión 2, cuarta y quinta ronda: tras el apoyo de salud mental, un id sensible, el tema, una intoxicación que puede ser
    // método, un emoticono, o un seguimiento sin padecimiento propio cuando antes se nombró un id sensible, dan la crisis
    // completa (aunque el turno nombre un padecimiento no sensible); una consulta técnica con ancla, otra revelación, un
    // cierre o la aceptación de la oferta siguen su curso; cualquier otro turno es una señal y recibe la crisis completa.
    if (crisisPrevia === 'apoyo_sm') {
      if (simbolosSM(String(qn)) || simbolosNoTecnicos(qn) || EMOJI_RIESGO.test(qn) || idsSensiblesEn(qn).length ||
          nombraReleaseSensible(normLB(qn)) || /\b(suicid|autolesi|autoinflig|self harm|intoxicacion|envenenamiento|plaguicida|monoxido|poisoning|ahogamiento|ahogad|drowning|ahorcamiento|asfixia)/.test(q) ||
          // Décima ronda: intoxicaciones, quemaduras, efectos de agentes externos (CIE T), lesiones autoinfligidas (X) y armas de
          // fuego (W32-W34), por alias, código o inglés. Una mordedura de perro u otra causa externa no es un método.
          releasesEnConsulta(normLB(qn), { prefijos: true }).some((r) => /^(T|X|W3[2-4])/i.test(String(r.cie || ''))) ||
          ((previos || []).some((t) => idsSensiblesEn(t).length) && !nombraPadLimpio(qn) && !saludMentalPropia(qn))) {
        return en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES;
      }
      if (cortesia(qn)) return en ? CIERRE_APOYO_EN : CIERRE_APOYO_ES;
      // Ronda 4 (Codex Sol): tras una crisis personal en la conversación, otra revelación recibe la crisis completa.
      const smOtra0 = saludMentalPropia(qn);
      // El recorrido ya cuenta la crisis del detector base (deja el estado en 'crisis').
      const crisisPersonalAntes = () => hubo ?? huboCrisisEnTurnos(previos || [], nombraPadLimpio);
      const smOtra = smOtra0 && !crisisPersonalAntes() ? smOtra0 : null;
      // Ronda 2 (Codex Sol): un año solo («en 2008») tras el apoyo puede ser un año de nacimiento: crisis en KB y RAG.
      const anioSolo = /^(y |and )?(en|in) (19|20)\d\d$/.test(normTercera(qn));
      // Ronda 7 (Codex Sol y Fable): la continuación de la oferta pasa la guarda con el mismo criterio con que se resuelve.
      if (ofertaPendiente(qn, previos || [])) return null;
      if ((smOtra && !smOtra.laxa) || SALUDO.test(normTercera(qn)) || ACEPTA_OFERTA.test(normTercera(qn)) || (sigueTercera(qn) && !anioSolo) ||
        (turnoTecnico(qn) && conAncla(qn) && !SENAL_PREVIA.test(normTercera(qn))) ||
        /^(en corto|para nota|para junta|resumen|resumelo|mas corto|y)$/.test(normTercera(qn))) return null;
      return en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES;
    }
    if (crisisPrevia === 'tema_cerrado') {
      return reabreSensible(qn) ? (en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES) : null;
    }
    if (levantaCrisis(qn, nombraPadLimpio)) return null;
    // Decisión 1: el seguimiento neutro sólo para un turno técnico sin primera persona ni petición; cualquier otro
    // («I do not feel safe», «tengo miedo») recibe el seguimiento personal.
    if (crisisPrevia === 'crisis_tercera') {
      if (sigueTercera(qn)) return en ? CRISIS_SEGUIMIENTO_TERCERA_EN : CRISIS_SEGUIMIENTO_TERCERA_ES;
      if (cortesia(qn)) return en ? CRISIS_SEGUIMIENTO_EN : CRISIS_SEGUIMIENTO_ES;
      return en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES;
    }
    if (crisisPrevia !== 'crisis') return null;
    return en ? CRISIS_SEGUIMIENTO_EN : CRISIS_SEGUIMIENTO_ES;
  }

  /**
   * alta_b44 (19-nov-2026): controles sin alternativa (rolling_cv_historia_corta_2024_v1, portafolio igual al control). Con
   * un año de historia el único candidato fue el control estacional: se presentan como control publicado, no validado,
   * nunca como «validación en curso», aunque la etiqueta sellada del shard lo diga. Misma frase en unified.mjs,
   * estado-ficha.js, home-preview.js y obesidad_kb.js.
   */
  const ETIQUETA_SIN_ALTERNATIVA = 'Control estacional publicado: con un año de historia no hubo alternativa que elegir, no validado y sin validación prospectiva propia · pronóstico puntual sin intervalos';
  const uno = (x) => Number(x).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  /** Explicación fija de un control sin alternativa, con el error de su prueba única (del acceptance.json sellado). */
  function textoSinAlternativa(id, sinSexo) {
    const r = releases.find((x) => x.id === id);
    const p = r && r.pruebaSinAlternativa;
    const bases = sinSexo ? 'las series por estado' : 'las series por estado y sexo';
    const error = p
      ? ` Error del control en su prueba única (semanas 1 a ${p.semanas} de ${String(p.fold).replace(/^test_/, '')}, sMAPE): ${uno(p.smape_bases)} en ${bases}, ${uno(p.smape_all)} en el conjunto de las series publicadas y ${uno(p.smape_nacional_general)} en el total nacional.`
      : '';
    return 'Es el control estacional, no validado: cada semana repite los casos de 52 semanas antes. La serie sólo tiene un año de historia ' +
      'antes del pliegue de desarrollo, así que no hubo otro motor que elegir: el único candidato fue el control, y no tiene una ' +
      'validación prospectiva propia; sólo se registra su error con cada boletín, y al reunir cuatro semanas el veredicto técnico ' +
      `será CONTROL_ONLY, nunca una validación superada.${error}`;
  }

  /**
   * Octava auditoría Codex: motivo del rechazo del portafolio en la prueba única, desde las comprobaciones de la vista. Un
   * ámbito con portafolio y control en 0.0 no «empeora»: el cambio relativo frente a un control de cero queda indefinido y
   * la regla lo trata como rechazo, igual que las fichas. Recibe [{ nombre, portafolio, control }] de los ámbitos fallidos
   * y devuelve el texto que sigue a «porque».
   */
  function motivoRechazo(fallas) {
    const f1 = (x) => Number(x).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const cero = (x) => Math.round(Number(x.portafolio) * 10) === 0 && Math.round(Number(x.control) * 10) === 0;
    const y = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0]);
    const empeora = fallas.filter((x) => !cero(x)).map((x) => `${x.nombre} (sMAPE ${f1(x.portafolio)} frente a ${f1(x.control)} del control)`);
    const ceros = fallas.filter(cero).map((x) => x.nombre);
    const indef = ceros.length ? `en ${y(ceros)} portafolio y control dieron sMAPE 0.0: el cambio relativo frente a un control de ` +
      'cero queda indefinido y la regla, fijada antes de abrir la prueba, lo trata como rechazo' : '';
    if (empeora.length && ceros.length) return `empeoraba ${y(empeora)}; además, ${indef}`;
    if (ceros.length) return indef;
    return empeora.length ? `empeoraba ${y(empeora)}` : 'no cumplió el criterio de aceptación';
  }

  // ── Decisión 2 del plan canónico (26-nov-2026, delegada por el autor) ─────────────────────────────────────────────────
  // Quien dice en primera persona que vive con un padecimiento de salud mental («tengo depresión», «sufro de ansiedad»,
  // «estoy deprimido», «I have depression») recibe primero un apoyo breve, con la Línea de la Vida y el 911, sin cifras; las
  // cifras se ofrecen. Tras la auditoría ciega (NO_APTO), LISTA BLANCA y falla hacia la crisis: quitada la frase, si lo que
  // queda es sólo relleno o lugar → apoyo; si es relleno, lugar y una petición explícita de datos → la ficha con una línea de
  // apoyo antes; cualquier otra palabra («y no hay salida», «y tengo un plan», «tengo 14 años») → crisis completa. La crisis
  // del detector conserva su precedencia (se comprueba antes). Texto fijo, sin contenido clínico.
  const CONDICION_MENTAL = '(depresion|depresion posparto|depre|ansiedad|trastorno de ansiedad|ataques? de (panico|ansiedad)|' +
    'crisis de (panico|ansiedad)|trastorno bipolar|bipolaridad|esquizofrenia|anorexia|bulimia|(un )?trastorno (de la conducta )?' +
    'alimentari[oa]|estres postraumatico|trastorno obsesivo compulsivo|depression|anxiety|bipolar disorder|schizophrenia|' +
    '(an )?eating disorder|ptsd)';
  // Cuarta ronda (Codex Sol y Fable): más verbos de revelación y modificadores; los intermedios son sólo artículos y
  // modificadores, nunca palabras libres (una palabra libre entre el verbo y la condición podría ser una señal).
  const MENTAL_PROPIA = new RegExp('\\b(tengo|traigo|padezco|sufro|vivo con|me (diagnosticaron|detectaron|dijeron que tengo|dio|da|pego)|' +
    'fui diagnosticad[oa]|estoy diagnosticad[oa]|estoy en tratamiento|estoy pasando por|paso por|llevo (anos|meses|tiempo|mucho tiempo) con|' +
    'cai en|he tenido|mi|i have|i ve got|ive got|i have had|i ve had|ive had|i had|i suffer from|i was diagnosed with|' +
    'i ve been diagnosed with|ive been diagnosed with|i have been diagnosed with|i am struggling with|i m struggling with|im struggling with|' +
    'struggling with|i live with|my)( una| un| la| el| de| con| por| para| mucha| mucho| algo de| problemas de| problems with| fuerte| severa|' +
    ' grave| clinica| cronica| mayor| profunda| clinical| severe| major| chronic| deep| bad| terrible| a| an| some)* ' +
    CONDICION_MENTAL + '\\b', 'g');
  const ANIMO_PROPIO = /\b(estoy|me siento|ando|me he sentido|he estado|soy|i am|i m|im|i feel|i ve been|ive been|i have been)( muy| algo| un poco| tan| bien| super| bastante| demasiado| so| very| really| quite| pretty| extremely| clinically| too)* (deprimid[oa]|depresiv[oa]|depre|ansios[oa]|con ansiedad|con depresion|angustiad[oa]|depressed|anxious)\b/g;
  // La negación sólo cuenta pegada a la frase («no tengo depresión»); «tengo depresión y no estoy a salvo» no es negación.
  const NEGADA_SM = new RegExp('\\b((no|not|dont|don t|do not|never) (tengo|padezco|sufro( de)?|vivo con|me diagnosticaron( con)?|estoy|me siento|ando|have)|' +
    '(am|m) not)( una| un| la| el| muy| so| very| really)? (' + CONDICION_MENTAL.slice(1, -1) + '|deprimid[oa]|depre|ansios[oa]|depressed|anxious)\\b');
  const RELLENO_SM = new Set(('y e un una muy la los las de del con afirmo i ' +
    'leve moderada severa cronica tratamiento en hola buenas buenos dias tardes noches oye pues bueno gracias tambien ' +
    'soy de estado ciudad mexico pais republica and a an the hi hello so very really also in from ' +
    'depresion ansiedad bipolar bipolaridad esquizofrenia anorexia bulimia trastorno alimentario alimentaria panico ' +
    'depression anxiety schizophrenia eating disorder').split(' '));
  const DATOS_SM = new Set(('cuantos cuantas casos como va van anda esta pronostico tendencia cifras datos estadisticas ' +
    'hay sube baja que en el la how many cases forecast trend data is are what ' +
    'enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre ' +
    'january february march april may june july august september october november december').split(' '));
  const PIDE_DATOS_SM = /\b(cuantos|cuantas|casos|pronostico|tendencia|cifras|datos|estadisticas|numero|como (va|van|anda|esta)|how many|cases|forecast|trend|data)\b/;
  const OFERTA_SM = [
    { re: /\b(depresion|deprimid[oa]|depre|depression|depressed)\b/, es: 'depresión', en: 'depression', t: 'Depresión', q: '¿cómo va la depresión?', pad: 'Depresion' },
    { re: /\b(anorexia|bulimia|alimentari[oa]|eating disorder)\b/, es: 'anorexia, bulimia y otros trastornos alimentarios',
      en: 'anorexia, bulimia and other eating disorders', t: 'Trastornos alimentarios', q: '¿cómo va la anorexia?', pad: 'Anorexia F50' },
  ];
  const PREFIJO_SM = '_Gracias por contármelo. Si lo necesitas, la Línea de la Vida atiende gratis, las 24 horas: 800 911 2000._\n\n';
  const PREFIJO_SM_EN = '_Thank you for telling me. If you need it, Línea de la Vida is free and open 24 hours: 800 911 2000._\n\n';
  // Una duración sólo es relleno con su unidad («hace 3 años», «desde hace poco tiempo»); «hace 14» a secas no.
  const DURACION_SM = /\b(desde )?(hace|for|since) (\d{1,2}|un|una|unos|unas|poco|mucho|varios|varias|algun|a|a few|several|many)? ?(tiempo|anos?|meses|mes|semanas?|dias?|years?|months?|weeks?|days?|while|time)\b/g;
  // La condicional o la negación sólo retiran SU frase; si queda otra revelación afirmativa, se evalúa el resto.
  const CONDICIONAL_SM = new RegExp('\\b(si|whether|if) (tengo|padezco|sufro( de)?|estoy|me siento|ando|soy|i have|i am|i m|im|i feel)' +
    '( una| un| la| el| muy| so| very| really)? (' + '(depresion|depresion posparto|depre|ansiedad|trastorno de ansiedad|ataques? de (panico|ansiedad)|' +
    'crisis de (panico|ansiedad)|trastorno bipolar|bipolaridad|esquizofrenia|anorexia|bulimia|(un )?trastorno (de la conducta )?' +
    'alimentari[oa]|estres postraumatico|trastorno obsesivo compulsivo|depression|anxiety|bipolar disorder|schizophrenia|' +
    '(an )?eating disorder|ptsd)' + '|deprimid[oa]|depresiv[oa]|ansios[oa]|depressed|anxious)\\b', 'g');
  function apoyoSaludMental(q, en) {
    const o = OFERTA_SM.find((x) => x.re.test(q));
    if (en) {
      return 'Thank you for telling me. What you are living with can weigh on you, and you do not have to carry it alone: talking ' +
        'with your doctor, your health clinic or someone you trust can help.\n\n' +
        'For mental health support in Mexico, **Línea de la Vida** is free and open 24 hours: **800 911 2000**. If at any moment ' +
        'you think about hurting yourself or you are in danger, call **911**.\n\n' +
        'I am an epidemiological data assistant and do not give medical advice.' +
        (o ? ` If it helps, I can tell you how ${o.en} cases are going in your state.` : '') + '\n<!--SIN_GRAFICA-->';
    }
    return 'Gracias por contármelo. Lo que vives puede pesar, y no tienes que llevarlo a solas: hablarlo con tu médico, en tu ' +
      'unidad de salud o con una persona de confianza puede ayudar.\n\n' +
      'Para orientación en salud mental, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**. Si en algún ' +
      'momento piensas en hacerte daño o estás en peligro, llama al **911**.\n\n' +
      'Soy un asistente de datos epidemiológicos y no doy consejo médico.' +
      (o ? ` Si te sirve, puedo contarte cómo van los casos de ${o.es} en tu estado.` : '') +
      '\n<!--SIN_GRAFICA-->' + (o ? `\n<!--SIGUE:${JSON.stringify([{ t: o.t, q: o.q }])}-->` : '');
  }
  /** { apoyo } | { prefijo } | { crisis } | null para una consulta cruda. */
  // Palabras de pregunta que acompañan a una condicional o negación sin otra revelación («¿cómo sé si tengo depresión?»).
  const PREGUNTA_SM = new Set(('como se saber sabe puedo puede podria que hacer cual cuales son es los las sintomas senales ' +
    'how do does i can know tell what are signs symptoms si no voy ir al medico doctor psicologo sin solo pregunto nada mas ' +
    'curiosidad por just asking only').split(' '));
  // Una frase que termina en conector o artículo está cortada («y soy una», «con una», «and I»): falla hacia la crisis.
  const CONECTOR_FINAL = new Set('y e de del con la las los el un una unos unas i and a an the mi my o pero but que soy es'.split(' '));
  // Signos: sólo letras, cifras, espacios y «¿?¡!.,;:'»; «...», «!!», «??» y «o.o» cuentan como emoticono.
  const simbolosSM = (raw) => !/^[\p{L}\p{M}\d\s¿?¡!.,;:'\u2019]*$/u.test(raw) || /\.\.|!!|\?\?|\p{L}[._]\p{L}/u.test(raw);
  // Quinta ronda (Codex Sol y Fable): disparador INVERTIDO para lo que la lista de verbos no reconoce. Con una palabra de
  // salud mental y un verbo en primera persona, lo que queda (quitados relleno, datos, preguntas, lugar y auxiliares) debe
  // estar vacío (apoyo, o prefijo si pide datos); cualquier otra palabra da la crisis completa. Sin primera persona es una
  // consulta de datos. Con sólo «me» o «mi» y algo más («la depresión me está matando»), crisis.
  const SM_PALABRA = /\b(depresion|depresiones|depre|deprimid[oa]s?|deprim[a-z]*|depresiv[oa]s?|ansiedad|ansios[oa]s?|anorexia|bulimia|bipolar|bipolaridad|esquizofrenia|panico|depression|depressed|depressive|anxiety|anxious|eating disorders?|ptsd)\b/g;
  const VERBO_1A = /\b(tengo|tuve|tenia|sigo|estuve|estoy|estaba|soy|fui|siento|sentia|ando|llevo|padezco|padeci|sufro|sufri|vivo|encuentro|cai|i|im|ive|got)\b/;
  const AUX_1A = new Set(('tengo tuve tenia sigo estuve estoy estaba soy fui siento sentia ando llevo padezco padeci sufro sufri vivo encuentro ' +
    'cai me mi mis yo i im ive m ve got am feeling feel felt been have has had getting struggle struggling suffer suffering from with ' +
    'sufriendo pasando sintiendo sentido he has re bien super diagnostico diagnosticado diagnosticada sintomas de').split(' '));
  // Palabras que, junto a un padecimiento de salud mental y sin primera persona, son señal («con un plan», «una carta»).
  const RIESGO_SUELTO = new Set(('plan planes carta cartas nota salida despedida despedirme pastillas soga cuerda puente matando matar matarme morir ' +
    'morirme muerte muerto terminar acabar carga peligro cortarme cortar navaja veneno edificio vias tren adios note letter pills rope bridge ' +
    'die dying kill killing end ending burden danger goodbye razor poison').split(' '));
  const EDAD_MENOR = /\b([5-9]|1[0-7]) (anos|years)\b/;
  // Un familiar o alguien cercano («mi suegra anda con depresión») no es una revelación propia: lo atienden la ruta de
  // familiares y el detector base. «Estoy en riesgo de depresión» pregunta por un riesgo, no revela.
  const FAMILIAR_SM = /\b(mi|mis|my|tu|su) (suegr[oa]s?|hij[oa]s?|mama|papa|madre|padre|herman[oa]s?|prim[oa]s?|ti[oa]s?|abuel[oa]s?|espos[oa]|pareja|novi[oa]|amig[oa]s?|vecin[oa]s?|companer[oa]s?|cunad[oa]s?|nuera|yerno|sobrin[oa]s?|nieto|nieta|bebe|son|daughter|mother|mom|father|dad|brother|sister|friend|wife|husband|partner|cousin)\b/;
  const TERCERO_SM = /\b(amig[oa]s?|conocid[oa]s?|familiar(es)?|pacientes?|alumn[oa]s?|estudiantes|gente|vecin[oa]s?|companer[oa]s?|someone|a friend)\b/;
  function revelacionInversa(q, raw, crudo0) {
    if (!new RegExp(SM_PALABRA.source).test(q) || FAMILIAR_SM.test(q) || TERCERO_SM.test(q)) return null;
    q = q.replace(/\b(estoy|estare|estamos|i am|i m|im) (en riesgo de|at risk of|at risk for)\b/g, ' ');
    const r = q.replace(/\b(en |de |in )?(mi|my) (estado|ciudad|municipio|state|city)\b/g, ' ')
      .replace(/\b(tengo|tenia|i have) (una |unas |un |a )?(preguntas?|dudas?|consultas?|tareas?|trabajos?|questions?)\b/g, ' ')
      .replace(/\b(soy|i am|i m|im) (un |una |a |an )?(medic[oa]|doctor|doctora|enfermer[oa]|estudiante|investigador|investigadora|maestr[oa]|profesor|profesora|periodista|psicolog[oa]|epidemiolog[oa]|student|nurse|researcher|teacher|journalist)\b/g, ' ')
      .replace(/\b((quiero|quisiera|me gustaria) saber|me (puedes|podrias|dices|das|muestras|interesa|interesan|ayudas))\b/g, ' ');
    // Deuda del detector (b): la revelación elíptica («depressed af», «been depressed for months», «super deprimida») cuenta
    // como primera persona.
    const eliptica = /^ (?:(?:super|muy|bien|re|so|really|very|pretty|kinda|still|lately|ultimamente|todavia|aun|been|feeling|sintiendome) )*(?:deprimid[oa]|depressed|ansios[oa]|anxious)\b/.test(r);
    const verbo = VERBO_1A.test(r) || eliptica;
    // Sin primera persona: consulta de datos, salvo que traiga palabras fuera del vocabulario técnico y de datos («con
    // depresión y con un plan»); entonces falla hacia la crisis.
    if (!verbo && !/\b(me|mi|mis|my)\b/.test(r)) {
      if (turnoTecnico(raw)) return null;
      let otro = r.replace(new RegExp(SM_PALABRA.source, 'g'), ' ');
      for (const [e] of ESTADOS) otro = otro.split(` ${e} `).join(' ');
      const raros = otro.split(' ').filter((w) => w && w !== 'zzfin' && !VOCAB_NEUTRO.has(w) && !RELLENO_SM.has(w) && !DATOS_SM.has(w) &&
        !PREGUNTA_SM.has(w) && !/^\d+$/.test(w));
      return raros.some((w) => RIESGO_SUELTO.has(w)) ? { crisis: CRISIS_TEXTO_ES } : null;
    }
    const en = /\b(i|im|ive|my|got)\b/.test(r) || (/\b(depressed|anxious|depression|anxiety|been|af)\b/.test(r) && !/\b(estoy|tengo|me|mi|con|de|la|el|y|ando)\b/.test(r));
    const crisis = { crisis: en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES };
    if (DESESPERANZA_SM.test(q) || (verbo && (simbolosSM(crudo0) || simbolosNoTecnicos(raw) || EMOJI_RIESGO.test(raw)))) return crisis;
    let resto = r.replace(new RegExp(SM_PALABRA.source, 'g'), ' ').replace(DURACION_SM, ' ');
    for (const [e] of ESTADOS) resto = resto.split(` ${e} `).join(' ');
    const toks = resto.split(' ').filter((w) => w && w !== 'zzfin' && !AUX_1A.has(w) && !RELLENO_SM.has(w) && !DATOS_SM.has(w) &&
      !PREGUNTA_SM.has(w) && !ADVERBIO_SM_INV.has(w));
    // Sexta ronda (corpus de estrés): la inversión sólo AÑADE crisis ante una señal concreta (plan, carta, pastillas, edad de
    // menor…); con otras palabras la consulta sigue su curso, como antes del parche.
    if (toks.some((w) => RIESGO_SUELTO.has(w)) || EDAD_MENOR.test(q)) return crisis;
    if (toks.length || !verbo) return null;
    // Ronda 1 (Fable): la revelación que sólo se reconoce por un adverbio o por la forma elíptica es «laxa»: da el apoyo
    // como primer turno, pero no cuenta como «otra revelación» dentro del apoyo (ahí recibe la crisis completa, como antes).
    const laxa = eliptica && !VERBO_1A.test(r) || resto.split(' ').some((w) => ADVERBIO_SM_INV.has(w));
    if (PIDE_DATOS_SM.test(resto)) return { prefijo: en ? PREFIJO_SM_EN : PREFIJO_SM, laxa };
    return { apoyo: apoyoSaludMental(q, en), laxa };
  }
  // Deuda del detector (b): adverbios y modificadores que acompañan una revelación sin señal («estoy sola con depresión»,
  // «depressed af», «sigo deprimido todavía»). Sólo los usa el disparador INVERTIDO, cuyo resultado sin ellos era dejar pasar
  // las cifras: con ellos da el apoyo. No tocan la lista de relleno del disparador directo, así que nunca rebajan una crisis.
  const ADVERBIO_SM_INV = new Set(('sola solo solas solos todavia aun otra vez nuevo ya siempre seguido constantemente veces ' +
    'hoy ultimamente mucho tanto bastante demasiado horrible fatal terrible re bien super af still again always lately today ' +
    'kinda kind sort pretty really so very too as hell been for feeling sintiendome').split(' '));
  const DESESPERANZA_SM = /\b(no hay (nada|salida|remedio|esperanza|solucion)|nada que hacer|ya no (puedo|aguanto|quiero|tiene)|sin salida|no tiene salida|no vale la pena|nada mas|no tiene sentido|no le veo|no puedo (hacer nada|mas|seguir|con nada|con esto|con todo|con mi vida|con la vida)|ya no puedo|no aguanto|no (como|duermo|me levanto|salgo)|(ya )?no se (que|como) hacer|no se que mas|hopeless|no way out|no point|nothing left|give up|me rindo)\b/;
  function saludMentalPropia(raw) {
    const crudo0 = String(raw || '').normalize('NFKC').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'");
    // «sí tengo depresión» y «si, tengo…» afirman: no son condicional. La puntuación de fin de oración separa frases:
    // «No. Tengo depresión» no es una negación de la revelación.
    const crudo = crudo0.replace(/(^|[^\p{L}])sí(?=$|[^\p{L}])/gu, '$1 afirmo ').replace(/(^|[^\p{L}])si\s*,/gu, '$1 afirmo ')
      .replace(/[.;:!?¡¿,]+/g, ' zzfin ');
    const q = ` ${crudo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const hay = (re, t) => new RegExp(re.source).test(t);
    if (!(hay(MENTAL_PROPIA, q) || hay(ANIMO_PROPIO, q))) return revelacionInversa(q, raw, crudo0);
    const NEG = new RegExp(NEGADA_SM.source, 'g');
    const sinNoAfirm = q.replace(CONDICIONAL_SM, ' ').replace(NEG, ' ');
    const afirma = hay(MENTAL_PROPIA, sinNoAfirm) || hay(ANIMO_PROPIO, sinNoAfirm);
    const noAfirma = sinNoAfirm !== q;
    const en = /\b(i have|i ve|ive|i had|i suffer|i was diagnosed|i live with|i am|i m|im|i feel|my|if i|i do not|i dont)\b/.test(q);
    const crisis = { crisis: en ? CRISIS_TEXTO_EN : CRISIS_TEXTO_ES };
    if (simbolosSM(crudo0) || simbolosNoTecnicos(String(raw || '').replace(/[\u2018\u2019\u02bc]/g, "'")) || EMOJI_RIESGO.test(raw)) return crisis;
    if (DESESPERANZA_SM.test(q)) return crisis;
    const secuencia = q.split(' ').filter((w) => w && w !== 'zzfin');
    if (CONECTOR_FINAL.has(secuencia.at(-1))) return crisis;
    let resto = sinNoAfirm.replace(MENTAL_PROPIA, ' ').replace(ANIMO_PROPIO, ' ').replace(DURACION_SM, ' ')
      .replace(/\b(en |in )?(mi|my) (estado|ciudad|municipio|state|city)\b/g, ' ');
    for (const [e] of ESTADOS) resto = resto.split(` ${e} `).join(' ');
    const toks = resto.split(' ').filter((w) => w && w !== 'zzfin');
    // «si tengo depresion» sin tilde ni nada más es casi siempre la respuesta «sí»: apoyo.
    if (!afirma && /^ si /.test(q) && !toks.length) return { apoyo: apoyoSaludMental(q, en) };
    // Sólo condicional o negación, sin otra revelación: pregunta o desmentido; si dice algo más, falla hacia la crisis.
    if (!afirma) return toks.every((w) => RELLENO_SM.has(w) || PREGUNTA_SM.has(w) || DATOS_SM.has(w)) ? null : crisis;
    // Condicional o negación junto a una revelación: sólo con relleno puro alrededor.
    if (noAfirma && !toks.every((w) => RELLENO_SM.has(w))) return crisis;
    // «¿qué datos hay de mi caso?»: el bot no evalúa casos individuales; apoyo, sin cifras.
    // Lo demás debe ser relleno, datos o pregunta («mi caso es que tengo 15 años» da crisis). Igual «cómo va mi depresión».
    const PERSONAL_SM = new RegExp('\\b(mi|my) (caso|pronostico|forecast|case|situacion|situation|diagnostico|diagnosis|' + CONDICION_MENTAL.slice(1, -1) + ')\\b');
    if (PERSONAL_SM.test(q)) {
      const r2 = toks.filter((w) => !['caso', 'pronostico', 'forecast', 'case', 'situacion', 'situation', 'diagnostico', 'diagnosis', 'mi', 'my'].includes(w));
      return r2.every((w) => RELLENO_SM.has(w) || DATOS_SM.has(w) || PREGUNTA_SM.has(w)) ? { apoyo: apoyoSaludMental(q, en) } : crisis;
    }
    const lugar = ESTADOS.some(([e]) => q.includes(` ${e} `)) || / (mexico|cdmx|pais|republica|country) /.test(q);
    if (toks.every((w) => RELLENO_SM.has(w) || ((w === 'vivo' || w === 'radico' || w === 'live') && lugar))) {
      return { apoyo: apoyoSaludMental(q, en) };
    }
    if (PIDE_DATOS_SM.test(resto) && toks.every((w) => RELLENO_SM.has(w) || DATOS_SM.has(w))) return { prefijo: en ? PREFIJO_SM_EN : PREFIJO_SM };
    return crisis;
  }

  /** Para la función RAG: la consulta con la revelación sustituida por el nombre del padecimiento («tengo anorexia, cuántos
   * casos hay en Jalisco» → «anorexia cuantos casos hay en jalisco»), para que ningún modelo reciba la primera persona. */
  /** Decisión 2, quinta ronda: «sí», «claro» o «sí, en Jalisco» tras el apoyo continúan la oferta («depresión en Jalisco»). */
  // Ronda 5 (Codex Sol): la oferta dice «en tu estado»; un «sí» sin estado recibe en KB y RAG la misma pregunta fija por el
  // estado (antes el KB abría la ficha nacional y RAG pedía el padecimiento). Ronda 6 (Codex Sol y Fable): tras esa pregunta,
  // «sí, en Jalisco», «Jalisco», «nacional», «todo México» o un sexo continúan la oferta; otro «sí» a secas, no.
  const LUGAR_SOLO = new RegExp('^(y )?(en |in )?(el estado de )?' + LUGAR_T + '$');
  const NACIONAL_SOLO = /^(y )?(a nivel |en |in )?(nacional|todo (el pais|mexico)|el pais|mexico|la republica( mexicana)?|nationwide|nationally|the country)$/;
  function ofertaPendiente(qn, previos) {
    if (simbolosSM(String(qn)) || simbolosNoTecnicos(qn) || EMOJI_RIESGO.test(qn)) return null;
    // Ronda 8 (Fable): «Jalisco, México» es Jalisco (el país como apellido del estado), no el Estado de México.
    const q = normTercera(qn).replace(/^(.*?\b(?!mexico\b)[a-z]+) (mexico|mx)$/, (m, a) => (ESTADOS.some(([e]) => ` ${a} `.includes(` ${e} `) && e !== 'mexico') ? a : m));
    const ofertaDe = (t) => (t && saludMentalPropia(t)?.apoyo ? OFERTA_SM.find((x) => x.re.test(normTercera(t))) : null);
    const lugarDe = (t) => ESTADOS.find(([e]) => ` ${t} `.includes(` ${e} `));
    const p = normTercera(previos.at(-1) || '');
    // Octava ronda (Fable): la oferta vale sólo en el turno inmediato al apoyo, o en el siguiente a la pregunta por el estado.
    const inmediata = ofertaDe(previos.at(-1));
    const trasPregunta = !inmediata && ACEPTA_OFERTA.test(p) && !lugarDe(p) ? ofertaDe(previos.at(-2)) : null;
    const o = inmediata || trasPregunta;
    if (!o) return null;
    const conAcepta = ACEPTA_OFERTA.test(q);
    // Ronda 8 (Codex Sol): «sí, en México» o «yes, in Mexico» se resuelven con la misma lógica que el lugar solo.
    if (conAcepta) {
      const sinSi = q.replace(/^(si por favor|yes please|si|claro|yes|sure)\b\s*/, '');
      if (!sinSi) return trasPregunta ? null : { o, lugar: null };
      if (NACIONAL_SOLO.test(sinSi)) return { o, ambito: 'nacional' };
      return lugarDe(sinSi) ? { o, lugar: lugarDe(sinSi) } : (trasPregunta ? null : { o, lugar: null });
    }
    // Ronda 7 (Codex Sol): sexo y estado juntos («en mujeres de Jalisco», «Jalisco mujeres»).
    const sexos = q.match(/\b(hombres|mujeres|men|women)\b/g) || [];
    if (sexos.length > 1) return null;
    const sexo = sexos.length ? (/^(hombres|men)$/.test(sexos[0]) ? 'hombres' : 'mujeres') : null;
    const resto = sexo ? q.replace(/(^|\b)(y )?((en|entre|in|among) )?(hombres|mujeres|men|women)( (de|del|en|in|of))?\b/, ' ').replace(/\s+/g, ' ').trim() : q;
    if (sexo && inmediata) return null;
    if (!resto) return inmediata ? null : { o, ambito: 'nacional', sexo };
    // «México» o «todo el país» es el ámbito nacional, no el Estado de México.
    if (NACIONAL_SOLO.test(resto)) return inmediata ? null : { o, ambito: 'nacional', sexo };
    if (LUGAR_SOLO.test(resto) && lugarDe(resto)) return { o, lugar: lugarDe(resto), sexo };
    return null;
  }
  function consultaOferta(qn, previos = []) {
    const r = ofertaPendiente(qn, previos);
    if (!r || (!r.lugar && !r.ambito)) return null;
    const base = r.o.q.replace(/^¿cómo va la |\?$/g, '');
    return r.lugar ? `${base} en ${r.lugar[1]}${r.sexo ? ` en ${r.sexo}` : ''}` : `cuantos casos de ${base} hay en el pais${r.sexo ? ` en ${r.sexo}` : ''}`;
  }
  /** Ronda 8 (Fable): padecimiento ofrecido cuando se pregunta por el estado; el KB lo deja como contexto, como RAG lo hereda. */
  function padDeOferta(qn, previos = []) { const r = ofertaPendiente(qn, previos); return r && !r.lugar && !r.ambito ? r.o.pad : null; }
  /** «sí» a la oferta sin decir el estado: pregunta fija por el estado, en el idioma de la revelación. */
  function ofertaSinEstado(qn, previos = []) {
    const r = ofertaPendiente(qn, previos);
    if (!r || r.lugar || r.ambito) return null;
    const en = /\b(i|im|my|depression|depressed|eating)\b/.test(normTercera(previos.at(-1) || '')) && !/\b(tengo|estoy|mi)\b/.test(normTercera(previos.at(-1) || ''));
    return (en ? `Which state? Tell me (for example, «in Jalisco») and I will tell you how ${r.o.en} cases are going there.`
      : `¿En qué estado? Dímelo (por ejemplo, «en Jalisco») y te digo cómo van los casos de ${r.o.es} ahí.`) + '\n<!--SIN_GRAFICA-->';
  }
  const peticionConOtro = (t) => releasesEnConsulta(normLB(t), { prefijos: true }).length > 0 || /\b(dengue|parkinson|alzheimer)\b/.test(t);
  /** Ronda 6 (Fable): la petición sin la revelación cuando nombra otro padecimiento, o null (la usan el KB y RAG). */
  function peticionSinRevelacion(raw) { const r = consultaSinRevelacion(raw); return peticionConOtro(r) ? r : null; }
  function consultaSinRevelacion(raw) {
    const q = ` ${String(raw || '').normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
    // Ronda 5 (Codex Sol): si la petición nombra otro padecimiento («sigo deprimida, ¿cuántos casos de anorexia hay?»), la
    // revelación se quita sin sustituirla, para no mezclar dos referentes.
    const sinRev = q.replace(MENTAL_PROPIA, ' ').replace(ANIMO_PROPIO, ' ').replace(/\b(deprimid[oa]s?|depresiv[oa]s?|depre|ansios[oa]s?|depressed|anxious)\b/g, ' ')
      .split(' ').filter((w) => w && !AUX_1A.has(w) && !ADVERBIO_SM_INV.has(w)).join(' ');
    if (peticionConOtro(sinRev)) return sinRev;
    const cond = new RegExp(CONDICION_MENTAL);
    return q.replace(/\b(en |de |in )?(mi|my) (estado|ciudad|municipio|state|city)\b/g, ' ').replace(MENTAL_PROPIA, (m) => ` ${(m.match(cond) || [''])[0]} `)
      .replace(ANIMO_PROPIO, (m) => (/ansios|anxious|ansiedad/.test(m) ? ' ansiedad ' : ' depresion '))
      .split(' ').filter((w) => !AUX_1A.has(w) || w === 'de').join(' ').replace(/\b(deprimid[oa]s?|deprim[a-z]*|depresiv[oa]s?|depre)\b/g, 'depresion')
      .replace(/\bansios[oa]s?\b/g, 'ansiedad')
      .replace(/\s+/g, ' ').trim();
  }

  g.EPI_CATALOGO = Object.freeze({
    ETIQUETA_SIN_ALTERNATIVA, textoSinAlternativa,
    releases, diabetesEnConsulta, conDiabetesNombrada, conFamiliaNombrada, canonClinico, nombraAlias, noModeladas,
    mencionaNoModelada, conHipertensionNombrada, respuestaCrisis, esCrisisTercera, esCierreApoyo, esCrisisCompleta, crisisTextoDe, crisisPersonalDe, saludMentalPropia, consultaSinRevelacion, consultaOferta, ofertaSinEstado, padDeOferta, huboCrisisEnTurnos, peticionSinRevelacion, nombraReleaseSensible, normLB, subtipoAjeno, aliasAmbiguo,
    motivoRechazo, crisisEnTurnos, respuestaCrisisSeguimiento, respuestaMixtaSensible, fueraDeListaBlanca, idsSensiblesEn,
    alcoholCalificado, IDS_LISTA_BLANCA, _VOCAB_TECNICO: VOCAB_TECNICO, _FRAGMENTOS_GUARDAS: FRAGMENTOS_GUARDAS, fueraDeVocabulario, apoyoSuave, apoyoInmediato, respuestaTemaSensible, respuestaFueraDeVocabulario,
    restoFuera, tieneFragmentoDeDatos, respuestaConDatos, esRespuestaDeAyuda, salidaFueraDeVocabulario, APOYO_ES, APOYO_EN, pareceIngles, normalizaEntrada,
    ALIAS_LEGACY, padecimientosEnConsulta, releasesEnConsulta, CONJUGACIONES_COMUNES, NO_VERBALES_MOS,
  });
})(globalThis);
