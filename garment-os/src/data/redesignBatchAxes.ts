import type { RedesignAxis } from '@/types/redesign-batch';
export const REDESIGN_AXES:RedesignAxis[]=['neck','shoulder','fabric','pocket','finish','panel','contrast'];
export const REDESIGN_AXIS_LABELS:Record<RedesignAxis,string>={neck:'领口 / 开合',shoulder:'肩袖',fabric:'主体肌理',pocket:'口袋',finish:'边口 / 工艺',panel:'衣身拼片',contrast:'撞色部位'};
export interface BatchOption {id:string;name:string;assetId?:string;aliases?:string[]}
const keep:BatchOption={id:'keep',name:'保留当前'};
export const REDESIGN_BATCH_OPTIONS:Record<RedesignAxis,BatchOption[]>={
 neck:[keep,{id:'neck.crew',name:'圆领',assetId:'neck.crew'},{id:'neck.v',name:'V领',assetId:'neck.v'}, {id:'neck.henley',name:'亨利领',assetId:'neck.henley'},{id:'neck.polo',name:'Polo翻领',assetId:'neck.polo',aliases:['Polo领']},{id:'neck.stand',name:'立领',assetId:'neck.stand'},{id:'opening.quarter',name:'半开襟拉链',assetId:'opening.quarter',aliases:['短拉链','1/4拉链']},{id:'opening.full',name:'全开襟拉链',assetId:'opening.full'},{id:'opening.buttons',name:'短纽扣门襟',assetId:'opening.buttons',aliases:['纽扣短门襟']}],
 shoulder:[keep,{id:'shoulder.set-in',name:'装袖',assetId:'shoulder.set-in'},{id:'shoulder.raglan',name:'插肩袖',assetId:'shoulder.raglan',aliases:['插肩']},{id:'shoulder.drop',name:'微落肩',assetId:'shoulder.drop'}],
 fabric:[keep,{id:'fabric.jersey',name:'平纹汗布',assetId:'fabric.jersey',aliases:['汗布']},{id:'fabric.waffle',name:'华夫格',assetId:'fabric.waffle'},{id:'fabric.rib',name:'坑条罗纹',assetId:'fabric.rib',aliases:['坑条']},{id:'fabric.pique',name:'珠地',assetId:'fabric.pique'},{id:'fabric.slub',name:'竹节肌理',assetId:'fabric.slub',aliases:['竹节纱']}],
 pocket:[keep,{id:'none',name:'无口袋',aliases:['无袋']},{id:'pocket.patch',name:'胸贴袋',assetId:'pocket.patch',aliases:['贴袋']},{id:'pocket.kangaroo',name:'袋鼠式前袋',assetId:'pocket.kangaroo',aliases:['袋鼠袋']},{id:'pocket.welt',name:'单嵌线胸袋',assetId:'pocket.welt',aliases:['单嵌线袋']},{id:'pocket.zip-welt',name:'拉链嵌线胸袋',assetId:'pocket.zip-welt',aliases:['拉链嵌线袋']}],
 finish:[keep,{id:'finish.binding',name:'领口包边',assetId:'finish.binding',aliases:['领口窄包边']},{id:'finish.tape',name:'后领包条',assetId:'finish.tape',aliases:['后领内侧包条']},{id:'finish.piping',name:'拼缝嵌边',assetId:'finish.piping',aliases:['嵌边']},{id:'finish.topstitch',name:'外露压线',assetId:'finish.topstitch',aliases:['明线']},{id:'finish.cuff-rib',name:'罗纹袖口',assetId:'finish.cuff-rib',aliases:['袖口罗纹']},{id:'finish.hem-rib',name:'罗纹下摆',assetId:'finish.hem-rib',aliases:['下摆罗纹']},{id:'finish.slit',name:'下摆开衩',assetId:'finish.slit',aliases:['侧缝开衩']}],
 panel:[keep,{id:'none',name:'无拼片'},{id:'panel.yoke',name:'弧线育克',assetId:'panel.yoke',aliases:['弧线拼片','育克拼片']},{id:'panel.side',name:'侧身拼片',assetId:'panel.side',aliases:['侧拼片']}],
 contrast:[keep,{id:'contrast.neck',name:'领口撞色'},{id:'contrast.sleeve',name:'袖片撞色'},{id:'contrast.cuff',name:'袖口撞色'},{id:'contrast.neck-cuff',name:'领口与袖口撞色'},{id:'contrast.none',name:'无撞色',aliases:['去掉撞色']}],
};
export const batchOption=(axis:RedesignAxis,id:string)=>REDESIGN_BATCH_OPTIONS[axis].find(o=>o.id===id);
