export interface DesignCapability {
 id:string;name:string;tagNames:string[];sourceIds:string[];companyCodes:string[];
 preview:boolean;needs:string[];priority:'先补'|'随后补';
}
/** Local design contracts, not new dictionary codes or remote approval records. */
export const DESIGN_CAPABILITIES:DesignCapability[]=[
 {id:'crew',name:'圆领 / V领',tagNames:['圆领','V领'],sourceIds:['garment-os://pattern/t-shirt','garment-os://pattern/v-neck-tee'],companyCodes:['COT25M002'],preview:true,needs:['V尖拼接净样与领条伸缩率','领口与领条前后分段配缝及剪口'],priority:'先补'},
 {id:'raglan',name:'插肩袖',tagNames:['插肩'],sourceIds:[],companyCodes:['AT25M3275','AT24M3248'],preview:true,needs:['前后身与配套插肩袖净样','领口装配与腋下对位','前后袖片分段缝长与吃势'],priority:'先补'},
 {id:'drop',name:'微落肩 / 大落肩',tagNames:['微落肩','大落肩'],sourceIds:[],companyCodes:['COT25M002'],preview:true,needs:['分别建立肩点外移量与袖窿重制规则','微落肩和大落肩不得用同一档位代替'],priority:'先补'},
 {id:'henley',name:'亨利领短纽扣门襟',tagNames:['亨利领开口','半开襟','纽扣'],sourceIds:['garment-os://block/placket-center'],companyCodes:['L23M973D'],preview:true,needs:['左右门襟、开口贴衬与底部补强片','纽位、扣眼方向、搭门及领条收口'],priority:'先补'},
 {id:'polo',name:'Polo翻领 + 短门襟',tagNames:['Polo领'],sourceIds:[],companyCodes:['L22M664','LT25M1354'],preview:true,needs:['成型毛织领或本布领的独立材料合同','领面/领底及门襟连接端点','短门襟关闭后的领口净长'],priority:'先补'},
 {id:'stand',name:'立领',tagNames:['立领'],sourceIds:['garment-os://block/collar-mandarin'],companyCodes:['AT25M3275','AT24M3224'],preview:true,needs:['内外领片、领口弧长、领高与衬层','领角翻折余量、前中闭合对位'],priority:'先补'},
 {id:'quarter',name:'1/4拉链 / 半开襟',tagNames:['拉链','半开襟','外露拉链','单向拉链'],sourceIds:[],companyCodes:['AT25M3275','AT24M3224','LT25M1354'],preview:true,needs:['拉链长度、型号、牙宽、反装/正装和拉头规格','开口贴边、拉链底挡与护齿布','开口端补强、嵌装顺序及缝份'],priority:'先补'},
 {id:'fullzip',name:'全开襟拉链',tagNames:['全开襟','拉链'],sourceIds:['garment-os://pattern/hooded-zip-sweatshirt'],companyCodes:[],preview:true,needs:['分离左右前片及门襟贴边','开尾拉链与上下止口、下摆连接','不能用完整前片加画拉链代替切割净样'],priority:'随后补'},
 {id:'binding',name:'领口包边 / 后领包条',tagNames:['包边','领肩加固条'],sourceIds:['garment-os://pattern/bound-tank'],companyCodes:['COT25M002','LT26M1581','AT25M3275'],preview:true,needs:['明确领口/后领/袖窿/袖口部位','成品宽、裁条宽、折叠层数、方向和伸缩率','包覆关系与起止接头；包边不等于包缝'],priority:'先补'},
 {id:'piping',name:'拼缝嵌条',tagNames:['嵌边'],sourceIds:[],companyCodes:[],preview:true,needs:['嵌条截面、露出宽、芯绳及缝份','与拼缝配对的路径和转角规则'],priority:'随后补'},
 {id:'stitch',name:'明线 / 压线 / 包缝',tagNames:['明线','压线','包缝'],sourceIds:[],companyCodes:['AT24M3224','AT24M3248'],preview:true,needs:['区分结构缝与外露线迹','线迹型、针距、线数、双针间距和压线位置','包缝内侧工艺视图，不能冒充外露装饰'],priority:'先补'},
 {id:'pocket',name:'贴袋 / 胸袋 / 拉链口袋',tagNames:['贴袋','胸袋','拉链口袋','嵌线袋','袋鼠式前袋'],sourceIds:['garment-os://block/pocket-patch'],companyCodes:['L23M948D'],preview:true,needs:['贴袋净样、袋口折返与加固','拉链口袋另建嵌口、袋布及拉链配套','口袋位置、袋型、闭合件分开记录'],priority:'先补'},
 {id:'ribfinish',name:'罗纹领 / 袖口 / 下摆',tagNames:['罗纹收口','罗纹'],sourceIds:[],companyCodes:['AT25M3295','LT25M1354'],preview:true,needs:['领部与袖口下摆的部位区分','罗纹成品高、折返层数、伸缩率','按织物组织与边口构造分别绑定'],priority:'先补'},
 {id:'fabric',name:'华夫格 / 坑条 / 珠地',tagNames:['华夫格','华夫格肌理','坑条','罗纹状','珠地','平纹','竹节纱'],sourceIds:[],companyCodes:[],preview:true,needs:['企业面料ID及高清局部图','组织标签须有材料证据，外观肌理不得冒充组织','纹理尺度、方向、弹性和克重'],priority:'先补'},
 {id:'color',name:'撞色 / 色块拼接',tagNames:['撞色','色块拼接','弧线拼片'],sourceIds:[],companyCodes:[],preview:true,needs:['撞色参与部位与配色值','新增分割需有独立裁片边界与配缝，不能只涂色'],priority:'先补'},
 {id:'hood',name:'连帽 / 绳 / 鸡眼',tagNames:['连帽','抽绳调节','鸡眼','绳带'],sourceIds:['garment-os://pattern/hooded-zip-sweatshirt'],companyCodes:['AT24M3248','AT25M3288'],preview:true,needs:['两片/三片帽与双层帽分别登记','帽口包边、领圈配缝、绳道和鸡眼','公司套头帽不能用开襟Huey替代'],priority:'随后补'},
 {id:'hem',name:'下摆开衩 / 侧缝开衩',tagNames:['下摆开衩','侧缝开衩'],sourceIds:[],companyCodes:[],preview:true,needs:['开衩高度、贴边折返与补强','前后差长和开衩位置','侧缝断口的三视图对应'],priority:'随后补'},
 {id:'graphic',name:'Logo / 印花 / 刺绣',tagNames:['数码印花','贴布绣','无缝入式内标'],sourceIds:[],companyCodes:['COT25M002'],preview:false,needs:['图形源文件、权利依据、部位与实际尺寸','印花、刺绣和烫标按真实工艺分别登记','标签不能自动选择任意Logo；需指定素材ID'],priority:'随后补'},
];
export const COMPANY_CRAFT_REFERENCES=[
 {code:'L23M973D',recordId:'reczz28Xjq3qkp98',description:'圆领短纽扣门襟；原稿为长袖，短袖是派生设计'},
 {code:'L22M664',recordId:'reczz28Xjq3qkT7q',description:'翻领与纽扣短门襟，短袖Polo'},
 {code:'LT25M1354',recordId:'reczz28Xjq0u1yoX',description:'毛织短袖Polo；原稿短门襟14cm，存在拉链长度批复修改，尺寸待确认'},
 {code:'AT25M3275',recordId:'reczz28Xjq0u2Tih',description:'立领、插肩、1/4拉链；原稿开口22cm、领高5.5cm，短袖为派生'},
 {code:'AT24M3224',recordId:'reczz28Xjq0u078Q',description:'立领半开襟、门襟贴边、拉链底挡及侧缝前移'},
 {code:'AT24M3248',recordId:'reczz28Xjq3qlQkD',description:'三片帽、插肩、22cm短拉链；并非全开襟'},
];
