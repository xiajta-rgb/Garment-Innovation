import { useState } from 'react';
import { Input, Form, Button, Space, Select, message } from 'antd';
import { SaveOutlined, FileImageOutlined } from '@ant-design/icons';
import { useCanvasStore } from '@/store/canvasStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface DesignSheetInfo {
  companyName: string;
  styleCode: string;
  styleName: string;
  season: string;
  category: string;
  designer: string;
  reviewer: string;
  date: string;
  fabricInfo: string;
  accessoryInfo: string;
  notes: string;
}

const defaultInfo: DesignSheetInfo = {
  companyName: '',
  styleCode: '',
  styleName: '',
  season: '',
  category: '连衣裙',
  designer: '',
  reviewer: '',
  date: new Date().toISOString().split('T')[0],
  fabricInfo: '',
  accessoryInfo: '',
  notes: '',
};

const SEASONS = ['2024春', '2024夏', '2024秋', '2024冬', '2025春', '2025夏', '2025秋', '2025冬'];
const CATEGORIES = ['连衣裙', '上衣', '裤装', '半裙', '外套', '风衣', '衬衫', 'T恤', '针织', '套装'];

export default function DesignSheetPanel() {
  const [form] = Form.useForm();
  const [info, setInfo] = useState<DesignSheetInfo>(defaultInfo);
  const { components, markSaved } = useCanvasStore();
  const { addGarment } = useWorkspaceStore();

  const handleSave = () => {
    const garmentId = `g-${Date.now()}`;
    addGarment({
      id: garmentId,
      workspaceId: 'ws-default',
      styleCode: info.styleCode || `STYLE-${String(Date.now()).slice(-6)}`,
      category: info.category,
      name: info.styleName || `设计稿 ${new Date().toLocaleDateString()}`,
      canvasData: JSON.stringify({ components, sheetInfo: info }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDirty: false,
      version: 1,
    });
    markSaved();
    message.success('设计稿已保存');
  };

  const handleExportWithTemplate = () => {
    const stage = useCanvasStore.getState().getStageRef();
    if (!stage) return;

    // 隐藏 Transformer
    const trs = stage.find('Transformer');
    trs.forEach((tr) => tr.hide());
    stage.draw();

    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
    trs.forEach((tr) => tr.show());
    stage.draw();

    const link = document.createElement('a');
    link.download = `${info.styleCode || '设计稿'}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    message.success('设计稿已导出（含模板信息）');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100">
        <h4 className="font-semibold text-sm">设计稿信息</h4>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        <Form
          form={form}
          layout="vertical"
          size="small"
          initialValues={defaultInfo}
          onValuesChange={(_, allValues) => setInfo(allValues)}
        >
          <Form.Item label="公司名称" name="companyName" className="mb-2">
            <Input placeholder="输入公司名称" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-2">
            <Form.Item label="款式号" name="styleCode" className="mb-2">
              <Input placeholder="如: DL-2024-001" />
            </Form.Item>
            <Form.Item label="款式名称" name="styleName" className="mb-2">
              <Input placeholder="输入款式名称" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Form.Item label="季节" name="season" className="mb-2">
              <Select placeholder="选择季节" options={SEASONS.map((s) => ({ label: s, value: s }))} allowClear />
            </Form.Item>
            <Form.Item label="品类" name="category" className="mb-2">
              <Select placeholder="选择品类" options={CATEGORIES.map((c) => ({ label: c, value: c }))} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Form.Item label="设计师" name="designer" className="mb-2">
              <Input placeholder="设计师姓名" />
            </Form.Item>
            <Form.Item label="审核人" name="reviewer" className="mb-2">
              <Input placeholder="审核人姓名" />
            </Form.Item>
          </div>

          <Form.Item label="日期" name="date" className="mb-2">
            <Input type="date" />
          </Form.Item>

          <Form.Item label="面料信息" name="fabricInfo" className="mb-2">
            <Input.TextArea rows={2} placeholder="主面料、辅料面料等" />
          </Form.Item>

          <Form.Item label="辅料信息" name="accessoryInfo" className="mb-2">
            <Input.TextArea rows={2} placeholder="纽扣、拉链、织带等" />
          </Form.Item>

          <Form.Item label="备注" name="notes" className="mb-2">
            <Input.TextArea rows={2} placeholder="工艺说明、特殊要求等" />
          </Form.Item>
        </Form>
      </div>

      <div className="px-3 py-2 border-t border-gray-100">
        <Space style={{ width: '100%' }} direction="vertical" size={4}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            block
            onClick={handleSave}
          >
            保存设计稿
          </Button>
          <Button
            icon={<FileImageOutlined />}
            block
            onClick={handleExportWithTemplate}
            disabled={components.length === 0}
          >
            导出含模板图片
          </Button>
        </Space>
      </div>
    </div>
  );
}
