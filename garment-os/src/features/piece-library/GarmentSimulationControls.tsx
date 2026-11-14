import type { Dispatch, SetStateAction } from 'react';
import type { GarmentSimulationSettings } from './garment-simulation';

export function GarmentSimulationControls({settings,setSettings,mannequinVisible}:{settings:GarmentSimulationSettings;setSettings:Dispatch<SetStateAction<GarmentSimulationSettings>>;mannequinVisible:boolean}){
  const patch=(next:Partial<GarmentSimulationSettings>)=>setSettings(previous=>({...previous,...next}));
  const runPreview=()=>patch({state:settings.state==='preview'?'idle':'preview'});
  return <section className="mesh-inspector-section mesh-simulation-panel" data-testid="garment-simulation-panel">
    <header className="mesh-section-heading"><div><h4>柔性仿真准备</h4><small>XPBD 参数组 · 仅展示配置</small></div><span className={`mesh-status-dot ${settings.state==='preview'?'is-active':''}`}>{settings.state==='preview'?'预览中':'未运行'}</span></header>
    <div className="mesh-simulation-summary"><strong data-testid="simulation-mode">{settings.solver==='xpbd-preview'?'XPBD 预览配置':'未选择求解器'}</strong><span>未接入布料求解器</span></div>
    <div className="mesh-simulation-grid">
      <label className="mesh-field">颗粒间距 mm<input aria-label="仿真颗粒间距 mm" type="number" min="4" max="40" step="1" value={settings.particleMm} onChange={e=>patch({particleMm:Math.max(4,Math.min(40,Number(e.target.value)||12))})}/></label>
      <label className="mesh-field">子步数<input aria-label="仿真子步数" type="number" min="1" max="16" step="1" value={settings.substeps} onChange={e=>patch({substeps:Math.max(1,Math.min(16,Number(e.target.value)||4))})}/></label>
      <label className="mesh-field">阻尼 <output>{Math.round(settings.damping*100)}%</output><input aria-label="仿真阻尼" type="range" min="0" max=".6" step=".01" value={settings.damping} onChange={e=>patch({damping:Number(e.target.value)})}/></label>
      <label className="mesh-field">碰撞间隙 mm<input aria-label="碰撞间隙 mm" type="number" min="0" max="12" step=".5" value={settings.collisionOffsetMm} onChange={e=>patch({collisionOffsetMm:Math.max(0,Math.min(12,Number(e.target.value)||0))})}/></label>
    </div>
    <div className="mesh-simulation-toggles">
      <label><input type="checkbox" aria-label="启用重力" checked={settings.gravity} onChange={e=>patch({gravity:e.target.checked})}/>重力</label>
      <label><input type="checkbox" aria-label="启用自碰撞" checked={settings.selfCollision} onChange={e=>patch({selfCollision:e.target.checked})}/>自碰撞</label>
      <label className={!mannequinVisible?'is-disabled':''}><input type="checkbox" aria-label="启用人台碰撞" checked={settings.mannequinCollision} disabled={!mannequinVisible} onChange={e=>patch({mannequinCollision:e.target.checked})}/>人台碰撞</label>
    </div>
    <button className="mesh-simulation-run" data-testid="simulation-preview-toggle" onClick={runPreview}>{settings.state==='preview'?'停止预览':'运行预览配置'}</button>
    <p className="mesh-simulation-limit" data-testid="simulation-boundary">当前仅保存求解参数并显示状态，不改变裁片几何；碰撞、自碰撞、重力垂坠和真实面料物性尚未执行。</p>
  </section>;
}
