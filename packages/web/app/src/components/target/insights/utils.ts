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

/**
 * Adds missing samples to left and right sides of the series. We end up with a smooooooth chart
 */
export function fullSeries(
  data: [string, number][],
  interval: number,
  period: {
    from: string;
    to: string;
  },
): [string, number][] {
  if (!data.length) {
    return createEmptySeries({ interval, period });
  }

  // Find the first sample
  const firstSample = new Date(data[0][0]).getTime();
  // Find the last sample
  const lastSample = new Date(data[data.length - 1][0]).getTime();
  // Turn `period.from` to a number
  const startAt = new Date(period.from).getTime();
  // Turn `period.to` to a number
  const endAt = new Date(period.to).getTime();

  // Calculate the number missing steps by
  // 1. comparing two dates (last/first sample and the expected boundary sample)
  // 2. dividing by interval
  // 3. rounding to floor int
  const stepsToAddOnLeft = Math.floor(Math.abs(firstSample - startAt) / interval);
  const stepsToAddOnRight = Math.floor(Math.abs(endAt - lastSample) / interval);

  // Add n steps to the left side where each sample has its date decreased by i*interval based on the first sample
  for (let i = 1; i <= stepsToAddOnLeft; i++) {
    data.unshift([new Date(firstSample - i * interval).toISOString(), 0]);
  }

  // Add n steps to the right side where each sample has its date increased by i*interval based on the last sample
  for (let i = 1; i <= stepsToAddOnRight; i++) {
    data.push([new Date(lastSample + i * interval).toISOString(), 0]);
  }

  // Instead of creating a new array, we could move things around but this is easier
  const newData: [string, number][] = [];

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const previous = data[i - 1];

    if (previous) {
      const currentTime = new Date(current[0]).getTime();
      const previousTime = new Date(previous[0]).getTime();
      const diff = currentTime - previousTime;

      // We do subtract the interval to make sure we don't duplicate the current sample
      const stepsToAdd = Math.floor(Math.abs(diff - interval) / interval);

      if (stepsToAdd > 0) {
        // We start with 1 because we already have one sample on the left side
        for (let j = 1; j <= stepsToAdd; j++) {
          newData.push([new Date(previousTime + j * interval).toISOString(), 0]);
        }
      }
    }

    newData.push(current);
  }

  return newData;
}

function times<T>(amount: number, f: (index: number) => T) {
  const items: Array<T> = [];
  for (let i = 0; i < amount; i++) {
    items.push(f(i));
  }
  return items;
}

export function createEmptySeries({
  interval,
  period,
}: {
  interval: number;
  period: {
    from: string;
    to: string;
  };
}): [string, number][] {
  const startAt = new Date(period.from).getTime();
  const endAt = new Date(period.to).getTime();

  const steps = Math.floor((endAt - startAt) / interval);
  return times(steps, i => [new Date(startAt + i * interval).toISOString(), 0]);
}
