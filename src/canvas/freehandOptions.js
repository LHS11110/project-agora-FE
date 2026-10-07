/** Moderate pressure changes and stronger centerline smoothing for handwriting. */
export function freehandOptions(stroke, size) {
  const brush = stroke.brush === 'ink';
  return {
    size,
    thinning: brush ? .6 : .35,
    smoothing: brush ? .75 : .85,
    streamline: brush ? .45 : .4,
    easing: pressure => pressure,
    simulatePressure: stroke.simulatePressure !== false,
    start: { cap: true, taper: false },
    end: { cap: true, taper: false },
    // Track the pen tip while writing instead of snapping to it on release.
    last: stroke.brush === 'pen' || stroke.complete !== false,
  };
}
