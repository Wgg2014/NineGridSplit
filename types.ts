
export interface GridSegment {
  id: number;
  row: number;
  col: number;
  thumbnail: string;
  blob?: Blob;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
