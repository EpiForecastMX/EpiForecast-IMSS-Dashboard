/**
 * voice.js - Entrada y salida por voz para EpiForecast-MX.
 *
 * STT: Web Speech API (SpeechRecognition) - es-MX
 * TTS: Web Speech Synthesis API - es-MX, seleccion inteligente de voz
 */

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

export const STT_SUPPORTED = !!SpeechRecognition;
export const TTS_SUPPORTED = !!synth;

// ---------------------------------------------------------------------------
// Speech-to-Text (microphone input)
// ---------------------------------------------------------------------------

let recognition = null;
let listening = false;
let micBtn = null;

/**
 * Initialise the mic button and wire it to the input field.
 * @param {HTMLElement} btn - The mic toggle button
 * @param {HTMLInputElement} inputField - The text input
 * @param {Function} onResult - Called with the transcript (triggers send)
 */
export function initSTT(btn, inputField, onResult) {
  if (!STT_SUPPORTED) { btn.style.display = 'none'; return; }

  micBtn = btn;
  placeholderOriginal = inputField.placeholder;
  let sent = false; // guard: only fire onResult once per session

  recognition = new SpeechRecognition();
  recognition.lang = 'es-MX';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
    sent = false;
    micBtn.classList.add('mic-active');
    inputField.placeholder = 'Escuchando...';
  };

  recognition.onresult = (event) => {
    recibido = true;
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    // Show interim in input as visual feedback
    inputField.value = final || interim;
    if (final && !sent) {
      sent = true;
      stopSTT(inputField);
      // Mesa agéntica, fase 2: si el navegador duda de lo que oyó, no se envía solo; se deja para revisar.
      const conf = event.results[event.results.length - 1][0].confidence;
      if (conf > 0 && conf < UMBRAL_DUDA) { avisaDuda(inputField); return; }
      onResult(final.trim());
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      console.warn('SpeechRecognition error:', event.error);
    }
    // Mesa de la plataforma (25-nov-2026): un error o un permiso negado nunca borra lo que la persona ya había escrito.
    if (!recibido) inputField.value = borrador;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      micBtn.title = 'El micrófono no está disponible en este navegador o en este sitio';
      micBtn.setAttribute('aria-disabled', 'true');
    }
    stopSTT(inputField);
  };

  // Safari: isFinal may never be true. When recognition ends,
  // send whatever text is in the input field.
  recognition.onend = () => {
    // Sólo se envía lo dictado, nunca un borrador escrito antes de pulsar el micrófono.
    if (!recibido) {
      if (inputField.value !== borrador) inputField.value = borrador;
      if (listening) stopSTT(inputField);
      return;
    }
    if (!sent && inputField.value.trim()) {
      sent = true;
      const text = inputField.value.trim();
      stopSTT(inputField);
      onResult(text);
    } else if (listening) {
      stopSTT(inputField);
    }
  };

  btn.addEventListener('click', () => {
    // El toque del micrófono interrumpe la lectura en curso y, en ese mismo gesto, habilita la voz en iPhone.
    stopSpeaking();
    desbloqueaVoz();
    if (listening) stopSTT(inputField);
    else startSTT(inputField);
  });
  inputField.addEventListener('input', () => quitaDuda(inputField));
}

function startSTT(inputField) {
  if (!recognition || listening) return;
  borrador = inputField.value;
  recibido = false;
  try {
    recognition.start();
  } catch (_) { inputField.value = borrador; /* already started */ }
}

const UMBRAL_DUDA = 0.55;
let borrador = '';
let recibido = false;
let placeholderOriginal = '';
function avisaDuda(inputField) {
  quitaDuda(inputField);
  const p = document.createElement('p');
  p.className = 'voz-duda';
  p.setAttribute('role', 'status');
  p.textContent = 'No estoy seguro de haber entendido. Revisa el texto y pulsa Enviar.';
  inputField.closest('.input-wrapper')?.after(p);
  inputField.focus();
}
function quitaDuda(inputField) {
  inputField?.closest('.input-bar')?.querySelectorAll('.voz-duda').forEach((x) => x.remove());
}

