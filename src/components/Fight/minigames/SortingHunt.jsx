import { useRef } from 'react';
import BubbleHunt from './BubbleHunt.jsx';
import { SVT_CHALLENGES, shuffle } from '../../../data/fightData';

/**
 * Le Grand Tri (SVT) — bulles-mots qui apparaissent et éclatent : touche
 * les éléments de la catégorie demandée (vertébrés, ovipares, os…) avant
 * qu'ils disparaissent. Le défi change à chaque manche sans se répéter
 * (composant persistant pour tout le combat).
 */
export default function SortingHunt(props) {
  const used = useRef([]);

  const pickChallenge = () => {
    const remaining = SVT_CHALLENGES.filter((c) => !used.current.includes(c.id));
    const pool = remaining.length ? remaining : SVT_CHALLENGES;
    const ch = shuffle(pool)[0];
    used.current = [...used.current, ch.id];
    return ch;
  };

  return <BubbleHunt {...props} pickChallenge={pickChallenge} />;
}
