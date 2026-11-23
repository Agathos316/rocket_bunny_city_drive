/**
 * The settings panel opened by the cog in the bottom-left corner: car choice, traffic amount and the controls help.
 * Any future controls or info belong here.
 */
export class SettingsPanel {
  /**
   * @param {object} opts
   * @param {(count:number)=>void} opts.onTraffic  called when the traffic slider moves
   * @param {(model:string)=>void} opts.onCar      called when a different car is chosen
   * @param {(on:boolean)=>void} opts.onSound      called when sound is switched on or off
   * @param {(volume:number)=>void} opts.onVolume  called when the volume slider moves (0..1)
   */
  constructor({ onTraffic, onCar, onSound, onVolume, doc = document }) {
    this.doc = doc;
    this.cog = doc.getElementById('cog');
    this.panel = doc.getElementById('set');
    this.carSelect = doc.getElementById('car');
    this.slider = doc.getElementById('tr');
    this.sliderLabel = doc.getElementById('tv');
    this.soundBox = doc.getElementById('snd');
    this.volume = doc.getElementById('vol');

    this.cog.addEventListener('click', () => {
      this.panel.hidden = !this.panel.hidden;
      this.cog.blur();   // keep the arrow keys driving the car, not the button
    });
    this.slider.addEventListener('input', () => {
      this.sliderLabel.textContent = this.slider.value;
      onTraffic(+this.slider.value);
    });
    this.slider.addEventListener('change', () => this.slider.blur());
    this.soundBox.addEventListener('change', () => {
      onSound(this.soundBox.checked);
      this.soundBox.blur();
    });
    this.volume.addEventListener('input', () => onVolume(+this.volume.value / 100));
    this.volume.addEventListener('change', () => this.volume.blur());
    this.carSelect.addEventListener('change', () => {
      onCar(this.carSelect.value);
      this.carSelect.blur();
    });
  }

  setTraffic(count) {
    this.slider.value = count;
    this.sliderLabel.textContent = count;
  }

  setSound(on, volume) {
    this.soundBox.checked = on;
    this.volume.value = Math.round(volume * 100);
  }

  /** Offer a car that became available after the page loaded (a glTF model). */
  addCar(model, label) {
    if ([...this.carSelect.options].some((o) => o.value === model)) return;
    const option = this.doc.createElement('option');
    option.value = model;
    option.textContent = label;
    this.carSelect.insertBefore(option, this.carSelect.firstChild);
  }

  setCar(model) {
    this.carSelect.value = model;
  }
}
