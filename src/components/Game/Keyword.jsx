// Mot-clé cliquable du journal : survol/clic → fiche d'info (glossaire).
// Chaque occurrence est son propre composant (useId stable pour l'ancrage).
import { useInfoTrigger } from './useInfoTrigger';

export default function Keyword({ descriptor, children }) {
  const trigger = useInfoTrigger(descriptor);
  return <span className="log-kw" {...trigger}>{children}</span>;
}
