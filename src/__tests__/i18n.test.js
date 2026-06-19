// Infra i18n : traduction, interpolation, pluriel, repli.
import { describe, it, expect } from 'vitest';
import { t, tplural, tFor, DICT } from '../i18n/index.js';

describe('t()', () => {
  it('traduit selon la langue avec repli FR puis clé', () => {
    expect(t('common.close', null, 'fr')).toBe('Fermer');
    expect(t('common.close', null, 'en')).toBe('Close');
    expect(t('cle.inexistante', null, 'en')).toBe('cle.inexistante'); // repli = clé
  });
  it('interpole {x}', () => {
    DICT['__test.hi'] = { fr: 'Salut {name} !', en: 'Hi {name}!' };
    expect(t('__test.hi', { name: 'Léa' }, 'fr')).toBe('Salut Léa !');
    expect(t('__test.hi', { name: 'Lea' }, 'en')).toBe('Hi Lea!');
    delete DICT['__test.hi'];
  });
});

describe('tplural()', () => {
  it('choisit la bonne forme (FR: 0/1 sing ; EN: 1 sing)', () => {
    expect(tplural('common.coins', 1, {}, 'fr')).toBe('pièce');
    expect(tplural('common.coins', 2, {}, 'fr')).toBe('pièces');
    expect(tplural('common.coins', 0, {}, 'fr')).toBe('pièce');
    expect(tplural('common.coins', 1, {}, 'en')).toBe('coin');
    expect(tplural('common.coins', 0, {}, 'en')).toBe('coins');
  });
});

describe('tFor()', () => {
  it('renvoie une fonction liée à la langue + .plural', () => {
    const T = tFor(true);
    expect(T.lang).toBe('en');
    expect(T('common.cancel')).toBe('Cancel');
    expect(T.plural('common.coins', 3)).toBe('coins');
    expect(tFor(false)('common.cancel')).toBe('Annuler');
  });
});
