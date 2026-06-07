import { useState, useEffect } from 'react';
import { Tabs, Input, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTemplateStore } from '@/store/templateStore';
import { TEMPLATE_CATEGORIES } from '@/types/template';
import TemplateCard from './TemplateCard';

export default function TemplatePanel() {
  const { activeCategory, loading, setActiveCategory, setSearchQuery, fetchTemplates, getFilteredTemplates } =
    useTemplateStore();
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    fetchTemplates(activeCategory);
  }, [activeCategory, fetchTemplates]);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    setSearchQuery(value);
  };

  const filteredTemplates = getFilteredTemplates();

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-base mb-2">模板库</h3>
        <Input
          placeholder="搜索模板..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          size="small"
          allowClear
          value={localSearch}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* 分类标签 */}
      <Tabs
        activeKey={activeCategory}
        onChange={(key) => setActiveCategory(key as typeof activeCategory)}
        size="small"
        style={{ padding: '0 12px' }}
        items={TEMPLATE_CATEGORIES.map((cat) => ({
          key: cat.key,
          label: cat.label,
          children: (
            <div className="custom-scrollbar" style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spin />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="grid grid-cols-2 gap-2 pb-4">
                  {filteredTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
}
