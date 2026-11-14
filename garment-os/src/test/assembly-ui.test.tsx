import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PieceLibraryView } from '@/features/piece-library/PieceLibraryView';
import { AssemblyPanel } from '@/features/piece-library/AssemblyPanel';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { downloadText } from '@/features/files/browser-files';
import { createAssemblyRecord } from '@/application/assembly-record';

vi.mock('@/features/files/browser-files', () => ({ downloadText: vi.fn() }));
beforeEach(() => {
  useDesignStore.getState().newDesign();
  useDesignStore.getState().applyPattern('button-up-shirt');
  usePieceLibraryStore.getState().clearTagFilter();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('opens the real library tab, locates actual source curves and keeps unresolved zero-delta plackets pending', () => {
  const { container } = render(<PieceLibraryView />);
  fireEvent.click(screen.getByRole('button', { name: '裁片组成' }));
  expect(screen.getByTestId('assembly-summary')).toHaveTextContent('10 种源裁片');
  expect(screen.getByTestId('assembly-summary')).toHaveTextContent('89/89');
  expect(container.querySelectorAll('[data-assembly-join]')).toHaveLength(14);
  expect(container.querySelector('[data-assembly-join="placket-overlap"]')).toHaveAttribute('data-status', 'pending');
  fireEvent.click(screen.getByRole('button', { name: '领面与领座上边' }));
  const report = useDesignStore.getState().draft.assembly!;
  for (const id of ['simon.collar/insert-right', 'simon.collar/insert-left', 'simon.collarStand/top']) {
    expect(container.querySelector(`[data-assembly-edge="${id}"]`)).toHaveAttribute('d', report.boundaries.find(b => `${b.piece}/${b.id}` === id)!.pathD);
  }
  expect(screen.getByTestId('assembly-join-details')).toHaveTextContent('尚未执行褶量');
});

it('tag filters change actual rows and drawings without weakening the full assembly audit', () => {
  const { container } = render(<AssemblyPanel />), before = useDesignStore.getState().draft;
  fireEvent.click(screen.getByRole('button', { name: '领类' }));
  expect([...container.querySelectorAll('[data-assembly-piece]')].map(p => p.getAttribute('data-assembly-piece'))).toEqual(['simon.collar', 'simon.collarStand']);
  expect(container.querySelectorAll('[data-assembly-join]')).toHaveLength(2);
  expect([...container.querySelectorAll('[data-assembly-interface]')].every(p => p.getAttribute('data-assembly-interface')!.startsWith('simon.collar'))).toBe(true);
  expect(useDesignStore.getState().draft).toBe(before);
  expect(screen.getByTestId('assembly-summary')).toHaveTextContent('89/89');
  fireEvent.click(screen.getByRole('button', { name: '清除组成筛选' }));
  fireEvent.click(screen.getByRole('button', { name: '口袋类' }));
  expect(screen.getByTestId('assembly-empty')).toBeInTheDocument();
  expect(container.querySelector('[data-assembly-interface]')).toBeNull();
  expect(container.querySelector('[data-assembly-piece]')).toBeNull();
});

it('a size change regenerates edge locations and exports the same current configuration and report', () => {
  const { container } = render(<AssemblyPanel />);
  fireEvent.click(screen.getByRole('button', { name: '领面与领座上边' }));
  const before = container.querySelector('[data-assembly-edge="simon.collar/insert-right"]')!.getAttribute('d');
  act(() => useDesignStore.getState().setSize('L'));
  expect(container.querySelector('[data-assembly-edge="simon.collar/insert-right"]')!.getAttribute('d')).not.toBe(before);
  fireEvent.click(screen.getByRole('button', { name: '导出本例验收记录' }));
  const [content, filename] = vi.mocked(downloadText).mock.calls[0], record = JSON.parse(content);
  expect(filename).toContain('button-up-shirt-L');
  expect(record.configuration.measurements).toEqual(useDesignStore.getState().measurements);
  expect(record.assembly).toEqual(useDesignStore.getState().draft.assembly);
  expect(record.productionApproved).toBe(false);
  const s = useDesignStore.getState();
  expect(() => createAssemblyRecord({ ...s, measurements: { ...s.measurements, bust: s.measurements.bust + 1 } }, s.draft)).toThrow(/不一致/);
});

it('invalid new inputs withdraw the previous assembly details and export action', () => {
  render(<AssemblyPanel />);
  expect(screen.getByTestId('assembly-panel')).toBeInTheDocument();
  act(() => useDesignStore.getState().updateMeasurements({ neckCirc: NaN }));
  expect(screen.queryByTestId('assembly-panel')).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent('当前没有可用结构检查');
  expect(screen.queryByRole('button', { name: '导出本例验收记录' })).toBeNull();
});

it('cut-on-fold filtering excludes a full yoke, and unknown interfacing never displays a fabricated zero', () => {
  const { container } = render(<AssemblyPanel />);
  const yoke = container.querySelector('[data-assembly-piece="simon.yoke"]')!;
  expect(within(yoke as HTMLElement).getByText('否')).toBeInTheDocument();
  expect(within(yoke as HTMLElement).getByText('未声明')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '对折裁剪' }));
  expect([...container.querySelectorAll('[data-assembly-piece]')].map(p => p.getAttribute('data-assembly-piece'))).toEqual(['simon.back']);
});