function stopSTT(inputField) {
  listening = false;
  if (micBtn) micBtn.classList.remove('mic-active');
  if (inputField) inputField.placeholder = placeholderOriginal || inputField.placeholder;
  try { recognition.stop(); } catch (_) { /* not started */ }
}

// ---------------------------------------------------------------------------
// Text-to-Speech (bot reads response aloud)
// ---------------------------------------------------------------------------

let preferredVoice = null;
let voiceReady = false;
// Preferencia de silencio persistida entre sesiones (localStorage).
const TTS_MUTE_KEY = 'epibot_tts_muted';
let ttsEnabled = true;
try { ttsEnabled = localStorage.getItem(TTS_MUTE_KEY) !== '1'; } catch (_) { /* storage bloqueado */ }
let ttsSpeaking = false;
let lastSpokenFromVoice = false;
let currentUtterance = null;

/** Mark that the current query came from voice input (auto-speak response). */
export function setVoiceQuery(isVoice) { lastSpokenFromVoice = isVoice; }
export function wasVoiceQuery() { return lastSpokenFromVoice; }

// ---------------------------------------------------------------------------
// Intelligent voice selection
// ---------------------------------------------------------------------------

/** Score a voice for quality — higher = better. */
function scoreVoice(v) {
  const name = v.name.toLowerCase();
  let score = 0;

  // Language match
  if (v.lang === 'es-MX') score += 100;
  else if (v.lang.startsWith('es')) score += 50;
  else return 0; // not Spanish

  // Google cloud voices are the most natural-sounding
  if (name.includes('google')) score += 80;

  // Microsoft Online voices (Edge) are also good
  if (name.includes('online') || name.includes('natural')) score += 70;

  // macOS premium voices
  if (name.includes('paulina')) score += 60;
  if (name.includes('monica') || name.includes('mónica')) score += 55;

  // Prefer non-novelty voices (Eddy, Flo, Rocko, etc. are robotic)
  const novelty = ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'];
  if (novelty.some(n => name.includes(n))) score -= 30;

  // Prefer female voices for assistant personality
  if (name.includes('female') || name.includes('mujer')) score += 5;

  return score;
}

function loadVoice() {
  if (!TTS_SUPPORTED) return;
  const voices = synth.getVoices();
  if (!voices.length) return;

  // Log all Spanish voices for debugging
  const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
  console.info('TTS voces disponibles (es*):', spanishVoices.map(v => `${v.name} [${v.lang}]`).join(', '));

  // Score all voices and pick the best
  const scored = voices
    .map(v => ({ voice: v, score: scoreVoice(v) }))
    .filter(v => v.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) {
    preferredVoice = scored[0].voice;
    console.info(`TTS voz seleccionada: "${preferredVoice.name}" (${preferredVoice.lang}, score: ${scored[0].score})`);
  }
  voiceReady = true;
}

/** Ensure a voice is loaded before speaking. Returns the best available voice. */
function ensureVoice() {
  if (preferredVoice) return preferredVoice;
  // Voices might have loaded since init — retry
  loadVoice();
  if (preferredVoice) return preferredVoice;
  // Last resort: grab any es-MX or es voice directly
  const voices = synth.getVoices();
  const fallback = voices.find(v => v.lang === 'es-MX')
    || voices.find(v => v.lang === 'es-ES')
    || voices.find(v => v.lang.startsWith('es'));
  if (fallback) {
    preferredVoice = fallback;
    console.info(`TTS fallback voz: "${fallback.name}" (${fallback.lang})`);
  }
  return preferredVoice;
}

if (TTS_SUPPORTED) {
  loadVoice();
  synth.addEventListener('voiceschanged', loadVoice);
  setTimeout(loadVoice, 300);
  setTimeout(loadVoice, 1000);
}

// ---------------------------------------------------------------------------
// Clean text for TTS
// ---------------------------------------------------------------------------

