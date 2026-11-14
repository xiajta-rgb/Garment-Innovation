import type { DesignConfiguration } from '@/types/design';
import type { DraftResult } from './draft-service';
import { makeGateKey } from '@/lib/pattern/preview-gate';

/** A record is reproducible input + derived checks, never an authority to approve imported geometry. */
export function createAssemblyRecord(configuration: DesignConfiguration, draft: DraftResult) {
  const gateKey = makeGateKey(configuration.activePatternId, configuration.gender, configuration.fit, configuration.standardSize, configuration.measurements as unknown as Record<string, number>, configuration.construction);
  if (draft.gateKey !== gateKey || !draft.assembly || draft.assembly.templateId !== configuration.activePatternId || draft.assembly.version !== configuration.engineVersion) throw new Error('当前尺寸与结构检查不一致，请先重新生成');
  return structuredClone({ schema: 'garment-os/assembly-record/v1', scope: '系统结构及装配规则验收', configuration,
    draftStatus: draft.status, assembly: draft.assembly, productionApproved: false });
}
