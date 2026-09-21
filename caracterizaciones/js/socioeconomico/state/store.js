const state = {
  municipio: null,
  depto: null
  // where: null
};
const listeners = [];

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}