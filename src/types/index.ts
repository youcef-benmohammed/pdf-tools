import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ToolCategory = 'organize' | 'sign' | 'convert' | 'optimize';

export type AcceptKind = 'pdf' | 'image';

/** Tool identifiers double as URL slugs (#/<id>); their texts live in the dictionaries. */
export type ToolId =
  | 'fusionner'
  | 'diviser'
  | 'extraire'
  | 'supprimer'
  | 'organiser'
  | 'pivoter'
  | 'signer'
  | 'images-en-pdf'
  | 'compresser'
  | 'filigrane';

export interface ToolDefinition {
  id: ToolId;
  category: ToolCategory;
  icon: LucideIcon;
  accept: AcceptKind;
  /** Accepts several files at once */
  multiple: boolean;
  component: LazyExoticComponent<ComponentType>;
}

/** One page in a composition (reorder, extract, delete…) */
export interface PageRef {
  /** Stable id for drag and drop */
  id: string;
  /** Index of the source file */
  source: number;
  /** 0-based page index in the source file */
  index: number;
  /** Rotation added by the user, in degrees (multiple of 90) */
  rotation: number;
}

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  /** 0 → 1 */
  opacity: number;
  /** "#rrggbb" */
  color: string;
  /** Visible angle in degrees */
  angle: number;
  layout: 'center' | 'tile';
}

export interface ImagePageInput {
  bytes: Uint8Array;
  kind: 'jpg' | 'png';
}

export type PageSizeMode = 'fit' | 'a4' | 'letter';
export type OrientationMode = 'auto' | 'portrait' | 'landscape';

export interface ImagesToPdfOptions {
  pageSize: PageSizeMode;
  orientation: OrientationMode;
  /** Margin in PDF points */
  margin: number;
}

/** Placement of an image (signature) in PDF coordinates */
export interface StampPlacement {
  pageIndex: number;
  imageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees (counter-clockwise, PDF space) */
  rotate: number;
}

export interface RasterPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
  mime: string;
}