function cleanForTTS(md) {
  return md
    .replace(/<!--.*?-->/gs, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Plan canónico 2.7: las cursivas con guion bajo (`_nota_`) se leían «guion bajo».
    .replace(/(^|[\s(«"])_([^_\n]+)_(?=$|[\s.,;:)»"])/gm, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+·\s+/g, ', ')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/^\s*[-*]\s+/gm, ', ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/([.:;?!])\s*[.,]+/g, '$1')
    .replace(/^[\s.,]+|[\s,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Speak / Stop
// ---------------------------------------------------------------------------

/** Callbacks for UI updates when speech starts/stops. */
let onSpeakingChange = null;

/** Register a callback for speaking state changes. */
export function onSpeakingStateChange(cb) { onSpeakingChange = cb; }

function setSpeaking(val) {
  ttsSpeaking = val;
  if (onSpeakingChange) onSpeakingChange(val);
}

/**
 * Speak a markdown text aloud.
 * @param {string} markdown - The bot response in markdown
 * @param {HTMLElement} [speakerBtn] - Optional button to toggle animation
 */
/** Recorta en la última oración completa antes de `max` caracteres. */
function hastaOracion(texto, max) {
  if (texto.length <= max) return { texto, cortado: false };
  const corte = texto.slice(0, max);
  const fin = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('? '));
  return { texto: fin > max / 4 ? corte.slice(0, fin + 1) : `${corte.replace(/\s+\S*$/, '')}…`, cortado: true };
}

/** La frase que trae el 911 (síntomas de alarma, crisis): nunca se omite al hablar. */
function frase911(md) {
  const linea = String(md).split('\n').find((l) => /\b911\b/.test(l));
  if (!linea) return '';
  const t = cleanForTTS(linea).replace(/^[,\s]+/, '');
  const f = t.split(/(?<=[.?!])\s+/).find((x) => /\b911\b/.test(x)) || t;
  return /[.?!]$/.test(f) ? f : `${f}.`;
}

const TABLA = /^\s*\|.*\|\s*$/m;
/** Una cifra que se dice: casos, porcentaje o un número entre paréntesis (no basta «4 semanas» ni el año). */
export const CIFRA = /\d[\d,.]*\s*(casos?|%)|\(\d[\d,.]*\)|:\s*\d[\d,.]*\b(?!\s*de\s+\w+\s+de\s+\d{4})/;
/** Notas del principio que no son la respuesta: cursivas (alias, lugar) o la interpretación del término («Tomo…», «Por…»). */
const esNota = (p) => p.split('\n').every((l) => /^\s*_.*_\s*$/.test(l)) || /^\s*(Tomo|Por) «/.test(p);

/**
 * Lo que se dice en voz alta. Tras una pregunta por voz, sólo el veredicto: lo que va antes de la primera lista, sin las notas
 * en cursiva del principio (alias, lugar) y, si no trae ninguna cifra, con la primera viñeta. Con el botón de escuchar, la
 * respuesta completa hasta 1,500 caracteres. En ambos casos se corta en una oración entera, se conserva siempre la frase del
 * 911 y se avisa si hay una tabla en pantalla (plan canónico 2.7).
 */
export function textoHablado(markdown, completo = false) {
  // Plan canónico 2.5, escalón 2: una ficha de cita trae su propio texto para la voz (rótulo, cita completa y 911).
  const voz = String(markdown).match(/<!--VOZ:([\s\S]*?)-->/);
  if (voz) {
    const r = hastaOracion(voz[1].trim(), completo ? 1500 : 900);
    return `${r.texto}${r.cortado ? ' El resto está en pantalla.' : ''}`;
  }
  const md = String(markdown).split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');
  const tabla = TABLA.test(md);
  const cierre = (texto, cortado) => {
    const ayuda = /\b911\b/.test(md) && !/\b911\b/.test(texto) ? ` ${frase911(md)}` : '';
    const aviso = tabla ? ' La tabla y el detalle están en pantalla.' : (cortado ? ` ${completo ? 'El resto' : 'El detalle'} está en pantalla.` : '');
    return `${texto}${ayuda}${aviso}`;
  };
  const todo = cleanForTTS(md);
  if (completo) {
    const r = hastaOracion(todo, 1500);
    return cierre(r.texto, r.cortado);
  }
  const parrafos = md.split(/\n\s*\n/).filter((x) => x.trim());
  let i = 0;
  while (i < parrafos.length - 1 && esNota(parrafos[i])) i++;
  const resto = parrafos.slice(i).join('\n\n');
  let veredicto = cleanForTTS(resto.split(/\n\s*[-*] /)[0]);
  // Sin cifra de casos, o si es sólo un título o termina en «:», se completa con la primera viñeta.
  if (!CIFRA.test(veredicto) || /:$/.test(veredicto) || !/[.?!]$/.test(veredicto)) {
    const item = resto.match(/\n\s*[-*] (.+)/);
    const unir = /[.?!]$/.test(veredicto) ? `${veredicto} ` : `${veredicto.replace(/[\s:.,]*$/, ':')} `;
    if (item) veredicto = `${unir}${cleanForTTS(item[1]).replace(/[^.?!]$/, '$&.')}`;
  }
  // Los paréntesis largos sin cifra (fuente, fecha de corte) se quedan en pantalla: la voz va al dato.
  veredicto = veredicto.replace(/\s*\(([^()]{40,})\)/g, (m, dentro) => (CIFRA.test(dentro) ? m : ''));
  const base = veredicto.length >= 40 ? veredicto : todo;
  const r = hastaOracion(base, 320);
  return cierre(r.texto, r.cortado || base !== todo);
}

let vozDesbloqueada = false;
/** iOS sólo deja hablar si la síntesis se inició dentro de un gesto: una frase muda en el toque la habilita. */
export function desbloqueaVoz() {
  if (!TTS_SUPPORTED || vozDesbloqueada) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
    vozDesbloqueada = true;
  } catch (_) { /* sin síntesis */ }
}

export function speak(markdown, speakerBtn, { completo = false } = {}) {
  if (!TTS_SUPPORTED || !ttsEnabled) return;

  synth.cancel();

  const text = textoHablado(markdown, completo);
  if (!text) return;

  // Ensure we have a Spanish voice — never speak in English
  const voice = ensureVoice();
  if (!voice) {
    console.warn('TTS: no se encontro voz en espanol, omitiendo lectura');
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = voice;
  utter.lang = voice.lang; // match the voice's actual lang tag

  // Tune for naturalness depending on voice type
  const name = voice.name.toLowerCase();
  if (name.includes('google')) {
    utter.rate = 0.95;
    utter.pitch = 1.0;
  } else if (name.includes('paulina') || name.includes('monica') || name.includes('mónica')) {
    utter.rate = 0.92;
    utter.pitch = 1.05;
  } else {
    utter.rate = 0.9;
    utter.pitch = 1.02;
  }

  currentUtterance = utter;

  // Chrome bug: long utterances get cut off. Workaround: keep-alive timer.
  let resumeTimer = null;
  utter.onstart = () => {
    setSpeaking(true);
    if (speakerBtn) speakerBtn.classList.add('tts-speaking');
    // Chrome pauses after ~15s; this resumes it
    resumeTimer = setInterval(() => {
      if (synth.speaking && !synth.pending) synth.resume();
    }, 10000);
  };
  const cleanup = () => {
    setSpeaking(false);
    currentUtterance = null;
    if (speakerBtn) speakerBtn.classList.remove('tts-speaking');
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
  };
  utter.onend = cleanup;
  utter.onerror = cleanup;

  synth.speak(utter);
}

/** Stop any ongoing speech. */
export function stopSpeaking() {
  if (TTS_SUPPORTED) synth.cancel();
  setSpeaking(false);
  currentUtterance = null;
}

export function isSpeaking() { return ttsSpeaking; }

// ---------------------------------------------------------------------------
// Mute toggle
// ---------------------------------------------------------------------------

/** Toggle TTS on/off globally. Persists the choice. Returns new state. */
export function toggleMute() {
  ttsEnabled = !ttsEnabled;
  if (!ttsEnabled) stopSpeaking();
  try { localStorage.setItem(TTS_MUTE_KEY, ttsEnabled ? '0' : '1'); } catch (_) { /* storage bloqueado */ }
  return ttsEnabled;
}

export function isTTSEnabled() { return ttsEnabled; }
