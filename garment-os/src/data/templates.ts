import type { CanvasComponent } from '@/types';

export function getInitialTemplates(): CanvasComponent[] {
  return [
    {
      id: `comp-${Date.now()}-1`,
      name: '前衣片',
      category: 'body',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      materialId: '',
      zIndex: 1,
      paths: [
        {
          data: 'M100,60 Q150,50 200,60 L230,240 Q180,250 140,240 Z',
          fill: '#f8f8f8',
          stroke: '#333',
          strokeWidth: 1,
        },
      ],
    },
    {
      id: `comp-${Date.now()}-2`,
      name: '后衣片',
      category: 'body',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      materialId: '',
      zIndex: 1,
      paths: [
        {
          data: 'M250,60 Q300,50 350,60 L380,240 Q330,250 280,240 Z',
          fill: '#f8f8f8',
          stroke: '#333',
          strokeWidth: 1,
        },
      ],
    },
    {
      id: `comp-${Date.now()}-3`,
      name: '左袖',
      category: 'sleeve',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      materialId: '',
      zIndex: 1,
      paths: [
        {
          data: 'M40,90 L10,90 L5,280 L35,280 Z',
          fill: '#f5f5f5',
          stroke: '#333',
          strokeWidth: 1,
        },
      ],
    },
    {
      id: `comp-${Date.now()}-4`,
      name: '右袖',
      category: 'sleeve',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      materialId: '',
      zIndex: 1,
      paths: [
        {
          data: 'M410,90 L440,90 L445,280 L415,280 Z',
          fill: '#f5f5f5',
          stroke: '#333',
          strokeWidth: 1,
        },
      ],
    },
  ];
}
