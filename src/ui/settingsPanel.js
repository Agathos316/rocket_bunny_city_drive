/**
 * The settings panel opened by the cog in the bottom-left corner: the current car (changed with Space, see carSelector.js),
 * traffic amount, sound and the controls help.
 * Any future controls or info belong here.
 */
export class SettingsPanel {
  /**
   * @param {object} opts
   * @param {(count:number)=>void} opts.onTraffic  called when the traffic slider moves
   * @param {(on:boolean)=>void} opts.onSound      called when sound is switched on or off
   * @param {(volume:number)=>void} opts.onVolume  called when the volume slider moves (0..1)
   */
  constructor({ onTraffic, onSound, onVolume, doc = document }) {
    this.doc = doc;
    this.cog = doc.getElementById('cog');
    this.panel = doc.getElementById('set');
    this.carName = doc.getElementById('carname');
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
  }

  setTraffic(count) {
    this.slider.value = count;
    this.sliderLabel.textContent = count;
  }

  setSound(on, volume) {
    this.soundBox.checked = on;
    this.volume.value = Math.round(volume * 100);
  }

  setCar(label) {
    this.carName.textContent = label;
  }
}
