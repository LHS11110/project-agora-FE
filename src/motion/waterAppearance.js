/** Homepage water has stronger contrast; other scenes retain their appearance. */
export function waterAppearance(scene) {
  const home = scene.classList.contains('home-slide');
  const dark = scene.matches('.slide-start, .auth-visual-panel');
  return {
    home, dark,
    distance: home ? 6 : 10,
    interval: home ? 40 : 60,
    options: {
      interactive: false, ambient: 0, maxRipples: home ? 32 : 20, dprCap: 1,
      opacity: home ? (dark ? .52 : .48) : (dark ? .35 : .3),
      palette: dark
        ? { top: '#39324c', bottom: '#334e59', glint: home ? '#e0ffff' : '#c9eaec' }
        : home ? { top: '#f2f7f3', bottom: '#80b6c0', glint: '#a1dce5' }
          : { top: '#f6f7f1', bottom: '#b6d4d5', glint: '#ffffff' },
      wave: home
        ? { swell: .18, amplitude: .78, ringSpeed: .2, decay: .85, wavelength: 38, life: 3.8, refraction: .38, caustics: .24, specular: 1.15 }
        : { swell: .15, amplitude: .42, ringSpeed: .22, decay: 1.3, wavelength: 45, life: 3, refraction: .2, caustics: .12, specular: .7 },
    },
  };
}
