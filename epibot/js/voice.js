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
      onResult(final.trim());
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      console.warn('SpeechRecognition error:', event.error);
    }
    stopSTT(inputField);
  };

  // Safari: isFinal may never be true. When recognition ends,
  // send whatever text is in the input field.
  recognition.onend = () => {
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
    if (listening) stopSTT(inputField);
    else startSTT(inputField);
  });
}

function startSTT(inputField) {
  if (!recognition || listening) return;
  try {
    inputField.value = '';
    recognition.start();
  } catch (_) { /* already started */ }
}

function stopSTT(inputField) {
  listening = false;
  if (micBtn) micBtn.classList.remove('mic-active');
  if (inputField) inputField.placeholder = 'Escribe o habla tu pregunta...';
  try { recognition.stop(); } catch (_) { /* not started */ }
}

// ---------------------------------------------------------------------------
// Text-to-Speech (bot reads response aloud)
// ---------------------------------------------------------------------------

let preferredVoice = null;
let voiceReady = false;
let ttsEnabled = true;
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
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/[-*]\s+/g, ', ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
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
export function speak(markdown, speakerBtn) {
  if (!TTS_SUPPORTED || !ttsEnabled) return;

  synth.cancel();

  const plain = cleanForTTS(markdown);
  if (!plain) return;

  const maxChars = 600;
  const text = plain.length > maxChars
    ? plain.substring(0, maxChars) + '... Consulta el texto completo en pantalla.'
    : plain;

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

  utter.onstart = () => {
    setSpeaking(true);
    if (speakerBtn) speakerBtn.classList.add('tts-speaking');
  };
  utter.onend = () => {
    setSpeaking(false);
    currentUtterance = null;
    if (speakerBtn) speakerBtn.classList.remove('tts-speaking');
  };
  utter.onerror = () => {
    setSpeaking(false);
    currentUtterance = null;
    if (speakerBtn) speakerBtn.classList.remove('tts-speaking');
  };

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

/** Toggle TTS on/off globally. Returns new state. */
export function toggleMute() {
  ttsEnabled = !ttsEnabled;
  if (!ttsEnabled) stopSpeaking();
  return ttsEnabled;
}

export function isTTSEnabled() { return ttsEnabled; }
