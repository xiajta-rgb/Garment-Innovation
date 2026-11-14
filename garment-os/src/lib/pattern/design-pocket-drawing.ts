/** Finished accessory drawing in mm. Bag lining / folds require separate net patterns. */
export function designPocketDrawing(kind:'kangaroo'|'welt'|'zip-welt',width:number,height:number){
 const w=width,h=kind==='kangaroo'?height:Math.min(height,25);
 const line=(d:string,operation:string,fill='none')=>`<path data-operation="${operation}" d="${d}" fill="${fill}" stroke="#263a30" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
 if(kind==='kangaroo')return {width:w,height:h,markup:line(`M${w*.2} 0H${w*.8}Q${w*.82} ${h*.28} ${w} ${h*.45}V${h}H0V${h*.45}Q${w*.18} ${h*.28} ${w*.2} 0Z`,'kangaroo-pocket','currentColor')+line(`M${w*.2+6} 6H${w*.8-6}M6 ${h*.5}V${h-6}H${w-6}V${h*.5}`,'pocket-attachment-stitch')+line(`M${w*.2} 0Q${w*.18} ${h*.28} 0 ${h*.45}M${w*.8} 0Q${w*.82} ${h*.28} ${w} ${h*.45}`,'pocket-open-edges')};
 return {width:w,height:h,markup:line(`M0 0H${w}V${h}H0Z`,'welt-pocket','currentColor')+line(`M4 ${h/2}H${w-4}`,'welt-mouth')+(kind==='zip-welt'?`<g data-operation="pocket-zipper">${Array.from({length:Math.floor(w/4)-2},(_,i)=>line(`M${6+i*4} ${h/2-2}v4`,'pocket-zip-teeth')).join('')}${line(`M${w-17} ${h/2}v12h6V${h/2}Z`,'pocket-zip-pull','#c6c8c4')}</g>`:'')+line(`M0 0V${h}M${w} 0V${h}`,'pocket-end-reinforcement')};
}
