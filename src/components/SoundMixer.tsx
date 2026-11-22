import { t } from "../i18n";
import { CloudRain, Music2, Volume2, Waves } from "lucide-react";
import type { Ambient, Sound } from "../hooks/useAmbient";
export function SoundMixer({ audio }: { audio: Ambient }) {
  const sounds: {
    id: Sound;
    label: string;
    icon: typeof CloudRain;
  }[] = [
    { id: "rain", label: "Rainfall", icon: CloudRain },
    { id: "brown", label: "Brown noise", icon: Waves },
    { id: "keys", label: "Soft keys", icon: Music2 },
  ];
  return (
    <section className="panel sound-panel">
      <div className="panel-heading">
        <h2>
          <Music2 size={16} />
          {t(" Set the mood")}
        </h2>
        <span className="tiny muted">{t("NO DISTRACTIONS")}</span>
      </div>
      <div className="sound-options">
        {t(
          sounds.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => void audio.play(id)}
              aria-pressed={audio.sound === id}
              className={audio.sound === id ? "selected" : ""}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span>{t(label)}</span>
              {t(
                audio.sound === id && (
                  <i className="sound-wave">
                    <b />
                    <b />
                    <b />
                  </i>
                ),
              )}
            </button>
          )),
        )}
      </div>
      <label className="volume-slider">
        <Volume2 size={15} />
        <span className="sr-only">{t("Ambient volume")}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={audio.volume}
          onChange={(event) => audio.setVolume(Number(event.target.value))}
        />
        <span>
          {t(audio.volume)}
          {t("%")}
        </span>
      </label>
    </section>
  );
}
