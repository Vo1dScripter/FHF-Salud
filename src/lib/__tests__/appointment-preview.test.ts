import { isAppointmentPreviewEnabled } from '@/lib/appointment-preview';

describe('Appointment development preview boundary', () => {
  const originalEnv = process.env;
  afterEach(() => {
    process.env = originalEnv;
  });
  it.each([
    ['production', 'true', false],
    ['production', undefined, false],
    ['development', undefined, false],
    ['development', 'true', true],
  ])('mode=%s flag=%s enables preview=%s', (mode, flag, allowed) => {
    process.env = {
      ...originalEnv,
      NODE_ENV: mode as 'development' | 'production',
      FHF_APPOINTMENT_PREVIEW: flag,
    };
    expect(isAppointmentPreviewEnabled()).toBe(allowed);
  });
});
