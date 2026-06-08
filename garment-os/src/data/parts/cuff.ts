import type { PartVariant } from '../garmentParts';

export const CUFF_VARIANTS: PartVariant[] = [
  {
    id: 'cuff-none',
    name: '无袖口',
    frontPath: '',
    backPath: '',
    zIndex: 8,
    filled: false,
  },
  {
    id: 'cuff-plain',
    name: '平袖口',
    frontPath: 'M12,166 L36,154 M12,170 L36,158',
    backPath: 'M12,166 L36,154 M12,170 L36,158',
    zIndex: 8,
    filled: false,
  },
  {
    id: 'cuff-button',
    name: '纽扣袖口',
    frontPath: 'M12,166 L36,154 M12,170 L36,158 M14,168 C14,170 16,172 18,170 C16,168 14,168 14,168',
    backPath: 'M12,166 L36,154 M12,170 L36,158',
    zIndex: 8,
    filled: false,
  },
  {
    id: 'cuff-turnup',
    name: '翻袖口',
    frontPath: 'M12,160 L36,148 L36,154 L12,166 Z M12,166 L36,154 L36,170 L12,182 Z',
    backPath: 'M12,160 L36,148 L36,154 L12,166 Z',
    zIndex: 8,
    filled: true,
  },
  {
    id: 'cuff-elastic',
    name: '松紧袖口',
    frontPath: 'M12,166 C14,164 16,168 18,166 C20,164 22,168 24,166 C26,164 28,168 30,166 C32,164 34,168 36,166 L36,170 C34,172 32,168 30,170 C28,172 26,168 24,170 C22,172 20,168 18,170 C16,172 14,168 12,170 Z',
    backPath: 'M12,166 C14,164 16,168 18,166 C20,164 22,168 24,166 C26,164 28,168 30,166 C32,164 34,168 36,166 L36,170 C34,172 32,168 30,170 C28,172 26,168 24,170 C22,172 20,168 18,170 C16,172 14,168 12,170 Z',
    zIndex: 8,
    filled: true,
  },
];
