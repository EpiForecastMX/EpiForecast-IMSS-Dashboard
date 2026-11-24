// Nombres visibles de las categorías del boletín: sólo presentación. Los datos (data.json, el histórico y las
// descargas) conservan el nombre tal como lo imprime el boletín; la ficha lo muestra aparte cuando difiere.
// Se corrigen erratas («Hodking», «transtornos», «traquea»), marcas de nota del cuadro («Lepra°», «^Miasis»,
// «***»), espacios dobles, mayúsculas de título y los rótulos históricos que la extracción leyó revueltos.

const INFECCION_ASOCIADA = 'Infección asociada a la atención de la salud';

/** Correcciones por identidad (estable entre boletines). */
export const CORRECCIONES = Object.freeze({
  p23b2: 'COVID-19',
  p25b1: 'Linfogranuloma venéreo por clamidias',
  p30b1: 'Otras rickettsiosis',
  p31b1: 'Dengue no grave',
  p49b2: 'Enfermedad isquémica del corazón',
  p51b1: 'Úlceras, gastritis y duodenitis',
  p52b2: 'Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio',
  p62b2: 'Displasia cervical severa y cáncer cervicouterino in situ',
  p64b1: 'Tumor maligno de tráquea, bronquios y pulmón',
  p65b2: 'Linfoma de Hodgkin',
  p65b3: 'Linfoma no Hodgkin',
  p67b1: 'Tumores malignos del encéfalo y otras partes del sistema nervioso central',
  p73b1: 'Historia personal de lesión autoinfligida intencionalmente (intento de suicidio)',
  p73b2: 'Otros síntomas y signos que involucran el estado emocional (ideación suicida)',
  p76b2: 'Mordedura por serpiente coral',
  // Clasificaciones históricas: mayúsculas de título y rótulos revueltos por la extracción.
  'historical-dengue-a90-no-grave': 'Dengue no grave',
  'historical-dengue-a91-alarma-grave': 'Dengue con signos de alarma y dengue grave',
  'historical-dengue-alarma-sc': 'Dengue con signos de alarma',
  'historical-dengue-a91-grave': 'Dengue grave',
  'historical-ad114359911c': 'Fiebre por dengue',
  'historical-6d15c7ebf2c0': 'Fiebre hemorrágica por dengue',
  'historical-123e6bada488': 'Influenza estacional',
  'historical-a044b8c3c5ff': 'Enfermedad febril exantemática',
  'historical-0f83a9a53fac': 'Parálisis flácida aguda',
  'historical-51908bd8eefe': 'Parálisis flácida aguda en menores de 15 años',
  'historical-730ec3321214': 'Paratifoidea y otras salmonelosis',
  'historical-7deb8ebb1ca4': 'Infección intestinal por otros organismos y las mal definidas',
  'historical-dd7507146b52': 'Neumonías y bronconeumonías',
  'historical-6366ab495c8d': 'Neumonías y bronconeumonías',
  'historical-2ca61f83c518': 'Infección asintomática por VIH',
  'historical-84fec161d95f': 'Intoxicación por animales venenosos',
  'historical-1e2f33d2fbac': 'Mordeduras por serpiente',
  'historical-05da5f7c3ed1': 'Mordeduras por serpiente',
  'historical-2af2ca166756': 'Otras helmintiasis',
  'historical-7ebf35776da7': 'Infecciones respiratorias agudas',
  'historical-89ccccf7b8a2': 'Virus del papiloma humano',
  'historical-a165ca2a40fb': 'Intoxicación aguda por alcohol',
  'historical-efd86544ff98': 'Enfermedad alcohólica del hígado',
  'historical-dbc4a0961dd3': 'Displasia cervical severa y cáncer cervicouterino in situ',
  'historical-da11d391f4ba': 'Enfermedades infecciosas intestinales',
  'historical-9e3c371dbf32': 'Vulvovaginitis inespecífica',
  'historical-43bc1dd8024f': 'Otras rickettsiosis',
  'historical-ab2345c3f77c': 'Otras hepatitis víricas',
  'historical-e085ca24bf4f': 'Afección nosocomial',
  'historical-2c97a90e2907': 'Síndrome febril',
  'historical-500f9284c815': 'Efectos del calor y de la luz',
  'historical-9fe429d016b3': 'Intoxicación por ponzoña de animales',
  'historical-240974384036': 'Intoxicación por ponzoña de animales',
  'historical-617c46de37bb': 'Contacto traumático con avispas, avispones y abejas',
  'historical-ae0eb9b849f8': 'Enfermedad por virus Zika',
  'historical-sida-estadios-2020': 'Síndrome de inmunodeficiencia adquirida (por estadios)',
  'historical-009da2c66e70': INFECCION_ASOCIADA,
  'historical-d9f3d7ec70ed': INFECCION_ASOCIADA,
  'historical-7d31b6c064a9': INFECCION_ASOCIADA,
  'historical-e6f93c33520b': INFECCION_ASOCIADA,
  'historical-6a8ae1adc74a': INFECCION_ASOCIADA,
  'historical-cb68f248d9c7': INFECCION_ASOCIADA,
  'historical-557b5b330aeb': INFECCION_ASOCIADA,
  'historical-996bae91353f': INFECCION_ASOCIADA,
  'historical-f6e961063eaf': INFECCION_ASOCIADA,
});

/** Limpieza general: marcas de nota del cuadro al inicio o al final y espacios dobles. */
export function limpia(nombre) {
  return String(nombre ?? '').replace(/^[\^•]+/, '').replace(/[°*]+\s*$/, '').replace(/\s+/g, ' ').trim();
}

/** Nombre que se muestra para una categoría. */
export function nombreVisible(id, impreso) {
  return CORRECCIONES[id] ?? limpia(impreso);
}

/** ¿El nombre visible difiere del impreso más allá de los espacios? (la ficha muestra el impreso). */
export function corregido(id, impreso) {
  return nombreVisible(id, impreso) !== String(impreso ?? '').replace(/\s+/g, ' ').trim();
}
