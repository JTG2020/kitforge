export interface RectMM {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AspectRatioBucket =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9';

export interface AspectBucketConfig {
  ratioStr: AspectRatioBucket;
  w: number;
  h: number;
  value: number;
}
