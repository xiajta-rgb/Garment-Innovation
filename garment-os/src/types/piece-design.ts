/** Design intent in source CAD millimetres. Source methods own body/sleeve geometry. */
export interface PieceDesignSpec {
  schema: 'garment-os/piece-design/v1';
  colors: { front:string; back:string; sleeve:string; neckband:string; pocket:string };
  neckWidthMm:number;
  neckRatio:number;
  pocket: { kind:'none'|'square'|'pointed'|'round'; widthMm:number; heightMm:number; xMm:number; yMm:number };
}
export type PieceImageEffect='product'|'model';
