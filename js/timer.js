// ── Temporizador de descanso entre series ───────────────────────────────────
// Igual al de Leandro Gym: cuenta regresiva simple con callbacks de tick/fin.
const Timer = {
  duration: 60,
  remaining: 0,
  intervalId: null,
  active: false,
  _onTick: null,
  _onComplete: null,

  start(duration, onTick, onComplete) {
    this.stop();
    this.duration = duration;
    this.remaining = duration;
    this.active = true;
    this._onTick = onTick;
    this._onComplete = onComplete;

    if (onTick) onTick(this.remaining, this.duration);

    this.intervalId = setInterval(() => {
      this.remaining--;
      if (this._onTick) this._onTick(this.remaining, this.duration);
      if (this.remaining <= 0) {
        this.stop();
        this._vibrate();
        if (this._onComplete) this._onComplete();
      }
    }, 1000);
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.active = false;
  },

  skip() {
    this.stop();
    if (this._onComplete) this._onComplete();
  },

  _vibrate() {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    } catch (e) {}
  }
};
