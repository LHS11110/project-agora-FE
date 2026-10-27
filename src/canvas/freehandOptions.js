/** Preserve small handwriting turns while keeping brush outlines smooth. */
export function freehandOptions(stroke, size) {
  const brush = stroke.brush === 'ink';
  return {
    size,
    thinning: brush ? .6 : .35,
    smoothing: brush ? .75 : .85,
    streamline: brush ? .45 : .2,
    easing: pressure => pressure,
    simulatePressure: stroke.simulatePressure !== false,
    start: { cap: true, taper: false },
    end: { cap: true, taper: false },
    // Track the tip during drawing for every brush; finishing a stroke must
    // not cause its last segment to jump to a new position.
    last: true,
  };
}
