export const up = async () => {
  console.log('up');

  throw new Error("i'm failing on purpose, to prove a point");
};

export const down = async () => {
  console.log('down');
};

export default { up, down };
