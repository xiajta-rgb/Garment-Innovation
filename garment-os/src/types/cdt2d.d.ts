declare module 'cdt2d' {
  export default function triangulate(points:number[][],edges:number[][],options:{interior:boolean;exterior:boolean;delaunay?:boolean}):number[][];
}
