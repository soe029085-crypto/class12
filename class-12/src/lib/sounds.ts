/**
 * Web Audio API based 8-bit Sound Engine
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmInterval: any = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Pure 8-bit Oscillator
  private playPulse(freq: number, duration: number, volume: number = 0.1, type: OscillatorType = "square") {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playEat() {
    this.playPulse(880, 0.1, 0.1, "square");
    setTimeout(() => this.playPulse(1320, 0.1, 0.1, "square"), 50);
  }

  playExplode() {
    if (!this.ctx) return;
    const duration = 0.5;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const noise = this.ctx.createBufferSource();
    
    // Simple white noise for explosion
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    noise.buffer = buffer;
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  startBGM() {
    if (this.bgmInterval) return;
    this.init();
    
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    let step = 0;

    this.bgmInterval = setInterval(() => {
        // Simple 8-bit arpeggio
        const freq = notes[step % notes.length];
        this.playPulse(freq, 0.2, 0.03, "triangle");
        step++;
    }, 200);
  }

  stopBGM() {
    if (this.bgmInterval) {
        clearInterval(this.bgmInterval);
        this.bgmInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();
