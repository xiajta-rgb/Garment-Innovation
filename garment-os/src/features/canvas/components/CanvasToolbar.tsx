import { useEffect } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DeleteOutlined,
  SaveOutlined,
  ExportOutlined,
  FileImageOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useCanvasStore } from '@/store/canvasStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useBomStore } from '@/store/bomStore';
import { exportPNG } from '@/features/canvas/components/canvas-export';

export default function CanvasToolbar() {
  const {
    zoom, setZoom, selectedId, removeComponent,
    components, canUndo, canRedo, undo, redo,
    isDirty, markSaved, pushHistory, clearCanvas,
  } = useCanvasStore();
  const { addGarment } = useWorkspaceStore();
  const bomItems = useBomStore((s) => s.items);

  const handleZoomIn = () => setZoom(useCanvasStore.getState().zoom + 0.1);
  const handleZoomOut = () => setZoom(useCanvasStore.getState().zoom - 0.1);
  const handleResetZoom = () => setZoom(1);

  const handleDelete = () => {
    if (selectedId) {
      pushHistory();
      removeComponent(selectedId);
    }
  };

  const handleSave = () => {
    const garmentId = `g-${Date.now()}`;
    const canvasData = JSON.stringify(components);
    addGarment({
      id: garmentId,
      workspaceId: 'ws-default',
      styleCode: `STYLE-${String(Date.now()).slice(-6)}`,
      category: '连衣裙',
      name: `设计稿 ${new Date().toLocaleDateString()}`,
      canvasData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDirty: false,
      version: 1,
    });
    markSaved();
    message.success('设计稿已保存');
  };

  // 监听 Ctrl+S 的 CustomEvent
  useEffect(() => {
    const handler = () => handleSave();
    document.addEventListener('garment-save', handler);
    return () => document.removeEventListener('garment-save', handler);
  });

  const handleClear = () => {
    pushHistory();
    clearCanvas();
    useBomStore.getState().clearBom();
    message.info('画布已清空');
  };

  const handleExportImage = () => {
    // 优先使用 SVG → PNG 导出 (参数化设计稿)
    exportPNG('garment-sketch');
    message.success('图片已导出');
  };

  const handleExportBom = () => {
    const items = useBomStore.getState().items;
    if (items.length === 0) return;

    // 生成 CSV 格式的 BOM 报表
    const headers = ['部件', '面料', '用量(m)', '单价(元/m)', '损耗率', '成本(元)'];
    const rows = items.map((item) => [
      item.componentName,
      item.material.name,
      item.usage.toFixed(2),
      item.material.pricePerMeter.toFixed(2),
      `${(item.material.lossRate * 100).toFixed(0)}%`,
      item.cost.toFixed(2),
    ]);

    const totalCost = items.reduce((sum, i) => sum + i.cost, 0);
    rows.push(['合计', '', '', '', '', totalCost.toFixed(2)]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const BOM_CSV = '\uFEFF' + csv; // BOM for Excel UTF-8

    const blob = new Blob([BOM_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `BOM-${Date.now()}.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    message.success(`BOM 已导出 (${items.length} 项)`);
  };

  return (
    <Space size={2}>
      <Tooltip title="撤销 (Ctrl+Z)">
        <Button type="text" size="small" icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} />
      </Tooltip>
      <Tooltip title="重做 (Ctrl+Y)">
        <Button type="text" size="small" icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} />
      </Tooltip>

      <div style={{ width: 1, height: 20, background: 'var(--color-border-secondary)', margin: '0 6px' }} />

      <Tooltip title="缩小">
        <Button type="text" size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
      </Tooltip>
      <span
        style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 44, textAlign: 'center', cursor: 'pointer' }}
        onClick={handleResetZoom}
        title="点击重置缩放"
      >
        {Math.round(zoom * 100)}%
      </span>
      <Tooltip title="放大">
        <Button type="text" size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
      </Tooltip>

      <div style={{ width: 1, height: 20, background: 'var(--color-border-secondary)', margin: '0 6px' }} />

      <Tooltip title="删除选中 (Delete)">
        <Button type="text" size="small" icon={<DeleteOutlined />} disabled={!selectedId} onClick={handleDelete} />
      </Tooltip>
      <Tooltip title="清空画布">
        <Button type="text" size="small" icon={<ClearOutlined />} disabled={components.length === 0} onClick={handleClear} />
      </Tooltip>

      <div style={{ width: 1, height: 20, background: 'var(--color-border-secondary)', margin: '0 6px' }} />

      <Tooltip title={isDirty ? '保存 (Ctrl+S)' : '已保存'}>
        <Button
          type={isDirty ? 'primary' : 'text'}
          size="small"
          icon={<SaveOutlined />}
          onClick={handleSave}
        />
      </Tooltip>
      <Tooltip title="导出图片">
        <Button type="text" size="small" icon={<FileImageOutlined />} disabled={components.length === 0} onClick={handleExportImage} />
      </Tooltip>
      <Tooltip title="导出 BOM">
        <Button type="text" size="small" icon={<ExportOutlined />} disabled={bomItems.length === 0} onClick={handleExportBom} />
      </Tooltip>

      <div style={{ width: 1, height: 20, background: 'var(--color-border-secondary)', margin: '0 6px' }} />

      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
        组件: {components.length}
      </span>
      {isDirty && (
        <span style={{ fontSize: 12, color: '#faad14', marginLeft: 4 }}>未保存</span>
      )}
    </Space>
  );
}
