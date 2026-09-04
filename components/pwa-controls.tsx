"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureServiceWorker } from "@/lib/pwa/service-worker";

import styles from "./pwa-controls.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type PwaControlsProps = {
  onAvailabilityChange?: (available: boolean) => void;
};

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as NavigatorWithStandalone).standalone === true;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/u.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaControls({ onAvailabilityChange }: PwaControlsProps = {}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean | null>(null);
  const [ios, setIos] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 8_000);
  }, []);

  useEffect(() => {
    let disposed = false;
    setStandalone(isStandalone());
    setIos(isIOS());
    if ("serviceWorker" in navigator) {
      void ensureServiceWorker()
        .catch(() => {
          if (!disposed) showNotice("Не вдалося підготувати встановлення застосунку.");
        });
    }

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
      showNotice("Застосунок «Відмітка» встановлено.");
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, [showNotice]);

  useEffect(() => {
    onAvailabilityChange?.(standalone === false);
  }, [onAvailabilityChange, standalone]);

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      else showNotice("Встановлення скасовано. Його можна повторити з меню браузера.");
      return;
    }
    showNotice(ios
      ? "На iPhone/iPad: натисніть «Поділитися», потім «На початковий екран»."
      : "У меню браузера оберіть «Установити Відмітку» або «Додати на головний екран».");
  };

  if (standalone !== false) return null;
  return <div className={styles.controls}>
    <button
      type="button"
      className={styles.controlButton}
      aria-label="Встановити Відмітку як застосунок"
      title="Встановити застосунок"
      onClick={() => void install()}
    ><Download aria-hidden="true" /></button>
    {notice ? <div className={styles.notice} role="status" aria-live="polite">{notice}</div> : null}
  </div>;
}
