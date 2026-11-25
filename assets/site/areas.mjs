/**
 * areas.mjs — áreas clínicas de los padecimientos publicados (24-nov-2026, mesa de expertos sobre UX e iconografía).
 *
 * Sustituye la agrupación mínima del catálogo («Otros padecimientos» juntaba 131 de 152) por 20 áreas clínicas para
 * filtrar y hojear. Cada área tiene un icono del sprite assets/site/icons.svg. Los temas sensibles (lesiones
 * autoinfligidas, violencia) sólo llevan el icono neutro de su área, nunca uno propio. La asignación es explícita por id:
 * tests/areas.test.mjs exige que cada padecimiento del catálogo tenga exactamente un área.
 */
export const AREAS = Object.freeze([
  { id: 'respiratorias', nombre: 'Respiratorias', icono: 'i-area-respiratorias' },
  { id: 'tuberculosis', nombre: 'Tuberculosis y micobacterias', icono: 'i-area-tuberculosis' },
  { id: 'intestinales', nombre: 'Intestinales y por alimentos', icono: 'i-area-intestinales' },
  { id: 'parasitosis', nombre: 'Parasitosis por helmintos', icono: 'i-area-parasitosis' },
  { id: 'hepaticas', nombre: 'Hígado y hepatitis', icono: 'i-area-hepaticas' },
  { id: 'vectores', nombre: 'Vectores y zoonosis', icono: 'i-area-vectores' },
  { id: 'prevenibles', nombre: 'Prevenibles por vacunación y exantemáticas', icono: 'i-area-prevenibles' },
  { id: 'invasivas', nombre: 'Infecciones invasivas y meníngeas', icono: 'i-area-invasivas' },
  { id: 'piel', nombre: 'Piel, ojos, oídos y boca', icono: 'i-area-piel' },
  { id: 'sexual', nombre: 'Salud sexual y VIH', icono: 'i-area-sexual' },
  { id: 'materno', nombre: 'Embarazo y congénitas', icono: 'i-area-materno' },
  { id: 'cardio', nombre: 'Cardiovasculares', icono: 'i-area-cardio' },
  { id: 'metabolicas', nombre: 'Metabólicas y nutrición', icono: 'i-area-metabolicas' },
  { id: 'cancer', nombre: 'Tumores malignos y displasias', icono: 'i-area-cancer' },
  { id: 'mental', nombre: 'Salud mental y neurología', icono: 'i-area-mental' },
  { id: 'digestivas', nombre: 'Digestivas y urinarias', icono: 'i-area-digestivas' },
  { id: 'accidentes', nombre: 'Accidentes y quemaduras', icono: 'i-area-accidentes' },
  { id: 'apoyo', nombre: 'Lesiones autoinfligidas y violencia', icono: 'i-area-apoyo' },
  { id: 'ponzonosos', nombre: 'Picaduras y mordeduras', icono: 'i-area-ponzonosos' },
  { id: 'ambientales', nombre: 'Intoxicaciones y ambiente', icono: 'i-area-ambientales' },
]);

