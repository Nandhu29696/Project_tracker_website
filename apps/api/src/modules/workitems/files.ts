import { rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { env } from '../../config/env';

/** Absolute directory holding attachment files. */
export const uploadRoot = () =>
  isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : resolve(process.cwd(), env.UPLOAD_DIR);

export const storagePath = (storageKey: string) => join(uploadRoot(), storageKey);

/**
 * Removes stored files after their attachment rows were deleted (e.g. by a cascading
 * work item / project delete). Best effort - never throws.
 */
export async function removeStoredFiles(storageKeys: string[]) {
  await Promise.all(
    storageKeys.map((k) => rm(storagePath(k), { force: true }).catch(() => undefined)),
  );
}
