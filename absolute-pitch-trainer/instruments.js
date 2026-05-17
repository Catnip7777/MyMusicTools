const InstrumentEngine = (() => {
  function envGain(g, now, duration, { attack, decay, sustain, release, peak }) {
    const a = attack ?? 0.04;
    const d = decay ?? 0.1;
    const s = sustain ?? 0.7;
    const r = release ?? Math.max(0.5, duration * 0.35);
    const hold = Math.max(0.35, duration - a - d - r);
    const end = now + a + d + hold + r;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak ?? 0.85, now + a);
    g.gain.linearRampToValueAtTime(s * (peak ?? 0.85), now + a + d);
    g.gain.setValueAtTime(s * (peak ?? 0.85), now + a + d + hold);
    g.gain.exponentialRampToValueAtTime(0.0008, end);
    return end;
  }

  function addOsc(ctx, freq, type, gain, start, end, dest, detune = 0) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(end + 0.05);
    return osc;
  }

  function addNoise(ctx, start, end, dest, { gain = 0.08, type = "bandpass", freq = 1200, Q = 1.2 } = {}) {
    const len = Math.ceil(ctx.sampleRate * (end - start + 0.1));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(end + 0.05);
  }

  const instruments = {
    piano: {
      label: "钢琴",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.03,
          decay: 0.12,
          sustain: 0.72,
          release: Math.max(0.7, duration * 0.4),
          peak: 0.88,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(5200, freq * 10 + 800), now);
        filter.Q.value = 0.6;
        filter.connect(master);
        [
          [1, "sine", 1],
          [2, "sine", 0.42],
          [3, "triangle", 0.18],
        ].forEach(([m, type, gain]) => {
          addOsc(ctx, freq * m, type, gain * 0.36, now, end, filter, (Math.random() - 0.5) * 5);
        });
      },
    },

    organ: {
      label: "管风琴",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.06,
          decay: 0.05,
          sustain: 0.82,
          release: Math.max(0.9, duration * 0.45),
          peak: 0.75,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.min(4500, freq * 6 + 600);
        filter.connect(master);
        [1, 2, 3, 4, 6].forEach((m, i) => {
          addOsc(ctx, freq * m, "sine", 0.22 - i * 0.025, now, end, filter);
        });
      },
    },

    flute: {
      label: "长笛",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.08,
          decay: 0.1,
          sustain: 0.78,
          release: Math.max(0.8, duration * 0.42),
          peak: 0.8,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.min(3200, freq * 4 + 900);
        filter.connect(master);
        addOsc(ctx, freq, "sine", 0.55, now, end, filter);
        addOsc(ctx, freq * 2, "sine", 0.12, now, end, filter);
        addNoise(ctx, now, end, filter, {
          gain: 0.06,
          type: "bandpass",
          freq: Math.min(2400, freq * 2.5),
          Q: 2.5,
        });
      },
    },

    guitar: {
      label: "吉他",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const pluck = Math.min(1.2, duration * 0.45);
        const end = envGain(master, now, pluck + 0.15, {
          attack: 0.002,
          decay: 0.08,
          sustain: 0.35,
          release: Math.max(0.5, pluck * 0.9),
          peak: 0.9,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = freq;
        filter.Q.value = 9;
        filter.connect(master);
        addOsc(ctx, freq, "triangle", 0.5, now, end, filter);
        addOsc(ctx, freq * 2, "sine", 0.2, now, end, filter);
        addNoise(ctx, now, now + 0.04, filter, { gain: 0.35, type: "highpass", freq: 800, Q: 0.5 });
      },
    },

    violin: {
      label: "小提琴",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.12,
          decay: 0.08,
          sustain: 0.75,
          release: Math.max(0.85, duration * 0.42),
          peak: 0.78,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.min(4000, freq * 5 + 700);
        filter.connect(master);
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        const vibrato = ctx.createOscillator();
        vibrato.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.value = freq * 0.012;
        vibrato.connect(depth);
        depth.connect(osc.frequency);
        const g = ctx.createGain();
        g.gain.value = 0.28;
        osc.connect(g);
        g.connect(filter);
        osc.start(now);
        vibrato.start(now);
        osc.stop(end + 0.05);
        vibrato.stop(end + 0.05);
      },
    },

    trumpet: {
      label: "小号",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.07,
          decay: 0.06,
          sustain: 0.7,
          release: Math.max(0.65, duration * 0.38),
          peak: 0.82,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = freq * 2.2;
        filter.Q.value = 1.8;
        filter.connect(master);
        addOsc(ctx, freq, "sawtooth", 0.32, now, end, filter);
        addOsc(ctx, freq * 2, "square", 0.08, now, end, filter);
      },
    },

    bell: {
      label: "钟琴",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, Math.min(duration, 2.2), {
          attack: 0.002,
          decay: 0.15,
          sustain: 0.25,
          release: Math.max(1.2, duration * 0.55),
          peak: 0.85,
        });
        master.connect(dest);
        [
          [1, 1, 0.5],
          [2.4, 0.35, 0.8],
          [3.5, 0.22, 1.1],
          [4.8, 0.12, 1.4],
        ].forEach(([ratio, gain, decayMul]) => {
          const g = ctx.createGain();
          g.gain.setValueAtTime(gain * 0.4, now);
          g.gain.exponentialRampToValueAtTime(0.0008, now + duration * decayMul * 0.5);
          g.connect(master);
          addOsc(ctx, freq * ratio, "sine", 1, now, now + duration * decayMul * 0.55, g);
        });
      },
    },

    synth: {
      label: "合成器",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.65,
          release: Math.max(0.7, duration * 0.4),
          peak: 0.78,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(6000, freq * 12), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.5), now + 0.35);
        filter.Q.value = 2.2;
        filter.connect(master);
        addOsc(ctx, freq, "square", 0.22, now, end, filter);
        addOsc(ctx, freq, "sawtooth", 0.12, now, end, filter, 8);
      },
    },

    marimba: {
      label: "马林巴",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, Math.min(duration, 2), {
          attack: 0.001,
          decay: 0.06,
          sustain: 0.15,
          release: Math.max(1, duration * 0.5),
          peak: 0.9,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(freq * 3.5, now);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.25);
        filter.connect(master);
        addOsc(ctx, freq, "sine", 0.55, now, end, filter);
        addOsc(ctx, freq * 2.1, "sine", 0.18, now, end, filter);
        addOsc(ctx, freq * 4.2, "sine", 0.06, now, end, filter);
      },
    },

    harp: {
      label: "竖琴",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, Math.min(duration, 2.5), {
          attack: 0.002,
          decay: 0.1,
          sustain: 0.2,
          release: Math.max(1.1, duration * 0.52),
          peak: 0.82,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.min(5000, freq * 8 + 400);
        filter.connect(master);
        [-6, 0, 6].forEach((detune, i) => {
          addOsc(ctx, freq, "sine", 0.2 - i * 0.04, now, end, filter, detune);
          addOsc(ctx, freq * 2, "triangle", 0.08, now, end, filter, detune);
        });
      },
    },

    clarinet: {
      label: "单簧管",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.1,
          decay: 0.08,
          sustain: 0.76,
          release: Math.max(0.85, duration * 0.42),
          peak: 0.75,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.min(2800, freq * 3 + 500);
        filter.connect(master);
        [1, 3, 5, 7].forEach((m, i) => {
          addOsc(ctx, freq * m, "square", 0.35 / (i + 1), now, end, filter);
        });
      },
    },

    bass: {
      label: "电贝斯",
      play(ctx, freq, now, duration, dest) {
        const master = ctx.createGain();
        const end = envGain(master, now, duration, {
          attack: 0.01,
          decay: 0.15,
          sustain: 0.68,
          release: Math.max(0.75, duration * 0.4),
          peak: 0.88,
        });
        master.connect(dest);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.min(2200, freq * 4 + 200);
        filter.Q.value = 1.2;
        filter.connect(master);
        addOsc(ctx, freq, "sawtooth", 0.35, now, end, filter);
        addOsc(ctx, freq, "square", 0.15, now, end, filter);
        addOsc(ctx, freq * 2, "sine", 0.1, now, end, filter);
      },
    },
  };

  function play(ctx, id, freq, now, duration, dest) {
    const inst = instruments[id] ?? instruments.piano;
    inst.play(ctx, freq, now, duration, dest ?? ctx.destination);
  }

  function list() {
    return Object.entries(instruments).map(([id, { label }]) => ({ id, label }));
  }

  return { play, list, defaultId: "piano" };
})();
