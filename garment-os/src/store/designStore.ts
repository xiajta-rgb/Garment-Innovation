import { create } from 'zustand';
import { DESIGN_SCHEMA, ENGINE_VERSION, type DesignConfiguration, type DesignDocument, type DesignPresentation, type DesignRepository, type DesignSummary } from '@/types/design';
import type { BodyMeasurements, GenderType, StandardSize } from '@/types/measurements';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { requireReviewedPattern } from '@/data/patternReview';
import { computeDraft, type DraftResult } from '@/application/draft-service';
import { createHistory } from '@/application/design-history';
import { readConfiguration, readDesignDocument } from '@/application/design-document';
import type { PatternExportEnvelope } from '@/lib/pattern/pattern-format';
import { resolveReviewedImport } from '@/application/pattern-transfer';
import type { ConstructionSelection } from '@/types/construction';
import { readConstructionSelection } from '@/lib/pattern/construction-selection';
import { newCompanyStyle,readCompanyStyle } from '@/lib/pattern/company-style';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import type { CompanyStyleDraft } from '@/types/company-style';
import { reconcileCompanyAssets } from '@/lib/pattern/reusable-assets';
import { hasStyleVariations } from '@/lib/pattern/style-variation';
import { readPieceDesign,supportsPieceDesign } from '@/lib/pattern/piece-design-spec';
import type { PieceDesignSpec } from '@/types/piece-design';
import type { ManagedMaterialAssignment } from '@/types/managed-material';
import type { MaterialSlot } from '@/types/reusable-assets';
import { canAssignMaterial, readManagedAssignments } from '@/application/managed-materials';
import type { PieceComposition } from '@/types/piece-composition';
import { readPieceComposition } from '@/lib/pattern/piece-composition';
import { normalizeComposition } from '@/application/composition-catalogue';
import type { DesignAssetRecord, DesignAssetRepository } from '@/types/design-library';

interface EditorSnapshot { configuration: DesignConfiguration; presentation: DesignPresentation; name: string }
export interface DesignState extends DesignConfiguration, DesignPresentation {
  draft: DraftResult;
  sessionId: string; currentDesignId: string | null; designName: string; designCreatedAt: string | null; designTags: string[];
  lastError: string | null; canUndo: boolean; canRedo: boolean; isSaving: boolean; isLoading: boolean;
  setGender(gender: GenderType): void;
  setSize(size: StandardSize): void;
  setFit(fit: DesignConfiguration['fit']): void;
  updateMeasurements(partial: Partial<BodyMeasurements>): void;
  applyPattern(id: string): void;
  applyReviewedConfiguration(value: DesignConfiguration): void;
  setPieceDesign(value: PieceDesignSpec): void;
  setPieceComposition(value: PieceComposition): void;
  setManagedMaterial(slot: MaterialSlot, value: ManagedMaterialAssignment | null): void;
  setConstruction(value: ConstructionSelection | undefined): void;
  setCompanyDraft(value: CompanyStyleDraft): void;
  applyCompanyDraft(value: CompanyStyleDraft): void;
  restorePatternInputs(envelope: PatternExportEnvelope): void;
  setColor(color: string): void; setFabric(id: string): void;
  setView(view: DesignPresentation['view']): void; setViewMode(mode: DesignPresentation['viewMode']): void;
  setDesignName(name: string): void; clearError(): void;
  getConfiguration(): DesignConfiguration;
  newDesign(): void; undo(): void; redo(): void;
  listDesigns(): Promise<DesignSummary[]>;
  saveDesign(): Promise<string>; loadDesign(id: string): Promise<boolean>; deleteDesign(id: string): Promise<void>;
}

export function configurationOf(s: DesignConfiguration): DesignConfiguration {
  return { activePatternId: s.activePatternId, gender: s.gender, standardSize: s.standardSize,
    fit: s.fit, measurements: structuredClone(s.measurements), engineVersion: s.engineVersion,
    garmentColor: s.garmentColor, fabricId: s.fabricId, construction: s.construction ? structuredClone(s.construction) : undefined,
    ...(s.pieceDesign?{pieceDesign:structuredClone(s.pieceDesign)}:{}),
    ...(s.pieceComposition?{pieceComposition:normalizeComposition(structuredClone(s.pieceComposition))}:{}),
    ...(s.managedMaterials?{managedMaterials:structuredClone(s.managedMaterials)}:{}) };
}
function sameMeasurements(a:BodyMeasurements,b:BodyMeasurements):boolean {
  return Object.keys({...a,...b}).every(key=>Object.is(a[key as keyof BodyMeasurements],b[key as keyof BodyMeasurements]));
}
function sameGeometry(a: DesignConfiguration, b: DesignConfiguration): boolean {
  return a.activePatternId === b.activePatternId && a.gender === b.gender && a.standardSize === b.standardSize && a.fit === b.fit && a.engineVersion === b.engineVersion && sameMeasurements(a.measurements,b.measurements) && JSON.stringify(a.construction) === JSON.stringify(b.construction);
}
function defaults(gender: GenderType = 'male'): EditorSnapshot {
  return { configuration: { activePatternId: 'brian-reference', gender, standardSize: 'M', fit: 'regular',
    measurements: getReferenceMeasurements(gender,'M'), engineVersion: ENGINE_VERSION, garmentColor: '#87CEEB', fabricId: 'solid', construction: undefined },
    presentation: { view: 'front', viewMode: 'clean', companyDraft: newCompanyStyle() }, name: 'Untitled Design' };
}
interface Dependencies { repository: DesignRepository; assetRepository?: DesignAssetRepository; draft?: typeof computeDraft; id?: () => string; now?: () => string }

