/** @freesewing/core 最小类型声明 (仅声明我们使用的 API) */
declare module '@freesewing/core' {
  export interface FsPoint {
    x: number;
    y: number;
  }
  export class Point implements FsPoint {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    dist(other: FsPoint): number;
    shift(dist: number, angle: number): Point;
    rotate(angle: number, center?: FsPoint): Point;
  }
  export class Path {
    constructor();
    move(to: FsPoint): Path;
    line(to: FsPoint): Path;
    curve(cp1: FsPoint, cp2: FsPoint, to: FsPoint): Path;
    close(): Path;
    offset(distance: number): Path;
    join(...paths: Path[]): Path;
    reverse(cloneAttributes?: boolean): Path;
    length(withMoves?: boolean): number;
    end(): FsPoint;
    asPathstring(): string;
  }
  export class Part {
    constructor();
    points: Record<string, Point>;
    paths: Record<string, Path>;
  }
}

declare module '@freesewing/brian' {
  export class Brian {
    constructor(settings: { measurements: Record<string, number>; options?: Record<string, number | boolean>; sa?: number });
    draft(): void;
    parts: Array<Record<string, unknown>>;
    setStores: Array<{ get(key: string, fallback?: unknown): unknown }>;
  }
}
declare module '@freesewing/models' {
  const models: Record<string, Record<string, number>>;
  export = models;
}

declare module '@freesewing/teagan' {
  export class Teagan {
    constructor(settings: { measurements: Record<string, number>; options?: Record<string, number | boolean | string>; sa?: number; expand?:boolean });
    draft(): void;
    parts: Array<Record<string, unknown>>;
    setStores: Array<{ get(key: string, fallback?: unknown): unknown }>;
    settings: Array<{ options: Record<string, number | boolean | string>; absoluteOptions?:Record<string,number> }>;
  }
}
declare module '@freesewing/sven' { export { Teagan as Sven } from '@freesewing/teagan'; }
declare module '@freesewing/simon' { export { Teagan as Simon } from '@freesewing/teagan'; }
declare module '@freesewing/aaron' { export { Teagan as Aaron } from '@freesewing/teagan'; }
declare module '@freesewing/huey' { export { Teagan as Huey } from '@freesewing/teagan'; }
declare module '@freesewing/sandy' { export { Teagan as Sandy } from '@freesewing/teagan'; }
declare module '@freesewing/paco' { export { Teagan as Paco } from '@freesewing/teagan'; }
declare module '@freesewing/hugo' { export { Teagan as Hugo } from '@freesewing/teagan'; }
