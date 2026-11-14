/**
 * 裁片标签体系测试
 *  T1 只用明确元信息派生六个独立分类轴
 *  T2 筛选语义: 组内 OR / 跨组 AND / 无选中=全通过
 */

import { describe, it, expect } from 'vitest';
import { tagsForPath, matchesTagFilter, TAG_GROUPS, PIECE_TAGS } from '@/lib/pattern/piece-tags';
import { PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';
import type { PatternPath } from '@/types/pattern';

describe('piece-tags: 标签体系', () => {
  it('T1 未声明数量、材料和裁法保持未知，不能按大类猜测', () => {
    const p:PatternPath={id:'x',data:'',fill:'none',stroke:'none',strokeWidth:0,category:'cuff',pieceRole:'cuff.barrel',taxonomyVersion:PIECE_TAXONOMY_VERSION};
    expect(tagsForPath(p)).toEqual(['cuff','role:cuff.barrel','component','material:unknown','fold-unknown','cut-unknown']);
    expect(tagsForPath({...p,cutQty:2,cutOnFold:false,materialRole:'fabric'})).toEqual(['cuff','role:cuff.barrel','component','material:fabric','flat-cut','cut2']);
    expect(tagsForPath({...p,cutQty:4,cutOnFold:true})).toContain('fold');
    expect(tagsForPath({...p,cutQty:4,cutOnFold:true})).toContain('cut4');
    for(const qty of [3,6,13])expect(tagsForPath({...p,cutQty:qty})).not.toContain('cut-unknown');
    for(const qty of [0,-1,1.5,NaN])expect(tagsForPath({...p,cutQty:qty})).toContain('cut-unknown');
  });

  it('T2a 无选中 → 全通过', () => {
    expect(matchesTagFilter(['body', 'main'], [])).toBe(true);
  });

  it('未知或损坏的筛选条件不得匹配全部裁片',()=>{
    for(const selector of ['unknown','role:collar.nonexistent','toString','constructor','__proto__'])
      expect(matchesTagFilter(['body','main'],[selector])).toBe(false);
  });

  it('T2b 组内 OR: 选 body+sleeve → 两者都通过', () => {
    expect(matchesTagFilter(['body', 'main', 'fold'], ['body', 'sleeve'])).toBe(true);
    expect(matchesTagFilter(['sleeve', 'main', 'cut2'], ['body', 'sleeve'])).toBe(true);
    expect(matchesTagFilter(['collar', 'component', 'fold'], ['body', 'sleeve'])).toBe(false);
  });

  it('T2c 跨组 AND: 选 body+component → 谁都不匹配', () => {
    // body 与 component 不同组 → 需同时满足 → 无交集
    expect(matchesTagFilter(['body', 'main', 'fold'], ['body', 'component'])).toBe(false);
    // 主裁片+对折裁剪 同时满足 → 通过
    expect(matchesTagFilter(['body', 'main', 'fold'], ['body', 'fold'])).toBe(true);
  });

  it('T3 标签注册完备: 每组至少 2 个标签, 颜色/中文名齐全', () => {
    for (const g of TAG_GROUPS) {
      const tags = Object.values(PIECE_TAGS).filter((t) => t.group === g.id);
      expect(tags.length, `组 ${g.label}`).toBeGreaterThanOrEqual(2);
      for (const t of tags) {
        expect(t.label.length).toBeGreaterThan(0);
        expect(t.color).toMatch(/^#/);
      }
    }
  });
});
