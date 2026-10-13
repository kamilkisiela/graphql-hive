// @vitest-environment jsdom
import { migrateLegacyLaboratoryStorage } from './laboratory-legacy-storage';

const ENV = 'hive:laboratory:env';
const OLD_ENV = 'hive:laboratory:environment';
const ENABLED = 'hive:laboratory:preflightEnabled';
const OLD_ENABLED = 'hive:laboratory:isPreflightScriptEnabled';

const dump = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
    .sort()
    .map(key => [key, localStorage.getItem(key)]);

afterEach(() => {
  localStorage.clear();
});

describe('migrateLegacyLaboratoryStorage', () => {
  it('carries primitive GraphiQL variables over as text', () => {
    localStorage.setItem(
      OLD_ENV,
      JSON.stringify({ token: 'abc', retries: 3, debug: true, none: null, nested: { a: 1 } }),
    );

    migrateLegacyLaboratoryStorage();

    expect(JSON.parse(localStorage.getItem(ENV)!)).toEqual({
      variables: { token: 'abc', retries: '3', debug: 'true', none: 'null' },
    });
    expect(localStorage.getItem(OLD_ENV)).not.toBeNull();
  });

  it.each([
    ['invalid JSON', '{oops'],
    ['an array', '["a"]'],
    ['a string', '"a"'],
    ['null', 'null'],
  ])('writes no env for %s', (_, raw) => {
    localStorage.setItem(OLD_ENV, raw);

    migrateLegacyLaboratoryStorage();

    expect(localStorage.getItem(ENV)).toBeNull();
  });

  it('does not overwrite an existing lab env', () => {
    localStorage.setItem(OLD_ENV, '{"token":"old"}');
    localStorage.setItem(ENV, '{"variables":{"token":"new"}}');

    migrateLegacyLaboratoryStorage();

    expect(localStorage.getItem(ENV)).toBe('{"variables":{"token":"new"}}');
  });

  it('writes nothing when there is no GraphiQL state', () => {
    migrateLegacyLaboratoryStorage();

    expect(localStorage.length).toBe(0);
  });

  it.each(['true', 'false'])('copies the explicit toggle value %s', value => {
    localStorage.setItem(OLD_ENABLED, value);

    migrateLegacyLaboratoryStorage();

    expect(localStorage.getItem(ENABLED)).toBe(value);
  });

  it('ignores a toggle value that is not a boolean', () => {
    localStorage.setItem(OLD_ENABLED, 'yes');

    migrateLegacyLaboratoryStorage();

    expect(localStorage.getItem(ENABLED)).toBeNull();
  });

  it('does not overwrite an existing lab toggle', () => {
    localStorage.setItem(OLD_ENABLED, 'true');
    localStorage.setItem(ENABLED, 'false');

    migrateLegacyLaboratoryStorage();

    expect(localStorage.getItem(ENABLED)).toBe('false');
  });

  it('changes nothing on a second run', () => {
    localStorage.setItem(OLD_ENV, '{"token":"abc"}');
    localStorage.setItem(OLD_ENABLED, 'true');
    migrateLegacyLaboratoryStorage();
    const first = dump();

    migrateLegacyLaboratoryStorage();

    expect(dump()).toEqual(first);
  });
});
