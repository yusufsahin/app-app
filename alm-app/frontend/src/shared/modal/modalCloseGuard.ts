type GuardFn = () => boolean | Promise<boolean>;

let guard: GuardFn | null = null;

/** Registers whether the active modal may close (e.g. unsaved changes). Only one modal is open at a time. */
export function setModalCloseGuard(fn: GuardFn | null): void {
  guard = fn;
}

/** @returns true when the user may close the modal (or no guard is registered). */
export async function allowModalCloseAsync(): Promise<boolean> {
  if (!guard) return true;
  return Promise.resolve(guard());
}

/** Runs the close guard if set; calls `onClose` only when allowed. */
export async function attemptModalCloseAsync(onClose: () => void): Promise<void> {
  if (await allowModalCloseAsync()) onClose();
}
