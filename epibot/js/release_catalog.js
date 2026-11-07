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
 * `prefijos` solo los usa el detector de rag.mjs, que compara por subcadena.
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
      alias: ['hipertension', 'hipertension arterial', 'presion alta', 'presion arterial alta',
        'tension alta', 'hipertensos', 'i10', 'hypertension', 'high blood pressure'],
      prefijos: ['hipertens', 'hypertens', 'presion alta', 'presion arterial alta', 'tension alta'],
    },
    {
      id: 'isquemica_i20', pad: 'Enfermedad isquémica del corazón',
      nombre: 'Enfermedad isquémica del corazón', nombreCorto: 'Isquémica',
      etiqueta: 'Enfermedad isquémica del corazón (I20, I25)', dataKey: 'isquemica_i20',
      marca: 'ISQUEMICA_I20', pagina: 'isquemica_i20.html', consulta: 'enfermedad isquemica',
      cie: 'I20, I25', color: '#FB923C',
      alias: ['enfermedad isquemica', 'cardiopatia isquemica', 'isquemia cardiaca', 'angina de pecho',
        'i20', 'ischemic heart disease', 'coronary heart disease'],
      prefijos: ['isquemi', 'ischemic heart', 'coronary heart', 'angina de pecho'],
    },
    {
      id: 'cerebrovascular_i60', pad: 'Enfermedad cerebrovascular',
      nombre: 'Enfermedad cerebrovascular', nombreCorto: 'Cerebrovascular',
      etiqueta: 'Enfermedad cerebrovascular (I60-I67, I69)', dataKey: 'cerebrovascular_i60',
      marca: 'CEREBROVASCULAR_I60', pagina: 'cerebrovascular_i60.html',
      consulta: 'enfermedad cerebrovascular', cie: 'I60-I67, I69', color: '#FBBF24',
      alias: ['cerebrovascular', 'enfermedad cerebrovascular', 'derrame cerebral', 'evc', 'acv',
        'i60', 'stroke', 'cerebrovascular disease'],
      prefijos: ['cerebrovasc', 'derrame cerebral', 'stroke'],
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

  g.EPI_CATALOGO = Object.freeze({ releases, diabetesEnConsulta, conDiabetesNombrada });
})(globalThis);
