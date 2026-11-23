import { useState } from "react";
import * as Clipboard from "expo-clipboard";

export function useCopyText() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = async (text: string) => {
    try {
      const success = (await Clipboard.setStringAsync(text)) !== false;
      setCopyFailed(!success);
      setCopied(success);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };
  const resetCopy = () => {
    setCopied(false);
    setCopyFailed(false);
  };
  return { copied, copyFailed, copy, resetCopy };
}
