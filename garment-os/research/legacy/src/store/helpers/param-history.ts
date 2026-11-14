/**
 * parametricStore 撤销/重做历史管理
 *
 * 快照策略: 只存关键状态字段 (instances/measurements/gender/fit/activePatternId/garmentColor/fabricId/view/viewMode)
 * patternPaths 不存 (由 recomputePattern 从快照状态重新推导)
 */

import type { GeneInstance, GenderType } from '@/types/gene';
import type { BodyMeasurements, StandardSize } from '@/types/measurements';

type PartType = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';

export interface ParamSnapshot {
  instances: Record<PartType, GeneInstance>;
  measurements: BodyMeasurements;
  gender: GenderType;
  standardSize: StandardSize;
  fit: 'slim' | 'regular' | 'loose';
  activePatternId: string;
  garmentColor: string;
  fabricId: string;
  view: 'front' | 'back';
  viewMode: 'clean' | 'industrial';
}

const MAX_HISTORY = 40;
let _history: ParamSnapshot[] = [];
let _historyIndex = -1;

export function pushParamHistory(snapshot: ParamSnapshot): void {
  // 丢弃当前位置之后的历史
  _history = _history.slice(0, _historyIndex + 1);
  _history.push(JSON.parse(JSON.stringify(snapshot)));
  if (_history.length > MAX_HISTORY) _history.shift();
  _historyIndex = _history.length - 1;
}

export function canUndoParam(): boolean {
  return _historyIndex > 0;
}

export function canRedoParam(): boolean {
  return _historyIndex < _history.length - 1;
}

export function undoParam(): ParamSnapshot | null {
  if (_historyIndex <= 0) return null;
  _historyIndex--;
  return JSON.parse(JSON.stringify(_history[_historyIndex]));
}

export function redoParam(): ParamSnapshot | null {
  if (_historyIndex >= _history.length - 1) return null;
  _historyIndex++;
  return JSON.parse(JSON.stringify(_history[_historyIndex]));
}

export function getParamHistoryState() {
  return {
    canUndo: canUndoParam(),
    canRedo: canRedoParam(),
    length: _history.length,
    index: _historyIndex,
  };
}

/** 重置历史 (用于 newDesign / loadDesign 后清空旧历史) */
export function resetParamHistory(): void {
  _history = [];
  _historyIndex = -1;
}
