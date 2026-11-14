import type { AssemblyEdge,AssemblyReport } from './assembly';
export type XY=[number,number];
export type XYZ=[number,number,number];
export interface MeshVertexTrace { sourceMm:XY; localMm:XY; sourceEdge:string; t:number; mirrored:boolean }
export interface PanelMesh {
  id:string; sourceId:string; copy:number; quantity:number; unfolded:boolean; material:string;
  /** Rotation around Y followed by translation; all geometry stays in millimetres. */
  placement:{yawDeg:number;translationMm:XYZ};
  vertices:MeshVertexTrace[]; positionsMm:XYZ[]; triangles:number[];
  sourceEdges:AssemblyEdge[];
  metrics:{sourceAreaMm2:number;polygonAreaMm2:number;triangleAreaMm2:number;areaErrorRatio:number;maxRoundtripMm:number;maxEdgeDistortionMm:number;discardedZeroAreaFaces:number};
}
export interface MeshSeamSample { a:XYZ;b:XYZ;aSource:XY;bSource:XY;aSourceEdge:string;bSourceEdge:string;aT:number;bT:number;fraction:number;gapMm:number }
export interface PatternMesh3d {
  schema:'garment-os/pattern-3d/v1';templateId:string;engine:string;version:string;unit:'mm';
  stage:'flat-panel-placement';panels:PanelMesh[];sourceAssembly:AssemblyReport;
  /** Authored physical assignments exist for Aaron shoulder/side seams only. */
  seams:Array<{id:string;aPanel:string;bPanel:string;sourceJoinId:string;mirrored:boolean;sourceLengthDeltaMm:number;status:'unsewn';samples:MeshSeamSample[]}>;
  pending:string[];simulationReady:false;drapeValidated:false;productionApproved:false;
}
