import type { DuplicateStatus, ScanProgress, ScanStatus } from './scan-view'

export type ScanEvent =
  | { readonly type: 'progress'; readonly id: string; readonly progress: ScanProgress }
  | { readonly type: 'status'; readonly id: string; readonly status: ScanStatus }
  | { readonly type: 'duplicates'; readonly id: string; readonly status: DuplicateStatus; readonly done: number; readonly total: number }
