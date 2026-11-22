import catalog from "./locales/en.json";
export const languages = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी · Hindi" },
  { code: "as", name: "অসমীয়া · Assamese" },
  { code: "bn", name: "বাংলা · Bengali" },
  { code: "brx", name: "बड़ो · Bodo" },
  { code: "doi", name: "डोगरी · Dogri" },
  { code: "gu", name: "ગુજરાતી · Gujarati" },
  { code: "kn", name: "ಕನ್ನಡ · Kannada" },
  { code: "ks", name: "کٲشُر · Kashmiri" },
  { code: "gom", name: "कोंकणी · Konkani" },
  { code: "mai", name: "मैथिली · Maithili" },
  { code: "ml", name: "മലയാളം · Malayalam" },
  { code: "mni-Mtei", name: "ꯃꯤꯇꯩꯂꯣꯟ · Manipuri" },
  { code: "mr", name: "मराठी · Marathi" },
  { code: "ne", name: "नेपाली · Nepali" },
  { code: "or", name: "ଓଡ଼ିଆ · Odia" },
  { code: "pa", name: "ਪੰਜਾਬੀ · Punjabi" },
  { code: "sa", name: "संस्कृतम् · Sanskrit" },
  { code: "sat", name: "ᱥᱟᱱᱛᱟᱲᱤ · Santali" },
  { code: "sd", name: "سنڌي · Sindhi" },
  { code: "ta", name: "தமிழ் · Tamil" },
  { code: "te", name: "తెలుగు · Telugu" },
  { code: "ur", name: "اردو · Urdu" },
];

let dictionary: Record<string, string> = {};
let current = "en";
let requested = "en";
const missing = new Set<string>();
const knownPhrases = new Set(Object.keys(catalog));
const packs = import.meta.glob<Record<string, string>>(
  ["./locales/*.json", "!./locales/en.json"],
  { import: "default" },
);

export async function loadLanguage(code: string) {
  requested = code;
  const safeCode = languages.some((language) => language.code === code)
    ? code
    : "en";
  const pack =
    safeCode === "en"
      ? {}
      : (await packs[`./locales/${safeCode}.json`]?.()) || {};
  if (requested !== code) return;
  let saved = {};
  try {
    saved = JSON.parse(
      localStorage.getItem(`padhai-language-${safeCode}`) || "{}",
    );
  } catch {
    /* A damaged translation cache can be rebuilt. */
  }
  dictionary = { ...pack, ...saved };
  missing.clear();
  current = safeCode;
  document.documentElement.lang = safeCode;
  document.documentElement.dir = ["ur", "sd", "ks"].includes(safeCode)
    ? "rtl"
    : "ltr";
}

export function t<T>(value: T): T {
  if (typeof value !== "string" || current === "en") return value;
  const key = value.trim();
  const translated = dictionary[key];
  if (!translated && knownPhrases.has(key)) missing.add(key);
  return (translated ? value.replace(key, translated) : value) as T;
}

export function missingInterfacePhrases() {
  return [...missing].filter((phrase) => !dictionary[phrase]);
}
export function saveInterfaceTranslations(
  code: string,
  phrases: string[],
  translations: string[],
) {
  if (code !== current) return;
  phrases.forEach((phrase, index) => {
    if (typeof translations[index] === "string")
      dictionary[phrase] = translations[index];
  });
  try {
    localStorage.setItem(`padhai-language-${code}`, JSON.stringify(dictionary));
  } catch {
    /* Translations still work for this visit if device storage is full. */
  }
  window.dispatchEvent(new Event("padhai-language-updated"));
}
