import type { PartVariant } from '../garmentParts';

export const PLACKET_VARIANTS: PartVariant[] = [
  {
    id: 'placket-none',
    name: '无门襟',
    frontPath: '',
    backPath: '',
    zIndex: 6,
    filled: false,
  },
  {
    id: 'placket-center',
    name: '中开襟',
    frontPath: 'M98,42 L98,224 M102,42 L102,224',
    backPath: '',
    zIndex: 6,
    filled: false,
    details: 'M98,42 L98,224 M102,42 L102,224',
  },
  {
    id: 'placket-half',
    name: '半开襟',
    frontPath: 'M98,42 L98,130 M102,42 L102,130',
    backPath: '',
    zIndex: 6,
    filled: false,
    details: 'M98,42 L98,130 M102,42 L102,130',
  },
  {
    id: 'placket-hidden',
    name: '暗门襟',
    frontPath: 'M100,42 L100,224',
    backPath: '',
    zIndex: 6,
    filled: false,
    details: 'M100,42 L100,224',
  },
  {
    id: 'placket-wrap',
    name: '裹式',
    frontPath: 'M86,42 L86,224 M114,42 L114,224',
    backPath: '',
    zIndex: 6,
    filled: false,
    details: 'M86,42 L86,224 M114,42 L114,224',
  },
];
