import { useEffect, useRef, useState } from "react";

export type Sound = "rain" | "brown" | "keys";

export function useAmbient(notify: (message: string) => void) {
  const [sound, setSound] = useState<Sound | null>(null);
  const [volume, setVolume] = useState(35);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  function stop() {
    clearInterval(intervalRef.current);
    void contextRef.current?.close();
    contextRef.current = null;
    gainRef.current = null;
    setSound(null);
  }

  async function play(next: Sound) {
    if (sound === next) {
      stop();
      return;
    }
    stop();
    try {
      const context = new AudioContext();
      contextRef.current = context;
      const gain = context.createGain();
      gain.gain.value = (volume / 100) * 0.35;
      gain.connect(context.destination);
      gainRef.current = gain;
      await context.resume();

      if (next === "keys") {
        const chords = [
          [130.81, 164.81, 196],
          [110, 130.81, 164.81],
          [87.31, 110, 130.81],
          [98, 123.47, 146.83],
        ];
        let index = 0;
        const chord = () => {
          chords[index++ % chords.length].forEach((frequency, offset) => {
            const oscillator = context.createOscillator();
            const envelope = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = frequency * 2;
            const start = context.currentTime + offset * 0.18;
            envelope.gain.setValueAtTime(0, start);
            envelope.gain.linearRampToValueAtTime(0.17, start + 0.05);
            envelope.gain.exponentialRampToValueAtTime(0.001, start + 3.7);
            oscillator.connect(envelope).connect(gain);
            oscillator.start(start);
            oscillator.stop(start + 4);
          });
        };
        chord();
        intervalRef.current = window.setInterval(chord, 4000);
      } else {
        const buffer = context.createBuffer(
          1,
          context.sampleRate * 4,
          context.sampleRate,
        );
        const samples = buffer.getChannelData(0);
        let previous = 0;
        for (let index = 0; index < samples.length; index++) {
          const white = Math.random() * 2 - 1;
          previous = (previous + 0.02 * white) / 1.02;
          samples[index] = next === "brown" ? previous * 3.5 : white * 0.5;
        }
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        filter.type = next === "rain" ? "highpass" : "lowpass";
        filter.frequency.value = next === "rain" ? 500 : 500;
        source.buffer = buffer;
        source.loop = true;
        source.connect(filter).connect(gain);
        source.start();
      }
      setSound(next);
    } catch {
      stop();
      notify("Audio could not start. Tap a sound to try again.");
    }
  }

  useEffect(() => {
    if (gainRef.current && contextRef.current)
      gainRef.current.gain.setTargetAtTime(
        (volume / 100) * 0.35,
        contextRef.current.currentTime,
        0.1,
      );
  }, [volume]);

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      void contextRef.current?.close();
    },
    [],
  );
  return { sound, volume, setVolume, play, stop };
}

export type Ambient = ReturnType<typeof useAmbient>;
