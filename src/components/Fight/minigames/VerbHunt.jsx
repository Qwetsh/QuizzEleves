import BubbleHunt from './BubbleHunt.jsx';
import { IRREGULAR_VERBS, REGULAR_VERBS } from '../../../data/fightData';

const VERB_CHALLENGE = {
  id: 'verbes-irreguliers',
  prompt: 'Touche les verbes IRRÉGULIERS !',
  good: IRREGULAR_VERBS,
  bad: REGULAR_VERBS,
};

/**
 * Chasse aux verbes irréguliers (anglais) — bulles-mots qui apparaissent
 * et éclatent : touche les verbes irréguliers avant qu'ils disparaissent.
 */
export default function VerbHunt(props) {
  return <BubbleHunt {...props} pickChallenge={() => VERB_CHALLENGE} />;
}
