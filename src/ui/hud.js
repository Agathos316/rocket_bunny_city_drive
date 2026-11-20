/** On-screen readouts: speed, money and the crash flash. Writes to the DOM only when a value changes. */
export class Hud {
  constructor(doc = document) {
    this.speedEl = doc.getElementById('kmh');
    this.moneyEl = doc.getElementById('mny');
    this.crashEl = doc.getElementById('crash');
    this.shownSpeed = null;
    this.shownMoney = null;
    this.flashLeft = 0;
  }

  /** Speed in metres per second. */
  setSpeed(metresPerSecond) {
    const kmh = Math.round(Math.abs(metresPerSecond) * 3.6);
    if (kmh === this.shownSpeed) return;
    this.shownSpeed = kmh;
    this.speedEl.textContent = kmh;
  }

  setMoney(amount) {
    const whole = Math.floor(amount);
    if (whole === this.shownMoney) return;
    this.shownMoney = whole;
    this.moneyEl.textContent = whole.toLocaleString();
  }

  flashCrash(seconds) {
    this.crashEl.classList.add('on');
    this.flashLeft = seconds;
  }

  update(dt) {
    if (this.flashLeft <= 0) return;
    this.flashLeft -= dt;
    if (this.flashLeft <= 0) this.crashEl.classList.remove('on');
  }
}
