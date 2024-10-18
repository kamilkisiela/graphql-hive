import { execute } from './execute-script';

self.onmessage = async event => {
  const result = await execute(event.data);
  self.postMessage(result);
};
