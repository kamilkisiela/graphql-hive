export function resolutionToMilliseconds(
  resolution: number,
  period: {
    from: string;
    to: string;
  },
) {
  const distanceInMinutes =
    (new Date(period.to).getTime() - new Date(period.from).getTime()) / 1000 / 60;

  return Math.round(distanceInMinutes / resolution) * 1000 * 60;
}
