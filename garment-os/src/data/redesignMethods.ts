import type { RedesignMethod } from '@/types/redesign-method';
export const REDESIGN_SOURCE={
 title:'女装改款：方法、步骤与背后逻辑',fileId:'576878690681',url:'https://365.kdocs.cn/office/o/576878690681',
 collectionTitle:'女装改款文章20篇全收录｜建立可复用的商业款式延伸体系',collectionFileId:'585804964324',collectionUrl:'https://365.kdocs.cn/office/o/585804964324',
 observedAt:'2026-11-12',linkedArticlesObserved:19,articleBodiesRead:16,methodCount:12,
 retrieval:'WPS AirPage CLI',scope:'女装方法文献；下列执行动作是向现有短T设计台的应用适配，不能当作女装版型已接通',
};
const method=(id:RedesignMethod['id'],name:string,group:RedesignMethod['group'],sourceBlockId:string,summary:string,scope:string,implemented=true):RedesignMethod=>({id,name,group,sourceBlockId,sourceFileId:REDESIGN_SOURCE.fileId,summary,scope,implemented});
/** Method names and cited blocks are source facts; implementation options are local design proposals. */
export const REDESIGN_METHODS:RedesignMethod[]=[
 method('detail-transfer','细节转移','迁移','FNwYrHwgByJXjJDY','提取一个设计元素，保留其内容，转移到适配的新部位。','将已有图形从正面移到背面，保持尺寸与图形内容'),
 method('category-transfer','品类转移','迁移','BynBirfpddyZpQBL','将一组设计语言迁移至另一品类，再按新品类重新开发。','尚缺目标品类的配套尺寸、净样和三视图接口',false),
 method('replacement','组合更换','重组','fQsBghMKOECyueNa','明确保留项，只替换一个主要部件或维度。','替换领型、肩袖、肌理等现有可用设计素材'),
 method('silhouette-lock','廓形限定','重组','BoXxpIZcNzrLlbiz','先固定轮廓与结构，再让内部设计服从它。','锁定衣身、肩袖、领型、位置和尺寸，仅换主体面料肌理'),
 method('style-combination','款式组合','重组','bjoyNaFIyDnrKodY','主款提供主体，另一款提供局部，再统一接口比例。','从另一方案借领部组合或肩袖构型，在主款尺寸上重绘'),
 method('detail-extension','细节延伸','生长','GZIMWnxmJYHzRTAE','保留一个细节母题，在其他部位继续呼应。','复制已有图形至另一个视图，原图形保留'),
 method('reverse','逆向改款','生长','HZiwKwtlwQrgTmrP','只对调一组清楚的元素关系，重新检查视觉平衡。','对调主体与袖片配色，保留领型、肩袖和轮廓'),
 method('change-form','改变形式','生长','ucBWZUhHeTSblGWS','保留图案内容，改换实现工艺，重新核对材料与成本。','同一图形登记数码印花、刺绣或贴布绣意向；需工艺打样'),
 method('add-part','增加部位','加减','hjVCBeCSzlZXjQGC','为具体设计需求增加一个部件，并补齐配套。','新增贴袋、嵌线袋、袋鼠袋或帽体'),
 method('remove-part','减少部位','加减','AyaVBtlqrEPxkszz','保留核心卖点，移除可独立处理的额外部件。','移除指定口袋、帽体或拼片；不直接删除主体和袖片'),
 method('reduce-decoration','减少装饰','加减','uwocpqTXXjiLCzKD','减轻装饰，保留轮廓、材料和必要结构。','关闭撞色或嵌边装饰，保留罗纹、门襟及功能性帽绳'),
 method('reduce-pattern','减少图案','加减','VmqSNFEqpsdRCWly','降低图案面积或移除指定图形，再核对视觉重心。','将指定Logo等比缩小或移除，保留主体面料'),
];
