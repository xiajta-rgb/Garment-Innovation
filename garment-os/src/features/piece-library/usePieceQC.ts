import { useEffect } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { matchesTagFilter } from '@/lib/pattern/piece-tags';
/** Checks are computed once by the draft service. This hook only combines view preferences. */
export function usePieceQC() {
  const draft = useDesignStore(s => s.draft), session = useDesignStore(s => s.sessionId);
  const gateKey = `${session}|${draft.gateKey}`;
  const currentGate = usePieceLibraryStore(s => s.gateKey), hidden = usePieceLibraryStore(s => s.hiddenPieceKeys);
  const filter = usePieceLibraryStore(s => s.tagFilter), ensureGate = usePieceLibraryStore(s => s.ensureGate);
  useEffect(() => { ensureGate(gateKey); },[gateKey,ensureGate]);
  const hiddenPieceKeys = currentGate === gateKey ? hidden : [];
  return { gateKey, pieces:draft.pieces, hiddenPieceKeys,
    visiblePieces:draft.pieces.filter(piece => piece.pass && !hiddenPieceKeys.includes(piece.key) && matchesTagFilter(piece.tags,filter)) };
}
