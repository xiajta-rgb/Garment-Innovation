import { List, Tag, Empty, Button, Popconfirm, message } from 'antd';
import { DeleteOutlined, FolderOpenOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useBomStore } from '@/store/bomStore';
import type { CanvasComponent } from '@/types';

export default function SavedDesignsPanel() {
  const { garments, removeGarment } = useWorkspaceStore();
  const { loadComponents, setSelectedId, pushHistory } = useCanvasStore();

  const handleLoad = (canvasData: string) => {
    try {
      const parsed = JSON.parse(canvasData);
      const components: CanvasComponent[] = Array.isArray(parsed) ? parsed : parsed.components || [];
      pushHistory();
      loadComponents(components);
      setSelectedId(null);
      // 清空旧 BOM，加载新组件的 BOM
      useBomStore.getState().clearBom();
      components.forEach((comp) => {
        useBomStore.getState().addBomItem({
          id: `bom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          garmentId: '',
          componentId: comp.id,
          componentName: comp.name,
          material: {
            id: '',
            assetCode: '',
            name: '主面料',
            category: comp.category,
            imageUrl: '',
            widthMm: 1500,
            weightGsm: 0,
            pricePerMeter: 0,
            lossRate: 0.12,
          },
          usage: 0,
          unit: 'm',
          cost: 0,
        });
      });
      message.success('设计稿已加载');
    } catch {
      message.error('加载失败');
    }
  };

  const handleDelete = (id: string) => {
    removeGarment(id);
    message.info('已删除');
  };

  if (garments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Empty
          description="暂无保存的设计稿"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <List
      size="small"
      dataSource={garments}
      renderItem={(garment) => (
        <List.Item
          style={{ padding: '8px 12px', cursor: 'pointer' }}
          actions={[
            <Button
              key="load"
              type="link"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => handleLoad(garment.canvasData)}
            >
              加载
            </Button>,
            <Popconfirm
              key="del"
              title="确认删除？"
              onConfirm={() => handleDelete(garment.id)}
              okText="删除"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>,
          ]}
        >
          <List.Item.Meta
            title={
              <span style={{ fontSize: 13 }}>
                {garment.name}
                {garment.isDirty && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>未保存</Tag>}
              </span>
            }
            description={
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {new Date(garment.updatedAt).toLocaleString()}
                {' · '}{garment.styleCode}
              </span>
            }
          />
        </List.Item>
      )}
    />
  );
}
