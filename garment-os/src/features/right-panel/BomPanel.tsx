import { Table, Button, Empty, Statistic } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useBomStore } from '@/store/bomStore';
import type { BomItem } from '@/types';

export default function BomPanel() {
  const { items, getTotalCost, getTotalUsage } = useBomStore();

  const columns = [
    {
      title: '部位',
      dataIndex: 'componentName',
      key: 'componentName',
      width: 80,
    },
    {
      title: '面料',
      key: 'material',
      width: 100,
      render: (_: unknown, record: BomItem) => record.material.name || '-',
    },
    {
      title: '用量',
      dataIndex: 'usage',
      key: 'usage',
      width: 70,
      render: (v: number) => (v > 0 ? v.toFixed(3) : '-'),
    },
    {
      title: '金额',
      dataIndex: 'cost',
      key: 'cost',
      width: 70,
      render: (v: number) => (v > 0 ? `¥${v.toFixed(2)}` : '-'),
    },
  ];

  return (
    <div className="px-2">
      {items.length === 0 ? (
        <Empty
          description="添加组件后自动生成 BOM"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 40 }}
        />
      ) : (
        <>
          <Table
            dataSource={items}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={false}
            style={{ marginBottom: 12 }}
          />

          <div className="flex justify-between items-center mb-3">
            <Statistic title="总用量" value={getTotalUsage().toFixed(3)} suffix="m" valueStyle={{ fontSize: 16 }} />
            <Statistic title="总成本" value={getTotalCost().toFixed(2)} prefix="¥" valueStyle={{ fontSize: 16 }} />
          </div>

          <Button icon={<ExportOutlined />} block size="small" disabled>
            导出 Excel
          </Button>
        </>
      )}
    </div>
  );
}
