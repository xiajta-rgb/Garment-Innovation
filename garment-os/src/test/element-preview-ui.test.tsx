import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MiniOptionThumb } from '@/features/piece-design/CompositionElementPicker';

afterEach(() => cleanup());

it('renders a two-dimensional preview for every design axis used by the workbench', () => {
  const options = [
    ['neckline', 'crew'], ['shoulder', 'raglan'], ['fit', 'loose'], ['sleeve', 'extended'], ['fabric', 'waffle'],
    ['pants-fit', 'wide'], ['waistband', 'high'], ['pants-length', 'cropped'], ['cuff', 'rib'], ['hem', 'side-slit'],
    ['panel', 'yoke'], ['hood', 'three-piece'], ['opening', 'quarter-zip'], ['neck-finish', 'binding'], ['seam', 'piping'],
    ['pocket', '1'], ['logo', 'emblem'],
  ] as const;
  const { container } = render(<div>{options.map(([kind, value]) => <MiniOptionThumb key={`${kind}-${value}`} kind={kind} value={value} />)}</div>);
  expect(container.querySelectorAll('svg')).toHaveLength(options.length);
  expect([...container.querySelectorAll('svg')].every(svg => svg.getAttribute('viewBox'))).toBe(true);
});
