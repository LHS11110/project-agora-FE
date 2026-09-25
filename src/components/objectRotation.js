export function rotationAtPointer(initialRotation, startAngle, clientX, clientY, centerX, centerY) {
  const currentAngle = Math.atan2(clientY - centerY, clientX - centerX);
  let delta = (currentAngle - startAngle) * 180 / Math.PI;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const rotation = initialRotation + delta;
  return ((rotation + 180) % 360 + 360) % 360 - 180;
}
