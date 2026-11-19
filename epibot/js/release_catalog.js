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
      alias: ['toxoplasmosis', 'b58'],
      prefijos: ['toxoplasm'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:16.735688+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en toxoplasmosis_b58_57c2305d7e99, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'teniasis_b68', pad: 'Teniasis', nombre: 'Teniasis', nombreCorto: 'Teniasis', etiqueta: 'Teniasis (B68)', dataKey: 'teniasis_b68', marca: 'TENIASIS_B68', pagina: 'teniasis_b68.html', consulta: 'teniasis', cie: 'B68', color: '#3F6212',
      alias: ['teniasis', 'taeniasis', 'b68'],
      prefijos: ['teniasis', 'taeniasis'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:30.068368+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en teniasis_b68_5df03584bac6, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'cisticercosis_b69', pad: 'Cisticercosis', nombre: 'Cisticercosis', nombreCorto: 'Cisticercosis', etiqueta: 'Cisticercosis (B69)', dataKey: 'cisticercosis_b69', marca: 'CISTICERCOSIS_B69', pagina: 'cisticercosis_b69.html', consulta: 'cisticercosis', cie: 'B69', color: '#166534',
      alias: ['cisticercosis', 'neurocisticercosis', 'b69', 'cysticercosis'],
      prefijos: ['cisticercosis', 'neurocisticercosis', 'cysticercosis'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:21.600870+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en cisticercosis_b69_fe1c2b19bed3, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'triquinosis_b75', pad: 'Triquinosis', nombre: 'Triquinosis', nombreCorto: 'Triquinosis', etiqueta: 'Triquinosis (B75)', dataKey: 'triquinosis_b75', marca: 'TRIQUINOSIS_B75', pagina: 'triquinosis_b75.html', consulta: 'triquinosis', cie: 'B75', color: '#7F1D1D',
      alias: ['triquinosis', 'triquinelosis', 'b75', 'trichinosis', 'trichinellosis'],
      prefijos: ['triquinosis', 'triquinelosis', 'trichinosis', 'trichinellosis'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:34.120104+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en triquinosis_b75_248ad10f21a7, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'conjuntivitis_hemorragica_b303', pad: 'Conjuntivitis epidémica aguda hemorrágica', nombre: 'Conjuntivitis epidémica aguda hemorrágica', nombreCorto: 'Conjuntivitis epidémica aguda hemorrágica', etiqueta: 'Conjuntivitis epidémica aguda hemorrágica (B30.3)', dataKey: 'conjuntivitis_hemorragica_b303', marca: 'CONJUNTIVITIS_HEMORRAGICA_B303', pagina: 'conjuntivitis_hemorragica_b303.html', consulta: 'hemorragica conjuntival epidemica', cie: 'B30.3', color: '#BE185D',
      alias: ['hemorragica conjuntival epidemica', 'b30 3'],
      prefijos: ['hemorragica conjuntival epidemica'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:11.713796+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en conjuntivitis_hemorragica_b303_f0c4a3215b7e, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'tracoma_a71', pad: 'Tracoma', nombre: 'Tracoma', nombreCorto: 'Tracoma', etiqueta: 'Tracoma (A71)', dataKey: 'tracoma_a71', marca: 'TRACOMA_A71', pagina: 'tracoma_a71.html', consulta: 'tracoma', cie: 'A71', color: '#4338CA',
      alias: ['tracoma', 'a71', 'trachoma'],
      prefijos: ['tracoma', 'trachoma'],
      cronologia: 'Se entrenó con datos hasta 2026-W42 y su único pronóstico congelado se creó el 2026-11-19T13:29:38.036780+00:00 (19 de noviembre de 2026 en Ciudad de México). El boletín 44 (semana 2026-W43, primera disponibilidad verificable 2026-11-17T01:23:31.237010+00:00 UTC) ya era público antes de emitir: no se usó para entrenar y se registró por separado en tracoma_a71_e19dc92ac6d6, así que el primer objetivo (2026-W43) no es prospectivo respecto de la información. Como control estacional no tiene validación prospectiva propia: el registro técnico de cuatro semanas (1/4 INCOMPLETE al corte del boletín 44) pasa a CONTROL_ONLY al reunir las cuatro observaciones, sin obtener nunca aprobación prospectiva.',
    },
    {
      id: 'hipotermia_t68', pad: 'Hipotermia', nombre: 'Hipotermia', nombreCorto: 'Hipotermia', etiqueta: 'Hipotermia (T68)', dataKey: 'hipotermia_t68', marca: 'HIPOTERMIA_T68', pagina: 'hipotermia_t68.html', consulta: 'hipotermia', cie: 'T68', color: '#1E40AF',
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
  ]);

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
    [new RegExp(`\\btuberculosis (pulmonar|respiratoria)\\b|\\b(pulmonary|respiratory) tuberculosis\\b|\\ba1[56](?:\\.[0-9]|[0-9]| [0-9]${NO_UNIDAD})?\\b`),
      'tuberculosis respiratoria', 'tuberculosis respiratoria (A15-A16), que el boletín notifica aparte', 'tuberculosis_otras_formas_a171'],
    [new RegExp(`\\bmeningitis tuberculosa\\b|\\btuberculous meningitis\\b|\\ba17(?:\\.0|0| 0${NO_UNIDAD})\\b`),
      'meningitis tuberculosa', 'meningitis tuberculosa (A17.0), que el boletín notifica aparte', 'tuberculosis_otras_formas_a171'],
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
    const nombrado = releases.find((r) => r.cie && r.alias.some((al) => nombraAlias(canon, al)));
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
    const nombrado = releases.find((r) => r.cie && r.alias.some((al) => !/\d/.test(al) && nombraAlias(canon, al)));
    if (!nombrado) return null;
    for (const m of canon.matchAll(CODIGO_CIE)) {
      const [, letra, num, dec] = m;
      const otro = releaseQueCubre(letra, num, dec);
      if (!otro || otro.id === nombrado.id) continue;
      const codigo = `${letra.toUpperCase()}${num}${dec != null ? `.${dec}` : ''}`;
      return `El nombre «${nombrado.nombreCorto.toLowerCase()}» corresponde a **${nombrado.etiqueta}**; el código ${codigo} ` +
        `corresponde a otro bloque publicado, **${otro.etiqueta}**. No doy cifras hasta saber cuál consultas: ` +
        `pregunta por «${nombrado.consulta}» o por «${otro.consulta}».`;
    }
    return null;
  }

  /** El subtipo ajeno que nombra la consulta (normalizada): `{ termino, nombre, release }`, o null. */
  function subtipoAjeno(qn) {
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    const hit = SUBTIPOS_AJENOS.find(([re, , , , ctx]) => re.test(canon) && (!ctx || ctx.test(canon))) || codigoAjeno(canon);
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
      abarca: '«Meningitis» abarca renglones distintos del boletín: el síndrome meníngeo (G00-G03, excepto G00.0 y G00.1) y la meningitis meningocócica (A39.0) tienen cada uno su control estacional; la meningitis por Haemophilus influenzae (G00.0) y la neumocócica (G00.1) se cuentan dentro de las infecciones invasivas de su agente, y la tuberculosa (A17.0) se notifica aparte y no se pronostica.' },
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
    { release: null, bloques: ['tuberculosis_otras_formas_a171'], siempre: true,
      generico: /\b(tuberculosis|tb|tbc)\b(?!.*\b(otras formas|extrapulmonar|extrapulmonary)\b)|\ba17\b(?![ .]?[0-9])/, especifico: /(?!)/,
      abarca: '«Tuberculosis» abarca la respiratoria (A15-A16) y la meningitis tuberculosa (A17.0), que se notifican aparte y no se pronostican, y la tuberculosis otras formas (A17.1, A17.8, A17.9, A18-A19), con su control estacional.' },
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
      abarca: 'La hepatitis alcohólica (K70.1) se cuenta dentro de la enfermedad alcohólica del hígado (K70, excepto K70.3), sin una serie propia; pregunta por «enfermedad alcoholica del higado».' },
    { release: 'neumococo_a40', re: /\b(neumonia|neumonias|pneumonia) (neumococic[ao]s?|por neumococos?|por streptococcus pneumoniae|pneumococcal)\b|\bpneumococcal pneumonia\b|\bj13\b/,
      abarca: 'La neumonía por neumococo (J13) no forma parte del bloque de neumonías y bronconeumonías: se cuenta dentro de la enfermedad invasiva por neumococo (A40.3, G00.1, J13), sin una serie propia; pregunta por «enfermedad invasiva por neumococo».' },
    { release: 'haemophilus_a41', re: /\b(neumonia|neumonias|pneumonia) (por )?(haemophilus|hemophilus|h influenzae)\b|\bj14\b/,
      abarca: 'La neumonía por Haemophilus influenzae (J14) no forma parte del bloque de neumonías y bronconeumonías: se cuenta dentro de las infecciones invasivas por Haemophilus influenzae (A41.3, G00.0, J14), sin una serie propia; pregunta por «haemophilus influenzae».' },
  ];

  /** Aclaración ante un nombre genérico que no basta para elegir el bloque publicado, o null. */
  function aliasAmbiguo(qn) {
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    // Una aclaración («hepatitis B crónica B18.1») explica mejor que la contradicción entre nombre y código.
    const previa = ACLARACIONES.find((a) => a.re.test(canon));
    const contradiccion = previa ? null : contradiccionCie(canon);
    if (contradiccion) return { release: null, pad: null, texto: contradiccion };
    const hitPrevio = previa ? { release: previa.release, abarca: previa.abarca } : null;
    if (!hitPrevio && subtipoAjeno(qn)) return null;
    const nombrados = (a) => a.bloques.filter((id) => releases.find((r) => r.id === id).alias
      .some((al) => nombraAlias(canon, al))).length;
    const hit = hitPrevio || ALIAS_AMBIGUOS.find((a) => a.generico.test(canon) && !a.especifico.test(canon) &&
      (!a.uno || a.uno.test(canon) === a.otroEsp.test(canon)) && (!a.bloques || a.siempre || nombrados(a) !== 1));
    if (!hit) return null;
    if (hit.bloques) {
      const rs = hit.bloques.map((id) => releases.find((x) => x.id === id));
      return {
        release: null, pad: null,
        texto: `${hit.abarca} No doy cifras hasta saber cuál consultas: ` +
          `${rs.map((x) => `«${x.consulta}»`).join(', ').replace(/, ([^,]*)$/, ' o $1')}; por ejemplo, «${rs[0].consulta} en Jalisco».`,
      };
    }
    const r = releases.find((x) => x.id === hit.release);
    const otro = hit.otro ? releases.find((x) => x.id === hit.otro) : null;
    if (otro) {
      return {
        release: null, pad: null,
        texto: `${hit.abarca} No doy cifras hasta saber cuál consultas: pregunta por «${r.consulta}» ` +
          `(**${r.etiqueta}**) o por «${otro.consulta}» (**${otro.etiqueta}**); por ejemplo, «${r.consulta} en Jalisco».`,
      };
    }
    return {
      release: r.id, pad: r.pad,
      texto: `${hit.abarca} EpiForecast-MX sólo pronostica **${r.etiqueta}**, así que no doy cifras hasta saber ` +
        `si te refieres a ese bloque. Si es así, pregunta por «${r.consulta}»; por ejemplo, «${r.consulta} en Jalisco».`,
    };
  }

  /** La enfermedad no modelada que nombra la consulta (normalizada), o null. Compara al inicio de palabra. */
  function mencionaNoModelada(qn) {
    const canon = canonClinico(qn);
    const ajeno = subtipoAjeno(qn);
    if (ajeno) return ajeno.termino;
    // Antes de retirar alias: «presión arterial» es alias de hipertensión y taparía «presión arterial baja».
    const baja = canon.match(PRESION_BAJA);
    if (baja) return baja[0];
    const q = sinAliasPublicados(` ${canon.replace(CANCER_MAMA, ' ')} `);
    // Un término genérico que forma parte del nombre de un release nombrado («hepatitis B15») no lo niega.
    const sinTilde = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nombrados = releases.filter((r) => r.alias.some((al) => nombraAlias(canon, al)));
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

  const CRISIS_ES = /\b(suicidarme|suicidarse|matarme|matarse|quitarme la vida|quitarse la vida|acabar con mi vida|terminar con mi vida|(me|se) quier[eo] (morir|matar|suicidar)|me voy a (matar|morir|suicidar)|quiero (morir|morirme)|quisiera (morir|morirme|estar muert)|ganas de (morir|morirme|matarme|suicidarme)|(ya )?no quiero (vivir|seguir viviendo|seguir con vida|estar viv|existir)|no vale la pena vivir|hacerme dano|lastimarme|cortarme las venas|autolesionarme|(tengo|con) (pensamientos|ideas) suicidas|tengo ideacion suicida)\b/;
  const CRISIS_EN = /\b(kill(ing)? myself|want to die|wanna die|end my life|take my own life|hurt myself|harm myself|suicidal thoughts|im suicidal|i am suicidal)\b/;
  // alta_b44 (19-nov-2026): violencia vivida en primera persona («me pegan», «mi pareja me golpea»).
  const VIOLENCIA_ES = /\b(me (pega|pegan|pego|pegaron|golpea|golpean|golpeo|golpearon|maltrata|maltratan|amenaza|amenazan|viola|violan|violo|violaron|abusa|abusan|abuso|abusaron|lastima|lastiman|agrede|agreden|encierra|encierran)|(abusa|abusan|abuso|abusaron) de mi|sufro (violencia|maltrato|abuso)|vivo violencia|tengo miedo de mi (pareja|esposo|esposa|novio|novia|papa|mama|padre|madre))\b/;
  const VIOLENCIA_EN = /\b((he|she|they) (hits|beats|hurts|abuses|rapes) me|my (partner|husband|wife|boyfriend|girlfriend|father|mother|dad|mom) (hits|beats|hurts|abuses) me|i am being (abused|hit|beaten)|im being (abused|hit|beaten))\b/;
  // Temas sensibles a secas («suicidio en jalisco», «intento de suicidio», «autolesiones»): respuesta de crisis, sin cifras.
  // Sólo el rótulo técnico completo o el código de un release sensible (X60, X61, X70, X72, X78, X80, Z91.5, R45.8)
  // abre su ficha, y nunca si la consulta trae además una señal de riesgo personal.
  const SENSIBLE_ES = /\b(suicid\w*|intento de suicidio|ideacion suicida|autolesion\w*|autoinflig\w*|lesiones autoinfligidas)\b/;
  const SENSIBLE_EN = /\b(suicide|suicidal|self ?harm|self injury|self inflicted)\b/;
  function nombraReleaseSensible(qn) {
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    return releases.some((r) => r.sensible && r.alias.some((al) => nombraAlias(canon, al)));
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

  /** Texto fijo ante una señal de riesgo personal, o null. No pasa por ningún modelo. */
  function respuestaCrisis(qn) {
    const q = String(qn);
    if (CRISIS_ES.test(q) || VIOLENCIA_ES.test(q)) return CRISIS_TEXTO_ES;
    if (CRISIS_EN.test(q) || VIOLENCIA_EN.test(q)) return CRISIS_TEXTO_EN;
    if (nombraReleaseSensible(q)) return null;
    if (SENSIBLE_ES.test(q)) return CRISIS_TEXTO_ES;
    return SENSIBLE_EN.test(q) ? CRISIS_TEXTO_EN : null;
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

  g.EPI_CATALOGO = Object.freeze({
    ETIQUETA_SIN_ALTERNATIVA, textoSinAlternativa,
    releases, diabetesEnConsulta, conDiabetesNombrada, conFamiliaNombrada, canonClinico, nombraAlias, noModeladas,
    mencionaNoModelada, conHipertensionNombrada, respuestaCrisis, subtipoAjeno, aliasAmbiguo,
  });
})(globalThis);
