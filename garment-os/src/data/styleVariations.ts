import type { StyleVariation } from '@/types/style-variation';
export const STYLE_VARIATION_OPTIONS={
 neckline:[['source','沿用母版'],['crew','圆领'],['v','V领'],['polo','Polo翻领'],['hood','连帽'],['quarter-zip','立领半拉链']],
 sleeve:[['source','沿用母版'],['sleeveless','无袖'],['short','短袖'],['elbow','五分袖'],['long','长袖']],
 fit:[['source','沿用母版'],['regular','常规'],['relaxed','宽松'],['boxy','宽松箱型']],
 length:[['source','沿用母版'],['cropped','短款'],['regular','常规衣长'],['longline','加长']],
 pocket:[['source','沿用母版'],['none','无口袋'],['chest','单胸贴袋'],['double-chest','双胸贴袋'],['kangaroo','袋鼠袋'],['zip-side','两侧拉链插袋']],
 hem:[['source','沿用母版'],['straight','平直下摆'],['rib','罗纹下摆'],['curved','弧形下摆'],['split','侧开衩']],
 blocking:[['none','纯色'],['sleeves','撞色袖'],['chest-panel','胸部拼色'],['side-panel','侧片拼色'],['collar','领面撞色']],
 graphic:[['none','无图案'],['front','前片图案'],['back','后片图案'],['front-back','前后图案']],
} as const;
export const STYLE_VARIATION_LABELS={neckline:'领型',sleeve:'袖型',fit:'版型',length:'衣长',pocket:'口袋',hem:'下摆',blocking:'拼色',graphic:'图案'} as const;
export const DEFAULT_STYLE_VARIATION:StyleVariation={neckline:'source',sleeve:'source',fit:'source',length:'source',pocket:'source',hem:'source',blocking:'none',graphic:'none',accentColor:'#e6d3b1'};
export const STYLE_VARIATION_PRESETS:readonly {id:string;name:string;patch:Partial<StyleVariation>}[]=[
 {id:'polo',name:'撞色口袋 Polo',patch:{neckline:'polo',sleeve:'short',fit:'regular',length:'regular',pocket:'chest',hem:'split',blocking:'sleeves',graphic:'none',accentColor:'#e6d3b1'}},
 {id:'boxy',name:'宽短图案 T恤',patch:{neckline:'crew',sleeve:'elbow',fit:'boxy',length:'cropped',pocket:'none',hem:'straight',blocking:'chest-panel',graphic:'back',accentColor:'#e6d3b1'}},
 {id:'hoodie',name:'拼色袋鼠帽衫',patch:{neckline:'hood',sleeve:'long',fit:'relaxed',length:'regular',pocket:'kangaroo',hem:'rib',blocking:'side-panel',graphic:'none',accentColor:'#e6d3b1'}},
];
