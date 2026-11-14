import type { GeneInstance, RuleViolation } from '@/types/gene';
import { num } from './utils';

/**
 * 内置约束校验
 * - 下摆不能高于腰线
 * - 肩宽过窄警告
 * - 袖长过长警告
 * - 领高过大警告
 */
export function validateBuiltInConstraints(instance: GeneInstance): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const p = instance.parameterValues;

  switch (instance.category) {
    case 'body': {
      // 下摆不能高于腰线
      if (num(p, 'hemLength', 224) < num(p, 'waistY', 140) + 10) {
        violations.push({
          ruleId: 'body-hem-above-waist',
          message: '下摆不能高于腰线以下 10mm',
          level: 'error',
        });
      }
      // 肩宽不能过窄
      if (num(p, 'shoulderWidth', 32) < 20) {
        violations.push({
          ruleId: 'body-shoulder-too-narrow',
          message: '肩宽过窄，不符合人体工学',
          level: 'warning',
        });
      }
      break;
    }
    case 'sleeve': {
      const sleeveLen = num(p, 'sleeveLength', 160);
      if (sleeveLen > 200) {
        violations.push({
          ruleId: 'sleeve-too-long',
          message: '袖长过长，超过合理范围',
          level: 'warning',
        });
      }
      break;
    }
    case 'collar': {
      if (num(p, 'collarHeight', 14) > 40) {
        violations.push({
          ruleId: 'collar-too-high',
          message: '领高过大，影响穿着舒适度',
          level: 'warning',
        });
      }
      break;
    }
  }

  return violations;
}