/** One editor session; engines, persistence and history are injected independent services. */
export function createDesignStore(dependencies: Dependencies) {
  const repository = dependencies.repository, solve = dependencies.draft ?? computeDraft;
  const newId = dependencies.id ?? (() => crypto.randomUUID()), now = dependencies.now ?? (() => new Date().toISOString());
  const initial = defaults(), history = createHistory(initial);
  const pendingSaves = new Map<string,{ tail: Promise<string>; id: string; createdAt: string }>();
  let loadTicket = 0, mutation = 0;
  return create<DesignState>()((set,get) => {
    const snapshot = (): EditorSnapshot => ({ configuration: configurationOf(get()), presentation: { view: get().view, viewMode: get().viewMode, companyDraft: get().companyDraft ? structuredClone(get().companyDraft) : undefined }, name: get().designName });
    function install(value: EditorSnapshot, reset = false, requiredValid = false) {
      const current = get(), config = value.configuration;
      if(config.pieceComposition)config.pieceComposition=normalizeComposition(config.pieceComposition);
      const company=value.presentation.companyDraft;
      if(company?.cadApplied&&companyStyleMaster(company.masterId).cadTemplateId!==config.activePatternId)value.presentation={...value.presentation,companyDraft:{...company,cadApplied:false}};
      if (sameMeasurements(config.measurements,current.measurements)) config.measurements=current.measurements;
      const draft = sameGeometry(config,current) ? current.draft : solve(config);
      if (requiredValid && draft.status === 'blocked') throw new Error(draft.error!);
      mutation++;
      if (reset) history.reset(value); else history.push(value);
      set({ pieceComposition:undefined,pieceDesign:undefined,managedMaterials:undefined,...config, companyDraft: undefined, ...value.presentation, designName: value.name, draft, lastError: draft.error, isLoading: false, ...history.flags });
    }
    function change(partial: Partial<DesignConfiguration & DesignPresentation> & { name?: string }) {
      const s = snapshot();
      if(partial.activePatternId&&partial.activePatternId!==s.configuration.activePatternId)partial={pieceDesign:undefined,...partial};
      install({ configuration: configurationOf({ ...s.configuration,...partial }),
        presentation: { view: partial.view ?? s.presentation.view, viewMode: partial.viewMode ?? s.presentation.viewMode, companyDraft: 'companyDraft' in partial ? partial.companyDraft : s.presentation.companyDraft }, name: partial.name ?? s.name });
    }
    return {
      ...initial.configuration, ...initial.presentation, designName: initial.name, draft: solve(initial.configuration),
      sessionId: newId(), currentDesignId: null, designCreatedAt: null, designTags: [], lastError: null,
      canUndo: false, canRedo: false, isSaving: false, isLoading: false,
      getConfiguration: () => configurationOf(get()),
      setGender: gender => change({ gender, measurements: getReferenceMeasurements(gender,get().standardSize) }),
      setSize: standardSize => change({ standardSize, measurements: getReferenceMeasurements(get().gender,standardSize) }),
      setFit: fit => change({ fit }),
      updateMeasurements: partial => change({ measurements: { ...get().measurements,...partial } }),
      setConstruction: value => {
        try { change({ construction: readConstructionSelection(get().activePatternId, value) }); }
        catch (error) { set({ lastError: error instanceof Error ? error.message : String(error) }); }
      },
      setCompanyDraft: value => {
        const companyDraft=readCompanyStyle(reconcileCompanyAssets({...value,cadApplied:hasStyleVariations(value)?false:value.cadApplied})),current=get().companyDraft;
        // Applying a different master always requires the explicit CAD action.
        companyDraft.cadApplied=!hasStyleVariations(companyDraft)&&!!current?.cadApplied&&companyDraft.masterId===current.masterId&&companyStyleMaster(companyDraft.masterId).cadTemplateId===get().activePatternId;
        change({companyDraft,name:companyDraft.name,...(companyDraft.cadApplied?{garmentColor:companyDraft.color}:{})});
      },
      applyCompanyDraft: value => {
        const companyDraft=readCompanyStyle(value),master=companyStyleMaster(companyDraft.masterId);
        if(hasStyleVariations(companyDraft))throw Error('二维改款尚未接通对应裁片，请先单独制版');
        if(!master.cadTemplateId)throw Error('此公司母版尚未接通同构型裁片方法');
        requireReviewedPattern(master.cadTemplateId);
        const configuration=readConfiguration({...get().getConfiguration(),activePatternId:master.cadTemplateId,construction:undefined,pieceDesign:undefined,garmentColor:companyDraft.color});
        install({configuration,presentation:{view:'front',viewMode:'clean',companyDraft:{...companyDraft,cadApplied:true}},name:companyDraft.name},false,true);
      },
      applyPattern: activePatternId => {
        try { requireReviewedPattern(activePatternId); change({ activePatternId, construction: activePatternId === get().activePatternId ? get().construction : undefined }); }
        catch (error) { set({ lastError: error instanceof Error ? error.message : String(error) }); }
      },
      applyReviewedConfiguration: value => {
        const current=snapshot(),configuration=readConfiguration(value);
        install({...current,configuration},false,true);
      },
      setPieceDesign: value => {
        if(!supportsPieceDesign(get().activePatternId))throw Error('请先选配套T恤裁片');
        change({pieceDesign:readPieceDesign(value)});
      },
      setPieceComposition: value => change({pieceComposition:normalizeComposition(readPieceComposition(value))}),
      setManagedMaterial: (slot,value) => {
        const materials={...get().managedMaterials};
        if(value){const checked=readManagedAssignments({[slot]:value})!;if(!canAssignMaterial(checked[slot]!.material))throw Error('只有明确启用的面料可新增关联。');materials[slot]=checked[slot];}
        else delete materials[slot];
        change({managedMaterials:readManagedAssignments(materials)});
      },
      restorePatternInputs: envelope => {
        const input = resolveReviewedImport(envelope);
        const configuration = readConfiguration({ ...get().getConfiguration(), ...input, activePatternId: input.patternId });
        install({ configuration, presentation: { view: 'front', viewMode: 'clean' }, name: envelope.pattern.name },true,true);
        loadTicket++;
        set({ sessionId: newId(), currentDesignId: null, designCreatedAt: null, designTags: [], isSaving: false });
      },
      setColor: garmentColor => change({ garmentColor,...(get().companyDraft?.cadApplied?{companyDraft:reconcileCompanyAssets({...get().companyDraft!,color:garmentColor})}:{}) }), setFabric: fabricId => change({ fabricId }),
      setView: view => change({ view }), setViewMode: viewMode => change({ viewMode }),
      setDesignName: name => change({ name }), clearError: () => set({ lastError: null }),
      undo: () => {
        const value = history.undo(); if (!value) return;
        mutation++;
        const current=get();
        if (sameMeasurements(value.configuration.measurements,current.measurements)) value.configuration.measurements=current.measurements;
        const draft = sameGeometry(value.configuration,current) ? current.draft : solve(value.configuration);
        set({ pieceComposition:undefined,pieceDesign:undefined,managedMaterials:undefined,...value.configuration,companyDraft:undefined,...value.presentation,designName:value.name,draft,lastError:draft.error,isLoading:false,...history.flags });
      },
      redo: () => {
        const value = history.redo(); if (!value) return;
        mutation++;
        const current=get();
        if (sameMeasurements(value.configuration.measurements,current.measurements)) value.configuration.measurements=current.measurements;
        const draft = sameGeometry(value.configuration,current) ? current.draft : solve(value.configuration);
        set({ pieceComposition:undefined,pieceDesign:undefined,managedMaterials:undefined,...value.configuration,companyDraft:undefined,...value.presentation,designName:value.name,draft,lastError:draft.error,isLoading:false,...history.flags });
      },
      newDesign: () => {
        loadTicket++;
        const value = defaults(get().gender);
        install(value,true);
        set({ sessionId:newId(),currentDesignId:null,designCreatedAt:null,designTags:[],isSaving:false,isLoading:false });
      },
      listDesigns: () => repository.list(),
      saveDesign: () => {
        const s = get(), session = s.sessionId;
        const existing = pendingSaves.get(session);
        let configuration: DesignConfiguration;
        try {
          if (s.draft.status === 'blocked') throw new Error(s.draft.error!);
          configuration = readConfiguration(s.getConfiguration());
        } catch (error) {
          set({ lastError: error instanceof Error ? error.message : String(error) });
          return Promise.reject(error);
        }
        const date = now(), id = s.currentDesignId ?? existing?.id ?? `design-${newId()}`;
        const doc: DesignDocument = { schema:DESIGN_SCHEMA,id,name:s.designName,gender:s.gender,
          createdAt:s.designCreatedAt ?? existing?.createdAt ?? date,updatedAt:date,tags:[...new Set([...s.designTags.filter(t=>!['male','female','unisex'].includes(t)),s.gender])],configuration,
          presentation:{view:s.view,viewMode:s.viewMode,companyDraft:s.companyDraft?readCompanyStyle(s.companyDraft):undefined} };
        set({isSaving:true,lastError:null});
        const task = (existing?.tail.catch(() => undefined) ?? Promise.resolve()).then(() => repository.save(doc)).then(async () => {
          // Every saved three-view combination becomes a durable design asset.
          // The asset keeps the source design link and stays review-blocked until
          // a human has completed pattern and sample checks.
          const plans = configuration.pieceComposition?.plans ?? [];
          await Promise.all(dependencies.assetRepository ? plans.filter(plan => plan.pieces.length > 0).map(plan => {
            const asset: DesignAssetRecord = {
              schema: 'garment-os/design-asset/v1',
              id: `asset-${id}-${plan.id}`,
              name: plan.name,
              categoryId: configuration.activePatternId,
              patternId: configuration.activePatternId,
              gender: configuration.gender,
              standardSize: configuration.standardSize,
              fit: configuration.fit,
              tags: [...new Set([configuration.gender, configuration.activePatternId, ...s.designTags, ...(plan.matrix?.changedAxes ?? [])])],
              matrixBatchId: plan.matrix?.batchId,
              sourceDesignId: id,
              sourcePlanId: plan.id,
              composition: structuredClone(plan),
              reviewStatus: plan.matrix ? 'exploration' : 'draft',
              productionApproved: false,
              status: 'active',
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
              version: 1,
            };
            return dependencies.assetRepository!.save(asset);
          }) : []);
        }).then(() => {
          if (get().sessionId === session) set({currentDesignId:id,designCreatedAt:doc.createdAt});
          return id;
        }).catch(error => {
          if (get().sessionId === session) set({lastError:`保存失败：${error instanceof Error ? error.message : String(error)}`});
          throw error;
        }).finally(() => {
          if (pendingSaves.get(session)?.tail === task) {
            pendingSaves.delete(session);
            if (get().sessionId === session) set({isSaving:false});
          }
        });
        pendingSaves.set(session,{ tail:task,id,createdAt:doc.createdAt });
        return task;
      },
      loadDesign: async id => {
        const ticket = ++loadTicket, version = mutation, session = get().sessionId;
        const isCurrent = () => ticket === loadTicket && version === mutation && session === get().sessionId;
        set({isLoading:true,lastError:null});
        try {
          const raw = await repository.get(id);
          if (!isCurrent()) return false;
          if (!raw) throw new Error('未找到设计记录');
          const doc = readDesignDocument(raw);
          if(doc.configuration.pieceComposition)doc.configuration.pieceComposition=normalizeComposition(doc.configuration.pieceComposition);
          if (doc.id !== id) throw new Error('设计记录标识不一致');
          const draft = solve(doc.configuration);
          if (draft.status === 'blocked') throw new Error(draft.error!);
          const value: EditorSnapshot = {configuration:doc.configuration,presentation:doc.presentation,name:doc.name};
          mutation++; history.reset(value);
          set({ pieceComposition:undefined,pieceDesign:undefined,managedMaterials:undefined,...doc.configuration,companyDraft:undefined,...doc.presentation,designName:doc.name,draft,sessionId:newId(),currentDesignId:doc.id,
            designCreatedAt:doc.createdAt,designTags:doc.tags,lastError:null,isSaving:false,isLoading:false,...history.flags });
          return true;
        } catch (error) {
          if (isCurrent()) set({lastError:`载入失败：${error instanceof Error ? error.message : String(error)}；当前设计保持不变`});
          return false;
        } finally { if (ticket === loadTicket) set({isLoading:false}); }
      },
      deleteDesign: async id => {
        const session = get().sessionId;
        try {
          const pending = [...pendingSaves.values()].find(item => item.id === id);
          if (pending) await pending.tail;
          await repository.delete(id);
          if (get().sessionId === session && get().currentDesignId === id) get().newDesign();
        } catch (error) {
          set({lastError:`删除失败：${error instanceof Error ? error.message : String(error)}`});
          throw error;
        }
      },
    };
  });
}
