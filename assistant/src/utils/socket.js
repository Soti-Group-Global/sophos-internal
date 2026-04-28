// Minimal socket stub — replace with a real socket.io-client instance if needed.
const noop = () => {};

export const socket = {
  on:   noop,
  off:  noop,
  emit: noop,
};
