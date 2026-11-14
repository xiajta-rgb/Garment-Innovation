import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CanvasArea } from '@/components/layout/CanvasArea';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';

beforeEach(() => {
  useDesignStore.getState().newDesign();
  useDesignStore.getState().applyPattern('bound-tank');
  usePieceLibraryStore.getState().clearTagFilter();
});
afterEach(() => cleanup());

function renderWorkspace() {
  return render(<CanvasArea showSketch showPattern={false} onToggleSketch={() => {}}
    onTogglePattern={() => {}} sketchZoom={1} onSketchZoom={() => {}} garmentColor="#cbd5e1" />);
}

it('keeps the workbench focused on two-dimensional design and removes the 3D entry', () => {
  renderWorkspace();
  expect(screen.queryByRole('button', { name: /3D|三维/ })).toBeNull();
  expect(screen.getByRole('button', { name: '裁片组合设计' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '定制矩阵' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '款式工作流' })).toBeInTheDocument();
});

it('opens the two-dimensional piece library and preserves its review tabs', async () => {
  renderWorkspace();
  fireEvent.click(screen.getByRole('button', { name: '裁片库' }));
  expect(await screen.findByTestId('piece-library')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '裁片检验 (QC)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '裁片生成器' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '裁片组成' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '部件组合' })).toBeInTheDocument();
  expect(screen.queryByTestId('pattern-3d-panel')).toBeNull();
});

it('keeps reference browsing separate from the current two-dimensional design', async () => {
  usePieceLibraryStore.getState().openReferenceCatalogue('collar', 'collar.flat');
  renderWorkspace();
  expect(await screen.findByTestId('reference-catalogue')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /3D|三维/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '设计台' }));
  expect(await screen.findByTestId('piece-design-board')).toBeInTheDocument();
  expect(useDesignStore.getState().activePatternId).toBe('bound-tank');
});

it('switches between the matrix and style workflow without creating a mesh job', async () => {
  renderWorkspace();
  fireEvent.click(screen.getByRole('button', { name: '定制矩阵' }));
  expect(await screen.findByTestId('design-desk')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '款式工作流' }));
  expect(await screen.findByTestId('style-workflow')).toBeInTheDocument();
  expect(screen.queryByTestId('pattern-3d-panel')).toBeNull();
});
