import { expect,it } from 'vitest';
import { readDesignSuggestion } from '@/application/design-suggestion';
const valid={name:'圆领T恤',description:'基础针织参考',templateId:'t-shirt',unmetRequirements:[],colorSuggestions:['#abcdef'],fabricSuggestions:['棉针织'],rationale:'使用完整参考方法'};
it('only reviewed template IDs can be proposed; legacy blocks and guessed inputs are rejected',()=>{
  expect(readDesignSuggestion(valid)).toEqual(valid);
  for(const patch of [{templateId:'polo-shirt'},{templateId:'unknown'},{blocks:[{blockId:'bodice-basic'}]},{measurements:{bust:900}},{productionApproved:true},{colorSuggestions:['red']}]) expect(()=>readDesignSuggestion({...valid,...patch})).toThrow();
});
it('unavailable construction is explicitly missing and never gets a category fallback',()=>{
  expect(readDesignSuggestion({...valid,templateId:null,unmetRequirements:['缺少Polo翻领半开襟']})).toMatchObject({templateId:null});
  expect(()=>readDesignSuggestion({...valid,templateId:null})).toThrow(/缺失/);
});
