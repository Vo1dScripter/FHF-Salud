import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Capturas locales limpias sin alterar el indicador del desarrollo habitual.
  devIndicators:
    process.env.FHF_APPOINTMENT_PREVIEW === 'true' ? false : undefined,
};

export default nextConfig;
