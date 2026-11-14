/** View preferences only. Geometry and computed checks belong to the design application. */
import { create } from 'zustand';
import type { PartType } from '@/types/pattern';
export interface ReferenceBrowse { family?: PartType; role?: string }
interface PieceLibraryState {
  gateKey: string; hiddenPieceKeys: string[]; selectedPieceKey: string | null; tagFilter: string[]; activePart: PartType;
  referenceBrowse: ReferenceBrowse | null;
  currentPiecesView:boolean;
  showCurrentPieces():void;
  openReferenceCatalogue(family?:PartType,role?:string):void; closeReferenceCatalogue():void;
  ensureGate(key: string): void;
  setHidden(key: string, piece: string, hidden: boolean): void;
  showAllChecked(): void;
  selectPiece(key: string | null): void;
  toggleTagFilter(id: string): void; setTagFilter(ids: string[]): void; clearTagFilter(): void; setActivePart(part: PartType): void;
}
export const usePieceLibraryStore = create<PieceLibraryState>()((set,get) => ({
  gateKey: '', hiddenPieceKeys: [], selectedPieceKey: null, tagFilter: [], activePart: 'body', referenceBrowse:null, currentPiecesView:false,
  showCurrentPieces:()=>set({currentPiecesView:true,tagFilter:[],referenceBrowse:null}),
  openReferenceCatalogue:(family,role)=>set({referenceBrowse:{family,role}}),
  closeReferenceCatalogue:()=>set({referenceBrowse:null,currentPiecesView:false}),
  ensureGate: key => { if (get().gateKey !== key) set({ gateKey:key, hiddenPieceKeys:[], selectedPieceKey:null }); },
  setHidden: (key,piece,hidden) => {
    if (get().gateKey !== key) return;
    set(s => ({ hiddenPieceKeys: hidden ? [...new Set([...s.hiddenPieceKeys,piece])] : s.hiddenPieceKeys.filter(p => p !== piece) }));
  },
  showAllChecked: () => set({ hiddenPieceKeys:[] }),
  selectPiece: selectedPieceKey => set({selectedPieceKey}),
  toggleTagFilter: id => set(s => ({ tagFilter:s.tagFilter.includes(id) ? s.tagFilter.filter(t => t !== id) : [...s.tagFilter,id] })),
  setTagFilter: ids => set({tagFilter:[...new Set(ids)]}),
  clearTagFilter: () => set({tagFilter:[],referenceBrowse:null,currentPiecesView:false}), setActivePart: activePart => set({activePart}),
}));
