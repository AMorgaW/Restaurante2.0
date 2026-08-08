/**
 * Aviso sonoro opcional (Web Audio). Sin autoplay: solo tras gesto del usuario
 * que habilita el toggle.
 */

const SOUND_PREF_KEY = "brisas-order-alert-sound";

export function readOrderAlertSoundPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SOUND_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeOrderAlertSoundPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SOUND_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // sessionStorage puede fallar en modo privado; el estado en memoria basta.
  }
}

/** Reproduce un beep corto. No lanza si AudioContext está bloqueado. */
export function playOrderAlertSound(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
    void ctx.resume().catch(() => undefined);
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 400);
  } catch {
    // Silencio seguro si el navegador bloquea audio.
  }
}
