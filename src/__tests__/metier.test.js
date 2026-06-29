// Tests de l'extension « Métiers » : gating per-équipe + cascade de dépendances
// + verrou du choix (store).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { applyExtensionToggle, extOn } from '../extensions/registry.js';
import { craftEnabledFor, metierPending, METIER_IDS } from '../logic/metier.js';

const S = () => useGameStore.getState();
const ALL_ON = { equipment: true, forge: true, alchemy: true, enchant: true, metier: true };

describe('craftEnabledFor (gating par métier)', () => {
  it('extension du craft coupée → toujours faux', () => {
    expect(craftEnabledFor({ ...ALL_ON, forge: false }, { metier: 'forge' }, 'forge')).toBe(false);
  });

  it('extension Métiers coupée → tout le monde peut (historique)', () => {
    const ext = { equipment: true, forge: true, alchemy: true, enchant: true, metier: false };
    expect(craftEnabledFor(ext, { metier: null }, 'forge')).toBe(true);
    expect(craftEnabledFor(ext, { metier: null }, 'alchemy')).toBe(true);
    expect(craftEnabledFor(ext, undefined, 'enchant')).toBe(true);
  });

  it('Métiers active → seul le métier correspondant pratique', () => {
    const forgeron = { metier: 'forge' };
    expect(craftEnabledFor(ALL_ON, forgeron, 'forge')).toBe(true);
    expect(craftEnabledFor(ALL_ON, forgeron, 'alchemy')).toBe(false);
    expect(craftEnabledFor(ALL_ON, forgeron, 'enchant')).toBe(false);
  });

  it('Métiers active mais pas encore choisi → aucun craft', () => {
    const undecided = { metier: null };
    for (const c of METIER_IDS) expect(craftEnabledFor(ALL_ON, undecided, c)).toBe(false);
  });
});

describe('metierPending', () => {
  it('vrai seulement si extension active ET pas encore choisi', () => {
    expect(metierPending(ALL_ON, { metier: null })).toBe(true);
    expect(metierPending(ALL_ON, { metier: 'forge' })).toBe(false);
    expect(metierPending({ ...ALL_ON, metier: false }, { metier: null })).toBe(false);
    expect(metierPending(ALL_ON, null)).toBe(false);
  });
});

describe('cascade de dépendances Métiers', () => {
  it('activer Métiers active forge + alchimie + enchantement (+ équipement)', () => {
    const base = { equipment: false, forge: false, alchemy: false, enchant: false, metier: false };
    const next = applyExtensionToggle(base, 'metier', true);
    for (const id of ['metier', 'forge', 'alchemy', 'enchant', 'equipment']) {
      expect(extOn(next, id)).toBe(true);
    }
  });

  it('désactiver un craft requis désactive Métiers', () => {
    const next = applyExtensionToggle(ALL_ON, 'forge', false);
    expect(extOn(next, 'forge')).toBe(false);
    expect(extOn(next, 'metier')).toBe(false);
  });
});

describe('store : chooseMetier (verrou définitif)', () => {
  beforeEach(() => useGameStore.getState().reset());

  it('fixe le métier de l’équipe active et ferme la modale', () => {
    useGameStore.setState({
      phase: 'game', currentTeam: 0, extensions: ALL_ON,
      showMetierPicker: true,
      teams: [{ name: 'A', emoji: '🦁', metier: null }, { name: 'B', emoji: '🦅', metier: null }],
    });
    S().chooseMetier('alchemy');
    expect(S().teams[0].metier).toBe('alchemy');
    expect(S().showMetierPicker).toBe(false);
  });

  it('verrou : un 2e choix ne change rien', () => {
    useGameStore.setState({
      phase: 'game', currentTeam: 0, extensions: ALL_ON,
      teams: [{ name: 'A', emoji: '🦁', metier: 'forge' }],
    });
    S().chooseMetier('enchant');
    expect(S().teams[0].metier).toBe('forge');
  });

  it('métier invalide ignoré', () => {
    useGameStore.setState({
      phase: 'game', currentTeam: 0, extensions: ALL_ON,
      teams: [{ name: 'A', emoji: '🦁', metier: null }],
    });
    S().chooseMetier('plombier');
    expect(S().teams[0].metier).toBeNull();
  });

  it('choix d’une autre équipe (mobile) ne ferme pas la modale de l’équipe active', () => {
    useGameStore.setState({
      phase: 'game', currentTeam: 0, extensions: ALL_ON, showMetierPicker: true,
      teams: [{ name: 'A', emoji: '🦁', metier: null }, { name: 'B', emoji: '🦅', metier: null }],
    });
    S().chooseMetier('forge', 1); // l'équipe 1 choisit depuis son téléphone
    expect(S().teams[1].metier).toBe('forge');
    expect(S().showMetierPicker).toBe(true); // la modale de l'équipe active reste
  });
});
