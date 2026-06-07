import { Layout } from 'antd';
import TemplatePanel from '@/features/template-library/components/TemplatePanel';
import DesignCanvas from '@/features/canvas/components/DesignCanvas';
import CanvasToolbar from '@/features/canvas/components/CanvasToolbar';
import RightPanel from '@/features/right-panel/RightPanel';
import { useCanvasStore } from '@/store/canvasStore';

const { Sider, Content } = Layout;

export default function EditorLayout() {
  const { isDirty, components, lastSavedAt } = useCanvasStore();

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <Layout.Header
        style={{
          height: 44,
          lineHeight: '44px',
          padding: '0 16px',
          background: '#fff',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14,
            }}
          >
            G
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1f1f1f' }}>
            GarmentOS
          </span>
          <span style={{ color: '#bfbfbf', fontSize: 12 }}>
            服装创新设计平台
          </span>
        </div>
        <CanvasToolbar />
      </Layout.Header>

      <Layout>
        {/* 左侧：模板库 */}
        <Sider
          width={260}
          style={{
            background: '#fff',
            borderRight: '1px solid #e8e8e8',
            overflow: 'hidden',
          }}
        >
          <TemplatePanel />
        </Sider>

        {/* 中间：画布区域 */}
        <Content style={{ background: '#e8e8e8', position: 'relative' }}>
          <DesignCanvas />
        </Content>

        {/* 右侧：属性 + BOM + 设计稿 + 存档 */}
        <Sider
          width={300}
          style={{
            background: '#fff',
            borderLeft: '1px solid #e8e8e8',
            overflow: 'hidden',
          }}
        >
          <RightPanel />
        </Sider>
      </Layout>

      {/* 底部状态栏 */}
      <div
        style={{
          height: 24,
          lineHeight: '24px',
          padding: '0 12px',
          background: '#fafafa',
          borderTop: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#8c8c8c',
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          <span>组件: {components.length}</span>
          <span>BOM 项: {components.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {isDirty && <span style={{ color: '#faad14' }}>未保存</span>}
          {lastSavedAt && (
            <span>上次保存: {new Date(lastSavedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </Layout>
  );
}
