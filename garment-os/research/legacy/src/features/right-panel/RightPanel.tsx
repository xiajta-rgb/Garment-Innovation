import { Tabs, Empty } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined, FileTextOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useCanvasStore } from '@/store/canvasStore';
import ComponentProperties from './ComponentProperties';
import BomPanel from './BomPanel';
import DesignSheetPanel from '@/features/design-sheet/DesignSheetPanel';
import SavedDesignsPanel from '@/features/design-sheet/SavedDesignsPanel';

export default function RightPanel() {
  const { selectedId, components } = useCanvasStore();
  const selectedComponent = components.find((c) => c.id === selectedId);

  return (
    <div className="h-full flex flex-col">
      <Tabs
        defaultActiveKey="properties"
        size="small"
        style={{ padding: '0 8px', height: '100%' }}
        items={[
          {
            key: 'properties',
            label: (
              <span>
                <AppstoreOutlined /> 属性
              </span>
            ),
            children: (
              <div className="custom-scrollbar" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                {selectedComponent ? (
                  <ComponentProperties componentId={selectedComponent.id} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Empty
                      description="选中组件查看属性"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'bom',
            label: (
              <span>
                <UnorderedListOutlined /> BOM
              </span>
            ),
            children: (
              <div className="custom-scrollbar" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                <BomPanel />
              </div>
            ),
          },
          {
            key: 'sheet',
            label: (
              <span>
                <FileTextOutlined /> 设计稿
              </span>
            ),
            children: (
              <div className="custom-scrollbar" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                <DesignSheetPanel />
              </div>
            ),
          },
          {
            key: 'saved',
            label: (
              <span>
                <DatabaseOutlined /> 存档
              </span>
            ),
            children: (
              <div className="custom-scrollbar" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                <SavedDesignsPanel />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
