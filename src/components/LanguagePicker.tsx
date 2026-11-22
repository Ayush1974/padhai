import { t } from "../i18n";
import { Globe2 } from "lucide-react";
import { languages } from "../i18n";
export function LanguagePicker({
  language,
  onChange,
}: {
  language: string;
  onChange: (language: string) => void;
}) {
  return (
    <label className="language-picker">
      <Globe2 size={15} />
      <span className="sr-only">{t("App language")}</span>
      <select
        className="language-select"
        value={language}
        onChange={(event) => onChange(event.target.value)}
      >
        {t(
          languages.map((item) => (
            <option key={item.code} value={item.code} translate="no">
              {item.name}
            </option>
          )),
        )}
      </select>
    </label>
  );
}
