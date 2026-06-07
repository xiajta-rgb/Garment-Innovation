import { useCallback } from 'react';
import { Card } from 'antd';
import type { Template } from '@/types';

interface Props {
  template: Template;
}

export default function TemplateCard({ template }: Props) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('template', JSON.stringify(template));
      e.dataTransfer.effectAllowed = 'copy';
    },
    [template]
  );

  // 解析 canvasData 获取缩略图路径
  let thumbnailPaths: { data: string; fill: string; stroke: string; strokeWidth: number }[] = [];
  try {
    const parsed = JSON.parse(template.canvasData);
    thumbnailPaths = parsed.paths ?? [];
  } catch {
    // ignore
  }

  return (
    <Card
      hoverable
      size="small"
      draggable
      onDragStart={handleDragStart}
      style={{ cursor: 'grab' }}
      styles={{ body: { padding: '8px' } }}
    >
      {/* SVG 缩略图 */}
      <div
        className="w-full bg-gray-50 rounded flex items-center justify-center"
        style={{ height: 80 }}
      >
        <svg
          viewBox="0 0 550 450"
          width="100%"
          height="100%"
          style={{ maxWidth: 120, maxHeight: 70 }}
        >
          {thumbnailPaths.map((p, i) => (
            <path key={i} d={p.data} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
          ))}
        </svg>
      </div>
      <div className="text-xs text-center mt-1 text-gray-600 truncate">{template.name}</div>
    </Card>
  );
}
