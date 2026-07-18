// ─── RETRO SOUND FX SYNTHESIZER (WEB AUDIO API) ──────────

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return new AudioContextClass();
}

/**
 * Classic MSN Messenger incoming chat ding.
 */
function playMSNPing() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Lower tone followed instantly by higher tone
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    setTimeout(() => {
      try { osc.stop(); } catch(e) {}
    }, 400);
  } catch (err) {
    console.warn('AudioContext blocked or failed:', err);
  }
}

/**
 * Classic MSN Messenger message sent whoosh.
 */
function playMSNSend() {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.25; // 0.25s duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1; // White noise
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch (err) {
    console.warn('AudioContext blocked or failed:', err);
  }
}

/**
 * BSNL / MTNL Dial-Up Connecting sound sequence (dial tone, beeps, static).
 */
function playDialUpSequence() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 1. Play Dial Tone (dual frequency sine waves, 350Hz + 440Hz)
    const oscDial1 = ctx.createOscillator();
    const oscDial2 = ctx.createOscillator();
    const dialGain = ctx.createGain();
    
    oscDial1.frequency.setValueAtTime(350, now);
    oscDial2.frequency.setValueAtTime(440, now);
    dialGain.gain.setValueAtTime(0.08, now);
    dialGain.gain.linearRampToValueAtTime(0, now + 0.6); // Fade dialtone

    oscDial1.connect(dialGain);
    oscDial2.connect(dialGain);
    dialGain.connect(ctx.destination);
    
    oscDial1.start(now);
    oscDial2.start(now);
    oscDial1.stop(now + 0.6);
    oscDial2.stop(now + 0.6);

    // 2. Play 3 quick T9 dial beeps (700Hz + 1200Hz) at 0.7s, 0.9s, 1.1s
    const beepTimes = [0.7, 0.95, 1.2];
    const frequencies = [941, 1336, 1209]; // Classic DTMF tones
    
    beepTimes.forEach((time, index) => {
      const oscB1 = ctx.createOscillator();
      const oscB2 = ctx.createOscillator();
      const bGain = ctx.createGain();

      oscB1.frequency.setValueAtTime(frequencies[index % 3], now + time);
      oscB2.frequency.setValueAtTime(697, now + time);
      bGain.gain.setValueAtTime(0.06, now + time);
      bGain.gain.setValueAtTime(0, now + time + 0.15); // Short beep

      oscB1.connect(bGain);
      oscB2.connect(bGain);
      bGain.connect(ctx.destination);

      oscB1.start(now + time);
      oscB2.start(now + time);
      oscB1.stop(now + time + 0.15);
      oscB2.stop(now + time + 0.15);
    });

    // 3. Play screechy handshake static (White noise modulated by lowpass)
    const bufferSize = ctx.sampleRate * 0.8; // 0.8s static
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, now + 1.4);
    filter.frequency.linearRampToValueAtTime(300, now + 2.2);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.setValueAtTime(0.04, now + 1.4);
    noiseGain.gain.linearRampToValueAtTime(0.001, now + 2.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now + 1.4);
    noise.stop(now + 2.2);

  } catch (err) {
    console.warn('AudioContext failed:', err);
  }
}

/**
 * Ascending warm major 7th startup chord inspired by early operating systems.
 */
function playStartupChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // C major 7 notes: C4 (261.63), E4 (329.63), G4 (392.00), B4 (493.88), C5 (523.25)
    const notes = [261.63, 329.63, 392.00, 493.88, 523.25];
    const delays = [0, 0.15, 0.30, 0.45, 0.60];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Warm triangle wave filtered down
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delays[i]);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now + delays[i]);
      filter.frequency.exponentialRampToValueAtTime(200, now + delays[i] + 1.8);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.06, now + delays[i]);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delays[i] + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delays[i]);
      osc.stop(now + delays[i] + 1.9);
    });
  } catch (err) {
    console.warn('AudioContext failed:', err);
  }
}

/**
 * Short burst of screechy static noise simulating channel tuning.
 */
function playGlitchSound() {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.35; // 0.35s duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1; // White noise
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch (err) {
    console.warn('AudioContext failed:', err);
  }
}

