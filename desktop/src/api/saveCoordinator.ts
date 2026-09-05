let activeSaveOperation: Promise<void> | null = null;

export const getActiveSaveOperation = () => activeSaveOperation;

export const trackSaveOperation = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = fn();
  // Track completion (success or failure) without altering what the
  // caller of trackSaveOperation receives.
  activeSaveOperation = result.then(
    () => undefined,
    () => undefined
  ).finally(() => {
    activeSaveOperation = null;
  });
  return result;
};
