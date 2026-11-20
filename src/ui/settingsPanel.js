/**
 * The settings panel opened by the cog in the bottom-left corner: car choice, traffic amount and the controls help.
 * Any future controls or info belong here.
 */
export class SettingsPanel {
  /**
   * @param {object} opts
   * @param {(count:number)=>void} opts.onTraffic  called when the traffic slider moves
   * @param {(model:string)=>void} opts.onCar      called when a different car is chosen
   */
  constructor({ onTraffic, onCar, doc = document }) {
    this.cog = doc.getElementById('cog');
    this.panel = doc.getElementById('set');
    this.carSelect = doc.getElementById('car');
    this.slider = doc.getElementById('tr');
    this.sliderLabel = doc.getElementById('tv');

    this.cog.addEventListener('click', () => {
      this.panel.hidden = !this.panel.hidden;
      this.cog.blur();   // keep the arrow keys driving the car, not the button
    });
    this.slider.addEventListener('input', () => {
      this.sliderLabel.textContent = this.slider.value;
      onTraffic(+this.slider.value);
    });
    this.slider.addEventListener('change', () => this.slider.blur());
    this.carSelect.addEventListener('change', () => {
      onCar(this.carSelect.value);
      this.carSelect.blur();
    });
  }

  setTraffic(count) {
    this.slider.value = count;
    this.sliderLabel.textContent = count;
  }

  setCar(model) {
    this.carSelect.value = model;
  }
}
