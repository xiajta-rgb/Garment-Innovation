import type { GarmentAssembly3d } from '@/types/garment3d';
import type { PatternMesh3d } from '@/types/pattern3d';

/** A capability state is an application fact, never a visual quality score. */
export type CapabilityState = 'available' | 'preview-only' | 'not-implemented' | 'blocked';

export interface CapabilityStatus {
  state: CapabilityState;
  label: string;
  reason: string;
}

export interface PatternCapabilityReport {
  sourcePanels: CapabilityStatus;
  seamMapping: CapabilityStatus;
  garmentPreview: CapabilityStatus;
  materialPhysics: CapabilityStatus;
  drapeValidation: CapabilityStatus;
  productionApproval: CapabilityStatus;
}

const status = (state: CapabilityState, label: string, reason: string): CapabilityStatus => ({ state, label, reason });

/**
 * Centralizes the current low-fidelity 3D boundary. It intentionally does
 * not infer physical validity from mesh counts, seam gaps, or render quality.
 */
export function getPatternCapabilityReport(mesh: PatternMesh3d, garment?: GarmentAssembly3d): PatternCapabilityReport {
  const hasPanels = mesh.panels.length > 0;
  const hasSeams = mesh.seams.length > 0 || (garment?.seams.length ?? 0) > 0;
  const hasGarment = garment?.stage === 'seam-constrained-preview';
  return {
    sourcePanels: hasPanels
      ? status('available', '源裁片可用', '已生成带毫米坐标和来源追踪的裁片网格。')
      : status('blocked', '缺少源裁片', '没有可供后续装配或预览消费的裁片。'),
    seamMapping: hasSeams
      ? status('preview-only', '配缝映射预览', '当前记录配缝和长度差，但未执行物理缝合求解。')
      : status('blocked', '缺少配缝关系', '没有配缝关系，不能生成成衣装配预览。'),
    garmentPreview: hasGarment
      ? status('available', '成衣装配预览', '显示网格由源裁片和配缝关系派生，保持与源数据分离。')
      : status('not-implemented', '成衣装配未接通', '当前构型没有可用的成衣装配模型。'),
    materialPhysics: status('not-implemented', '面料物理未接通', '显示布厚、纹理和细分参数不是实测面料物性。'),
    drapeValidation: garment?.drapeValidated
      ? status('available', '垂坠已验证', '仅当单独获得实物或专业审核证据时才可进入该状态。')
      : status('blocked', '垂坠未验证', '当前结果不能代表真实面料垂坠、人体碰撞或试穿。'),
    productionApproval: garment?.productionApproved
      ? status('available', '生产已批准', '仅由独立生产审核流程设置。')
      : status('blocked', '生产未批准', '当前系统没有生产放行证据，禁止将预览当作生产文件。'),
  };
}

