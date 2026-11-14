import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ElementLibraryPanel } from '@/features/element-library/ElementLibraryPanel';
import { ELEMENT_REGISTRY } from '@/data/elementRegistry';

vi.mock('@/features/element-library/design-registration', () => ({
  buildRegistrationPackage: vi.fn(() => { throw new Error('历史模板已隔离，不能生成候选裁片资料'); }),
  downloadRegistrationPackage: vi.fn(),
}));
afterEach(cleanup);
const rows = () => [...screen.getByTestId('library-results').querySelectorAll('details')];

it('type/part/domain filters control the actual rendered rows, including empty and quarantined results', () => {
  render(<ElementLibraryPanel />);
  const expected = ELEMENT_REGISTRY.filter(e => e.domain === '服装造型域' && !['隔离', '弃用'].includes(e.status));
  expect(rows()).toHaveLength(expected.length);
  fireEvent.change(screen.getByLabelText('造型类型'), { target: { value: '结构部件模板' } });
  expect(rows().every(row => ELEMENT_REGISTRY.find(e => e.sourceId === row.getAttribute('data-source-id'))?.type === '结构部件模板')).toBe(true);
  fireEvent.change(screen.getByLabelText('适用部位'), { target: { value: '袖部' } });
  const expectedForPart = (part: string, includeIsolated = false) => ELEMENT_REGISTRY.filter(e => e.domain === '服装造型域' && e.type === '结构部件模板' && e.parts.includes(part) && (includeIsolated || !['隔离','弃用'].includes(e.status)));
  expect(rows()).toHaveLength(expectedForPart('袖部').length);
  expect(rows().some(row=>row.textContent?.includes('Brian 装袖参考部件'))).toBe(true);
  fireEvent.change(screen.getByLabelText('适用部位'), { target: { value: '领部' } });
  expect(rows()).toHaveLength(expectedForPart('领部').length);
  expect(rows().every(row=>row.textContent?.includes('Simon'))).toBe(true);
  fireEvent.click(screen.getByLabelText('显示隔离及弃用素材'));
  expect(rows()).toHaveLength(expectedForPart('领部',true).length);
  expect(rows().some(row=>row.querySelector('summary')?.textContent?.includes('隔离'))).toBe(true);
  fireEvent.change(screen.getByLabelText('造型类型'), { target: { value: '纸样与裁片' } });
  expect(rows()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('素材域'), { target: { value: '色彩图案域' } });
  expect(rows()).toHaveLength(ELEMENT_REGISTRY.filter(e => e.domain === '色彩图案域').length);
  fireEvent.change(screen.getByLabelText('搜索素材'), { target: { value: 'no-such-asset' } });
  expect(rows()).toHaveLength(0);
});
it('shows export validation errors in the panel', () => {
  render(<ElementLibraryPanel />);
  fireEvent.click(screen.getByText('导出候选裁片'));
  expect(screen.getByRole('alert')).toHaveTextContent('历史模板已隔离');
});
