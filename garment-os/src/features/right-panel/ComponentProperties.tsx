import { Descriptions, Tag, InputNumber, Space } from 'antd';
import type { CanvasComponent } from '@/types';
import { useCanvasStore } from '@/store/canvasStore';

interface Props {
  componentId: string;
}

export default function ComponentProperties({ componentId }: Props) {
  const { components, updateComponent, pushHistory } = useCanvasStore();
  const component = components.find(c => c.id === componentId);

  if (!component) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        Component not found
      </div>
    );
  }

  const handleUpdate = (updates: Partial<CanvasComponent>) => {
    pushHistory();
    updateComponent(component.id, updates);
  };

  return (
    <div className="px-2">
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="名称">{component.name}</Descriptions.Item>
        <Descriptions.Item label="X">
          <InputNumber
            size="small"
            value={Math.round(component.x)}
            onChange={(v) => v !== null && handleUpdate({ x: v })}
            style={{ width: '100%' }}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Y">
          <InputNumber
            size="small"
            value={Math.round(component.y)}
            onChange={(v) => v !== null && handleUpdate({ y: v })}
            style={{ width: '100%' }}
          />
        </Descriptions.Item>
        <Descriptions.Item label="缩放 X">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              size="small"
              value={Math.round(component.scaleX * 100)}
              onChange={(v) => v !== null && handleUpdate({ scaleX: v / 100 })}
              min={10}
              max={500}
              style={{ width: 'calc(100% - 28px)' }}
            />
            <span className="ant-input-group-addon" style={{ lineHeight: '24px', padding: '0 8px', fontSize: 13 }}>%</span>
          </Space.Compact>
        </Descriptions.Item>
        <Descriptions.Item label="缩放 Y">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              size="small"
              value={Math.round(component.scaleY * 100)}
              onChange={(v) => v !== null && handleUpdate({ scaleY: v / 100 })}
              min={10}
              max={500}
              style={{ width: 'calc(100% - 28px)' }}
            />
            <span className="ant-input-group-addon" style={{ lineHeight: '24px', padding: '0 8px', fontSize: 13 }}>%</span>
          </Space.Compact>
        </Descriptions.Item>
        <Descriptions.Item label="旋转">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              size="small"
              value={Math.round(component.rotation)}
              onChange={(v) => v !== null && handleUpdate({ rotation: v })}
              min={-360}
              max={360}
              style={{ width: 'calc(100% - 24px)' }}
            />
            <span className="ant-input-group-addon" style={{ lineHeight: '24px', padding: '0 8px', fontSize: 13 }}>°</span>
          </Space.Compact>
        </Descriptions.Item>
        <Descriptions.Item label="面料">
          {component.materialId ? (
            <Tag color="blue">已应用</Tag>
          ) : (
            <Tag>未应用</Tag>
          )}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
