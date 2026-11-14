import type { PieceDesignResult } from './piece-design';
import { escapeSvg } from '@/lib/pattern/mesh/garment-technical-view';
import type { ManagedMaterialAssignment } from '@/types/managed-material';

/** Embedded, display-only photographic material sample. Never changes source CAD. */
export function pieceMaterialPreview(result:PieceDesignResult,assignment:ManagedMaterialAssignment,image:{dataUrl:string;width:number;height:number},includeNeck=false){
  if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl)||image.dataUrl.length>15_000_000||![image.width,image.height].every(n=>Number.isFinite(n)&&n>0))throw Error('面料预览需要有效的嵌入图片。');
  if(!assignment.material.materialPic)throw Error('此面料未提供来源图片。');
  // Company style regions use drawing ratios, while legacy projection paths use px.
  const ratioSpace=result.metadata.styleGuide?.coordinateSpace==='company-drawing-ratio';
  const textureId='piece-material-photo',tileWidth=ratioSpace?.20:500,tileHeight=ratioSpace?.26:650;
  const definition=`<defs><pattern id="${textureId}" patternUnits="userSpaceOnUse" width="${tileWidth}" height="${tileHeight}"><image href="${image.dataUrl}" width="${tileWidth}" height="${tileHeight}" preserveAspectRatio="xMidYMid slice"/></pattern></defs>`;
  const sourceIds:string[]=[];
  const svg=result.threeViewSvg.replace(/<path data-source-piece="([^"]+)"[^>]*\/>/g,(path,id:string)=>{
    const isNeck=/neckband|binding/.test(id);
    if(isNeck&&!includeNeck)return path;
    if(!/\.(front|back|sleeve)$|patch-pocket|neckband|binding/.test(id))return path;
    if(!sourceIds.includes(id))sourceIds.push(id);
    return path.replace(/fill="[^"]*"/,`fill="url(#${textureId})"`).replace(/stroke="[^"]*"/,'stroke="none"');
  });
  if(!sourceIds.length)throw Error('当前三视图没有可对应的裁片色块。');
  const materialPreview={schema:'garment-os/piece-material-preview/v1',source:assignment,embeddedImage:{width:image.width,height:image.height},sourceIds,mode:'photo-pattern-clipped-to-existing-piece-regions',physicalTextureScaleMm:null,cadModified:false,drapeValidated:false,neckPhotoApplied:includeNeck};
  const output=svg.replace(/<metadata>[\s\S]*?<\/metadata>/,`<metadata>${escapeSvg(JSON.stringify({...result.metadata,materialPreview}))}</metadata>`).replace(/(<rect width="1500" height="\d+" fill="#fff"\/>)/,`$1${definition}`);
  return {svg:output,metadata:materialPreview};
}
