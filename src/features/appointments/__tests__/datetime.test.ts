import {
  dateInTimeZone,
  dayRangeInTimeZone,
  localDateTimeInputValue,
  localDateTimeToIso,
} from '../datetime';

describe('appointment datetime helpers', () => {
  it('convierte hora local de Ciudad de México a ISO con offset', () => {
    expect(localDateTimeToIso('2030-01-15T10:00')).toBe(
      '2030-01-15T16:00:00.000Z',
    );
  });

  it('crea un rango semiabierto de un día en la zona de la agenda', () => {
    expect(dayRangeInTimeZone('2030-01-15')).toEqual({
      from: '2030-01-15T06:00:00.000Z',
      to: '2030-01-16T06:00:00.000Z',
    });
  });

  it('calcula la fecha de agenda aunque el navegador use otra zona', () => {
    expect(dateInTimeZone(new Date('2030-01-15T05:00:00.000Z'))).toBe(
      '2030-01-14',
    );
  });

  it('prepara el valor de datetime-local en la zona de la agenda', () => {
    expect(localDateTimeInputValue(new Date('2030-01-15T16:00:00.000Z'))).toBe(
      '2030-01-15T10:00',
    );
  });

  it('rechaza un valor local inválido', () => {
    expect(() => localDateTimeToIso('15/01/2030 10:00')).toThrow(
      'formato válido',
    );
  });
});