const IDS = {
  respiratorias: 'ira_j00 neumonias_j12 asma_j45 faringitis_j02 coqueluchoide_u99',
  tuberculosis: 'tuberculosis_respiratoria_a15 tuberculosis_otras_formas_a171 meningitis_tuberculosa_a170 lepra_a30',
  intestinales: 'intestinales_a04 rotavirus_a080 salmonelosis_a02 shigelosis_a03 tifoidea_a01 paratifoidea_a011 alimentaria_a05 amebiasis_a06 absceso_hepatico_a064 giardiasis_a071 protozoarios_a07',
  parasitosis: 'ascariasis_b77 enterobiasis_b80 helmintiasis_b65 teniasis_b68 cisticercosis_b69 triquinosis_b75',
  hepaticas: 'hepatitis_a_b15 hepatitis_b_b16 hepatitis_c_b17 otras_hepatitis_b17 alcoholica_higado_k70 cirrosis_alcoholica_k703',
  vectores: 'dengue chikungunya_a920 paludismo_vivax_b51 chagas_aguda_b570 chagas_cronica_b572 leishmaniasis_cutanea_b551 fiebre_manchada_a770 otras_rickettsiosis_a79 tifo_murino_a752 brucelosis_a23 leptospirosis_a27 toxoplasmosis_b58',
  prevenibles: 'varicela_b01 parotiditis_b26 tos_ferina_a37 escarlatina_a38 tetanos_a34 viruela_simica_b04 paralisis_flacida_u98 esavi_y58',
  invasivas: 'sindrome_meningeo_g00 meningococica_a39 neumococo_a40 haemophilus_a41 iaas_sc',
  piel: 'escabiosis_b86 erisipela_a46 mal_del_pinto_a67 conjuntivitis_h10 conjuntivitis_hemorragica_b303 tracoma_a71 otitis_h65 gingivitis_k05',
  sexual: 'sifilis_adquirida_a51 chancro_blando_a57 gonococica_a54 herpes_genital_a600 linfogranuloma_a55 tricomoniasis_a590 candidiasis_b37 vph_b97 vulvovaginitis_n76 vih_b20',
  materno: 'embarazo_diabetes_o24 embarazo_hipertensivos_o10 sifilis_congenita_a50 anencefalia_q00 encefalocele_q01 espina_bifida_q05 microcefalia_q02 labio_paladar_q35',
  cardio: 'hipertension_i10 isquemica_i20 cerebrovascular_i60 reumatica_i00 ivp_i87',
  metabolicas: 'diabetes_t1 diabetes_t2 obesidad desnutricion_leve_e441 desnutricion_moderada_e440 desnutricion_severa_e40 bocio_e01',
  cancer: 'cancer_colon_c18 cancer_cuello_utero_c53 cancer_cuerpo_utero_c54 cancer_encefalo_c70 cancer_esofago_c15 cancer_estomago_c16 cancer_higado_c22 cancer_huesos_c40 cancer_mama_c50 cancer_ovario_c56 cancer_pancreas_c26 cancer_prostata_c61 cancer_pulmon_c33 cancer_rinon_c64 leucemia_c91 linfoma_hodgkin_c81 linfoma_no_hodgkin_c82 displasia_leve_n87 displasia_severa_n87',
  mental: 'depresion parkinson alzheimer anorexia_f50',
  digestivas: 'ulceras_k25 ivu_n39 hiperplasia_prostata_n40',
  accidentes: 'peaton_v01 vehiculos_v20 quemaduras_t20',
  apoyo: 'ahorcamiento_x70 disparo_arma_corta_x72 objeto_cortante_x78 salto_lugar_elevado_x80 envenenamiento_analgesicos_x60 envenenamiento_psicotropicos_x61 ideacion_suicida_r458 intento_suicidio_z915 violencia_intrafamiliar_y07 herida_arma_fuego_w32',
  ponzonosos: 'abeja_u604 avispa_u605 alacran_t63 mordedura_cascabel_u600 mordedura_coral_u601 mordedura_otras_serpientes_t630 otras_aranas_t633 viuda_negra_u602 violinista_u603 otros_artropodos_t634 otros_ponzonosos_t631 mordedura_perro_w54 mordedura_mamiferos_w55',
  ambientales: 'intox_alcohol_f100 monoxido_t58 plaguicidas_t60 calor_t67 hipotermia_t68',
};

/** Área clínica de un id publicado ({ id, nombre, icono }), o null si no está asignado. */
const POR_ID = new Map();
for (const a of AREAS) for (const id of IDS[a.id].split(' ')) POR_ID.set(id, a);
export const areaDe = (id) => POR_ID.get(id) ?? null;
export const idsDeArea = (area) => (IDS[area] ? IDS[area].split(' ') : []);
