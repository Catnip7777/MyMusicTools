const AppSettings = (() => {
  const STORAGE_KEY = "apt-app-settings-v1";
  const LEGACY_AUDIO_KEY = "apt-audio-settings-v1";
  const MIDI_MIN = 21;
  const MIDI_MAX = 108;

  const defaults = {
    volume: 85,
    duration: 2.8,
    rangeLow: 48,
    rangeHigh: 72,
    includeBlack: true,
    instrument: "piano",
  };

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, Number(n)));
  }

  function clampMidi(midi) {
    return clamp(midi, MIDI_MIN, MIDI_MAX);
  }

  function normalize(data) {
    let rangeLow = clampMidi(data.rangeLow ?? defaults.rangeLow);
    let rangeHigh = clampMidi(data.rangeHigh ?? defaults.rangeHigh);
    if (rangeLow > rangeHigh) [rangeLow, rangeHigh] = [rangeHigh, rangeLow];

    return {
      volume: clamp(data.volume ?? defaults.volume, 0, 100),
      duration: clamp(data.duration ?? defaults.duration, 0.5, 6),
      rangeLow,
      rangeHigh,
      includeBlack: data.includeBlack !== false,
      instrument:
        typeof data.instrument === "string" ? data.instrument : defaults.instrument,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));

      const legacy = localStorage.getItem(LEGACY_AUDIO_KEY);
      if (legacy) {
        const old = JSON.parse(legacy);
        return normalize({
          volume: old.volume,
          duration: old.duration,
        });
      }
      return { ...defaults };
    } catch {
      return { ...defaults };
    }
  }

  function save(settings) {
    const next = normalize(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function get() {
    return load();
  }

  function set(partial) {
    return save({ ...load(), ...partial });
  }

  function readFromDOM(els) {
    return normalize({
      volume: parseInt(els.volume?.value ?? defaults.volume, 10),
      duration: (parseInt(els.duration?.value ?? defaults.duration * 10, 10) || 28) / 10,
      rangeLow: parseInt(els.rangeLow?.value ?? defaults.rangeLow, 10),
      rangeHigh: parseInt(els.rangeHigh?.value ?? defaults.rangeHigh, 10),
      includeBlack: els.includeBlack?.checked ?? defaults.includeBlack,
      instrument: els.instrument?.value ?? defaults.instrument,
    });
  }

  function applyToDOM(els, settings, validInstruments) {
    const s = normalize(settings);
    const instrument = validInstruments?.includes(s.instrument)
      ? s.instrument
      : defaults.instrument;

    if (els.volume) els.volume.value = String(Math.round(s.volume));
    if (els.duration) els.duration.value = String(Math.round(s.duration * 10));
    if (els.rangeLow) els.rangeLow.value = String(s.rangeLow);
    if (els.rangeHigh) els.rangeHigh.value = String(s.rangeHigh);
    if (els.includeBlack) els.includeBlack.checked = s.includeBlack;
    if (els.instrument) els.instrument.value = instrument;

    return { ...s, instrument };
  }

  return { get, set, save, readFromDOM, applyToDOM, defaults };
})();

/** @deprecated use AppSettings */
const AudioSettings = AppSettings;
