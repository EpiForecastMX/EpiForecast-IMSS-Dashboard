/**
 * voice.js - Entrada y salida por voz para EpiForecast-MX.
 *
 * STT: Web Speech API (SpeechRecognition) - es-MX
 * TTS: Web Speech Synthesis API - es-MX
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

  recognition = new SpeechRecognition();
  recognition.lang = 'es-MX';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
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
    if (final) {
      stopSTT(inputField);
      onResult(final.trim());
    }
  };

  recognition.onerror = (event) => {
    // 'no-speech' and 'aborted' are normal — user just didn't say anything
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      console.warn('SpeechRecognition error:', event.error);
    }
    stopSTT(inputField);
  };

  recognition.onend = () => {
    if (listening) stopSTT(inputField);
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
let lastSpokenFromVoice = false;

/** Mark that the current query came from voice input (auto-speak response). */
export function setVoiceQuery(isVoice) { lastSpokenFromVoice = isVoice; }
export function wasVoiceQuery() { return lastSpokenFromVoice; }

/**
 * Pre-load an es-MX or es voice.
 */
function loadVoice() {
  if (!TTS_SUPPORTED) return;
  const voices = synth.getVoices();
  // Prefer es-MX, fallback to any es-*
  preferredVoice = voices.find(v => v.lang === 'es-MX')
    || voices.find(v => v.lang.startsWith('es'))
    || null;
  voiceReady = true;
}

if (TTS_SUPPORTED) {
  // Voices load async in some browsers
  if (synth.getVoices().length) loadVoice();
  else synth.addEventListener('voiceschanged', loadVoice, { once: true });
}

/**
 * Strip markdown/HTML to plain text for TTS.
 */
function cleanForTTS(md) {
  return md
    .replace(/<!--.*?-->/gs, '')          // HTML comments
    .replace(/\*\*([^*]+)\*\*/g, '$1')    // bold
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/`([^`]+)`/g, '$1')          // inline code
    .replace(/#{1,6}\s*/g, '')            // headings
    .replace(/\|[^\n]+\|/g, '')           // table rows
    .replace(/[-*]\s+/g, ', ')            // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/\n{2,}/g, '. ')             // paragraphs
    .replace(/\n/g, ', ')                 // line breaks
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Speak a markdown text aloud.
 * @param {string} markdown - The bot response in markdown
 * @param {HTMLElement} [speakerBtn] - Optional button to toggle animation
 */
export function speak(markdown, speakerBtn) {
  if (!TTS_SUPPORTED || !ttsEnabled) return;

  // Cancel any ongoing speech
  synth.cancel();

  const plain = cleanForTTS(markdown);
  if (!plain) return;

  // Truncate very long responses to avoid TTS hanging
  const maxChars = 500;
  const text = plain.length > maxChars
    ? plain.substring(0, maxChars) + '... Consulta el texto completo en pantalla.'
    : plain;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-MX';
  utter.rate = 1.05;
  utter.pitch = 1.0;
  if (preferredVoice) utter.voice = preferredVoice;

  if (speakerBtn) {
    utter.onstart = () => speakerBtn.classList.add('tts-speaking');
    utter.onend = () => speakerBtn.classList.remove('tts-speaking');
    utter.onerror = () => speakerBtn.classList.remove('tts-speaking');
  }

  synth.speak(utter);
}

/** Stop any ongoing speech. */
export function stopSpeaking() {
  if (TTS_SUPPORTED) synth.cancel();
}

/** Toggle TTS on/off globally. */
export function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  if (!ttsEnabled) stopSpeaking();
  return ttsEnabled;
}

export function isTTSEnabled() { return ttsEnabled; }
