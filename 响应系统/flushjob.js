export const jobQueue = new Set();

const p = Promise.resolve();

let isFlush = false;
export const flushJob = () => {
  if (isFlush) return;

  isFlush = true;

  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    isFlush = false;
  });
};
