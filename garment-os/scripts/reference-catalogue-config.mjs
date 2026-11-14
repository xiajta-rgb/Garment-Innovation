/** Explicit source identities. A material variant is not a new structure role. */
export const referenceSources = {
  'brian.front':'body.front', 'brian.back':'body.back', 'library.sleeve':'sleeve.main',
  'aaron.front':'body.front', 'aaron.back':'body.back', 'aaron.armBinding':'binding.armhole', 'aaron.neckBinding':'binding.neck',
  'teagan.front':'body.front', 'teagan.back':'body.back', 'teagan.sleeve':'sleeve.main',
  'sven.front':'body.front', 'sven.back':'body.back', 'sven.sleeve':'sleeve.main', 'sven.cuff':'cuff.rib', 'sven.waistband':'hem-band.rib',
  'simon.frontLeft':'body.front', 'simon.frontRight':'body.front', 'simon.back':'body.back', 'simon.yoke':'yoke.back',
  'simon.sleeve':'sleeve.main', 'simon.collar':'collar.unsplit-pair', 'simon.collarStand':'collar.stand', 'simon.cuff':'cuff.barrel',
  'simon.buttonholePlacket':'placket.front-overlap', 'simon.buttonPlacket':'placket.front-underlap',
  'simon.sleevePlacketOverlap':'placket.sleeve-overlap', 'simon.sleevePlacketUnderlap':'placket.sleeve-underlap',
  'huey.front':'body.front', 'huey.back':'body.back', 'huey.sleeve':'sleeve.main', 'huey.hood':'hood.side',
  'huey.pocket':'pocket.patch', 'huey.waistband':'hem-band.rib', 'huey.cuff':'cuff.rib',
  'albert.front':'accessory.bib', 'albert.pocket':'pocket.patch', 'albert.strap':'strap.shoulder',
  'bee.cup':'foundation.cup-whole', 'bee.neckTie':'strap.shoulder', 'bee.bandTie':'strap.tie',
  'benjamin.bow1':'accessory.bow', 'benjamin.bow2':'accessory.bow', 'benjamin.bow3':'accessory.bow', 'benjamin.collarBand':'strap.tie',
  'library.topsleeve':'sleeve.upper', 'library.undersleeve':'sleeve.under',
  'bob.bib':'accessory.bib',
  'bruce.front':'foundation.brief-front', 'bruce.back':'foundation.brief-back', 'bruce.inset':'gusset.crotch', 'bruce.side':'foundation.brief-side',
  'carlton.front':'body.front', 'carlton.frontFacing':'facing.front', 'carlton.frontLining':'body.front', 'carlton.back':'body.back',
  'carlton.backStay':'reinforcement.local', 'carlton.tail':'skirt.gore',
  'carlton.topsleeve':'sleeve.upper', 'carlton.undersleeve':'sleeve.under', 'carlton.belt':'strap.belt',
  'carlton.collarStand':'collar.stand', 'carlton.collar':'collar.top', 'carlton.cuffFacing':'facing.wrist',
  'carlton.pocket':'pocket.patch', 'carlton.pocketFlap':'pocket.flap', 'carlton.pocketLining':'pocket.bag',
  'carlton.chestPocketWelt':'pocket.welt', 'carlton.chestPocketBag':'pocket.bag', 'carlton.innerPocketWelt':'pocket.welt',
  'carlton.innerPocketBag':'pocket.bag', 'carlton.innerPocketTab':'strap.tab',
  'cathrin.panel1':'foundation.corset-panel', 'cathrin.panel2':'foundation.corset-panel', 'cathrin.panel3':'foundation.corset-panel',
  'cathrin.panel4':'foundation.corset-panel', 'cathrin.panel5':'foundation.corset-panel', 'cathrin.panel6':'foundation.corset-panel',
  'charlie.front':'trouser.front', 'charlie.back':'trouser.back', 'charlie.waistband':'waistband.outer', 'charlie.waistbandCurved':'waistband.outer',
  'charlie.frontPocketBag':'pocket.bag', 'charlie.frontPocketFacing':'pocket.facing', 'charlie.backPocketBag':'pocket.bag',
  'charlie.backPocketFacing':'pocket.facing', 'charlie.backPocketInterfacing':'reinforcement.local', 'charlie.backPocketWelt':'pocket.welt',
  'charlie.flyFacing':'placket.fly-facing', 'charlie.flyExtension':'placket.fly-shield', 'charlie.beltLoops':'strap.loop',
  'florent.top':'headwear.crown', 'florent.side':'headwear.band', 'florent.brimBottom':'headwear.brim-under',
  'florent.brimTop':'headwear.brim-top', 'florent.brimInterfacing':'reinforcement.local',
  'holmes.crown':'headwear.crown', 'holmes.visor':'headwear.brim-top', 'holmes.ear':'headwear.earflap',
  'hugo.front':'body.front', 'hugo.back':'body.back', 'hugo.sleeve':'sleeve.main', 'hugo.pocket':'pocket.patch',
  'hugo.pocketFacing':'pocket.facing', 'library.hoodSide':'hood.side', 'library.hoodCenter':'hood.center',
  'hugo.waistband':'hem-band.rib', 'hugo.cuff':'cuff.rib', 'hugo.neckBinding':'binding.neck',
  'jaeger.front':'body.front', 'jaeger.frontFacing':'facing.front', 'jaeger.frontLining':'body.front',
  'jaeger.chestPiece':'reinforcement.chest', 'jaeger.side':'body.side', 'jaeger.back':'body.back',
  'jaeger.collarStand':'collar.stand', 'jaeger.collar':'collar.top', 'jaeger.underCollar':'collar.under',
  'jaeger.pocket':'pocket.patch', 'jaeger.pocketLining':'pocket.bag', 'jaeger.chestPocketWelt':'pocket.welt',
  'jaeger.chestPocketBag':'pocket.bag', 'jaeger.topsleeve':'sleeve.upper', 'jaeger.undersleeve':'sleeve.under',
  'jaeger.innerPocketBag':'pocket.bag', 'jaeger.innerPocketWelt':'pocket.welt',
  'noble.backInside':'body.back', 'noble.backOutside':'body.side-back', 'noble.frontInside':'body.front', 'noble.frontOutside':'body.side-front',
  'paco.front':'trouser.front', 'paco.back':'trouser.back', 'paco.cuff':'hem-band.leg', 'paco.frontPocketBag':'pocket.bag', 'paco.waistband':'waistband.casing',
  'penelope.front':'skirt.front', 'penelope.back':'skirt.back', 'penelope.waistband':'waistband.outer',
  'sandy.skirt':'skirt.gore', 'sandy.waistband':'waistband.outer',
  'shelly.front':'body.front', 'shelly.back':'body.back', 'shelly.raglanSleeve':'sleeve.main', 'shelly.neckband':'binding.neck',
  'shin.front':'trouser.front', 'shin.back':'trouser.back', 'shin.waistband':'waistband.outer',
  'uma.front':'foundation.brief-front', 'uma.back':'foundation.brief-back', 'uma.gusset':'gusset.crotch',
  'trayvon.interfacingTail':'accessory.tie', 'trayvon.interfacingTip':'accessory.tie',
  'trayvon.liningTail':'accessory.tie-tip', 'trayvon.liningTip':'accessory.tie-tip',
  'trayvon.fabricTail':'accessory.tie', 'trayvon.fabricTip':'accessory.tie', 'trayvon.fabricLoop':'strap.loop',
  'lunetius.lacerna':'drape.cape',
};

