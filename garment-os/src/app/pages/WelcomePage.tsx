import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { RocketOutlined } from '@ant-design/icons';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <RocketOutlined style={{ fontSize: 36, color: '#fff' }} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">GarmentOS</h1>
        <p className="text-lg text-gray-500 mb-8 max-w-md">
          服装创新设计平台 — 拼积木式快速2D款式组合工具
        </p>
        <Button
          type="primary"
          size="large"
          onClick={() => navigate('/editor')}
          style={{ height: 48, paddingInline: 40, fontSize: 16, borderRadius: 8 }}
        >
          进入编辑器
        </Button>
        <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">15min</div>
            <div className="text-sm text-gray-400 mt-1">单款设计时间</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">80%</div>
            <div className="text-sm text-gray-400 mt-1">重复工作替代</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">50+</div>
            <div className="text-sm text-gray-400 mt-1">基础版型模板</div>
          </div>
        </div>
      </div>
    </div>
  );
}
