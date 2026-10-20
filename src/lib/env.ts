/**
 * Configuration for type-safe environment variables.
 * Imported through src/app/page.tsx
 * @see https://x.com/mattpocockuk/status/1760991147793449396
 */
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SHOW_LOGGER: z.enum(['true', 'false']).optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SHOW_LOGGER: process.env.NEXT_PUBLIC_SHOW_LOGGER,
});
