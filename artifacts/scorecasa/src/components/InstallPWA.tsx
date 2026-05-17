import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "scorecasa.pwa.installDismissedAt";
const DISMISS_DAYS = 14;

function wasRecentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const dismissedAt = Number(v);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone || wasRecentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  if (!visible || !deferred) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      data-testid="pwa-install-banner"
    >
      <div
        className="rounded-2xl shadow-2xl p-4 flex items-center gap-3 border"
        style={{ background: "#0D1B8C", borderColor: "rgba(255,255,255,0.15)" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Instalar ScoreCasa</p>
          <p className="text-xs text-white/70 leading-tight">Tenha o app no seu celular</p>
        </div>
        <button
          onClick={install}
          className="px-3 h-9 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{ background: "#10A65A", color: "white" }}
          data-testid="button-install-pwa"
        >
          Instalar
        </button>
        <button
          onClick={dismiss}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Dispensar"
          data-testid="button-dismiss-pwa"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