// A source can contain several distinct closed panel paths, all preserved separately.
export const netPathKeys = {
  'noble.backInside':['insideSeam'], 'noble.backOutside':['outsideSeam'],
  'cathrin.panel1':['panel1a','panel1b'], 'cathrin.panel2':['panel2'], 'cathrin.panel3':['panel3'],
  'cathrin.panel4':['panel4'], 'cathrin.panel5':['panel5'], 'cathrin.panel6':['panel6'],
  'paco.frontPocketBag':['pocket'], 'penelope.waistband':['outline'], 'holmes.crown':['gore_seam'],
};
// Cathrin's first source part contains two genuinely separate panels.
export const cutPathKeys = {
  'cathrin.panel1/panel1a':['saA'], 'cathrin.panel1/panel1b':['saB'],
};
const male = 'cisMaleAdult38', female = 'cisFemaleAdult34';
export const referenceSamples = [
  ...['brian','aaron','teagan','sven','simon','huey','albert','benjamin','bent','bruce','carlton','charlie','florent','holmes','hugo','jaeger','paco','shin','trayvon','lunetius']
    .map(design=>({id:design,design,profile:male,options:{},label:'源默认构型'})),
  ...['bee','bob','cathrin','noble','penelope','sandy','shelly','uma']
    .map(design=>({id:design,design,profile:female,options:{},label:'源默认构型'})),
  {id:'simon-separate',design:'simon',profile:male,options:{separateButtonPlacket:true,separateButtonholePlacket:true},label:'独立前门襟'},
  ...['straightBarrelCuff','roundedBarrelCuff','straightFrenchCuff','roundedFrenchCuff','angledFrenchCuff']
    .map(cuffStyle=>({id:'simon-'+cuffStyle,design:'simon',profile:male,options:{cuffStyle},only:['simon.cuff'],
      role:cuffStyle.includes('French')?'cuff.french':'cuff.barrel',
      label:({straightBarrelCuff:'直角单翻袖口',roundedBarrelCuff:'圆角单翻袖口',straightFrenchCuff:'直角双翻袖口',roundedFrenchCuff:'圆角双翻袖口',angledFrenchCuff:'斜角双翻袖口'})[cuffStyle]})),
];
