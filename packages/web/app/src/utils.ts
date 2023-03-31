type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T; // from lodash

export function truthy<T>(value: T): value is Truthy<T> {
  return !!value;
}

export function openChatSupport() {
  window.$crisp?.push(['do', 'chat:open']);
}

const darkChartStyles = {
  backgroundColor: 'transparent',
  textStyle: { color: '#fff' },
  legend: {
    textStyle: { color: '#fff' },
  },
};

export function useChartStyles() {
  return darkChartStyles;
  // TODO: fix it when Hive will have white theme
  // useColorModeValue(
  //   {
  //     backgroundColor: '#fff',
  //     textStyle: { color: '#52525b' },
  //     legend: {
  //       textStyle: { color: '#52525b' },
  //     },
  //   },
  // );
}
