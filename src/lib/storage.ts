import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function readStorage<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(`padhai-${key}`) || "null") ?? fallback
    );
  } catch {
    return fallback;
  }
}

export function useStoredState<T>(
  key: string,
  fallback: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    readStorage(
      key,
      typeof fallback === "function" ? (fallback as () => T)() : fallback,
    ),
  );
  useEffect(() => {
    try {
      localStorage.setItem(`padhai-${key}`, JSON.stringify(value));
    } catch {
      window.dispatchEvent(new CustomEvent("storage-error"));
    }
  }, [key, value]);
  return [value, setValue];
}

export function downloadFile(
  name: string,
  contents: string | Blob,
  type = "application/json",
) {
  const url = URL.createObjectURL(
    contents instanceof Blob ? contents : new Blob([contents], { type }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
