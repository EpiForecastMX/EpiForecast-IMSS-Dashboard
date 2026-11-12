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
      consulta: 'infecciones intestinales', cie: 'A04, A08-A09', color: '#38BDF8',
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
  ]);

  /**
   * Subtipos de diabetes que nombra la consulta (ya normalizada), o null si no habla de los que se
   * modelan. Diabetes gestacional, insípida y prediabetes no se modelan: quedan para el aviso de no
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
   * Formas que describen un padecimiento publicado con palabras que, leídas sueltas, apuntan a otro:
   * «isquemia cerebral» es cerebrovascular y «cardiopatía isquémica» no es una cardiopatía sin modelar.
   */
  const CANON_CLINICO = [
    [/\bcerebro vascular(es)?\b/g, 'cerebrovascular'],
    [/\benfermedad(es)? vascular(es)? cerebral(es)?\b/g, 'enfermedad cerebrovascular'],
    [/\b(isquemia|isquemica|isquemico|infarto|embolia|ataque|evento|accidente)( vascular)? cerebral(es)?\b/g,
      'enfermedad cerebrovascular'],
    [/\bcardiopatias? isquemicas?\b/g, 'enfermedad isquemica'],
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
    if (PRESION_BAJA.test(q) || /\b(diabet|dm ?[12]\b)/.test(q)) return q;
    if (!new RegExp(HTA_TERMINO.source).test(q) || !new RegExp(EMBARAZO_TERMINO.source).test(q)) return q;
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
    'intento de suicidio', 'ideacion suicida', 'autolesion', 'lesion autoinfligida', 'self harm',
    'suicidio', 'suicida', 'suicide', 'suicidal',
    // Categorías del boletín sobre autolesión y violencias: sin cifras en EPI, y sin caer en la tabla
    // neuro del estado («violencia intrafamiliar en jalisco» la mostraba).
    'lesiones autoinfligidas', 'envenenamiento autoinfligido', 'autoinfligid',
    'violencia', 'abuso sexual', 'agresion sexual', 'violacion', 'maltrato', 'arma de fuego',
    'herida de bala', 'heridas de bala', 'balazo', 'domestic violence', 'gunshot',
    'hipotension', 'hypotension', 'presion baja', 'presion arterial baja', 'tension baja',
    'tension arterial baja',
    'cancer', 'hipertension pulmonar', 'prediabetes', 'diabetes gestacional', 'diabetes insipida', 'diabetes en el embarazo',
    'diabetes del embarazo', 'epilepsia',
    'esquizofrenia', 'ansiedad', 'bipolar', 'autismo', 'tdah',
    'influenza', 'covid', 'tuberculosis', 'vih', 'sida', 'colera',
    'sarampion', 'rubeola', 'hepatitis', 'zika', 'chikungunya', 'malaria',
    'linfoma', 'tumor', 'neoplasia', 'cardiopatia congenita', 'cardiopatia', 'infarto',
    'ataque al corazon', 'ataque cardiaco',
    'embolia', 'bronquitis', 'enfisema', 'cirrosis', 'artritis',
    // Fuera de los bloques A04, A08-A09 y A06: rotavirus es A08.0 y las demás tienen código propio.
    'rotavirus', 'shigelosis', 'salmonelosis', 'tifoidea',
    'lupus', 'fibromialgia', 'esclerosis', 'huntington', 'ela ',
    'insuficiencia renal', 'insuficiencia cardiaca',
    // En inglés: sin esto, «epilepsy in jalisco» caería en la tabla neuro del estado.
    'gestational diabetes', 'diabetes gestational', 'diabetes insipidus', 'prediabetic',
    'epilepsy', 'schizophrenia', 'anxiety', 'tuberculosis', 'hiv', 'aids', 'measles',
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
    [subcodigo('a06', '4-8'), 'absceso hepatico amebiano',
      'absceso hepático amebiano (A06.4) ni otras amebiasis fuera del intestino (A06.5-A06.8)', 'amebiasis_a06'],
    [/\babscesos? (hepaticos?|amebianos?)\b|\b(amebic |amoebic )?liver abscess\b/, 'absceso hepatico amebiano',
      'absceso hepático amebiano (A06.4)', 'amebiasis_a06'],
    [/\b(amebiasis|amibiasis|amoebiasis|amebic|amoebic)( (del|de|en el|en la|of the))? (extraintestinal|cutanea|pulmonar|cerebral|hepatica|higado|liver|hepatic|skin|lung|brain)\b|\bextraintestinal (amebiasis|amibiasis|amoebiasis)\b/,
      'amebiasis extraintestinal', 'amebiasis fuera del intestino (A06.4-A06.8)', 'amebiasis_a06'],
    [subcodigo('h65', '2-9'), 'otitis media cronica', 'otitis media crónica (H65.2-H65.9)', 'otitis_h65'],
    [/\bh66\b|\botitis( [a-z]+){0,3} (no aguda|cronic[ao]s?|chronic|supurativ[ao]s?|suppurative|purulent[ao]s?|purulent)\b|\b(chronic|suppurative|purulent) otitis\b/,
      'otitis media cronica o supurativa',
      'otitis media crónica (H65.2-H65.9) ni supurativa o purulenta (H66)', 'otitis_h65'],
    [/\botitis externa\b|\botitis del nadador\b|\b(external otitis|otitis externa|swimmer s ear)\b|\bh60\b/, 'otitis externa',
      'otitis externa (H60)', 'otitis_h65'],
    [/\botitis interna\b|\binternal otitis\b/, 'otitis interna', 'otitis interna, que no forma parte de H65.0-H65.1',
      'otitis_h65'],
    [/\bconjuntivitis( [a-z]+){0,3} (hemorragicas?|viral(es)?|viricas?|virus|adenovir[a-z]*|epidemicas?|gonococ[a-z]*|neonatal(es)?|recien nacidos?|herpetic[a-z]*|clamidi[a-z]*|chlamydi[a-z]*)\b|\b(hemorrhagic|viral|adenoviral|epidemic|gonococcal|neonatal|chlamydial|herpetic) conjunctivitis\b|\bb30([ .]?[0-9])?\b/,
      'conjuntivitis fuera de h10',
      'conjuntivitis viral ni epidémica aguda hemorrágica (B30), ni las conjuntivitis gonocócica, por clamidia, herpética o neonatal, que tienen código propio fuera de H10',
      'conjuntivitis_h10'],
    [/\b(peaton(es)?|atropell[a-z]*|pedestrians?)\b|\bv0[1-9]\b/, 'peaton lesionado',
      'peatón lesionado en accidente de transporte (V01-V09)', 'vehiculos_v20', TRANSPORTE],
    [/\b(bicicletas?|ciclistas?|bicycles?|cyclists?)\b|\bv1[0-9]\b/, 'ciclista lesionado',
      'ciclista lesionado en accidente de transporte (V10-V19)', 'vehiculos_v20', TRANSPORTE],
    [/\bv(3[0-9]|8[0-9]|9[0-9])\b/, 'otro accidente de transporte',
      'accidentes de transporte fuera de V20-V29 y V40-V79', 'vehiculos_v20'],
  ];

  /** El subtipo ajeno que nombra la consulta (normalizada): `{ termino, nombre, release }`, o null. */
  function subtipoAjeno(qn) {
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    const hit = SUBTIPOS_AJENOS.find(([re, , , , ctx]) => re.test(canon) && (!ctx || ctx.test(canon)));
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
    { release: 'otitis_h65', generico: /\b(otitis|h65)\b/,
      especifico: new RegExp(`\\botitis media aguda\\b|\\bacute otitis media\\b|${subcodigo('h65', '01').source}`),
      abarca: '«Otitis» abarca varias categorías con código propio: la externa (H60), la media crónica (H65.2-H65.9) y la supurativa (H66).' },
    { release: 'amebiasis_a06', generico: /\b(amebiasis|amibiasis|amoebiasis|a06)\b/,
      especifico: new RegExp(`\\b(amebiasis|amibiasis|amoebiasis) intestinal\\b|\\bintestinal (amebiasis|amoebiasis)\\b|\\bdisenteria amebiana\\b|\\bamebic dysentery\\b|${subcodigo('a06', '0-39').source}`),
      abarca: '«Amebiasis» incluye formas fuera del intestino: el absceso hepático amebiano (A06.4) y otras amebiasis extraintestinales (A06.5-A06.8).' },
  ];

  /** Aclaración ante un nombre genérico que no basta para elegir el bloque publicado, o null. */
  function aliasAmbiguo(qn) {
    const canon = canonClinico(String(qn).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' '));
    if (subtipoAjeno(qn)) return null;
    const hit = ALIAS_AMBIGUOS.find((a) => a.generico.test(canon) && !a.especifico.test(canon));
    if (!hit) return null;
    const r = releases.find((x) => x.id === hit.release);
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
    const directa = noModeladas.find((e) => q.includes(e.endsWith(' ') ? ` ${e}` : ` ${e.trim()}`));
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
    if (CRISIS_ES.test(qn)) return CRISIS_TEXTO_ES;
    return CRISIS_EN.test(qn) ? CRISIS_TEXTO_EN : null;
  }

  g.EPI_CATALOGO = Object.freeze({
    releases, diabetesEnConsulta, conDiabetesNombrada, canonClinico, nombraAlias, noModeladas,
    mencionaNoModelada, conHipertensionNombrada, respuestaCrisis, subtipoAjeno, aliasAmbiguo,
  });
})(globalThis);
