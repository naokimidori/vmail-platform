import { useEffect, useRef } from "react";

type TurnstileChallengeProps = {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey: number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const turnstileScriptId = "cf-turnstile-script";

export function TurnstileChallenge({ siteKey, onToken, resetKey }: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      containerRef.current.innerHTML = "";
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = turnstileScriptId;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken, resetKey, siteKey]);

  return (
    <div className="rounded-[16px] border border-white/70 bg-white/58 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <div ref={containerRef} />
    </div>
  );
}
