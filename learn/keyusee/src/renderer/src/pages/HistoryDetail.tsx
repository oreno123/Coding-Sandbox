import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, IconButton, Slider, Button,
  CircularProgress, Stack, FormControl, InputLabel, Select, MenuItem, Menu,
  TextField, Tab, Tabs, LinearProgress, Tooltip, Link,
  ToggleButton, SvgIcon, RadioGroup, FormControlLabel, Radio, Switch, FormLabel, Checkbox
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  UploadFile,
  ContentCut as ContentCutIcon,
  CenterFocusStrong as CenterFocusStrongIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  VolumeUp as VolumeUpIcon,
  Mic as MicIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';

interface HistoryDetailProps { }

interface RecordingHistoryItem {
  id: string;
  recordedAt: string;
  startedAtMs?: number;
  createdAtMs: number;
  durationMs: number;
  durationText: string;
  name: string;
  absolutePath: string;
  screenVideoPath?: string;
  cameraVideoPath?: string;
  micAudioPath?: string;
  inputLogPath?: string;
}

interface ParsedAction {
  id: string;
  order: number;
  time: string;
  timestamp: number;
  type?: number;
  x?: number;
  y?: number;
  button?: number;
  clicks?: number;
  amount?: number;
  direction?: number;
  rotation?: number;
  keycode?: number;
  action: string;
  detail: string;
}

type CameraPositionPreset = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
type ExportPreset = { label: string; width: number; height: number; fps: 30 | 60 };
type ExportVideoFormat = 'webm' | 'mp4';
type MouseOperationKind = 'click' | 'doubleClick' | 'rightClick' | 'down' | 'up' | 'wheel';
type EditBlockType = 'cut' | 'focus';
type CutTransitionType = 'none' | 'dissolve' | 'dipToBlack' | 'slideLeft' | 'zoomFade';
type TransitionCurveType = 'linear' | 'easeOutQuad' | 'easeInOutQuad' | 'easeOutCubic' | 'easeInOutCubic' | 'easeOutBack' | 'easeInOutBack';
type FocusTransform3DAnchor = 'none' | 'topLeft' | 'top' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left';
type FocusZoomMode = 'follow' | 'fixed' | 'custom';

interface EditBlockBase {
  id: string;
  type: EditBlockType;
  startSec: number;
  endSec: number;
}

interface CutEditBlock extends EditBlockBase {
  type: 'cut';
  transitionType: CutTransitionType;
  transitionDurationSec: number;
}

interface FocusEditBlock extends EditBlockBase {
  type: 'focus';
  zoomScale: number;
  transitionDurationSec: number;
  transitionCurve: TransitionCurveType;
  cameraZoomScale: number;
  hideCamera?: boolean;
  zoomMode?: FocusZoomMode;
  fixedMargin?: number;
  customCenterX?: number;
  customCenterY?: number;
  breakoutScreenBounds?: boolean;
  transform3dAnchor?: FocusTransform3DAnchor;
  transform3dStrength?: number;
}

type TimelineEditBlock = CutEditBlock | FocusEditBlock;

interface BlockDragState {
  blockId: string;
  mode: 'move' | 'resize-left' | 'resize-right';
  startClientX: number;
  initialStartSec: number;
  initialEndSec: number;
}

interface MousePointSample {
  t: number;
  x: number;
  y: number;
}

interface MouseOperationEvent extends MousePointSample {
  kind: MouseOperationKind;
  label: string;
}

interface KeyboardHintEvent {
  t: number;
  text: string;
}

interface MouseReplayData {
  samples: MousePointSample[];
  operations: MouseOperationEvent[];
  keyboardHints: KeyboardHintEvent[];
}

interface PreviewSourceRect {
  x: number;
  y: number;
  w: number;
  h: number;
  vw: number;
  vh: number;
}

interface PreviewRenderGeometry {
  canvasWidth: number;
  canvasHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  screenDrawRect: { x: number; y: number; w: number; h: number };
  activeSourceRect: PreviewSourceRect | null;
}

interface ScreenFrameStyle {
  margin: number;
  radius: number;
}

interface NormalizedCutRange {
  startSec: number;
  endSec: number;
  transitionType: CutTransitionType;
  transitionDurationSec: number;
}

const EXPORT_PRESETS: ExportPreset[] = [
  { label: '1080p 30fps', width: 1920, height: 1080, fps: 30 },
  { label: '1080p 60fps', width: 1920, height: 1080, fps: 60 },
  { label: '2k 30fps', width: 2560, height: 1440, fps: 30 },
  { label: '2k 60fps', width: 2560, height: 1440, fps: 60 },
  { label: '4k 30fps', width: 3840, height: 2160, fps: 30 },
  { label: '4k 60fps', width: 3840, height: 2160, fps: 60 }
];
const DEFAULT_EXPORT_PRESET = EXPORT_PRESETS[0];
const EMPTY_MOUSE_REPLAY_DATA: MouseReplayData = { samples: [], operations: [], keyboardHints: [] };
const CUT_TRANSITION_OPTIONS: { value: CutTransitionType; label: string }[] = [
  { value: 'none', label: '不过渡' },
  { value: 'dissolve', label: '叠化' },
  { value: 'dipToBlack', label: '黑场淡变' },
  { value: 'slideLeft', label: '左滑过渡' },
  { value: 'zoomFade', label: '缩放渐变' }
];
const DEFAULT_CUT_TRANSITION_TYPE: CutTransitionType = 'none';
const DEFAULT_CUT_TRANSITION_DURATION_SEC = 0.35;
const MAX_CUT_TRANSITION_DURATION_SEC = 2;
const DEFAULT_FOCUS_TRANSITION_DURATION_SEC = 0.4;
const DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS = true;
const DEFAULT_CUSTOM_FOCUS_CENTER = 0.5;
const DEFAULT_FOCUS_3D_STRENGTH = 32;
const MAX_FOLLOW_FOCUS_ZOOM_SCALE = 3;
const MAX_CUSTOM_FOCUS_ZOOM_SCALE = 10;
const PREVIEW_WHEEL_ZOOM_STEP = 0.1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;
const formatTwoDecimals = (value: number) => roundToTwoDecimals(value).toFixed(2);
const parseInputNumber = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveScreenFrameStyle = (
  baseMargin: number,
  baseRadius: number,
  breakoutProgress: number
): ScreenFrameStyle => {
  const progress = clamp(breakoutProgress, 0, 1);
  return {
    margin: lerp(Math.max(0, baseMargin), 0, progress),
    radius: Math.max(0, baseRadius)
  };
};

const EASING_FUNCTIONS: Record<TransitionCurveType, (t: number) => number> = {
  linear: (t) => t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }
};

const FOCUS_CURVE_OPTIONS: { value: TransitionCurveType; label: string }[] = [
  { value: 'linear', label: '匀速 (Linear)' },
  { value: 'easeOutQuad', label: '平滑减速 (Ease Out)' },
  { value: 'easeInOutQuad', label: '平滑加速减速 (Ease In Out)' },
  { value: 'easeOutCubic', label: '平滑减速2 (Ease Out Cubic)' },
  { value: 'easeInOutCubic', label: '平滑加速减速2 (Ease In Out Cubic)' },
  { value: 'easeOutBack', label: '回弹 (Ease Out Back)' },
  { value: 'easeInOutBack', label: '回弹2 (Ease In Out Back)' }
];

const FOCUS_3D_ANCHOR_OPTIONS: { value: FocusTransform3DAnchor; label: string; grid: [number, number] }[] = [
  { value: 'topLeft', label: '左上角', grid: [2, 2] },
  { value: 'top', label: '上边', grid: [1, 2] },
  { value: 'topRight', label: '右上角', grid: [2, 0] },
  { value: 'left', label: '左边', grid: [0, 1] },
  { value: 'none', label: '不变换', grid: [1, 1] },
  { value: 'right', label: '右边', grid: [2, 1] },
  { value: 'bottomLeft', label: '左下角', grid: [0, 2] },
  { value: 'bottom', label: '下边', grid: [1, 0] },
  { value: 'bottomRight', label: '右下角', grid: [0, 0] }

];

const get3DAnchorNearVector = (anchor: FocusTransform3DAnchor) => {
  switch (anchor) {
    case 'topLeft':
      return { x: -0.707, y: -0.707 };
    case 'top':
      return { x: 0, y: -1 };
    case 'topRight':
      return { x: 0.707, y: -0.707 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottomRight':
      return { x: 0.707, y: 0.707 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'bottomLeft':
      return { x: -0.707, y: 0.707 };
    case 'left':
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
};

const createOrResizeCanvas = (ref: React.MutableRefObject<HTMLCanvasElement | null>, width: number, height: number) => {
  if (!ref.current) {
    ref.current = document.createElement('canvas');
  }
  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  if (ref.current.width !== targetWidth || ref.current.height !== targetHeight) {
    ref.current.width = targetWidth;
    ref.current.height = targetHeight;
  }
  return ref.current;
};

const buildPerspectiveCorners = (width: number, height: number, anchor: FocusTransform3DAnchor, strengthDeg: number) => {
  const near = get3DAnchorNearVector(anchor);
  const angle = clamp(Math.abs(strengthDeg), 0, 75) * (Math.PI / 180);
  const yaw = near.x * angle * 0.75;
  const pitch = -near.y * angle * 0.75;
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);
  const minDimension = Math.min(width, height);
  const forward = -Math.sin(angle * 0.85) * minDimension * 0.28;
  const focal = Math.max(width, height) * 1.95;
  const sourceCorners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 }
  ];
  const projected = sourceCorners.map((corner) => {
    const yawX = corner.x * cosYaw;
    const yawZ = -corner.x * sinYaw;
    const pitchY = corner.y * cosPitch - yawZ * sinPitch;
    const pitchZ = corner.y * sinPitch + yawZ * cosPitch + forward;
    const z = pitchZ;
    const p = focal / Math.max(1, focal + z);
    return { x: yawX * p, y: pitchY * p };
  });
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of projected) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const padding = Math.ceil(Math.max(width, height) * (0.14 + Math.sin(angle) * 0.12));
  const outW = Math.max(1, Math.ceil(maxX - minX + padding * 2));
  const outH = Math.max(1, Math.ceil(maxY - minY + padding * 2));
  const corners = projected.map((p) => ({
    x: p.x - minX + padding,
    y: p.y - minY + padding
  })) as [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }];
  return { width: outW, height: outH, corners };
};

const drawImageToTriangle = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  src: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }],
  dst: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }],
  imageWidth: number,
  imageHeight: number
) => {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;
  
  // To avoid seams between triangles, we slightly expand the destination triangle
  const cx = (d0.x + d1.x + d2.x) / 3;
  const cy = (d0.y + d1.y + d2.y) / 3;
  const expand = 0.6; // Adjust expansion to cover anti-aliasing gaps without creating thick overlaps
  const pad = (node: { x: number; y: number }) => {
    const dx = node.x - cx;
    const dy = node.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return node;
    return { x: node.x + (dx / dist) * expand, y: node.y + (dy / dist) * expand };
  };
  const c0 = pad(d0);
  const c1 = pad(d1);
  const c2 = pad(d2);

  // Recompute the affine transform matrix using the slightly expanded destination coordinates
  // This ensures the image stretches to fill the expanded triangle, eliminating both gaps and double-drawn edges
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-6) return;
  const a = (c0.x * (s1.y - s2.y) + c1.x * (s2.y - s0.y) + c2.x * (s0.y - s1.y)) / denom;
  const c = (c0.x * (s2.x - s1.x) + c1.x * (s0.x - s2.x) + c2.x * (s1.x - s0.x)) / denom;
  const e = (c0.x * (s1.x * s2.y - s2.x * s1.y) + c1.x * (s2.x * s0.y - s0.x * s2.y) + c2.x * (s0.x * s1.y - s1.x * s0.y)) / denom;
  const b = (c0.y * (s1.y - s2.y) + c1.y * (s2.y - s0.y) + c2.y * (s0.y - s1.y)) / denom;
  const d = (c0.y * (s2.x - s1.x) + c1.y * (s0.x - s2.x) + c2.y * (s1.x - s0.x)) / denom;
  const f = (c0.y * (s1.x * s2.y - s2.x * s1.y) + c1.y * (s2.x * s0.y - s0.x * s2.y) + c2.y * (s0.x * s1.y - s1.x * s0.y)) / denom;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
  ctx.restore();
};

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const n = vector.length;
  const a = matrix.map((row) => [...row]);
  const b = [...vector];
  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxAbs = Math.abs(a[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const valueAbs = Math.abs(a[row][col]);
      if (valueAbs > maxAbs) {
        maxAbs = valueAbs;
        pivotRow = row;
      }
    }
    if (maxAbs < 1e-9) {
      return null;
    }
    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }
    const pivot = a[col][col];
    for (let j = col; j < n; j += 1) {
      a[col][j] /= pivot;
    }
    b[col] /= pivot;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j < n; j += 1) {
        a[row][j] -= factor * a[col][j];
      }
      b[row] -= factor * b[col];
    }
  }
  return b;
};

const buildHomography = (
  src: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }],
  dst: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }]
) => {
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const s = src[i];
    const d = dst[i];
    matrix.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    vector.push(d.x);
    matrix.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    vector.push(d.y);
  }
  const solved = solveLinearSystem(matrix, vector);
  if (!solved) return null;
  const [h11, h12, h13, h21, h22, h23, h31, h32] = solved;
  return { h11, h12, h13, h21, h22, h23, h31, h32 };
};

const mapByHomography = (
  h: { h11: number, h12: number, h13: number, h21: number, h22: number, h23: number, h31: number, h32: number },
  x: number,
  y: number
) => {
  const den = h.h31 * x + h.h32 * y + 1;
  if (Math.abs(den) < 1e-7) {
    return { x: h.h11 * x + h.h12 * y + h.h13, y: h.h21 * x + h.h22 * y + h.h23 };
  }
  return {
    x: (h.h11 * x + h.h12 * y + h.h13) / den,
    y: (h.h21 * x + h.h22 * y + h.h23) / den
  };
};

const drawImageToQuad = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  corners: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }],
  detail = 12
) => {
  const [tl, tr, br, bl] = corners;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const srcQuad: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }] = [
    { x: 0, y: 0 },
    { x: imageWidth, y: 0 },
    { x: imageWidth, y: imageHeight },
    { x: 0, y: imageHeight }
  ];
  const h = buildHomography(srcQuad, corners);
  if (!h) {
    drawImageToTriangle(
      ctx,
      image,
      [{ x: 0, y: 0 }, { x: imageWidth, y: 0 }, { x: imageWidth, y: imageHeight }],
      [tl, tr, br],
      imageWidth,
      imageHeight
    );
    drawImageToTriangle(
      ctx,
      image,
      [{ x: 0, y: 0 }, { x: imageWidth, y: imageHeight }, { x: 0, y: imageHeight }],
      [tl, br, bl],
      imageWidth,
      imageHeight
    );
    return;
  }
  const segments = clamp(Math.round(detail), 4, 28);
  const bleed = 0.35;
  for (let y = 0; y < segments; y += 1) {
    const v0Base = (y / segments) * imageHeight;
    const v1Base = ((y + 1) / segments) * imageHeight;
    const v0 = y === 0 ? v0Base : Math.max(0, v0Base - bleed);
    const v1 = y === segments - 1 ? v1Base : Math.min(imageHeight, v1Base + bleed);
    for (let x = 0; x < segments; x += 1) {
      const u0Base = (x / segments) * imageWidth;
      const u1Base = ((x + 1) / segments) * imageWidth;
      const u0 = x === 0 ? u0Base : Math.max(0, u0Base - bleed);
      const u1 = x === segments - 1 ? u1Base : Math.min(imageWidth, u1Base + bleed);
      const p00 = mapByHomography(h, u0, v0);
      const p10 = mapByHomography(h, u1, v0);
      const p11 = mapByHomography(h, u1, v1);
      const p01 = mapByHomography(h, u0, v1);
      drawImageToTriangle(
        ctx,
        image,
        [{ x: u0, y: v0 }, { x: u1, y: v0 }, { x: u1, y: v1 }],
        [p00, p10, p11],
        imageWidth,
        imageHeight
      );
      drawImageToTriangle(
        ctx,
        image,
        [{ x: u0, y: v0 }, { x: u1, y: v1 }, { x: u0, y: v1 }],
        [p00, p11, p01],
        imageWidth,
        imageHeight
      );
    }
  }
};

const findUpperBoundByTime = <T extends { t: number }>(items: T[], t: number) => {
  let left = 0;
  let right = items.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (items[mid].t <= t) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
};

const percentile = (sorted: number[], ratio: number) => {
  if (sorted.length === 0) return 0;
  const index = clamp(Math.round((sorted.length - 1) * ratio), 0, sorted.length - 1);
  return sorted[index];
};

const buildAxisNormalizer = (values: number[], videoSize: number) => {
  const fallbackMax = Number.isFinite(videoSize) && videoSize > 0 ? videoSize : 1;
  if (values.length === 0) {
    return (value: number) => clamp(value / fallbackMax, 0, 1);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const p02 = percentile(sorted, 0.02);
  const p98 = percentile(sorted, 0.98);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const span = Math.max(1, max - min);
  const coreSpan = Math.max(1, p98 - p02);
  const inVideoRangeCount = values.filter(v => v >= -fallbackMax * 0.05 && v <= fallbackMax * 1.05).length;
  const inVideoRatio = inVideoRangeCount / values.length;

  let refMin = 0;
  let refMax = fallbackMax;
  const seemsNative = inVideoRatio >= 0.9 && span <= fallbackMax * 1.25;
  const seemsOffset = coreSpan >= fallbackMax * 0.75 && coreSpan <= fallbackMax * 1.35;
  if (seemsNative) {
    refMin = 0;
    refMax = fallbackMax;
  } else if (seemsOffset) {
    refMin = p02;
    refMax = p02 + fallbackMax;
  } else {
    refMin = p02;
    refMax = p98;
  }

  const denom = Math.max(1, refMax - refMin);
  return (value: number) => clamp((value - refMin) / denom, 0, 1);
};

const resolveActionType = (action: ParsedAction) => {
  if (typeof action.type === 'number') return action.type;
  if (action.action.includes('键盘按下')) return 4;
  if (action.action.includes('键盘抬起')) return 5;
  if (action.action.includes('鼠标点击')) return 6;
  if (action.action.includes('鼠标按下')) return 7;
  if (action.action.includes('鼠标抬起')) return 8;
  if (action.action.includes('鼠标移动')) return 9;
  if (action.action.includes('鼠标滚轮')) return 11;
  return -1;
};

const resolveClickOperationMeta = (action: ParsedAction): Pick<MouseOperationEvent, 'kind' | 'label'> => {
  const actionText = `${action.action} ${action.detail}`.toLowerCase();
  const isRightClick = action.button === 2 || action.button === 3 || actionText.includes('右键') || actionText.includes('right');
  if (isRightClick) {
    return { kind: 'rightClick', label: '右击' };
  }
  const isDoubleClick = (action.clicks ?? 0) >= 2 || actionText.includes('双击') || actionText.includes('double');
  if (isDoubleClick) {
    return { kind: 'doubleClick', label: '双击' };
  }
  return { kind: 'click', label: '单击' };
};

const buildMouseReplayData = (actions: ParsedAction[], videoWidth: number, videoHeight: number): MouseReplayData => {
  const validActions = actions
    .filter(action => Number.isFinite(action.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (validActions.length === 0) {
    return EMPTY_MOUSE_REPLAY_DATA;
  }

  const rawPoints = validActions.filter(
    action => Number.isFinite(action.x) && Number.isFinite(action.y)
  );
  const normalizeX = buildAxisNormalizer(rawPoints.map(action => Number(action.x)), videoWidth);
  const normalizeY = buildAxisNormalizer(rawPoints.map(action => Number(action.y)), videoHeight);

  const samples: MousePointSample[] = rawPoints.map(action => ({
    t: action.timestamp,
    x: normalizeX(Number(action.x)),
    y: normalizeY(Number(action.y))
  }));

  const operations: MouseOperationEvent[] = validActions
    .filter(action => {
      const type = resolveActionType(action);
      return (type === 6 || type === 7 || type === 8 || type === 11) && Number.isFinite(action.x) && Number.isFinite(action.y);
    })
    .map(action => {
      const type = resolveActionType(action);
      const operationMeta: Pick<MouseOperationEvent, 'kind' | 'label'> = type === 6
        ? resolveClickOperationMeta(action)
        : type === 7
          ? { kind: 'down', label: '按下' }
          : type === 8
            ? { kind: 'up', label: '抬起' }
            : { kind: 'wheel', label: '滚轮' };
      return {
        t: action.timestamp,
        x: normalizeX(Number(action.x)),
        y: normalizeY(Number(action.y)),
        kind: operationMeta.kind,
        label: operationMeta.label
      };
    });

  const keyboardHints: KeyboardHintEvent[] = validActions
    .filter(action => {
      const type = resolveActionType(action);
      return type === 4 || type === 5;
    })
    .map(action => ({
      t: action.timestamp,
      text: action.detail
    }));

  return { samples, operations, keyboardHints };
};

const interpolatePointer = (samples: MousePointSample[], t: number) => {
  if (samples.length === 0) return null;
  const upper = findUpperBoundByTime(samples, t);
  if (upper <= 0) return { x: samples[0].x, y: samples[0].y };
  if (upper >= samples.length) return { x: samples[samples.length - 1].x, y: samples[samples.length - 1].y };
  const prev = samples[upper - 1];
  const next = samples[upper];
  const span = Math.max(1, next.t - prev.t);
  const progress = clamp((t - prev.t) / span, 0, 1);
  return {
    x: prev.x + (next.x - prev.x) * progress,
    y: prev.y + (next.y - prev.y) * progress
  };
};

const getTrailPoints = (samples: MousePointSample[], t: number, trailMs: number, maxPoints: number) => {
  if (samples.length === 0 || trailMs <= 0) return [];
  const startT = t - trailMs;
  const startUpper = findUpperBoundByTime(samples, startT);
  const endUpper = findUpperBoundByTime(samples, t);
  const points: MousePointSample[] = [];
  const startPos = interpolatePointer(samples, startT);
  if (startPos) points.push({ t: startT, x: startPos.x, y: startPos.y });
  for (let i = startUpper; i < endUpper; i += 1) {
    points.push(samples[i]);
  }
  const endPos = interpolatePointer(samples, t);
  if (endPos) points.push({ t, x: endPos.x, y: endPos.y });
  if (points.length <= maxPoints) return points;
  const stride = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % stride === 0 || index === points.length - 1);
};

const MIN_BLOCK_DURATION_SEC = 0.2;
const BLOCK_TIME_EPSILON = 0.0001;
const AI_FOCUS_PADDING_SEC = 0.2;
const AI_FOCUS_NEARBY_MERGE_GAP_SEC = 0.45;
const AI_FOCUS_MIN_DRAG_DURATION_MS = 140;
const AI_FOCUS_MIN_DRAG_POINTS = 8;
const AI_FOCUS_CIRCLE_WINDOW_MS = 1500;
const AI_FOCUS_CIRCLE_STEP_MS = 200;
const AI_FOCUS_CIRCLE_MAX_SPAN = 0.16;
const AI_FOCUS_CIRCLE_MAX_DIRECT_DISTANCE = 0.075;

interface FocusCandidateRange {
  startSec: number;
  endSec: number;
}

const getSortedTimelineBlocks = (blocks: TimelineEditBlock[]) => (
  [...blocks].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec)
);

const findBlockAtTime = (blocks: TimelineEditBlock[], timeSec: number) => (
  blocks.find((block) => (
    timeSec >= block.startSec - BLOCK_TIME_EPSILON &&
    timeSec <= block.endSec + BLOCK_TIME_EPSILON
  )) || null
);

const findBestStartInAvailableGap = (
  desiredStartSec: number,
  durationSec: number,
  excludeBlockId: string | null,
  blocks: TimelineEditBlock[],
  totalDurationSec: number
) => {
  const safeTotalDuration = Math.max(0, totalDurationSec);
  const safeDuration = Math.max(MIN_BLOCK_DURATION_SEC, durationSec);
  if (safeDuration > safeTotalDuration + BLOCK_TIME_EPSILON) {
    return null;
  }
  const others = getSortedTimelineBlocks(blocks.filter(block => block.id !== excludeBlockId));
  let cursor = 0;
  let bestStart: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const evaluateGap = (gapStart: number, gapEnd: number) => {
    if (gapEnd - gapStart < safeDuration - BLOCK_TIME_EPSILON) return;
    const maxStart = gapEnd - safeDuration;
    const clampedStart = clamp(desiredStartSec, gapStart, maxStart);
    const distance = Math.abs(clampedStart - desiredStartSec);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStart = clampedStart;
    }
  };
  for (const other of others) {
    evaluateGap(cursor, Math.max(cursor, other.startSec));
    cursor = Math.max(cursor, other.endSec);
  }
  evaluateGap(cursor, safeTotalDuration);
  return bestStart;
};

const getMinStartForEnd = (endSec: number, excludeBlockId: string, blocks: TimelineEditBlock[]) => {
  let minStart = 0;
  for (const block of blocks) {
    if (block.id === excludeBlockId) continue;
    if (block.startSec < endSec - BLOCK_TIME_EPSILON) {
      minStart = Math.max(minStart, block.endSec);
    }
  }
  return minStart;
};

const getMaxEndForStart = (startSec: number, excludeBlockId: string, blocks: TimelineEditBlock[], totalDurationSec: number) => {
  let maxEnd = Math.max(0, totalDurationSec);
  for (const block of blocks) {
    if (block.id === excludeBlockId) continue;
    if (block.endSec > startSec + BLOCK_TIME_EPSILON) {
      maxEnd = Math.min(maxEnd, block.startSec);
    }
  }
  return maxEnd;
};

const resolveRecordingStartMs = (record: RecordingHistoryItem | null, actions: ParsedAction[]) => {
  if (record && typeof record.startedAtMs === 'number' && Number.isFinite(record.startedAtMs)) {
    return record.startedAtMs;
  }
  const firstAction = actions.find(action => Number.isFinite(action.timestamp));
  return firstAction ? firstAction.timestamp : 0;
};

const resolveFocusZoomMode = (value?: string): FocusZoomMode => {
  if (value === 'follow' || value === 'custom') return value;
  return 'fixed';
};

const normalizeFocusBlock = (block: FocusEditBlock): FocusEditBlock => ({
  ...block,
  zoomScale: clamp(Number.isFinite(block.zoomScale) ? block.zoomScale : 1.5, 1, MAX_CUSTOM_FOCUS_ZOOM_SCALE),
  transitionDurationSec: clamp(
    Number.isFinite(block.transitionDurationSec) ? block.transitionDurationSec : DEFAULT_FOCUS_TRANSITION_DURATION_SEC,
    0,
    2
  ),
  transitionCurve: block.transitionCurve || 'easeInOutQuad',
  cameraZoomScale: clamp(Number.isFinite(block.cameraZoomScale) ? block.cameraZoomScale : 0.85, 0.1, 2),
  hideCamera: block.hideCamera ?? false,
  zoomMode: resolveFocusZoomMode(block.zoomMode),
  fixedMargin: Math.max(0, Number.isFinite(block.fixedMargin) ? block.fixedMargin as number : 60),
  customCenterX: clamp(
    Number.isFinite(block.customCenterX) ? block.customCenterX as number : DEFAULT_CUSTOM_FOCUS_CENTER,
    0,
    1
  ),
  customCenterY: clamp(
    Number.isFinite(block.customCenterY) ? block.customCenterY as number : DEFAULT_CUSTOM_FOCUS_CENTER,
    0,
    1
  ),
  breakoutScreenBounds: block.breakoutScreenBounds ?? DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS,
  transform3dAnchor: block.transform3dAnchor ?? 'none',
  transform3dStrength: clamp(
    Number.isFinite(block.transform3dStrength) ? block.transform3dStrength as number : DEFAULT_FOCUS_3D_STRENGTH,
    1,
    75
  )
});

const normalizeTimelineBlock = (block: TimelineEditBlock): TimelineEditBlock => {
  if (block.type === 'focus') {
    return normalizeFocusBlock(block);
  }
  return block;
};

const createDefaultFocusBlock = (id: string, startSec: number, endSec: number): FocusEditBlock => normalizeFocusBlock({
  id,
  type: 'focus',
  startSec,
  endSec,
  zoomScale: 1.5,
  transitionDurationSec: DEFAULT_FOCUS_TRANSITION_DURATION_SEC,
  transitionCurve: 'easeInOutQuad',
  cameraZoomScale: 0.85,
  hideCamera: false,
  zoomMode: 'fixed',
  fixedMargin: 60,
  customCenterX: DEFAULT_CUSTOM_FOCUS_CENTER,
  customCenterY: DEFAULT_CUSTOM_FOCUS_CENTER,
  breakoutScreenBounds: DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS,
  transform3dAnchor: 'none',
  transform3dStrength: DEFAULT_FOCUS_3D_STRENGTH
});

const computePointerPathMetrics = (points: MousePointSample[]) => {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let pathLen = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    if (i > 0) {
      const prev = points[i - 1];
      pathLen += Math.hypot(p.x - prev.x, p.y - prev.y);
    }
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const diagonal = Math.hypot(spanX, spanY);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const directDistance = Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y);
  return {
    spanX,
    spanY,
    diagonal,
    pathLen,
    directDistance,
    dominantSpan: Math.max(spanX, spanY),
    minorSpan: Math.min(spanX, spanY)
  };
};

const normalizeTimelineBlocksWithoutOverlap = (blocks: TimelineEditBlock[], totalDurationSec: number) => {
  const result: TimelineEditBlock[] = [];
  const sorted = getSortedTimelineBlocks(blocks);
  for (const block of sorted) {
    const desiredDuration = Math.max(MIN_BLOCK_DURATION_SEC, block.endSec - block.startSec);
    const fittedStart = findBestStartInAvailableGap(
      block.startSec,
      desiredDuration,
      null,
      result,
      totalDurationSec
    );
    if (fittedStart === null) continue;
    result.push({
      ...block,
      startSec: fittedStart,
      endSec: fittedStart + desiredDuration
    });
  }
  return result;
};

const buildPressDragFocusRanges = (
  actions: ParsedAction[],
  samples: MousePointSample[],
  recordingStartMs: number
) => {
  const ranges: FocusCandidateRange[] = [];
  if (actions.length === 0 || samples.length === 0) return ranges;
  const sortedActions = [...actions]
    .filter(action => Number.isFinite(action.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  let activePress: ParsedAction | null = null;
  for (const action of sortedActions) {
    const type = resolveActionType(action);
    if (type === 7) {
      activePress = action;
      continue;
    }
    if (type === 8 && activePress) {
      const startMs = activePress.timestamp;
      const endMs = action.timestamp;
      if (endMs > startMs + AI_FOCUS_MIN_DRAG_DURATION_MS) {
        const sampleStart = findUpperBoundByTime(samples, startMs - 1);
        const sampleEnd = findUpperBoundByTime(samples, endMs);
        const points = samples.slice(sampleStart, sampleEnd);
        if (points.length >= AI_FOCUS_MIN_DRAG_POINTS) {
          const {
            spanX,
            spanY,
            diagonal,
            pathLen,
            directDistance,
            dominantSpan,
            minorSpan
          } = computePointerPathMetrics(points);
          const isBoxSelection = (
            spanX >= 0.07
            && spanY >= 0.07
            && pathLen >= diagonal * 0.8
            && directDistance >= diagonal * 0.45
          );
          const isTextSweepSelection = (
            dominantSpan >= 0.075
            && minorSpan <= 0.055
            && directDistance >= dominantSpan * 0.72
            && pathLen >= dominantSpan * 0.9
          );
          if (isBoxSelection || isTextSweepSelection) {
            ranges.push({
              startSec: (startMs - recordingStartMs) / 1000,
              endSec: (endMs - recordingStartMs) / 1000
            });
          }
        }
      }
      activePress = null;
    }
  }
  return ranges;
};

const buildSmallCircleFocusRanges = (samples: MousePointSample[], recordingStartMs: number) => {
  const ranges: FocusCandidateRange[] = [];
  if (samples.length < 20) return ranges;
  const firstMs = samples[0].t;
  const lastMs = samples[samples.length - 1].t;
  const windowMs = AI_FOCUS_CIRCLE_WINDOW_MS;
  const stepMs = AI_FOCUS_CIRCLE_STEP_MS;
  for (let startMs = firstMs; startMs + windowMs <= lastMs; startMs += stepMs) {
    const endMs = startMs + windowMs;
    const startIndex = findUpperBoundByTime(samples, startMs - 1);
    const endIndex = findUpperBoundByTime(samples, endMs);
    const points = samples.slice(startIndex, endIndex);
    if (points.length < 14) continue;
    const { spanX, spanY, pathLen, directDistance } = computePointerPathMetrics(points);
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const angleBins = new Set<number>();
    for (const point of points) {
      const angle = Math.atan2(point.y - centerY, point.x - centerX);
      const normalized = angle >= 0 ? angle : angle + Math.PI * 2;
      const bucket = Math.floor((normalized / (Math.PI * 2)) * 8);
      angleBins.add(clamp(bucket, 0, 7));
    }
    const isSmallArea = spanX <= AI_FOCUS_CIRCLE_MAX_SPAN && spanY <= AI_FOCUS_CIRCLE_MAX_SPAN;
    const hasDenseMovement = pathLen >= 0.4 && pathLen >= directDistance * 3;
    const loopsBack = directDistance <= AI_FOCUS_CIRCLE_MAX_DIRECT_DISTANCE;
    const hasCircularCoverage = angleBins.size >= 5;
    if (isSmallArea && hasDenseMovement && loopsBack && hasCircularCoverage) {
      ranges.push({
        startSec: (startMs - recordingStartMs) / 1000,
        endSec: (endMs - recordingStartMs) / 1000
      });
    }
  }
  return ranges;
};

const mergeFocusCandidateRanges = (ranges: FocusCandidateRange[], gapSec: number = AI_FOCUS_NEARBY_MERGE_GAP_SEC) => {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startSec - b.startSec);
  const merged: FocusCandidateRange[] = [];
  for (const range of sorted) {
    if (merged.length === 0) {
      merged.push({ ...range });
      continue;
    }
    const last = merged[merged.length - 1];
    if (range.startSec <= last.endSec + Math.max(0, gapSec)) {
      last.endSec = Math.max(last.endSec, range.endSec);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
};

const resolveCutTransitionDurationSec = (
  transitionType: CutTransitionType,
  transitionDurationSec: number,
  maxAllowedSec: number
) => {
  if (transitionType === 'none') return 0;
  return clamp(transitionDurationSec, 0, Math.max(0, Math.min(MAX_CUT_TRANSITION_DURATION_SEC, maxAllowedSec)));
};

const drawTransitionOverlay = (
  ctx: CanvasRenderingContext2D,
  fromFrame: HTMLCanvasElement,
  width: number,
  height: number,
  progress: number,
  transitionType: CutTransitionType
) => {
  if (transitionType === 'none') return;
  const safeProgress = clamp(progress, 0, 1);
  ctx.save();
  if (transitionType === 'dissolve') {
    ctx.globalAlpha = 1 - safeProgress;
    ctx.drawImage(fromFrame, 0, 0, width, height);
    ctx.restore();
    return;
  }
  if (transitionType === 'dipToBlack') {
    const oldAlpha = safeProgress < 0.5 ? 1 - safeProgress * 2 : 0;
    const blackAlpha = 1 - Math.abs(safeProgress * 2 - 1);
    if (oldAlpha > 0.001) {
      ctx.globalAlpha = oldAlpha;
      ctx.drawImage(fromFrame, 0, 0, width, height);
    }
    if (blackAlpha > 0.001) {
      ctx.globalAlpha = blackAlpha * 0.75;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
    return;
  }
  if (transitionType === 'slideLeft') {
    const slideX = -safeProgress * width;
    const fade = 1 - safeProgress * 0.3;
    ctx.globalAlpha = fade;
    ctx.drawImage(fromFrame, slideX, 0, width, height);
    ctx.restore();
    return;
  }
  if (transitionType === 'zoomFade') {
    const scale = 1 + safeProgress * 0.12;
    const drawW = width * scale;
    const drawH = height * scale;
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;
    ctx.globalAlpha = 1 - safeProgress;
    ctx.drawImage(fromFrame, drawX, drawY, drawW, drawH);
    ctx.restore();
    return;
  }
  ctx.restore();
};

const mergeCutRanges = (blocks: TimelineEditBlock[]) => {
  const ranges = blocks
    .filter((block): block is CutEditBlock => block.type === 'cut')
    .map((block) => {
      const startSec = Math.min(block.startSec, block.endSec);
      const endSec = Math.max(block.startSec, block.endSec);
      const maxAllowedTransition = Math.max(0, (endSec - startSec) * 0.5);
      return {
        startSec,
        endSec,
        transitionType: block.transitionType,
        transitionDurationSec: resolveCutTransitionDurationSec(block.transitionType, block.transitionDurationSec, maxAllowedTransition)
      };
    })
    .sort((a, b) => a.startSec - b.startSec);
  if (ranges.length <= 1) return ranges;
  const merged: NormalizedCutRange[] = [{ ...ranges[0] }];
  for (let i = 1; i < ranges.length; i += 1) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr.startSec <= prev.endSec) {
      prev.endSec = Math.max(prev.endSec, curr.endSec);
      if (prev.transitionType === 'none' && curr.transitionType !== 'none') {
        prev.transitionType = curr.transitionType;
      }
      prev.transitionDurationSec = Math.max(prev.transitionDurationSec, curr.transitionDurationSec);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
};

const findSkipTarget = (sourceSec: number, cutRanges: NormalizedCutRange[]) => {
  for (let i = 0; i < cutRanges.length; i += 1) {
    const range = cutRanges[i];
    if (sourceSec >= range.startSec && sourceSec < range.endSec - 0.0001) {
      return range;
    }
  }
  return null;
};

const CurveIcon = ({ type }: { type: TransitionCurveType }) => {
  const pathData: Record<TransitionCurveType, string> = {
    linear: "M 0 24 L 24 0",
    easeOutQuad: "M 0 24 Q 0 0 24 0",
    easeInOutQuad: "M 0 24 C 12 24 12 0 24 0",
    easeOutCubic: "M 0 24 C 0 0 8 0 24 0",
    easeInOutCubic: "M 0 24 C 12 24 12 0 24 0",
    easeOutBack: "M 0 24 C 0 0 16 -10 24 0",
    easeInOutBack: "M 0 24 C 8 34 16 -10 24 0"
  };

  return (
    <svg width="20" height="20" viewBox="-4 -10 32 44" style={{ marginRight: 8, overflow: 'visible', flexShrink: 0 }}>
      <path d={pathData[type]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const Focus3DAnchorIcon = ({ grid }: { grid: [number, number] }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    {[0, 1, 2].map((row) => [0, 1, 2].map((col) => {
      const selected = row === grid[1] && col === grid[0];
      return (
        <rect
          key={`${row}-${col}`}
          x={5 + col * 5.2}
          y={5 + row * 5.2}
          width="3.6"
          height="3.6"
          rx="0.8"
          fill={selected ? 'currentColor' : 'currentColor'}
          opacity={selected ? 1 : 0.28}
        />
      );
    }))}
  </svg>
);

const HistoryDetail: React.FC<HistoryDetailProps> = () => {
  const [record, setRecord] = useState<RecordingHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actions, setActions] = useState<ParsedAction[]>([]);
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const [sourceResolution, setSourceResolution] = useState({ width: 0, height: 0 });

  // Playback State
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // in seconds
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [previewScale, setPreviewScale] = useState(100);
  const [systemVolume, setSystemVolume] = useState(100);
  const [micVolume, setMicVolume] = useState(100);
  const [timelineBlocks, setTimelineBlocks] = useState<TimelineEditBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [panelBlockType, setPanelBlockType] = useState<EditBlockType>('cut');
  const [blockDragState, setBlockDragState] = useState<BlockDragState | null>(null);
  const [previewDragging, setPreviewDragging] = useState(false);

  // Config State
  const [config, setConfig] = useState({
    aspectPreset: 'auto', // auto, 16:9, 9:16, 4:3, custom
    customWidth: 1920,
    customHeight: 1080,
    backgroundImage: '', // URL or base64
    cameraShape: 'circle' as 'circle' | 'rect',
    cameraScale: 0.15, // 0.1 to 0.5
    cameraPosition: 'bottomLeft' as CameraPositionPreset,
    cameraMargin: 48,
    cameraRadius: 20, // for rect
    screenMargin: 20, // padding for screen video inside canvas
    screenRadius: 10,
    cursorImage: '', // Custom cursor image
    cursorSize: 32,
    cursorHotspotX: 0.08,
    cursorHotspotY: 0.06,
    cursorTrailLengthMs: 700,
    cursorTrailWidth: 3,
    cursorTrailOpacity: 0.5,
    cursorClickEffectDuration: 280,
    showCursorTrail: false,
    showClickEffect: true,
    showTextPrompt: false,
    shadowOpacity: 0.5,
    shadowBlur: 20,
    shadowOffsetX: 0,
    shadowOffsetY: 10,
  });

  const updateConfig = useCallback((patch: Partial<typeof config>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const [selectedElement, setSelectedElement] = useState<'clip' | 'screen' | 'camera' | 'mouse' | 'aiFocus' | 'log'>('screen');
  const [aiFocusOptions, setAiFocusOptions] = useState({
    clearExistingFocusBlocks: true,
    focusBoxSelection: true,
    focusCircleMotion: true
  });
  const [logs, setLogs] = useState<{ time: string, message: string, type: 'info' | 'error' }[]>([]);

  const addLog = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, message, type }]);
  }, []);

  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [exportMenuAnchorEl, setExportMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [exportVideoFormat, setExportVideoFormat] = useState<ExportVideoFormat>('webm');

  // Refs for media and rendering
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const cursorImgRef = useRef<HTMLImageElement | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({}); // Image Cache
  const screenCompositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenWarpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);

  // FPS tracking
  const lastDrawTimeRef = useRef(0);
  const fpsFrameCountRef = useRef(0);
  const fpsSampleStartRef = useRef(0);
  const lastPlayheadSyncRef = useRef(0);
  const [previewFps, setPreviewFps] = useState(0);
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [cursorImages, setCursorImages] = useState<string[]>([]);
  const playheadRef = useRef(0);
  const playingRef = useRef(false);
  const aspectRatioRef = useRef(16 / 9);
  const configRef = useRef(config);
  const actionTimestampsRef = useRef<number[]>([]);
  const mouseReplayRef = useRef<MouseReplayData>(EMPTY_MOUSE_REPLAY_DATA);
  const recordRef = useRef<RecordingHistoryItem | null>(null);
  const timelineBlocksRef = useRef<TimelineEditBlock[]>([]);
  const selectedBlockRef = useRef<TimelineEditBlock | null>(null);
  const cutRangesRef = useRef<NormalizedCutRange[]>([]);
  const fixedFocusCacheRef = useRef<{
    key: string;
    targetZoomScale: number;
    fixedFocusRect: { x: number, y: number, w: number, h: number } | null;
  } | null>(null);
  const previewGeometryRef = useRef<PreviewRenderGeometry | null>(null);
  const previewInteractionPointerIdRef = useRef<number | null>(null);
  const activePreviewTransitionRef = useRef<{
    type: CutTransitionType;
    durationMs: number;
    startTimeMs: number;
    fromFrame: HTMLCanvasElement;
  } | null>(null);
  const exportingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const seekAnimationFrameRef = useRef(0);
  const exportMenuCloseTimerRef = useRef<number | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const clipboardBlockRef = useRef<TimelineEditBlock | null>(null);

  useEffect(() => {
    // @ts-ignore
    if (window.api.getResourceFiles) {
      // @ts-ignore
      window.api.getResourceFiles('background').then(files => setBackgroundImages(files));
      // @ts-ignore
      window.api.getResourceFiles('cursor').then(files => setCursorImages(files));
    }
  }, []);

  const location = useLocation();

  const recordId = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return search.get('recordId') || '';
  }, [location.search]);

  const cutRanges = useMemo(() => mergeCutRanges(timelineBlocks), [timelineBlocks]);
  const selectedBlock = useMemo(
    () => timelineBlocks.find(block => block.id === selectedBlockId) || null,
    [selectedBlockId, timelineBlocks]
  );
  const isCustomFocusSelected = selectedBlock?.type === 'focus' && selectedBlock.zoomMode === 'custom';

  const clampBlockToDuration = useCallback((startSec: number, endSec: number) => {
    const duration = Math.max(0, totalDurationSec || 0);
    const safeStart = clamp(Math.min(startSec, endSec), 0, duration);
    const safeEnd = clamp(Math.max(startSec, endSec), 0, duration);
    if (safeEnd - safeStart < MIN_BLOCK_DURATION_SEC) {
      const adjustedEnd = clamp(safeStart + MIN_BLOCK_DURATION_SEC, 0, duration);
      if (adjustedEnd - safeStart >= MIN_BLOCK_DURATION_SEC) {
        return { startSec: safeStart, endSec: adjustedEnd };
      }
      return { startSec: Math.max(0, duration - MIN_BLOCK_DURATION_SEC), endSec: duration };
    }
    return { startSec: safeStart, endSec: safeEnd };
  }, [totalDurationSec]);

  const updateTimelineBlock = useCallback((blockId: string, updater: (prev: TimelineEditBlock) => TimelineEditBlock) => {
    setTimelineBlocks(prev => {
      const currentBlock = prev.find(block => block.id === blockId);
      if (!currentBlock) return prev;
      const updatedBlock = normalizeTimelineBlock(updater(currentBlock));
      const startChanged = Math.abs(updatedBlock.startSec - currentBlock.startSec) > BLOCK_TIME_EPSILON;
      const endChanged = Math.abs(updatedBlock.endSec - currentBlock.endSec) > BLOCK_TIME_EPSILON;
      if (!startChanged && !endChanged) {
        return prev.map(block => (block.id === blockId ? updatedBlock : block));
      }
      let nextStart = updatedBlock.startSec;
      let nextEnd = updatedBlock.endSec;
      if (startChanged && !endChanged) {
        const minStart = getMinStartForEnd(nextEnd, blockId, prev);
        nextStart = clamp(nextStart, minStart, nextEnd - MIN_BLOCK_DURATION_SEC);
      } else if (!startChanged && endChanged) {
        const maxEnd = getMaxEndForStart(nextStart, blockId, prev, totalDurationSec);
        nextEnd = clamp(nextEnd, nextStart + MIN_BLOCK_DURATION_SEC, maxEnd);
      } else {
        const desiredDuration = Math.max(MIN_BLOCK_DURATION_SEC, nextEnd - nextStart);
        const fittedStart = findBestStartInAvailableGap(nextStart, desiredDuration, blockId, prev, totalDurationSec);
        if (fittedStart === null) {
          return prev;
        }
        nextStart = fittedStart;
        nextEnd = fittedStart + desiredDuration;
      }
      const clampedRange = clampBlockToDuration(nextStart, nextEnd);
      const finalBlock = { ...updatedBlock, ...clampedRange };
      return prev.map(block => (block.id === blockId ? finalBlock : block));
    });
  }, [clampBlockToDuration, totalDurationSec]);

  const addTimelineBlock = useCallback((type: EditBlockType) => {
    const duration = Math.max(1, totalDurationSec || 0);
    const defaultLength = type === 'cut' ? 2 : 3;
    const desiredStartSec = clamp(playheadRef.current, 0, Math.max(0, duration - MIN_BLOCK_DURATION_SEC));
    const desiredDuration = Math.max(MIN_BLOCK_DURATION_SEC, defaultLength);
    const fittedStartSec = findBestStartInAvailableGap(
      desiredStartSec,
      desiredDuration,
      null,
      timelineBlocksRef.current,
      duration
    );
    if (fittedStartSec === null) {
      addLog('没有可用时间段，无法添加新块（禁止重叠）', 'error');
      return;
    }
    const startSec = fittedStartSec;
    const endSec = fittedStartSec + desiredDuration;
    const id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const block: TimelineEditBlock = type === 'cut'
      ? {
        id,
        type: 'cut',
        startSec,
        endSec,
        transitionType: DEFAULT_CUT_TRANSITION_TYPE,
        transitionDurationSec: DEFAULT_CUT_TRANSITION_DURATION_SEC
      }
      : createDefaultFocusBlock(id, startSec, endSec);
    setTimelineBlocks(prev => getSortedTimelineBlocks([...prev, block]));
    setSelectedBlockId(id);
    setPanelBlockType(type);
    setSelectedElement('clip');
  }, [addLog, totalDurationSec]);

  const toFileUrl = useCallback((absolutePath?: string) => {
    if (!absolutePath) return '';
    const normalized = absolutePath.replace(/\\/g, '/');
    // Handle Windows drive letters (e.g. C:) specifically to avoid encoding the colon
    const parts = normalized.split('/');
    const encodedParts = parts.map((part, index) => {
      // If it's the first part and looks like a drive letter (e.g. "C:"), don't encode it
      if (index === 0 && /^[a-zA-Z]:$/.test(part)) {
        return part;
      }
      return encodeURIComponent(part);
    });
    return `file:///${encodedParts.join('/')}`;
  }, []);

  const toBackgroundThumbPath = useCallback((absolutePath?: string) => {
    if (!absolutePath) return '';
    const normalized = absolutePath.replace(/\//g, '\\');
    const idx = normalized.lastIndexOf('\\');
    const dir = idx >= 0 ? normalized.slice(0, idx) : '';
    const file = idx >= 0 ? normalized.slice(idx + 1) : normalized;
    const dot = file.lastIndexOf('.');
    const base = dot > 0 ? file.slice(0, dot) : file;
    return `${dir}\\_thumbs\\${base}.jpg`;
  }, []);

  const backgroundGrid = useMemo(() => {
    if (backgroundImages.length === 0) return null;
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 1 }}>
        {backgroundImages.map((backgroundPath) => {
          const fullUrl = toFileUrl(backgroundPath);
          const thumbUrl = toFileUrl(toBackgroundThumbPath(backgroundPath));
          return (
            <Box
              key={backgroundPath}
              onClick={() => updateConfig({ backgroundImage: fullUrl })}
              sx={{
                aspectRatio: '16/9',
                bgcolor: '#000',
                borderRadius: 1,
                overflow: 'hidden',
                cursor: 'pointer',
                border: config.backgroundImage === fullUrl ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                '&:hover': { opacity: 0.8 }
              }}
            >
              <img
                src={thumbUrl}
                alt="bg"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== fullUrl) img.src = fullUrl;
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
          );
        })}
      </Box>
    );
  }, [backgroundImages, config.backgroundImage, toBackgroundThumbPath, toFileUrl, updateConfig]);

  useEffect(() => {
    if (backgroundImages.length > 0) {
      // Auto-select first background if none is set
      setConfig(prev => {
        if (!prev.backgroundImage) {
          return { ...prev, backgroundImage: toFileUrl(backgroundImages[0]) };
        }
        return prev;
      });
    }
  }, [backgroundImages]);

  useEffect(() => {
    const loadData = async () => {
      if (!recordId) {
        setError('缺少历史记录ID');
        setLoading(false);
        return;
      }
      const item = await window.api.getRecordingHistoryItem(recordId);
      if (!item) {
        setError('未找到历史记录');
        setLoading(false);
        return;
      }
      setRecord(item);
      setTotalDurationSec(item.durationMs / 1000);

      if (item.inputLogPath) {
        const parsed = await window.api.getParsedInputLog(item.inputLogPath);
        if (parsed.success) {
          setActions(parsed.actions);
        } else {
          console.warn(parsed.error || '键鼠日志解析失败');
        }
      }

      // Load config from project folder
      if (item.absolutePath) {
        const configPath = `${item.absolutePath}/project-config.json`;
        const configResult = await window.api.readFileText(configPath);
        if (configResult.success && configResult.data) {
          try {
            const savedData = JSON.parse(configResult.data);
            if (savedData.config) {
              setConfig(prev => ({ ...prev, ...savedData.config }));
            }
            if (savedData.timelineBlocks && Array.isArray(savedData.timelineBlocks)) {
              const normalizedBlocks = savedData.timelineBlocks.map((block: TimelineEditBlock) => normalizeTimelineBlock(block));
              setTimelineBlocks(normalizeTimelineBlocksWithoutOverlap(normalizedBlocks, item.durationMs / 1000));
            }
          } catch (e) {
            console.error('Failed to parse project config', e);
          }
        }
      }

      setLoading(false);
    };
    loadData();
  }, [recordId]);

  const aspectRatio = useMemo(() => {
    if (config.aspectPreset === 'auto') {
      return sourceAspectRatio || 1;
    }
    if (config.aspectPreset === 'custom') {
      return config.customWidth / config.customHeight || 1;
    }
    const [w, h] = config.aspectPreset.split(':').map(Number);
    return w / h || 1;
  }, [config.aspectPreset, config.customWidth, config.customHeight, sourceAspectRatio]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    actionTimestampsRef.current = actions.map(action => action.timestamp);
    const targetWidth = sourceResolution.width > 0 ? sourceResolution.width : window.screen.width || 1920;
    const targetHeight = sourceResolution.height > 0 ? sourceResolution.height : window.screen.height || 1080;
    mouseReplayRef.current = buildMouseReplayData(actions, targetWidth, targetHeight);
  }, [actions, sourceResolution.height, sourceResolution.width]);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  useEffect(() => {
    timelineBlocksRef.current = timelineBlocks;
  }, [timelineBlocks]);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  useEffect(() => {
    cutRangesRef.current = cutRanges;
  }, [cutRanges]);

  useEffect(() => {
    exportingRef.current = exporting;
  }, [exporting]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    aspectRatioRef.current = aspectRatio;
  }, [aspectRatio]);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    if (selectedBlockId && !timelineBlocks.some(block => block.id === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId, timelineBlocks]);

  useEffect(() => {
    if (!selectedBlock) return;
    if (selectedBlock.type === panelBlockType) return;
    updateTimelineBlock(selectedBlock.id, (block) => {
      if (panelBlockType === 'cut') {
        return {
          id: block.id,
          type: 'cut',
          startSec: block.startSec,
          endSec: block.endSec,
          transitionType: block.type === 'cut' ? block.transitionType : DEFAULT_CUT_TRANSITION_TYPE,
          transitionDurationSec: block.type === 'cut' ? block.transitionDurationSec : DEFAULT_CUT_TRANSITION_DURATION_SEC
        };
      }
      return normalizeFocusBlock({
        id: block.id,
        type: 'focus',
        startSec: block.startSec,
        endSec: block.endSec,
        zoomScale: block.type === 'focus' ? block.zoomScale : 1.5,
        transitionDurationSec: block.type === 'focus' ? block.transitionDurationSec : DEFAULT_FOCUS_TRANSITION_DURATION_SEC,
        transitionCurve: block.type === 'focus' ? block.transitionCurve : 'easeInOutQuad',
        cameraZoomScale: block.type === 'focus' ? block.cameraZoomScale : 0.85,
        hideCamera: block.type === 'focus' ? (block.hideCamera ?? false) : false,
        zoomMode: block.type === 'focus' ? resolveFocusZoomMode(block.zoomMode) : 'fixed',
        fixedMargin: block.type === 'focus' ? (block.fixedMargin ?? 60) : 60,
        customCenterX: block.type === 'focus' ? (block.customCenterX ?? DEFAULT_CUSTOM_FOCUS_CENTER) : DEFAULT_CUSTOM_FOCUS_CENTER,
        customCenterY: block.type === 'focus' ? (block.customCenterY ?? DEFAULT_CUSTOM_FOCUS_CENTER) : DEFAULT_CUSTOM_FOCUS_CENTER,
        breakoutScreenBounds: block.type === 'focus'
          ? (block.breakoutScreenBounds ?? DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS)
          : DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS,
        transform3dAnchor: block.type === 'focus' ? (block.transform3dAnchor ?? 'none') : 'none',
        transform3dStrength: block.type === 'focus'
          ? (block.transform3dStrength ?? DEFAULT_FOCUS_3D_STRENGTH)
          : DEFAULT_FOCUS_3D_STRENGTH
      });
    });
  }, [panelBlockType, selectedBlock, updateTimelineBlock]);

  useEffect(() => {
    if (config.cursorImage) {
      const img = new Image();
      img.onload = () => { cursorImgRef.current = img; };
      img.src = config.cursorImage;
    } else {
      cursorImgRef.current = null;
    }
  }, [config.cursorImage]);

  const handleLoadImage = (field: 'backgroundImage' | 'cursorImage') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setConfig(prev => ({ ...prev, [field]: url }));
      }
    };
    input.click();
  };

  // Handle Video Events
  const checkMediaReady = useCallback(() => {
    const screenVideo = screenVideoRef.current;
    const cameraVideo = cameraVideoRef.current;
    const micAudio = micAudioRef.current;

    const hasScreen = !!record?.screenVideoPath;
    const hasCamera = !!record?.cameraVideoPath;
    const hasMic = !!record?.micAudioPath;

    let screenReady = !hasScreen;
    if (hasScreen && screenVideo) {
      screenReady = screenVideo.readyState >= 2;
    }

    let cameraReady = !hasCamera;
    if (hasCamera && cameraVideo) {
      cameraReady = cameraVideo.readyState >= 2;
    }

    let micReady = !hasMic;
    if (hasMic && micAudio) {
      micReady = micAudio.readyState >= 2;
    }

    if (screenReady && cameraReady && micReady) {
      setMediaLoading(false);
    }
  }, [record]);

  const handleMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    if (video === screenVideoRef.current) {
      const metadataDuration = video.duration;
      if (Number.isFinite(metadataDuration) && metadataDuration > 0) {
        setTotalDurationSec(metadataDuration);
      } else if (recordRef.current && Number.isFinite(recordRef.current.durationMs) && recordRef.current.durationMs > 0) {
        setTotalDurationSec(recordRef.current.durationMs / 1000);
      }
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setSourceAspectRatio(video.videoWidth / video.videoHeight);
        setSourceResolution({ width: video.videoWidth, height: video.videoHeight });
      }
    }
  }, []);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video load error:', e.currentTarget.src);
    setMediaLoading(false);
    setError('视频资源加载失败，请检查文件是否存在');
  }, []);

  const handleScreenPlaying = useCallback(() => {
    setMediaLoading(false);
  }, []);

  useEffect(() => {
    setMediaLoading(true);
    // Check immediately in case already ready
    checkMediaReady();
    // Also set a small timeout to check again
    const timer = setTimeout(checkMediaReady, 200);
    return () => clearTimeout(timer);
  }, [record, checkMediaReady]);

  // Core Rendering Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const screenVideo = screenVideoRef.current;
    const cameraVideo = cameraVideoRef.current;
    const currentConfig = configRef.current;
    const currentMouseReplay = mouseReplayRef.current;
    const currentActionTimestamps = actionTimestampsRef.current;
    const currentRecord = recordRef.current;

    if (!canvas || !ctx || !screenVideo) return;

    const now = performance.now();
    if (lastDrawTimeRef.current) {
      const delta = now - lastDrawTimeRef.current;
      if (delta > 0) {
        if (!fpsSampleStartRef.current) fpsSampleStartRef.current = now;
        fpsFrameCountRef.current += 1;
        const sampleDuration = now - fpsSampleStartRef.current;
        if (sampleDuration >= 1000) {
          const fps = Math.round((fpsFrameCountRef.current * 1000) / sampleDuration);
          setPreviewFps(prev => (prev !== fps ? fps : prev));
          fpsSampleStartRef.current = now;
          fpsFrameCountRef.current = 0;
        }
      }
    }
    lastDrawTimeRef.current = now;

    if (!fpsSampleStartRef.current) fpsSampleStartRef.current = now;

    let currentSourceSec = screenVideo.currentTime;
    const isVideoAdvancing = !screenVideo.paused;
    if (isVideoAdvancing) {
      const skipRange = findSkipTarget(currentSourceSec, cutRangesRef.current);
      if (skipRange && Number.isFinite(skipRange.endSec) && skipRange.endSec > currentSourceSec) {
        const maxDuration = Number.isFinite(screenVideo.duration) && screenVideo.duration > 0 ? screenVideo.duration : skipRange.endSec;
        const safeTarget = Math.min(skipRange.endSec, maxDuration);
        const transitionDurationSec = resolveCutTransitionDurationSec(
          skipRange.transitionType,
          skipRange.transitionDurationSec,
          (skipRange.endSec - skipRange.startSec) * 0.5
        );
        if (skipRange.transitionType !== 'none' && transitionDurationSec > 0 && canvas.width > 0 && canvas.height > 0) {
          const fromFrame = document.createElement('canvas');
          fromFrame.width = canvas.width;
          fromFrame.height = canvas.height;
          const fromCtx = fromFrame.getContext('2d');
          if (fromCtx) {
            fromCtx.drawImage(canvas, 0, 0);
            activePreviewTransitionRef.current = {
              type: skipRange.transitionType,
              durationMs: transitionDurationSec * 1000,
              startTimeMs: now,
              fromFrame
            };
          }
        }
        screenVideo.currentTime = safeTarget;
        if (cameraVideo && Number.isFinite(cameraVideo.duration)) {
          cameraVideo.currentTime = Math.min(safeTarget, cameraVideo.duration);
        }
        currentSourceSec = safeTarget;
        playheadRef.current = safeTarget;
        if (!exportingRef.current) {
          setPlayhead(safeTarget);
        }
        if (playingRef.current && !exportingRef.current) {
          animationFrameRef.current = requestAnimationFrame(renderFrame);
        }
      }
    }

    const currentMs = screenVideo.currentTime * 1000;
    let currentAbsoluteMs = currentMs;
    let recordingStartMs = 0;
    if (currentActionTimestamps.length > 0 && currentRecord) {
      const firstActionTime = currentActionTimestamps[0] ?? 0;
      recordingStartMs = typeof currentRecord.startedAtMs === 'number' && Number.isFinite(currentRecord.startedAtMs)
        ? currentRecord.startedAtMs
        : firstActionTime;
      currentAbsoluteMs = recordingStartMs + currentMs;
    }
    const pointer = interpolatePointer(currentMouseReplay.samples, currentAbsoluteMs);
    let currentZoomScale = 1;
    let currentCameraZoomScale = 1;
    let fixedFocusRect: { x: number, y: number, w: number, h: number } | null = null;
    let fixedZoomScale = 1;
    let focusTransitionProgress = 0;
    let focusBreakoutProgress = 0;
    let active3DAnchor: FocusTransform3DAnchor = 'none';
    let active3DStrength = 18;
    let hideCamera = false;

    const activeFocus = timelineBlocksRef.current.find((block) => (
      block.type === 'focus' &&
      currentSourceSec >= block.startSec &&
      currentSourceSec <= block.endSec
    )) as FocusEditBlock | undefined;

    if (activeFocus) {
      const {
        id: focusId,
        startSec,
        endSec,
        transitionDurationSec,
        transitionCurve,
        zoomScale,
        cameraZoomScale,
        hideCamera: activeHideCamera = false,
        zoomMode = 'fixed',
        fixedMargin = 60,
        customCenterX = DEFAULT_CUSTOM_FOCUS_CENTER,
        customCenterY = DEFAULT_CUSTOM_FOCUS_CENTER,
        breakoutScreenBounds = DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS,
        transform3dAnchor = 'none',
        transform3dStrength = 18
      } = activeFocus;
      const easeFn = EASING_FUNCTIONS[transitionCurve] || EASING_FUNCTIONS.easeOutQuad;
      const actualTransitionDuration = Math.min(transitionDurationSec, (endSec - startSec) / 2);

      let progress = 1;
      if (actualTransitionDuration > 0) {
        if (currentSourceSec < startSec + actualTransitionDuration) {
          progress = (currentSourceSec - startSec) / actualTransitionDuration;
        } else if (currentSourceSec > endSec - actualTransitionDuration) {
          progress = (endSec - currentSourceSec) / actualTransitionDuration;
        }
      }

      progress = clamp(progress, 0, 1);
      const easedProgress = easeFn(progress);
      focusTransitionProgress = easedProgress;
      focusBreakoutProgress = breakoutScreenBounds ? easedProgress : 0;
      active3DAnchor = transform3dAnchor;
      active3DStrength = transform3dStrength;
      hideCamera = activeHideCamera;

      let targetZoomScale = clamp(zoomScale, 1, MAX_CUSTOM_FOCUS_ZOOM_SCALE);

      if (zoomMode === 'fixed') {
        const lastSampleT = currentMouseReplay.samples.length > 0
          ? currentMouseReplay.samples[currentMouseReplay.samples.length - 1].t
          : 0;
        const fixedCacheKey = [
          focusId,
          startSec.toFixed(4),
          endSec.toFixed(4),
          fixedMargin.toFixed(1),
          screenVideo.videoWidth,
          screenVideo.videoHeight,
          currentMouseReplay.samples.length,
          lastSampleT
        ].join('|');
        const cachedFocus = fixedFocusCacheRef.current;
        if (cachedFocus && cachedFocus.key === fixedCacheKey) {
          targetZoomScale = cachedFocus.targetZoomScale;
          fixedFocusRect = cachedFocus.fixedFocusRect;
        } else {
          const startMs = recordingStartMs + startSec * 1000;
          const endMs = recordingStartMs + endSec * 1000;
          const sStartIdx = findUpperBoundByTime(currentMouseReplay.samples, startMs - 1);
          const sEndIdx = findUpperBoundByTime(currentMouseReplay.samples, endMs);
          const points = currentMouseReplay.samples.slice(sStartIdx, sEndIdx);

          if (points.length > 0 && screenVideo.videoWidth > 0 && screenVideo.videoHeight > 0) {
            let minX = 1, minY = 1, maxX = 0, maxY = 0;
            for (const p of points) {
              if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
              }
            }

            if (minX <= maxX && minY <= maxY) {
              const vw = screenVideo.videoWidth;
              const vh = screenVideo.videoHeight;
              let pxMinX = minX * vw;
              let pxMinY = minY * vh;
              let pxMaxX = maxX * vw;
              let pxMaxY = maxY * vh;

              pxMinX = Math.max(0, pxMinX - fixedMargin);
              pxMinY = Math.max(0, pxMinY - fixedMargin);
              pxMaxX = Math.min(vw, pxMaxX + fixedMargin);
              pxMaxY = Math.min(vh, pxMaxY + fixedMargin);

              const boxW = Math.max(1, pxMaxX - pxMinX);
              const boxH = Math.max(1, pxMaxY - pxMinY);
              const scaleX = vw / boxW;
              const scaleY = vh / boxH;
              fixedZoomScale = Math.min(scaleX, scaleY);
              fixedZoomScale = clamp(fixedZoomScale, 1, MAX_CUSTOM_FOCUS_ZOOM_SCALE);
              targetZoomScale = fixedZoomScale;

              const centerX = pxMinX + boxW / 2;
              const centerY = pxMinY + boxH / 2;
              fixedFocusRect = {
                x: centerX,
                y: centerY,
                w: vw / targetZoomScale,
                h: vh / targetZoomScale
              };
            }
          }
          fixedFocusCacheRef.current = {
            key: fixedCacheKey,
            targetZoomScale,
            fixedFocusRect
          };
        }
      } else if (zoomMode === 'follow') {
        targetZoomScale = clamp(targetZoomScale, 1, MAX_FOLLOW_FOCUS_ZOOM_SCALE);
      } else {
        fixedFocusRect = {
          x: clamp(customCenterX, 0, 1) * screenVideo.videoWidth,
          y: clamp(customCenterY, 0, 1) * screenVideo.videoHeight,
          w: screenVideo.videoWidth / targetZoomScale,
          h: screenVideo.videoHeight / targetZoomScale
        };
      }

      currentZoomScale = 1 + (targetZoomScale - 1) * easedProgress;
      currentCameraZoomScale = 1 + (cameraZoomScale - 1) * easedProgress;
    }

    const drawInteractionLayer = (
      targetCtx: CanvasRenderingContext2D,
      drawRect: { x: number, y: number, w: number, h: number },
      sourceRect: { x: number, y: number, w: number, h: number, vw: number, vh: number } | null,
      roundedRadius: number
    ) => {
      if (!(currentActionTimestamps.length > 0 && currentRecord)) return;
      const mapPoint = (p: { x: number, y: number }) => {
        if (!sourceRect) return { x: p.x, y: p.y };
        const { x: sx, y: sy, w: sw, h: sh, vw, vh } = sourceRect;
        return {
          x: (p.x * vw - sx) / sw,
          y: (p.y * vh - sy) / sh
        };
      };
      targetCtx.save();
      targetCtx.beginPath();
      if (roundedRadius > 0) {
        targetCtx.roundRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h, roundedRadius);
      } else {
        targetCtx.rect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      }
      targetCtx.clip();

      if (pointer) {
        const cursorSize = Math.max(1, currentConfig.cursorSize);
        const mappedPointer = mapPoint(pointer);
        const cX = drawRect.x + mappedPointer.x * drawRect.w;
        const cY = drawRect.y + mappedPointer.y * drawRect.h;
        const trailPoints = getTrailPoints(
          currentMouseReplay.samples,
          currentAbsoluteMs,
          Math.max(0, currentConfig.cursorTrailLengthMs),
          120
        );
        if (currentConfig.showCursorTrail && trailPoints.length >= 2 && currentConfig.cursorTrailOpacity > 0 && currentConfig.cursorTrailWidth > 0) {
          const width = currentConfig.cursorTrailWidth;
          for (let i = 1; i < trailPoints.length; i += 1) {
            const prev = mapPoint(trailPoints[i - 1]);
            const next = mapPoint(trailPoints[i]);
            const progress = i / (trailPoints.length - 1);
            targetCtx.beginPath();
            targetCtx.moveTo(drawRect.x + prev.x * drawRect.w, drawRect.y + prev.y * drawRect.h);
            targetCtx.lineTo(drawRect.x + next.x * drawRect.w, drawRect.y + next.y * drawRect.h);
            targetCtx.strokeStyle = `rgba(56, 189, 248, ${currentConfig.cursorTrailOpacity * progress})`;
            targetCtx.lineWidth = width * (0.4 + progress * 0.6);
            targetCtx.lineCap = 'round';
            targetCtx.stroke();
          }
        }

        if (currentConfig.showClickEffect) {
          const effectDuration = Math.max(60, currentConfig.cursorClickEffectDuration);
          const operationUpper = findUpperBoundByTime(currentMouseReplay.operations, currentAbsoluteMs);
          const operationStart = findUpperBoundByTime(currentMouseReplay.operations, currentAbsoluteMs - effectDuration);
          for (let i = operationStart; i < operationUpper; i += 1) {
            const operation = currentMouseReplay.operations[i];
            if (operation.kind === 'wheel') {
              continue;
            }
            const mappedOp = mapPoint(operation);
            const progress = clamp((currentAbsoluteMs - operation.t) / effectDuration, 0, 1);
            const pulseX = drawRect.x + mappedOp.x * drawRect.w;
            const pulseY = drawRect.y + mappedOp.y * drawRect.h;
            const styleByKind: Record<Exclude<MouseOperationKind, 'wheel'>, {
              color: [number, number, number];
              radiusStart: number;
              radiusGrowth: number;
              baseAlpha: number;
              lineWidthFactor: number;
              rings: number;
              fillAlphaBoost: number;
            }> = {
              click: {
                color: [251, 191, 36],
                radiusStart: 0.24,
                radiusGrowth: 0.85,
                baseAlpha: 0.42,
                lineWidthFactor: 0.055,
                rings: 1,
                fillAlphaBoost: 0.9
              },
              doubleClick: {
                color: [56, 189, 248],
                radiusStart: 0.28,
                radiusGrowth: 1.6,
                baseAlpha: 0.62,
                lineWidthFactor: 0.085,
                rings: 2,
                fillAlphaBoost: 1.2
              },
              rightClick: {
                color: [248, 113, 113],
                radiusStart: 0.3,
                radiusGrowth: 1.2,
                baseAlpha: 0.58,
                lineWidthFactor: 0.075,
                rings: 1,
                fillAlphaBoost: 1.1
              },
              down: {
                color: [96, 165, 250],
                radiusStart: 0.32,
                radiusGrowth: 1.2,
                baseAlpha: 0.5,
                lineWidthFactor: 0.07,
                rings: 1,
                fillAlphaBoost: 1
              },
              up: {
                color: [74, 222, 128],
                radiusStart: 0.34,
                radiusGrowth: 1.25,
                baseAlpha: 0.5,
                lineWidthFactor: 0.07,
                rings: 1,
                fillAlphaBoost: 1
              }
            };
            const style = styleByKind[operation.kind];
            for (let ringIndex = 0; ringIndex < style.rings; ringIndex += 1) {
              const ringProgress = clamp(progress - ringIndex * 0.14, 0, 1);
              if (ringProgress <= 0) continue;
              const radius = cursorSize * (style.radiusStart + ringProgress * style.radiusGrowth + ringIndex * 0.2);
              const alpha = style.baseAlpha * (1 - ringProgress) * (1 - ringIndex * 0.2);
              targetCtx.beginPath();
              targetCtx.arc(pulseX, pulseY, radius, 0, Math.PI * 2);
              targetCtx.strokeStyle = `rgba(${style.color[0]}, ${style.color[1]}, ${style.color[2]}, ${alpha})`;
              targetCtx.lineWidth = Math.max(1.1, cursorSize * style.lineWidthFactor);
              targetCtx.stroke();
            }
            targetCtx.beginPath();
            targetCtx.arc(pulseX, pulseY, Math.max(2, cursorSize * 0.08), 0, Math.PI * 2);
            targetCtx.fillStyle = `rgba(${style.color[0]}, ${style.color[1]}, ${style.color[2]}, ${style.baseAlpha * (1 - progress) * style.fillAlphaBoost})`;
            targetCtx.fill();
          }
        }

        const hotspotX = clamp(currentConfig.cursorHotspotX, 0, 1) * cursorSize;
        const hotspotY = clamp(currentConfig.cursorHotspotY, 0, 1) * cursorSize;
        targetCtx.save();
        targetCtx.shadowColor = 'rgba(15, 23, 42, 0.45)';
        targetCtx.shadowBlur = 12;
        targetCtx.shadowOffsetY = 2;
        if (cursorImgRef.current) {
          targetCtx.drawImage(cursorImgRef.current, cX - hotspotX, cY - hotspotY, cursorSize, cursorSize);
        } else {
          const scale = cursorSize / 24;
          targetCtx.translate(cX, cY);
          targetCtx.scale(scale, scale);
          targetCtx.beginPath();
          targetCtx.moveTo(0, 0);
          targetCtx.lineTo(15, 15);
          targetCtx.lineTo(6, 15);
          targetCtx.lineTo(1, 24);
          targetCtx.lineTo(0, 0);
          targetCtx.fillStyle = '#ffffff';
          targetCtx.fill();
          targetCtx.strokeStyle = '#000000';
          targetCtx.lineWidth = 1.2;
          targetCtx.stroke();
        }
        targetCtx.restore();

        if (currentConfig.showTextPrompt) {
          const opIndex = findUpperBoundByTime(currentMouseReplay.operations, currentAbsoluteMs) - 1;
          const activeOperation = opIndex >= 0 ? currentMouseReplay.operations[opIndex] : null;
          if (activeOperation && currentAbsoluteMs - activeOperation.t <= 640) {
            const label = activeOperation.label;
            targetCtx.save();
            targetCtx.font = '600 22px sans-serif';
            const textWidth = targetCtx.measureText(label).width;
            const badgeX = cX + cursorSize * 0.55;
            const badgeY = cY - cursorSize * 0.25;
            targetCtx.fillStyle = 'rgba(15,23,42,0.72)';
            targetCtx.beginPath();
            targetCtx.roundRect(badgeX, badgeY, textWidth + 26, 34, 10);
            targetCtx.fill();
            targetCtx.fillStyle = '#f8fafc';
            targetCtx.textBaseline = 'middle';
            targetCtx.textAlign = 'left';
            targetCtx.fillText(label, badgeX + 13, badgeY + 17);
            targetCtx.restore();
          }
        }
      }

      if (currentConfig.showTextPrompt) {
        const keyIndex = findUpperBoundByTime(currentMouseReplay.keyboardHints, currentAbsoluteMs) - 1;
        const activeKeyHint = keyIndex >= 0 ? currentMouseReplay.keyboardHints[keyIndex] : null;
        if (activeKeyHint && currentAbsoluteMs - activeKeyHint.t <= 900) {
          targetCtx.save();
          targetCtx.font = 'bold 36px sans-serif';
          const text = activeKeyHint.text;
          const textWidth = targetCtx.measureText(text).width;
          targetCtx.fillStyle = 'rgba(0,0,0,0.6)';
          targetCtx.beginPath();
          const badgeX = drawRect.x + (drawRect.w - textWidth) / 2 - 20;
          const badgeY = drawRect.y + drawRect.h - 120;
          targetCtx.roundRect(badgeX, badgeY, textWidth + 40, 60, 10);
          targetCtx.fill();
          targetCtx.fillStyle = 'white';
          targetCtx.textAlign = 'center';
          targetCtx.textBaseline = 'middle';
          targetCtx.fillText(text, drawRect.x + drawRect.w / 2, badgeY + 30);
          targetCtx.restore();
        }
      }

      targetCtx.restore();
    };

    const drawCustomFocusHandle = (
      targetCtx: CanvasRenderingContext2D,
      drawRect: { x: number, y: number, w: number, h: number },
      sourceRect: PreviewSourceRect | null
    ) => {
      const selectedBlock = selectedBlockRef.current;
      if (!selectedBlock || selectedBlock.type !== 'focus' || selectedBlock.zoomMode !== 'custom' || !sourceRect) {
        return;
      }
      const focusX = clamp(selectedBlock.customCenterX ?? DEFAULT_CUSTOM_FOCUS_CENTER, 0, 1);
      const focusY = clamp(selectedBlock.customCenterY ?? DEFAULT_CUSTOM_FOCUS_CENTER, 0, 1);
      const normalizedX = (focusX * sourceRect.vw - sourceRect.x) / sourceRect.w;
      const normalizedY = (focusY * sourceRect.vh - sourceRect.y) / sourceRect.h;
      if (normalizedX < -0.15 || normalizedX > 1.15 || normalizedY < -0.15 || normalizedY > 1.15) {
        return;
      }
      const centerX = drawRect.x + normalizedX * drawRect.w;
      const centerY = drawRect.y + normalizedY * drawRect.h;
      const size = clamp(Math.min(drawRect.w, drawRect.h) * 0.045, 14, 28);
      targetCtx.save();
      targetCtx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
      targetCtx.fillStyle = 'rgba(59, 130, 246, 0.18)';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.arc(centerX, centerY, size * 0.42, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.moveTo(centerX - size, centerY);
      targetCtx.lineTo(centerX + size, centerY);
      targetCtx.moveTo(centerX, centerY - size);
      targetCtx.lineTo(centerX, centerY + size);
      targetCtx.stroke();
      targetCtx.restore();
    };

    const virtualW = 1920;
    const virtualH = virtualW / aspectRatioRef.current;

    // Store where the screen video is actually drawn to align cursor correctly
    let screenDrawRect = { x: 0, y: 0, w: virtualW, h: virtualH };
    let activeSourceRect: { x: number, y: number, w: number, h: number, vw: number, vh: number } | null = null;

    // Setup context scaling
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / virtualW, canvas.height / virtualH);
    const offsetX = (canvas.width - virtualW * scale) / 2;
    const offsetY = (canvas.height - virtualH * scale) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. Draw Background
    if (bgImageRef.current) {
      const img = bgImageRef.current;
      const imgAspect = img.width / img.height;
      const canvasAspect = virtualW / virtualH;
      let drawW = virtualW;
      let drawH = virtualH;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > canvasAspect) {
        drawW = virtualH * imgAspect;
        drawX = (virtualW - drawW) / 2;
      } else {
        drawH = virtualW / imgAspect;
        drawY = (virtualH - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, virtualW, virtualH);
    }

    const shouldApply3D = active3DAnchor !== 'none' && focusTransitionProgress > 0.001;
    let didDraw3DLayer = false;
    const screenFrameStyle = resolveScreenFrameStyle(
      currentConfig.screenMargin,
      currentConfig.screenRadius,
      focusBreakoutProgress
    );

    // 2. Draw Screen Video
    if (screenVideo.readyState >= 2) {
      const m = screenFrameStyle.margin;
      const svW = virtualW - m * 2;
      const svH = virtualH - m * 2;
      const vAspect = screenVideo.videoWidth / screenVideo.videoHeight;
      let drawW = svW;
      let drawH = svH;

      if (vAspect > svW / svH) {
        drawH = svW / vAspect;
      } else {
        drawW = svH * vAspect;
      }

      const drawX = m + (svW - drawW) / 2;
      const drawY = m + (svH - drawH) / 2;
      screenDrawRect = { x: drawX, y: drawY, w: drawW, h: drawH };

      let sourceW = screenVideo.videoWidth;
      let sourceH = screenVideo.videoHeight;
      let sourceX = 0;
      let sourceY = 0;
      if (activeFocus && screenVideo.videoWidth > 0 && screenVideo.videoHeight > 0) {
        if ((activeFocus.zoomMode === 'fixed' || activeFocus.zoomMode === 'custom') && fixedFocusRect) {
          const zoom = clamp(currentZoomScale, 1, MAX_CUSTOM_FOCUS_ZOOM_SCALE);
          sourceW = screenVideo.videoWidth / zoom;
          sourceH = screenVideo.videoHeight / zoom;
          sourceX = clamp(fixedFocusRect.x - sourceW / 2, 0, screenVideo.videoWidth - sourceW);
          sourceY = clamp(fixedFocusRect.y - sourceH / 2, 0, screenVideo.videoHeight - sourceH);
        } else {
          const zoom = clamp(currentZoomScale, 1, MAX_FOLLOW_FOCUS_ZOOM_SCALE);
          const focusX = clamp(pointer?.x ?? DEFAULT_CUSTOM_FOCUS_CENTER, 0, 1);
          const focusY = clamp(pointer?.y ?? DEFAULT_CUSTOM_FOCUS_CENTER, 0, 1);
          sourceW = screenVideo.videoWidth / zoom;
          sourceH = screenVideo.videoHeight / zoom;
          sourceX = clamp(focusX * screenVideo.videoWidth - sourceW / 2, 0, screenVideo.videoWidth - sourceW);
          sourceY = clamp(focusY * screenVideo.videoHeight - sourceH / 2, 0, screenVideo.videoHeight - sourceH);
        }
      }
      activeSourceRect = { x: sourceX, y: sourceY, w: sourceW, h: sourceH, vw: screenVideo.videoWidth, vh: screenVideo.videoHeight };

      if (shouldApply3D) {
        const renderScale3D = exportingRef.current ? 1 : 0.82;
        const localW = Math.max(1, Math.round(drawW * renderScale3D));
        const localH = Math.max(1, Math.round(drawH * renderScale3D));
        const compositeCanvas = createOrResizeCanvas(screenCompositeCanvasRef, localW, localH);
        const compositeCtx = compositeCanvas.getContext('2d');
        if (compositeCtx) {
          compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
          compositeCtx.clearRect(0, 0, localW, localH);
          compositeCtx.save();
          if (screenFrameStyle.radius > 0) {
            compositeCtx.beginPath();
            compositeCtx.roundRect(0, 0, localW, localH, screenFrameStyle.radius * renderScale3D);
            compositeCtx.clip();
          }
          compositeCtx.drawImage(screenVideo, sourceX, sourceY, sourceW, sourceH, 0, 0, localW, localH);
          compositeCtx.restore();
          drawInteractionLayer(
            compositeCtx,
            { x: 0, y: 0, w: localW, h: localH },
            activeSourceRect,
            screenFrameStyle.radius * renderScale3D
          );

          const strength = clamp(active3DStrength, 1, 75) * focusTransitionProgress;
          const perspective = buildPerspectiveCorners(localW, localH, active3DAnchor, strength);
          const warpCanvas = createOrResizeCanvas(screenWarpCanvasRef, perspective.width, perspective.height);
          const warpCtx = warpCanvas.getContext('2d');
          if (warpCtx) {
            warpCtx.setTransform(1, 0, 0, 1, 0, 0);
            warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height);
            const warpDetail = exportingRef.current
              ? 16 + Math.round(focusTransitionProgress * 8)
              : 10 + Math.round(focusTransitionProgress * 6);
            drawImageToQuad(warpCtx, compositeCanvas, localW, localH, perspective.corners, warpDetail);
            const worldW = perspective.width / renderScale3D;
            const worldH = perspective.height / renderScale3D;
            const worldBaseW = localW / renderScale3D;
            const worldBaseH = localH / renderScale3D;
            const outX = drawX - (worldW - worldBaseW) / 2;
            const outY = drawY - (worldH - worldBaseH) / 2;

            ctx.save();
            ctx.shadowColor = `rgba(2, 6, 23, ${0.3 + focusTransitionProgress * 0.25})`;
            ctx.shadowBlur = 32 + 28 * focusTransitionProgress;
            ctx.shadowOffsetY = 16 + 18 * focusTransitionProgress;
            ctx.drawImage(warpCanvas, outX, outY, worldW, worldH);
            ctx.restore();

            ctx.drawImage(warpCanvas, outX, outY, worldW, worldH);
            screenDrawRect = { x: outX, y: outY, w: worldW, h: worldH };
            didDraw3DLayer = true;
          }
        }
      }

      if (!didDraw3DLayer) {
        ctx.save();
        if (currentConfig.shadowOpacity > 0) {
          ctx.shadowColor = `rgba(0,0,0,${currentConfig.shadowOpacity})`;
          ctx.shadowBlur = currentConfig.shadowBlur;
          ctx.shadowOffsetX = currentConfig.shadowOffsetX;
          ctx.shadowOffsetY = currentConfig.shadowOffsetY;
        }
        if (screenFrameStyle.radius > 0) {
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, drawW, drawH, screenFrameStyle.radius);
          ctx.fillStyle = '#000';
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.clip();
        }
        ctx.drawImage(screenVideo, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
        ctx.restore();
      }
    }

    previewGeometryRef.current = {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      offsetX,
      offsetY,
      scale,
      screenDrawRect,
      activeSourceRect
    };

    // 3. Draw Camera Video
    if (cameraVideo && cameraVideo.readyState >= 2 && !hideCamera) {
      const camSize = virtualW * currentConfig.cameraScale * currentCameraZoomScale;
      let camW = camSize;
      let camH = camSize;

      // For rect, maintain aspect ratio (or use fixed ratio if desired, but usually rect implies fit)
      // However, to ensure "fill" behavior for rect too if user wants a fixed box, we can do similar logic.
      // For now, let's assume 'rect' means "show full camera with rounded corners" -> keep aspect.
      // BUT if 'circle', we want a perfect circle filled with video -> crop.

      if (currentConfig.cameraShape === 'rect') {
        camH = camSize * (cameraVideo.videoHeight / cameraVideo.videoWidth);
      }

      const margin = currentConfig.cameraMargin;
      const isLeft = currentConfig.cameraPosition === 'topLeft' || currentConfig.cameraPosition === 'bottomLeft';
      const isTop = currentConfig.cameraPosition === 'topLeft' || currentConfig.cameraPosition === 'topRight';
      const drawX = isLeft ? margin : virtualW - camW - margin;
      const drawY = isTop ? margin : virtualH - camH - margin;

      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,0.4)`;
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 8;

      ctx.beginPath();
      if (currentConfig.cameraShape === 'circle') {
        const radius = camW / 2;
        ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
      } else {
        ctx.roundRect(drawX, drawY, camW, camH, currentConfig.cameraRadius);
      }
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();

      // Ensure camera fills the clip area (Object-fit: cover)
      // Calculate source rectangle to crop
      const vW = cameraVideo.videoWidth;
      const vH = cameraVideo.videoHeight;
      const vAspect = vW / vH;
      const dAspect = camW / camH;

      let sW = vW;
      let sH = vH;
      let sX = 0;
      let sY = 0;

      if (vAspect > dAspect) {
        // Source is wider than dest: crop horizontal sides
        sW = vH * dAspect;
        sX = (vW - sW) / 2;
      } else if (vAspect < dAspect) {
        // Source is taller than dest: crop vertical sides
        sH = vW / dAspect;
        sY = (vH - sH) / 2;
      }
      // If equal, no crop needed (sW=vW, sH=vH)

      ctx.drawImage(cameraVideo, sX, sY, sW, sH, drawX, drawY, camW, camH);

      // Removed border stroke
      ctx.restore();
    }

    // 4. Draw Cursor and Keyboard Actions
    if (!didDraw3DLayer) {
      drawInteractionLayer(ctx, screenDrawRect, activeSourceRect, screenFrameStyle.radius);
    }
    drawCustomFocusHandle(ctx, screenDrawRect, activeSourceRect);

    ctx.restore();

    const activePreviewTransition = activePreviewTransitionRef.current;
    if (activePreviewTransition) {
      const transitionProgress = activePreviewTransition.durationMs > 0
        ? (now - activePreviewTransition.startTimeMs) / activePreviewTransition.durationMs
        : 1;
      if (transitionProgress >= 1) {
        activePreviewTransitionRef.current = null;
      } else {
        const overlayCtx = canvas.getContext('2d');
        if (overlayCtx) {
          drawTransitionOverlay(
            overlayCtx,
            activePreviewTransition.fromFrame,
            canvas.width,
            canvas.height,
            transitionProgress,
            activePreviewTransition.type
          );
        }
      }
    }

    if (playingRef.current) {
      const currentTime = screenVideo.currentTime;
      playheadRef.current = currentTime;
      if (now - lastPlayheadSyncRef.current >= 120) {
        lastPlayheadSyncRef.current = now;
        setPlayhead(prev => (Math.abs(prev - currentTime) > 0.05 ? currentTime : prev));
      }
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    }
  }, []);

  // Sync canvas size with aspect ratio
  useEffect(() => {
    const host = previewHostRef.current;
    const canvas = previewCanvasRef.current;
    if (!host || !canvas) return;

    let resizeTimer: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        // Only update if dimensions actually changed to avoid unnecessary clears
        const newWidth = Math.max(1, Math.floor(rect.width * dpr));
        const newHeight = Math.max(1, Math.floor(rect.height * dpr));

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
          canvas.width = newWidth;
          canvas.height = newHeight;
          // Force a redraw after resize
          if (!playing) requestAnimationFrame(renderFrame);
        }
      }, 100); // Debounce 100ms
    };

    const observer = new ResizeObserver(handleResize);

    observer.observe(host);
    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [aspectRatio, playing, renderFrame]);

  // Preload background images
  useEffect(() => {
    if (backgroundImages.length > 0) {
      backgroundImages.forEach(path => {
        const url = toFileUrl(path);
        if (!imageCacheRef.current[url]) {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            imageCacheRef.current[url] = img;
          };
        }
      });
    }
  }, [backgroundImages, toFileUrl]);

  // Load external images with cache optimization
  useEffect(() => {
    if (config.backgroundImage) {
      // Check cache first
      if (imageCacheRef.current[config.backgroundImage]) {
        bgImageRef.current = imageCacheRef.current[config.backgroundImage];
        if (!playing) requestAnimationFrame(renderFrame);
      } else {
        // Not in cache, load it
        const img = new Image();
        img.onload = () => {
          bgImageRef.current = img;
          imageCacheRef.current[config.backgroundImage] = img; // Add to cache
          if (!playing) requestAnimationFrame(renderFrame);
        };
        img.src = config.backgroundImage;
      }
    } else {
      bgImageRef.current = null;
      if (!playing) requestAnimationFrame(renderFrame);
    }
  }, [config.backgroundImage, playing, renderFrame]);

  // Handle Play/Pause
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.volume = clamp(systemVolume / 100, 0, 1);
    }
  }, [systemVolume]);

  useEffect(() => {
    if (micAudioRef.current) {
      micAudioRef.current.volume = clamp(micVolume / 100, 0, 1);
    }
  }, [micVolume]);

  useEffect(() => {
    if (playing) {
      screenVideoRef.current?.play();
      cameraVideoRef.current?.play();
      micAudioRef.current?.play();
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    } else {
      screenVideoRef.current?.pause();
      cameraVideoRef.current?.pause();
      micAudioRef.current?.pause();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Draw one static frame
      requestAnimationFrame(renderFrame);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [playing, renderFrame]);

  // Render static frame when editable state changes but paused
  useEffect(() => {
    if (!playing) {
      const id = requestAnimationFrame(renderFrame);
      return () => cancelAnimationFrame(id);
    }
  }, [config, timelineBlocks, selectedBlockId, renderFrame, playing, playhead]);

  // Handle Seek
  const applySeek = useCallback((time: number) => {
    if (!Number.isFinite(time) || time < 0) return;
    activePreviewTransitionRef.current = null;
    if (screenVideoRef.current) {
      const dur = screenVideoRef.current.duration;
      screenVideoRef.current.currentTime = (Number.isFinite(dur) && dur > 0) ? Math.min(time, dur) : time;
    }
    if (cameraVideoRef.current) {
      const dur = cameraVideoRef.current.duration;
      cameraVideoRef.current.currentTime = (Number.isFinite(dur) && dur > 0) ? Math.min(time, dur) : time;
    }
    if (micAudioRef.current) {
      const dur = micAudioRef.current.duration;
      micAudioRef.current.currentTime = (Number.isFinite(dur) && dur > 0) ? Math.min(time, dur) : time;
    }
    requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  const handleSeek = useCallback((time: number) => {
    if (!Number.isFinite(time) || time < 0) return;

    // Pause if playing
    if (playingRef.current) {
      setPlaying(false);
    }

    playheadRef.current = time;
    setPlayhead(time);
    pendingSeekRef.current = time;
    if (!seekAnimationFrameRef.current) {
      seekAnimationFrameRef.current = requestAnimationFrame(() => {
        const nextTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
        seekAnimationFrameRef.current = 0;
        if (nextTime !== null) applySeek(nextTime);
      });
    }
  }, [applySeek]);

  const getPreviewFocusPointFromClient = useCallback((clientX: number, clientY: number) => {
    const geometry = previewGeometryRef.current;
    const canvas = previewCanvasRef.current;
    if (!geometry || !canvas || !geometry.activeSourceRect) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const canvasX = ((clientX - rect.left) / rect.width) * geometry.canvasWidth;
    const canvasY = ((clientY - rect.top) / rect.height) * geometry.canvasHeight;
    const virtualX = (canvasX - geometry.offsetX) / geometry.scale;
    const virtualY = (canvasY - geometry.offsetY) / geometry.scale;
    const { screenDrawRect, activeSourceRect } = geometry;
    if (
      virtualX < screenDrawRect.x ||
      virtualX > screenDrawRect.x + screenDrawRect.w ||
      virtualY < screenDrawRect.y ||
      virtualY > screenDrawRect.y + screenDrawRect.h
    ) {
      return null;
    }
    const ratioX = (virtualX - screenDrawRect.x) / screenDrawRect.w;
    const ratioY = (virtualY - screenDrawRect.y) / screenDrawRect.h;
    return {
      x: clamp((activeSourceRect.x + ratioX * activeSourceRect.w) / activeSourceRect.vw, 0, 1),
      y: clamp((activeSourceRect.y + ratioY * activeSourceRect.h) / activeSourceRect.vh, 0, 1)
    };
  }, []);

  const updateSelectedCustomFocusCenter = useCallback((x: number, y: number) => {
    const selectedBlock = selectedBlockRef.current;
    if (!selectedBlock || selectedBlock.type !== 'focus' || selectedBlock.zoomMode !== 'custom') return;
    updateTimelineBlock(selectedBlock.id, block => (
      block.type === 'focus'
        ? { ...block, customCenterX: clamp(x, 0, 1), customCenterY: clamp(y, 0, 1) }
        : block
    ));
  }, [updateTimelineBlock]);

  const handlePreviewPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const selectedBlock = selectedBlockRef.current;
    if (!selectedBlock || selectedBlock.type !== 'focus' || selectedBlock.zoomMode !== 'custom' || event.button !== 0) return;
    const point = getPreviewFocusPointFromClient(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    previewInteractionPointerIdRef.current = event.pointerId;
    setPreviewDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSelectedCustomFocusCenter(point.x, point.y);
  }, [getPreviewFocusPointFromClient, updateSelectedCustomFocusCenter]);

  const handlePreviewPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (previewInteractionPointerIdRef.current !== event.pointerId) return;
    const point = getPreviewFocusPointFromClient(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    updateSelectedCustomFocusCenter(point.x, point.y);
  }, [getPreviewFocusPointFromClient, updateSelectedCustomFocusCenter]);

  const finishPreviewPointerInteraction = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (previewInteractionPointerIdRef.current !== event.pointerId) return;
    previewInteractionPointerIdRef.current = null;
    setPreviewDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handlePreviewWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const selectedBlock = selectedBlockRef.current;
    if (!selectedBlock || selectedBlock.type !== 'focus' || selectedBlock.zoomMode !== 'custom') return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    updateTimelineBlock(selectedBlock.id, block => (
      block.type === 'focus'
        ? { ...block, zoomScale: clamp(block.zoomScale + direction * PREVIEW_WHEEL_ZOOM_STEP, 1, MAX_CUSTOM_FOCUS_ZOOM_SCALE) }
        : block
    ));
  }, [updateTimelineBlock]);

  useEffect(() => {
    if (!selectedBlock || selectedBlock.type !== 'focus' || selectedBlock.zoomMode !== 'custom') {
      previewInteractionPointerIdRef.current = null;
      setPreviewDragging(false);
    }
  }, [selectedBlock]);

  useEffect(() => {
    if (!blockDragState) return;
    const onMouseMove = (event: MouseEvent) => {
      const trackEl = timelineTrackRef.current;
      if (!trackEl || totalDurationSec <= 0) return;
      const rect = trackEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaSec = ((event.clientX - blockDragState.startClientX) / rect.width) * totalDurationSec;

      let syncTime = -1;
      let nextStartCalc = blockDragState.initialStartSec;
      let nextEndCalc = blockDragState.initialEndSec;

      const originalDuration = Math.max(MIN_BLOCK_DURATION_SEC, blockDragState.initialEndSec - blockDragState.initialStartSec);

      if (blockDragState.mode === 'move') {
        nextStartCalc = clamp(blockDragState.initialStartSec + deltaSec, 0, Math.max(0, totalDurationSec - originalDuration));
        nextEndCalc = nextStartCalc + originalDuration;
      } else if (blockDragState.mode === 'resize-left') {
        nextStartCalc = clamp(
          blockDragState.initialStartSec + deltaSec,
          0,
          Math.max(0, blockDragState.initialEndSec - MIN_BLOCK_DURATION_SEC)
        );
        syncTime = nextStartCalc;
      } else if (blockDragState.mode === 'resize-right') {
        nextEndCalc = clamp(
          blockDragState.initialEndSec + deltaSec,
          Math.min(totalDurationSec, blockDragState.initialStartSec + MIN_BLOCK_DURATION_SEC),
          totalDurationSec
        );
        syncTime = nextEndCalc;
      }

      updateTimelineBlock(blockDragState.blockId, (block) => {
        if (blockDragState.mode === 'move') {
          return { ...block, startSec: nextStartCalc, endSec: nextEndCalc };
        }
        if (blockDragState.mode === 'resize-left') {
          return { ...block, startSec: nextStartCalc };
        }
        return { ...block, endSec: nextEndCalc };
      });

      if (syncTime >= 0) {
        handleSeek(syncTime);
      }
    };
    const onMouseUp = () => {
      setBlockDragState(null);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [blockDragState, totalDurationSec, updateTimelineBlock, handleSeek]);

  const handleBlockMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, blockId: string, mode: BlockDragState['mode']) => {
    event.preventDefault();
    event.stopPropagation();
    const block = timelineBlocks.find(item => item.id === blockId);
    if (!block) return;
    setSelectedBlockId(blockId);
    setPanelBlockType(block.type);
    setSelectedElement('clip');
    setBlockDragState({
      blockId,
      mode,
      startClientX: event.clientX,
      initialStartSec: block.startSec,
      initialEndSec: block.endSec
    });
  }, [timelineBlocks]);

  const syncSelectedBlockWithTime = useCallback((timeSec: number) => {
    const matchedBlock = findBlockAtTime(timelineBlocks, timeSec);
    if (!matchedBlock) {
      setSelectedBlockId(null);
      return;
    }
    setSelectedBlockId(matchedBlock.id);
    setPanelBlockType(matchedBlock.type);
    setSelectedElement('clip');
  }, [timelineBlocks]);

  const handleTimelineTrackClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const trackEl = timelineTrackRef.current;
    if (!trackEl || totalDurationSec <= 0) return;
    const rect = trackEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const targetTime = clamp((event.clientX - rect.left) / rect.width, 0, 1) * totalDurationSec;
    handleSeek(targetTime);
    syncSelectedBlockWithTime(targetTime);
  }, [handleSeek, syncSelectedBlockWithTime, totalDurationSec]);

  const applyBlockTimes = useCallback((blockId: string, nextStartSec: number, nextEndSec: number) => {
    updateTimelineBlock(blockId, (block) => {
      const normalized = clampBlockToDuration(nextStartSec, nextEndSec);
      return { ...block, ...normalized };
    });
  }, [clampBlockToDuration, updateTimelineBlock]);

  const updateSelectedBlockStart = useCallback((nextStart: number) => {
    if (!selectedBlock) return;
    applyBlockTimes(selectedBlock.id, roundToTwoDecimals(nextStart), roundToTwoDecimals(selectedBlock.endSec));
  }, [applyBlockTimes, selectedBlock]);

  const updateSelectedBlockEnd = useCallback((nextEnd: number) => {
    if (!selectedBlock) return;
    applyBlockTimes(selectedBlock.id, roundToTwoDecimals(selectedBlock.startSec), roundToTwoDecimals(nextEnd));
  }, [applyBlockTimes, selectedBlock]);

  const updateSelectedBlockDuration = useCallback((nextDuration: number) => {
    if (!selectedBlock) return;
    const safeDuration = Math.max(MIN_BLOCK_DURATION_SEC, roundToTwoDecimals(nextDuration));
    applyBlockTimes(
      selectedBlock.id,
      roundToTwoDecimals(selectedBlock.startSec),
      roundToTwoDecimals(selectedBlock.startSec + safeDuration)
    );
  }, [applyBlockTimes, selectedBlock]);

  const handleAutoAddAIFocusBlocks = useCallback(() => {
    if (!record) return;
    const duration = Math.max(0, totalDurationSec || 0);
    if (duration <= 0) {
      addLog('视频时长无效，无法分析 AI 着重块', 'error');
      return;
    }
    if (!aiFocusOptions.focusBoxSelection && !aiFocusOptions.focusCircleMotion) {
      addLog('请至少勾选一个 AI 分析来源', 'error');
      return;
    }
    const recordingStartMs = resolveRecordingStartMs(record, actions);
    const mouseSamples = mouseReplayRef.current.samples;
    const candidateRanges: FocusCandidateRange[] = [];
    if (aiFocusOptions.focusBoxSelection) {
      candidateRanges.push(...buildPressDragFocusRanges(actions, mouseSamples, recordingStartMs));
    }
    if (aiFocusOptions.focusCircleMotion) {
      candidateRanges.push(...buildSmallCircleFocusRanges(mouseSamples, recordingStartMs));
    }
    const mergedRanges = mergeFocusCandidateRanges(
      candidateRanges
      .map((range) => ({
        startSec: clamp(range.startSec - AI_FOCUS_PADDING_SEC, 0, duration),
        endSec: clamp(range.endSec + AI_FOCUS_PADDING_SEC, 0, duration)
      }))
      .filter(range => range.endSec - range.startSec >= MIN_BLOCK_DURATION_SEC),
      AI_FOCUS_NEARBY_MERGE_GAP_SEC
    );
    const baseBlocks = aiFocusOptions.clearExistingFocusBlocks
      ? timelineBlocks.filter(block => block.type !== 'focus')
      : [...timelineBlocks];
    const nextBlocks = [...baseBlocks];
    let created = 0;
    let lastCreatedId: string | null = null;
    for (const range of mergedRanges) {
      const desiredDuration = Math.max(MIN_BLOCK_DURATION_SEC, range.endSec - range.startSec);
      const fittedStart = findBestStartInAvailableGap(
        range.startSec,
        desiredDuration,
        null,
        nextBlocks,
        duration
      );
      if (fittedStart === null) continue;
      const blockId = `focus-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const block = createDefaultFocusBlock(blockId, fittedStart, fittedStart + desiredDuration);
      nextBlocks.push(block);
      created += 1;
      lastCreatedId = blockId;
    }
    const sortedBlocks = getSortedTimelineBlocks(nextBlocks);
    setTimelineBlocks(sortedBlocks);
    if (lastCreatedId) {
      setSelectedBlockId(lastCreatedId);
      setPanelBlockType('focus');
      setSelectedElement('clip');
    }
    if (created > 0) {
      addLog(`AI 已添加 ${created} 个着重块（已自动避让重叠）`, 'info');
    } else if (aiFocusOptions.clearExistingFocusBlocks) {
      addLog('AI 未识别到有效片段，已清除现有着重块', 'info');
    } else {
      addLog('AI 未识别到可添加的着重片段', 'info');
    }
  }, [record, totalDurationSec, aiFocusOptions, actions, timelineBlocks, addLog]);

  const deleteSelectedBlock = useCallback(() => {
    if (!selectedBlock) return;
    setTimelineBlocks(prev => prev.filter(block => block.id !== selectedBlock.id));
    setSelectedBlockId(null);
  }, [selectedBlock]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Spacebar Play/Pause
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setPlaying(prev => !prev);
      }

      // Ctrl+C / Cmd+C: Copy selected block
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedBlock) {
          clipboardBlockRef.current = JSON.parse(JSON.stringify(selectedBlock));
          addLog(`已复制块: ${selectedBlock.type === 'cut' ? '裁切' : '着重'}`, 'info');
        }
      }

      // Ctrl+V / Cmd+V: Paste block
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboardBlockRef.current) {
          const original = clipboardBlockRef.current;
          const duration = original.endSec - original.startSec;
          const desiredStart = playheadRef.current;
          const fittedStart = findBestStartInAvailableGap(
            desiredStart,
            duration,
            null,
            timelineBlocksRef.current,
            totalDurationSec || 0
          );
          if (fittedStart === null) {
            addLog('没有可用时间段，粘贴失败（禁止重叠）', 'error');
            return;
          }
          const newStart = fittedStart;
          const newEnd = Math.min(newStart + duration, totalDurationSec || 0);
          const newBlock = {
            ...original,
            id: `${original.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            startSec: newStart,
            endSec: newEnd,
          };
          setTimelineBlocks(prev => getSortedTimelineBlocks([...prev, newBlock]));
          setSelectedBlockId(newBlock.id);
          setPanelBlockType(newBlock.type);
          setSelectedElement('clip');
          addLog(`已粘贴块: ${newBlock.type === 'cut' ? '裁切' : '着重'}`, 'info');
        }
      }

      // Delete / Backspace: Delete selected block
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock) {
        e.preventDefault();
        deleteSelectedBlock();
        addLog(`已删除块: ${selectedBlock.type === 'cut' ? '裁切' : '着重'}`, 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlock, deleteSelectedBlock, addLog, totalDurationSec]);

  // Auto-save Config to project folder
  useEffect(() => {
    if (!record?.absolutePath) return;
    const saveToDisk = async () => {
      try {
        const configPath = `${record.absolutePath}/project-config.json`;
        const content = JSON.stringify({
          config,
          timelineBlocks
        }, null, 2);
        await window.api.writeFileText(configPath, content);
      } catch (e) {
        console.error('Failed to save config to disk', e);
      }
    };
    const timer = setTimeout(saveToDisk, 500);
    return () => clearTimeout(timer);
  }, [config, timelineBlocks, record?.absolutePath]);

  useEffect(() => {
    return () => {
      if (seekAnimationFrameRef.current) cancelAnimationFrame(seekAnimationFrameRef.current);
    };
  }, []);

  // Timeline zoom with Ctrl + Mouse Wheel
  useEffect(() => {
    const el = timelineScrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Zoom in if scrolling up, out if scrolling down
        const zoomDelta = e.deltaY < 0 ? 0.25 : -0.25;
        setTimelineZoom(prev => clamp(prev + zoomDelta, 1, 10));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePlayToggle = () => {
    setPlaying(!playing);
  };

  const handleExportWithFfmpeg = async (preset: ExportPreset = DEFAULT_EXPORT_PRESET) => {
    setSelectedElement('log');
    setLogs([]);
    addLog(`开始导出任务: ${preset.label} (${preset.width}x${preset.height} ${preset.fps}fps, ${exportVideoFormat.toUpperCase()})`, 'info');
    const previousTimelineBlocksRef = timelineBlocksRef.current;
    const previousConfigRef = configRef.current;
    const previousRecordRef = recordRef.current;
    const exportTimelineSnapshot = getSortedTimelineBlocks(timelineBlocks.map(normalizeTimelineBlock));
    timelineBlocksRef.current = exportTimelineSnapshot;
    configRef.current = config;
    recordRef.current = record;

    const canvas = canvasRef.current;
    const screenVideo = screenVideoRef.current;
    const cameraVideo = cameraVideoRef.current;
    const micAudio = micAudioRef.current;
    if (!canvas || !screenVideo || !record?.absolutePath) {
      addLog('导出失败：缺少可用的视频素材', 'error');
      alert('导出失败：缺少可用的视频素材');
      return;
    }
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      addLog('当前环境不支持视频导出', 'error');
      alert('当前环境不支持视频导出');
      return;
    }

    const sourceDuration = Number.isFinite(totalDurationSec) && totalDurationSec > 0
      ? totalDurationSec
      : (Number.isFinite(screenVideo.duration) && screenVideo.duration > 0 ? screenVideo.duration : 0);
    if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
      addLog('导出失败：无法读取录屏时长', 'error');
      alert('导出失败：无法读取录屏时长');
      return;
    }

    const normalizedCuts = mergeCutRanges(timelineBlocksRef.current)
      .map((range) => ({
        startSec: clamp(range.startSec, 0, sourceDuration),
        endSec: clamp(range.endSec, 0, sourceDuration),
        transitionType: range.transitionType,
        transitionDurationSec: range.transitionDurationSec
      }))
      .filter((range) => range.endSec - range.startSec > 0.0001)
      .sort((a, b) => a.startSec - b.startSec);
    const keepSegments: { startSec: number; endSec: number; followingCut: NormalizedCutRange | null }[] = [];
    let cursor = 0;
    for (let i = 0; i < normalizedCuts.length; i += 1) {
      const cut = normalizedCuts[i];
      if (cut.startSec > cursor + 0.0001) {
        keepSegments.push({ startSec: cursor, endSec: cut.startSec, followingCut: cut });
      }
      cursor = Math.max(cursor, cut.endSec);
    }
    if (cursor < sourceDuration - 0.0001) {
      keepSegments.push({ startSec: cursor, endSec: sourceDuration, followingCut: null });
    }
    const transitionDurationsSec = keepSegments.map((segment, index) => {
      const nextSegment = keepSegments[index + 1];
      if (!segment.followingCut || !nextSegment) return 0;
      const segmentDuration = Math.max(0, segment.endSec - segment.startSec);
      const nextDuration = Math.max(0, nextSegment.endSec - nextSegment.startSec);
      return resolveCutTransitionDurationSec(
        segment.followingCut.transitionType,
        segment.followingCut.transitionDurationSec,
        Math.min(segmentDuration * 0.5, nextDuration * 0.5, segment.followingCut.endSec - segment.followingCut.startSec)
      );
    });
    const effectiveDuration = keepSegments.reduce((sum, segment) => sum + Math.max(0, segment.endSec - segment.startSec), 0)
      + transitionDurationsSec.reduce((sum, value) => sum + value, 0);
    if (effectiveDuration < 0.08) {
      addLog('导出失败：裁切区间覆盖了几乎全部视频内容，请调整后重试', 'error');
      alert('导出失败：裁切区间覆盖了几乎全部视频内容，请调整后重试');
      return;
    }

    addLog(`计算有效时长完成: ${effectiveDuration.toFixed(2)}秒, 片段数: ${keepSegments.length}`, 'info');

    const previousPlayhead = playheadRef.current;
    const previousPlaying = playingRef.current;
    const previousScreenLoop = screenVideo.loop;
    const previousCameraLoop = cameraVideo?.loop ?? false;
    const previousMicLoop = micAudio?.loop ?? false;
    const previousScreenMuted = screenVideo.muted;
    const previousCameraMuted = cameraVideo?.muted ?? true;
    const previousMicMuted = micAudio?.muted ?? true;
    const previousScreenVolume = screenVideo.volume;
    const previousMicVolume = micAudio?.volume ?? 1;
    const previousCutRanges = cutRangesRef.current;
    const previewCanvas = canvas;
    const exportCanvas = document.createElement('canvas');
    let exportStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    let screenSourceNode: MediaElementAudioSourceNode | null = null;
    let micSourceNode: MediaElementAudioSourceNode | null = null;
    let screenGainNode: GainNode | null = null;
    let micGainNode: GainNode | null = null;

    const safePlay = async (media: HTMLMediaElement | null) => {
      if (!media) return;
      try {
        await media.play();
      } catch {
        media.pause();
      }
    };

    const waitVideoSeeked = async (video: HTMLVideoElement, targetTime: number) => {
      const maxDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : targetTime;
      const safeTarget = clamp(targetTime, 0, Math.max(0, maxDuration));
      if (Math.abs(video.currentTime - safeTarget) <= 0.01 && video.readyState >= 2) {
        return;
      }
      await new Promise<void>((resolve) => {
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('canplay', onSeeked);
          window.clearTimeout(timeoutId);
        };
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, 1200);
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('canplay', onSeeked, { once: true });
        video.currentTime = safeTarget;
      });
    };

    const waitMediaSeeked = async (media: HTMLMediaElement, targetTime: number) => {
      const maxDuration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : targetTime;
      const safeTarget = clamp(targetTime, 0, Math.max(0, maxDuration));
      if (Math.abs(media.currentTime - safeTarget) <= 0.01 && media.readyState >= 2) {
        return;
      }
      await new Promise<void>((resolve) => {
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          media.removeEventListener('seeked', onSeeked);
          media.removeEventListener('canplay', onSeeked);
          window.clearTimeout(timeoutId);
        };
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, 1200);
        media.addEventListener('seeked', onSeeked, { once: true });
        media.addEventListener('canplay', onSeeked, { once: true });
        media.currentTime = safeTarget;
      });
    };

    const seekAllVideos = async (time: number) => {
      const tasks: Promise<void>[] = [waitVideoSeeked(screenVideo, time)];
      if (cameraVideo) {
        tasks.push(waitVideoSeeked(cameraVideo, time));
      }
      if (micAudio) {
        tasks.push(waitMediaSeeked(micAudio, time));
      }
      await Promise.all(tasks);
    };

    try {
      const exportWidth = preset.width;
      const exportHeight = preset.height;
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
      canvasRef.current = exportCanvas;

      setPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      setExporting(true);
      exportingRef.current = true;
      setExportProgress(0);
      setExportMessage('正在初始化导出...');
      addLog('正在初始化导出环境...', 'info');

      cutRangesRef.current = [];
      activePreviewTransitionRef.current = null;
      screenVideo.loop = false;
      screenVideo.muted = false;
      screenVideo.volume = clamp(systemVolume / 100, 0, 1);
      if (cameraVideo) {
        cameraVideo.loop = false;
        cameraVideo.muted = true;
      }
      if (micAudio) {
        micAudio.loop = false;
        micAudio.muted = false;
        micAudio.volume = clamp(micVolume / 100, 0, 1);
      }

      await seekAllVideos(keepSegments[0].startSec);
      playheadRef.current = keepSegments[0].startSec;
      setPlayhead(keepSegments[0].startSec);
      renderFrame();

      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioDest = audioContext.createMediaStreamDestination();
        screenSourceNode = audioContext.createMediaElementSource(screenVideo);
        screenGainNode = audioContext.createGain();
        screenGainNode.gain.value = clamp(systemVolume / 100, 0, 2);
        screenSourceNode.connect(screenGainNode);
        screenGainNode.connect(audioDest);
        if (micAudio) {
          micSourceNode = audioContext.createMediaElementSource(micAudio);
          micGainNode = audioContext.createGain();
          micGainNode.gain.value = clamp(micVolume / 100, 0, 2);
          micSourceNode.connect(micGainNode);
          micGainNode.connect(audioDest);
        }
        addLog('音频上下文初始化成功', 'info');
      } catch (e) {
        addLog(`音频初始化失败: ${String(e)}`, 'error');
        console.warn('Audio setup failed:', e);
      }

      const targetBitrate = Math.min(
        100_000_000,
        Math.max(15_000_000, Math.round((exportWidth * exportHeight / (1920 * 1080)) * 25_000_000 * (preset.fps / 30)))
      );

      addLog(`目标码率: ${(targetBitrate / 1000000).toFixed(1)} Mbps`, 'info');

      const canvasStream = exportCanvas.captureStream(preset.fps);
      if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        audioDest.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      }

      const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: targetBitrate });
      exportStream = recorder.stream;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const recorderStopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };
      });

      recorder.start(1000);
      addLog('开始录制视频流（包含特效）...', 'info');

      let exportedElapsedSec = 0;
      for (let i = 0; i < keepSegments.length; i += 1) {
        const segment = keepSegments[i];
        const segmentDuration = Math.max(0, segment.endSec - segment.startSec);
        if (segmentDuration <= 0.0001) {
          continue;
        }

        addLog(`开始渲染片段 ${i + 1}/${keepSegments.length} (时长: ${segmentDuration.toFixed(2)}s)`, 'info');

        await seekAllVideos(segment.startSec);
        playheadRef.current = segment.startSec;
        setPlayhead(segment.startSec);
        renderFrame();

        await safePlay(screenVideo);
        if (cameraVideo && record.cameraVideoPath) {
          await safePlay(cameraVideo);
        }
        if (micAudio && record.micAudioPath) {
          await safePlay(micAudio);
        }

        await new Promise<void>((resolve) => {
          let rafId = 0;
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (rafId) {
              cancelAnimationFrame(rafId);
            }
            resolve();
          };
          const tick = () => {
            renderFrame();
            const currentSec = screenVideo.currentTime;
            const segmentProgress = clamp((currentSec - segment.startSec) / Math.max(0.001, segmentDuration), 0, 1);
            const overallProgress = ((exportedElapsedSec + segmentProgress * segmentDuration) / effectiveDuration) * 100;
            setExportProgress(Math.min(50, overallProgress * 0.5));
            if (overallProgress > 60) {
              setExportMessage('正在渲染画中画与光标轨迹...');
            } else if (overallProgress > 30) {
              setExportMessage('正在渲染特效...');
            } else {
              setExportMessage('正在合成视频画面...');
            }
            if (currentSec >= segment.endSec - (1 / Math.max(24, preset.fps)) || screenVideo.ended) {
              finish();
              return;
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        });

        screenVideo.pause();
        if (cameraVideo) {
          cameraVideo.pause();
        }
        if (micAudio) {
          micAudio.pause();
        }
        exportedElapsedSec += segmentDuration;

        const transitionDurationSec = transitionDurationsSec[i] ?? 0;
        const nextSegment = keepSegments[i + 1];
        if (transitionDurationSec > 0 && nextSegment && segment.followingCut && segment.followingCut.transitionType !== 'none') {
          addLog(`应用过渡效果: ${segment.followingCut.transitionType} (时长: ${transitionDurationSec.toFixed(2)}s)`, 'info');
          const transitionType = segment.followingCut.transitionType;
          const fromTime = Math.max(segment.startSec, segment.endSec - transitionDurationSec);
          await seekAllVideos(fromTime);
          renderFrame();
          const fromFrame = document.createElement('canvas');
          fromFrame.width = exportCanvas.width;
          fromFrame.height = exportCanvas.height;
          const fromCtx = fromFrame.getContext('2d');
          if (fromCtx) {
            fromCtx.drawImage(exportCanvas, 0, 0);
          }
          const transitionFrames = Math.max(2, Math.round(transitionDurationSec * preset.fps));
          for (let frameIndex = 0; frameIndex < transitionFrames; frameIndex += 1) {
            const progress = (frameIndex + 1) / transitionFrames;
            const nextTime = clamp(
              nextSegment.startSec + progress * transitionDurationSec,
              nextSegment.startSec,
              nextSegment.endSec
            );
            await seekAllVideos(nextTime);
            renderFrame();
            const exportCtx = exportCanvas.getContext('2d');
            if (exportCtx) {
              drawTransitionOverlay(
                exportCtx,
                fromFrame,
                exportCanvas.width,
                exportCanvas.height,
                progress,
                transitionType
              );
            }
            const transitionElapsed = progress * transitionDurationSec;
            const overallProgress = ((exportedElapsedSec + transitionElapsed) / Math.max(0.001, effectiveDuration)) * 100;
            setExportProgress(Math.min(50, overallProgress * 0.5));
            setExportMessage('正在生成过渡效果...');
            await new Promise(resolve => setTimeout(resolve, 1000 / preset.fps));
          }
          exportedElapsedSec += transitionDurationSec;
        }
      }

      const finalTarget = keepSegments[keepSegments.length - 1]?.endSec ?? sourceDuration;
      await seekAllVideos(finalTarget);
      renderFrame();
      await new Promise(resolve => setTimeout(resolve, 260));

      if (recorder.state !== 'inactive') {
        recorder.requestData();
        await new Promise(resolve => setTimeout(resolve, 160));
        recorder.stop();
      }

      const exportedBlob = await recorderStopped;
      if (exportedBlob.size < 8000) {
        throw new Error('导出文件异常偏小，请检查裁切区间是否覆盖过多内容或源视频解码状态');
      }

      addLog(`临时视频录制完成，大小: ${(exportedBlob.size / 1024 / 1024).toFixed(2)} MB`, 'info');
      setExportMessage('正在使用 FFmpeg 转换格式...');

      const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const tempFileName = `temp-export-${timestamp}.webm`;
      const finalFileName = `${record.name}-剪辑导出-${preset.width}x${preset.height}-${preset.fps}fps-${timestamp}.${exportVideoFormat}`;
      
      const tempBuffer = await exportedBlob.arrayBuffer();
      const tempSaveResult = await window.api.saveExportedVideo({
        baseDir: record.absolutePath,
        fileName: tempFileName,
        videoBlob: tempBuffer
      });

      if (!tempSaveResult.success || !tempSaveResult.path) {
        throw new Error(tempSaveResult.error || '保存临时视频失败');
      }

      addLog(`临时文件已保存: ${tempSaveResult.path}`, 'info');

      // @ts-ignore
      const progressUnsubscribe = window.api.onExportProgress((progress: number) => {
        setExportProgress(Math.min(99, 50 + progress * 0.5));
        if (progress > 60) {
          setExportMessage('正在封装导出文件...');
        } else if (progress > 30) {
          setExportMessage('正在处理视频编码...');
        } else {
          setExportMessage('正在处理视频流...');
        }
      });

      // @ts-ignore
      const convertResult = await window.api.convertVideoWithFfmpeg({
        inputPath: tempSaveResult.path,
        outputPath: tempSaveResult.path.replace(tempFileName, finalFileName),
        width: preset.width,
        height: preset.height,
        fps: preset.fps,
        format: exportVideoFormat
      });

      progressUnsubscribe();

      if (convertResult.success && convertResult.path && tempSaveResult.path) {
        // @ts-ignore
        await window.api.deleteFile(tempSaveResult.path);
        addLog('临时文件已清理', 'info');
      }

      if (!convertResult.success || !convertResult.path) {
        throw new Error(convertResult.error || '格式转换失败');
      }

      setExportProgress(100);
      setExportMessage('导出完成！');
      addLog(`导出完成！文件已保存至: ${convertResult.path}`, 'info');
      setExporting(false);
      exportingRef.current = false;
      setExportMessage('');
      if (window.confirm('导出完成，是否立即打开视频？')) {
        const openResult = await window.api.openPath(convertResult.path);
        if (!openResult?.success) {
          alert(openResult?.error || '打开视频失败');
        }
      }
    } catch (exportError) {
      setExporting(false);
      exportingRef.current = false;
      setExportMessage('');
      addLog(`导出过程中发生错误: ${String(exportError)}`, 'error');
      alert(`导出失败：${String(exportError)}`);
    } finally {
      screenVideo.pause();
      if (cameraVideo) {
        cameraVideo.pause();
      }
      if (micAudio) {
        micAudio.pause();
      }
      if (screenSourceNode) {
        screenSourceNode.disconnect();
      }
      if (micSourceNode) {
        micSourceNode.disconnect();
      }
      if (screenGainNode) {
        screenGainNode.disconnect();
      }
      if (micGainNode) {
        micGainNode.disconnect();
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      exportingRef.current = false;
      if (exportStream) {
        exportStream.getTracks().forEach(track => track.stop());
      }
      timelineBlocksRef.current = previousTimelineBlocksRef;
      configRef.current = previousConfigRef;
      recordRef.current = previousRecordRef;
      cutRangesRef.current = previousCutRanges;
      canvasRef.current = previewCanvas;
      screenVideo.loop = previousScreenLoop;
      screenVideo.muted = previousScreenMuted;
      screenVideo.volume = previousScreenVolume;
      if (cameraVideo) {
        cameraVideo.loop = previousCameraLoop;
        cameraVideo.muted = previousCameraMuted;
      }
      if (micAudio) {
        micAudio.loop = previousMicLoop;
        micAudio.muted = previousMicMuted;
        micAudio.volume = previousMicVolume;
      }
      applySeek(previousPlayhead);
      playheadRef.current = previousPlayhead;
      setPlayhead(previousPlayhead);
      requestAnimationFrame(renderFrame);
      if (previousPlaying) {
        setPlaying(true);
      }
    }
  };

  const handleExport = async (preset: ExportPreset = DEFAULT_EXPORT_PRESET) => {
    setSelectedElement('log');
    setLogs([]); // Clear previous logs
    addLog(`开始导出任务: ${preset.label} (${preset.width}x${preset.height} ${preset.fps}fps, ${exportVideoFormat.toUpperCase()})`, 'info');
    const previousTimelineBlocksRef = timelineBlocksRef.current;
    const previousConfigRef = configRef.current;
    const previousRecordRef = recordRef.current;
    const exportTimelineSnapshot = getSortedTimelineBlocks(timelineBlocks.map(normalizeTimelineBlock));
    timelineBlocksRef.current = exportTimelineSnapshot;
    configRef.current = config;
    recordRef.current = record;

    const canvas = canvasRef.current;
    const screenVideo = screenVideoRef.current;
    const cameraVideo = cameraVideoRef.current;
    const micAudio = micAudioRef.current;
    if (!canvas || !screenVideo || !record?.absolutePath) {
      addLog('导出失败：缺少可用的视频素材', 'error');
      alert('导出失败：缺少可用的视频素材');
      return;
    }
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      addLog('当前环境不支持视频导出', 'error');
      alert('当前环境不支持视频导出');
      return;
    }

    const sourceDuration = Number.isFinite(totalDurationSec) && totalDurationSec > 0
      ? totalDurationSec
      : (Number.isFinite(screenVideo.duration) && screenVideo.duration > 0 ? screenVideo.duration : 0);
    if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
      addLog('导出失败：无法读取录屏时长', 'error');
      alert('导出失败：无法读取录屏时长');
      return;
    }

    const normalizedCuts = mergeCutRanges(timelineBlocksRef.current)
      .map((range) => ({
        startSec: clamp(range.startSec, 0, sourceDuration),
        endSec: clamp(range.endSec, 0, sourceDuration),
        transitionType: range.transitionType,
        transitionDurationSec: range.transitionDurationSec
      }))
      .filter((range) => range.endSec - range.startSec > 0.0001)
      .sort((a, b) => a.startSec - b.startSec);
    const keepSegments: { startSec: number; endSec: number; followingCut: NormalizedCutRange | null }[] = [];
    let cursor = 0;
    for (let i = 0; i < normalizedCuts.length; i += 1) {
      const cut = normalizedCuts[i];
      if (cut.startSec > cursor + 0.0001) {
        keepSegments.push({ startSec: cursor, endSec: cut.startSec, followingCut: cut });
      }
      cursor = Math.max(cursor, cut.endSec);
    }
    if (cursor < sourceDuration - 0.0001) {
      keepSegments.push({ startSec: cursor, endSec: sourceDuration, followingCut: null });
    }
    const transitionDurationsSec = keepSegments.map((segment, index) => {
      const nextSegment = keepSegments[index + 1];
      if (!segment.followingCut || !nextSegment) return 0;
      const segmentDuration = Math.max(0, segment.endSec - segment.startSec);
      const nextDuration = Math.max(0, nextSegment.endSec - nextSegment.startSec);
      return resolveCutTransitionDurationSec(
        segment.followingCut.transitionType,
        segment.followingCut.transitionDurationSec,
        Math.min(segmentDuration * 0.5, nextDuration * 0.5, segment.followingCut.endSec - segment.followingCut.startSec)
      );
    });
    const effectiveDuration = keepSegments.reduce((sum, segment) => sum + Math.max(0, segment.endSec - segment.startSec), 0)
      + transitionDurationsSec.reduce((sum, value) => sum + value, 0);
    if (effectiveDuration < 0.08) {
      addLog('导出失败：裁切区间覆盖了几乎全部视频内容，请调整后重试', 'error');
      alert('导出失败：裁切区间覆盖了几乎全部视频内容，请调整后重试');
      return;
    }

    addLog(`计算有效时长完成: ${effectiveDuration.toFixed(2)}秒, 片段数: ${keepSegments.length}`, 'info');

    const previousPlayhead = playheadRef.current;
    const previousPlaying = playingRef.current;
    const previousScreenLoop = screenVideo.loop;
    const previousCameraLoop = cameraVideo?.loop ?? false;
    const previousMicLoop = micAudio?.loop ?? false;
    const previousScreenMuted = screenVideo.muted;
    const previousCameraMuted = cameraVideo?.muted ?? true;
    const previousMicMuted = micAudio?.muted ?? true;
    const previousScreenVolume = screenVideo.volume;
    const previousMicVolume = micAudio?.volume ?? 1;
    const previousCutRanges = cutRangesRef.current;
    const previewCanvas = canvas;
    const exportCanvas = document.createElement('canvas');
    let exportStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    let screenSourceNode: MediaElementAudioSourceNode | null = null;
    let micSourceNode: MediaElementAudioSourceNode | null = null;
    let screenGainNode: GainNode | null = null;
    let micGainNode: GainNode | null = null;

    const safePlay = async (media: HTMLMediaElement | null) => {
      if (!media) return;
      try {
        await media.play();
      } catch {
        media.pause();
      }
    };

    const waitVideoSeeked = async (video: HTMLVideoElement, targetTime: number) => {
      const maxDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : targetTime;
      const safeTarget = clamp(targetTime, 0, Math.max(0, maxDuration));
      if (Math.abs(video.currentTime - safeTarget) <= 0.01 && video.readyState >= 2) {
        return;
      }
      await new Promise<void>((resolve) => {
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('canplay', onSeeked);
          window.clearTimeout(timeoutId);
        };
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, 1200);
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('canplay', onSeeked, { once: true });
        video.currentTime = safeTarget;
      });
    };

    const waitMediaSeeked = async (media: HTMLMediaElement, targetTime: number) => {
      const maxDuration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : targetTime;
      const safeTarget = clamp(targetTime, 0, Math.max(0, maxDuration));
      if (Math.abs(media.currentTime - safeTarget) <= 0.01 && media.readyState >= 2) {
        return;
      }
      await new Promise<void>((resolve) => {
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          media.removeEventListener('seeked', onSeeked);
          media.removeEventListener('canplay', onSeeked);
          window.clearTimeout(timeoutId);
        };
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, 1200);
        media.addEventListener('seeked', onSeeked, { once: true });
        media.addEventListener('canplay', onSeeked, { once: true });
        media.currentTime = safeTarget;
      });
    };

    const seekAllVideos = async (time: number) => {
      const tasks: Promise<void>[] = [waitVideoSeeked(screenVideo, time)];
      if (cameraVideo) {
        tasks.push(waitVideoSeeked(cameraVideo, time));
      }
      if (micAudio) {
        tasks.push(waitMediaSeeked(micAudio, time));
      }
      await Promise.all(tasks);
    };

    try {
      const exportWidth = preset.width;
      const exportHeight = preset.height;
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
      canvasRef.current = exportCanvas;

      setPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      setExporting(true);
      exportingRef.current = true;
      setExportProgress(0);
      setExportMessage('正在初始化导出...');
      addLog('正在初始化导出环境...', 'info');

      cutRangesRef.current = [];
      activePreviewTransitionRef.current = null;
      screenVideo.loop = false;
      screenVideo.muted = false;
      screenVideo.volume = clamp(systemVolume / 100, 0, 1);
      if (cameraVideo) {
        cameraVideo.loop = false;
        cameraVideo.muted = true;
      }
      if (micAudio) {
        micAudio.loop = false;
        micAudio.muted = false;
        micAudio.volume = clamp(micVolume / 100, 0, 1);
      }

      await seekAllVideos(keepSegments[0].startSec);
      playheadRef.current = keepSegments[0].startSec;
      setPlayhead(keepSegments[0].startSec);
      renderFrame();

      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioDest = audioContext.createMediaStreamDestination();
        screenSourceNode = audioContext.createMediaElementSource(screenVideo);
        screenGainNode = audioContext.createGain();
        screenGainNode.gain.value = clamp(systemVolume / 100, 0, 2);
        screenSourceNode.connect(screenGainNode);
        screenGainNode.connect(audioDest);
        if (micAudio) {
          micSourceNode = audioContext.createMediaElementSource(micAudio);
          micGainNode = audioContext.createGain();
          micGainNode.gain.value = clamp(micVolume / 100, 0, 2);
          micSourceNode.connect(micGainNode);
          micGainNode.connect(audioDest);
        }
        addLog('音频上下文初始化成功', 'info');
      } catch (e) {
        addLog(`音频初始化失败: ${String(e)}`, 'error');
        console.warn('Audio setup failed:', e);
      }

      const mimeCandidates = exportVideoFormat === 'mp4'
        ? ['video/mp4;codecs=avc1.64001F,mp4a.40.2', 'video/mp4;codecs=h264,aac', 'video/mp4;codecs=h264', 'video/mp4']
        : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const supportedMimeType = mimeCandidates.find(type => MediaRecorder.isTypeSupported(type));
      if (exportVideoFormat === 'mp4' && !supportedMimeType) {
        throw new Error('当前环境不支持 MP4 导出，请切换到 WEBM');
      }
      const targetBitrate = Math.min(
        100_000_000,
        Math.max(12_000_000, Math.round((exportWidth * exportHeight / (1920 * 1080)) * 18_000_000 * (preset.fps / 30)))
      );

      addLog(`使用MIME类型: ${supportedMimeType || '默认'}, 目标码率: ${(targetBitrate / 1000000).toFixed(1)} Mbps`, 'info');

      const canvasStream = exportCanvas.captureStream(preset.fps);
      if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        audioDest.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      }

      const recorder = supportedMimeType
        ? new MediaRecorder(canvasStream, { mimeType: supportedMimeType, videoBitsPerSecond: targetBitrate })
        : new MediaRecorder(canvasStream, { videoBitsPerSecond: targetBitrate });
      exportStream = recorder.stream;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const recorderStopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const fallbackMimeType = exportVideoFormat === 'mp4' ? 'video/mp4' : 'video/webm';
          const blob = new Blob(chunks, { type: supportedMimeType || fallbackMimeType });
          resolve(blob);
        };
      });

      recorder.start(1000);
      addLog('开始录制视频流...', 'info');

      let exportedElapsedSec = 0;
      for (let i = 0; i < keepSegments.length; i += 1) {
        const segment = keepSegments[i];
        const segmentDuration = Math.max(0, segment.endSec - segment.startSec);
        if (segmentDuration <= 0.0001) {
          continue;
        }

        addLog(`开始渲染片段 ${i + 1}/${keepSegments.length} (时长: ${segmentDuration.toFixed(2)}s)`, 'info');

        await seekAllVideos(segment.startSec);
        playheadRef.current = segment.startSec;
        setPlayhead(segment.startSec);
        renderFrame();

        await safePlay(screenVideo);
        if (cameraVideo && record.cameraVideoPath) {
          await safePlay(cameraVideo);
        }
        if (micAudio && record.micAudioPath) {
          await safePlay(micAudio);
        }

        await new Promise<void>((resolve) => {
          let rafId = 0;
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (rafId) {
              cancelAnimationFrame(rafId);
            }
            resolve();
          };
          const tick = () => {
            renderFrame();
            const currentSec = screenVideo.currentTime;
            const segmentProgress = clamp((currentSec - segment.startSec) / Math.max(0.001, segmentDuration), 0, 1);
            const overallProgress = ((exportedElapsedSec + segmentProgress * segmentDuration) / effectiveDuration) * 100;
            setExportProgress(Math.min(99, overallProgress));
            if (overallProgress > 60) {
              setExportMessage('正在封装导出文件...');
            } else if (overallProgress > 30) {
              setExportMessage('正在渲染画中画与光标轨迹...');
            } else {
              setExportMessage('正在合成视频画面...');
            }
            if (currentSec >= segment.endSec - (1 / Math.max(24, preset.fps)) || screenVideo.ended) {
              finish();
              return;
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        });

        screenVideo.pause();
        if (cameraVideo) {
          cameraVideo.pause();
        }
        if (micAudio) {
          micAudio.pause();
        }
        exportedElapsedSec += segmentDuration;

        const transitionDurationSec = transitionDurationsSec[i] ?? 0;
        const nextSegment = keepSegments[i + 1];
        if (transitionDurationSec > 0 && nextSegment && segment.followingCut && segment.followingCut.transitionType !== 'none') {
          addLog(`应用过渡效果: ${segment.followingCut.transitionType} (时长: ${transitionDurationSec.toFixed(2)}s)`, 'info');
          const transitionType = segment.followingCut.transitionType;
          const fromTime = Math.max(segment.startSec, segment.endSec - transitionDurationSec);
          await seekAllVideos(fromTime);
          renderFrame();
          const fromFrame = document.createElement('canvas');
          fromFrame.width = exportCanvas.width;
          fromFrame.height = exportCanvas.height;
          const fromCtx = fromFrame.getContext('2d');
          if (fromCtx) {
            fromCtx.drawImage(exportCanvas, 0, 0);
          }
          const transitionFrames = Math.max(2, Math.round(transitionDurationSec * preset.fps));
          for (let frameIndex = 0; frameIndex < transitionFrames; frameIndex += 1) {
            const progress = (frameIndex + 1) / transitionFrames;
            const nextTime = clamp(
              nextSegment.startSec + progress * transitionDurationSec,
              nextSegment.startSec,
              nextSegment.endSec
            );
            await seekAllVideos(nextTime);
            renderFrame();
            const exportCtx = exportCanvas.getContext('2d');
            if (exportCtx) {
              drawTransitionOverlay(
                exportCtx,
                fromFrame,
                exportCanvas.width,
                exportCanvas.height,
                progress,
                transitionType
              );
            }
            const transitionElapsed = progress * transitionDurationSec;
            const overallProgress = ((exportedElapsedSec + transitionElapsed) / Math.max(0.001, effectiveDuration)) * 100;
            setExportProgress(Math.min(99, overallProgress));
            setExportMessage('正在生成过渡效果...');
            await new Promise(resolve => setTimeout(resolve, 1000 / preset.fps));
          }
          exportedElapsedSec += transitionDurationSec;
        }
      }

      const finalTarget = keepSegments[keepSegments.length - 1]?.endSec ?? sourceDuration;
      await seekAllVideos(finalTarget);
      renderFrame();
      await new Promise(resolve => setTimeout(resolve, 260));

      if (recorder.state !== 'inactive') {
        recorder.requestData();
        await new Promise(resolve => setTimeout(resolve, 160));
        recorder.stop();
      }

      const exportedBlob = await recorderStopped;
      if (exportedBlob.size < 8000) {
        throw new Error('导出文件异常偏小，请检查裁切区间是否覆盖过多内容或源视频解码状态');
      }
      const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const fileName = `${record.name}-剪辑导出-${preset.width}x${preset.height}-${preset.fps}fps-${timestamp}.${exportVideoFormat}`;
      const buffer = await exportedBlob.arrayBuffer();

      addLog(`开始保存文件: ${fileName} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`, 'info');
      const saveResult = await window.api.saveExportedVideo({
        baseDir: record.absolutePath,
        fileName,
        videoBlob: buffer
      });
      if (!saveResult.success || !saveResult.path) {
        throw new Error(saveResult.error || '保存导出视频失败');
      }

      setExportProgress(100);
      setExportMessage('导出完成！');
      addLog(`导出完成！文件已保存至: ${saveResult.path}`, 'info');
      setExporting(false);
      exportingRef.current = false;
      setExportMessage('');
      if (window.confirm('导出完成，是否立即打开视频？')) {
        const openResult = await window.api.openPath(saveResult.path);
        if (!openResult?.success) {
          alert(openResult?.error || '打开视频失败');
        }
      }
    } catch (exportError) {
      setExporting(false);
      exportingRef.current = false;
      setExportMessage('');
      addLog(`导出过程中发生错误: ${String(exportError)}`, 'error');
      alert(`导出失败：${String(exportError)}`);
    } finally {
      screenVideo.pause();
      if (cameraVideo) {
        cameraVideo.pause();
      }
      if (micAudio) {
        micAudio.pause();
      }
      if (screenSourceNode) {
        screenSourceNode.disconnect();
      }
      if (micSourceNode) {
        micSourceNode.disconnect();
      }
      if (screenGainNode) {
        screenGainNode.disconnect();
      }
      if (micGainNode) {
        micGainNode.disconnect();
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      exportingRef.current = false;
      if (exportStream) {
        exportStream.getTracks().forEach(track => track.stop());
      }
      timelineBlocksRef.current = previousTimelineBlocksRef;
      configRef.current = previousConfigRef;
      recordRef.current = previousRecordRef;
      cutRangesRef.current = previousCutRanges;
      canvasRef.current = previewCanvas;
      screenVideo.loop = previousScreenLoop;
      screenVideo.muted = previousScreenMuted;
      screenVideo.volume = previousScreenVolume;
      if (cameraVideo) {
        cameraVideo.loop = previousCameraLoop;
        cameraVideo.muted = previousCameraMuted;
      }
      if (micAudio) {
        micAudio.loop = previousMicLoop;
        micAudio.muted = previousMicMuted;
        micAudio.volume = previousMicVolume;
      }
      applySeek(previousPlayhead);
      playheadRef.current = previousPlayhead;
      setPlayhead(previousPlayhead);
      requestAnimationFrame(renderFrame);
      if (previousPlaying) {
        setPlaying(true);
      }
    }
  };

  const exportMenuOpen = Boolean(exportMenuAnchorEl);
  const exportPresetMenuItems = useMemo(() => {
    const hasSourceResolution = sourceResolution.width > 0 && sourceResolution.height > 0;
    return EXPORT_PRESETS.map((preset) => ({
      ...preset,
      disabled: hasSourceResolution && (preset.width > sourceResolution.width || preset.height > sourceResolution.height)
    }));
  }, [sourceResolution.height, sourceResolution.width]);

  const clearExportMenuCloseTimer = () => {
    if (exportMenuCloseTimerRef.current) {
      window.clearTimeout(exportMenuCloseTimerRef.current);
      exportMenuCloseTimerRef.current = null;
    }
  };

  const openExportMenu = (anchorElement: HTMLElement) => {
    clearExportMenuCloseTimer();
    setExportMenuAnchorEl(anchorElement);
  };

  const closeExportMenu = () => {
    clearExportMenuCloseTimer();
    setExportMenuAnchorEl(null);
  };

  const scheduleCloseExportMenu = () => {
    clearExportMenuCloseTimer();
    exportMenuCloseTimerRef.current = window.setTimeout(() => {
      setExportMenuAnchorEl(null);
      exportMenuCloseTimerRef.current = null;
    }, 120);
  };

  const handleOpenProjectFolder = useCallback(async () => {
    if (!record?.absolutePath) return;
    const result = await window.api.openPath(record.absolutePath);
    if (!result?.success) {
      alert(result?.error || '打开项目文件夹失败');
    }
  }, [record?.absolutePath]);

  useEffect(() => {
    return () => {
      clearExportMenuCloseTimer();
    };
  }, []);

  const formatDuration = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) {
      return '00:00';
    }
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (error && !record) return <Box sx={{ p: 4 }}><Typography color="error">{error}</Typography></Box>;
  if (!record || loading) return <Box sx={{ p: 4 }}><Typography>加载中...</Typography></Box>;

  const aspectPresets = [
    { value: 'auto', label: '原始比例 (自动)' },
    { value: '16:9', label: '16:9 (横屏)' },
    { value: '9:16', label: '9:16 (竖屏)' },
    { value: '4:3', label: '4:3 (标准)' },
    { value: '1:1', label: '1:1 (正方形)' },
    { value: 'custom', label: '自定义' },
  ];

  const cameraPositionOptions: { value: CameraPositionPreset; label: string; iconX: number; iconY: number }[] = [
    { value: 'topLeft', label: '左上', iconX: 8, iconY: 8 },
    { value: 'topRight', label: '右上', iconX: 16, iconY: 8 },
    { value: 'bottomLeft', label: '左下', iconX: 8, iconY: 16 },
    { value: 'bottomRight', label: '右下', iconX: 16, iconY: 16 },
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a', color: '#f8fafc', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold">{record.name}</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            color="inherit"
            sx={{ borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: 'rgba(255,255,255,0.8)' } }}
            onClick={handleOpenProjectFolder}
          >
            打开项目
          </Button>
          <Box
            onMouseEnter={(event) => openExportMenu(event.currentTarget)}
            onMouseLeave={scheduleCloseExportMenu}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<UploadFile />}
              onClick={() => handleExportWithFfmpeg(DEFAULT_EXPORT_PRESET)}
              disabled={exporting}
            >
              导出视频
            </Button>
            <Menu
              anchorEl={exportMenuAnchorEl}
              open={exportMenuOpen}
              onClose={closeExportMenu}
              MenuListProps={{
                onMouseEnter: clearExportMenuCloseTimer,
                onMouseLeave: scheduleCloseExportMenu
              }}
            >
              {exportPresetMenuItems.map((preset) => (
                <MenuItem
                  key={`${preset.width}-${preset.height}-${preset.fps}`}
                  disabled={preset.disabled || exporting}
                  onClick={async () => {
                    closeExportMenu();
                    await handleExportWithFfmpeg(preset);
                  }}
                >
                  {preset.label}
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: 'text.secondary' }}>
            <Typography variant="caption" sx={{ opacity: exportVideoFormat === 'webm' ? 1 : 0.6 }}>WEBM</Typography>
            <Switch
              size="small"
              checked={exportVideoFormat === 'mp4'}
              disabled={exporting}
              onChange={(_, checked) => setExportVideoFormat(checked ? 'mp4' : 'webm')}
            />
            <Typography variant="caption" sx={{ opacity: exportVideoFormat === 'mp4' ? 1 : 0.6 }}>MP4</Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 1.5, gap: 1.5, overflow: 'hidden' }}>

        {/* Upper Area: Left, Center, Right */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr 300px', gap: 1.5, overflow: 'hidden' }}>

          {/* Left Panel: Config */}
          <Paper sx={{ p: 0, minHeight: 0, display: 'flex', bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <Tabs
              value={selectedElement}
              onChange={(_, v) => setSelectedElement(v)}
              orientation="vertical"
              sx={{
                width: 96,
                borderRight: '1px solid rgba(255,255,255,0.1)',
                '& .MuiTabs-indicator': { left: 0, right: 'auto', width: 3 }
              }}
            >
              <Tab value="screen" label="画面" sx={{ minHeight: 42, py: 0, alignItems: 'flex-start', px: 2 }} />
              <Tab value="camera" label="摄像头" sx={{ minHeight: 42, py: 0, alignItems: 'flex-start', px: 2 }} />
              <Tab value="mouse" label="鼠标" sx={{ minHeight: 42, py: 0, alignItems: 'flex-start', px: 2 }} />
              <Tab value="aiFocus" label="AI着重" sx={{ minHeight: 42, py: 0, alignItems: 'flex-start', px: 2 }} />
              <Tab value="clip" label="属性" sx={{ minHeight: 42, py: 0, alignItems: 'flex-start', px: 2 }} />
              <Tab value="log" label="日志" sx={{ minHeight: 42, py: 0, alignItems: 'flex-start', px: 2 }} />
            </Tabs>

            <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, p: 1.5, display: 'flex', flexDirection: 'column' }}>
              <Stack
                spacing={2}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  pr: 1,
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}
              >
                {selectedElement === 'screen' && (
                  <>
                    <Typography variant="body2" color="text.secondary" mb={1}>画面比例</Typography>
                    <FormControl size="small" fullWidth>
                      <InputLabel>画面比例</InputLabel>
                      <Select value={config.aspectPreset} label="画面比例" onChange={(e) => updateConfig({ aspectPreset: e.target.value })}>
                        {aspectPresets.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {config.aspectPreset === 'custom' && (
                      <Stack direction="row" spacing={1}>
                        <TextField size="small" label="宽" type="number" value={config.customWidth} onChange={(e) => updateConfig({ customWidth: Number(e.target.value) })} />
                        <TextField size="small" label="高" type="number" value={config.customHeight} onChange={(e) => updateConfig({ customHeight: Number(e.target.value) })} />
                      </Stack>
                    )}
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>画面边距</Typography>
                      <Slider min={0} max={200} value={config.screenMargin} onChange={(_, v) => updateConfig({ screenMargin: v as number })} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>圆角半径</Typography>
                      <Slider min={0} max={100} value={config.screenRadius} onChange={(_, v) => updateConfig({ screenRadius: v as number })} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>自定义底图</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="small" fullWidth onClick={() => handleLoadImage('backgroundImage')}>
                          {config.backgroundImage ? '更改底图' : '选择图片'}
                        </Button>
                        {config.backgroundImage && (
                          <Button variant="text" color="error" size="small" onClick={() => updateConfig({ backgroundImage: '' })}>清除</Button>
                        )}
                      </Stack>
                      {backgroundGrid}
                    </Box>
                  </>
                )}

                {selectedElement === 'camera' && (
                  <>
                    <Typography variant="body2" color="text.secondary" mb={1}>摄像头样式</Typography>
                    <FormControl size="small" fullWidth>
                      <InputLabel>摄像头样式</InputLabel>
                      <Select value={config.cameraShape} label="摄像头样式" onChange={(e) => updateConfig({ cameraShape: e.target.value as 'circle' | 'rect' })}>
                        <MenuItem value="circle">圆形画中画</MenuItem>
                        <MenuItem value="rect">矩形画中画</MenuItem>
                      </Select>
                    </FormControl>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>画面位置</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                        {cameraPositionOptions.map((option) => (
                          <ToggleButton
                            key={option.value}
                            value={option.value}
                            selected={config.cameraPosition === option.value}
                            onChange={() => updateConfig({ cameraPosition: option.value })}
                            sx={{
                              textTransform: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                              py: 0.8,
                              borderColor: 'rgba(148, 163, 184, 0.4)',
                              color: 'text.secondary',
                              '&.Mui-selected': {
                                borderColor: 'primary.main',
                                bgcolor: 'rgba(37, 99, 235, 0.16)',
                                color: 'primary.light'
                              }
                            }}
                          >
                            <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 20 }}>
                              <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                              <circle cx={option.iconX} cy={option.iconY} r="2.2" fill="currentColor" />
                            </SvgIcon>
                            <Typography variant="caption">{option.label}</Typography>
                          </ToggleButton>
                        ))}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>摄像头大小</Typography>
                      <Slider min={0.1} max={0.5} step={0.01} value={config.cameraScale} onChange={(_, v) => updateConfig({ cameraScale: v as number })} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>摄像头边距</Typography>
                      <Slider min={0} max={160} step={1} value={config.cameraMargin} onChange={(_, v) => updateConfig({ cameraMargin: v as number })} />
                    </Box>
                    {config.cameraShape === 'rect' && (
                      <Box>
                        <Typography variant="body2" color="text.secondary" mb={1}>圆角大小</Typography>
                        <Slider min={0} max={100} value={config.cameraRadius} onChange={(_, v) => updateConfig({ cameraRadius: v as number })} />
                      </Box>
                    )}
                  </>
                )}

                {selectedElement === 'mouse' && (
                  <>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>显示开关</Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <FormControlLabel
                          control={<Switch size="small" checked={config.showClickEffect} onChange={(e) => updateConfig({ showClickEffect: e.target.checked })} />}
                          label={<Typography variant="body2">点击效果</Typography>}
                          sx={{ m: 0 }}
                        />
                        <FormControlLabel
                          control={<Switch size="small" checked={config.showTextPrompt} onChange={(e) => updateConfig({ showTextPrompt: e.target.checked })} />}
                          label={<Typography variant="body2">文字提示</Typography>}
                          sx={{ m: 0 }}
                        />
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>自定义鼠标样式</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="small" fullWidth onClick={() => handleLoadImage('cursorImage')}>
                          {config.cursorImage ? '更改样式' : '选择图片'}
                        </Button>
                        {config.cursorImage && (
                          <Button variant="text" color="error" size="small" onClick={() => updateConfig({ cursorImage: '' })}>默认</Button>
                        )}
                      </Stack>
                      {cursorImages.length > 0 && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mt: 1 }}>
                          {cursorImages.map(path => {
                            const url = toFileUrl(path);
                            return (
                              <Box
                                key={path}
                                onClick={() => updateConfig({ cursorImage: url })}
                                sx={{
                                  aspectRatio: '1/1',
                                  bgcolor: 'rgba(255,255,255,0.05)',
                                  borderRadius: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  border: config.cursorImage === url ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                }}
                              >
                                <img src={url} alt="cursor" style={{ width: '60%', height: '60%', objectFit: 'contain' }} />
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>鼠标大小 ({config.cursorSize}px)</Typography>
                      <Slider min={0} max={256} value={config.cursorSize} onChange={(_, v) => updateConfig({ cursorSize: v as number })} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>热点X ({Math.round(config.cursorHotspotX * 100)}%)</Typography>
                      <Slider min={0} max={1} step={0.01} value={config.cursorHotspotX} onChange={(_, v) => updateConfig({ cursorHotspotX: v as number })} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>热点Y ({Math.round(config.cursorHotspotY * 100)}%)</Typography>
                      <Slider min={0} max={1} step={0.01} value={config.cursorHotspotY} onChange={(_, v) => updateConfig({ cursorHotspotY: v as number })} />
                    </Box>
                    <Box>
                      <FormControlLabel
                        control={<Switch size="small" checked={config.showCursorTrail} onChange={(e) => updateConfig({ showCursorTrail: e.target.checked })} />}
                        label={<Typography variant="body2">鼠标轨迹</Typography>}
                        sx={{ m: 0, mb: config.showCursorTrail ? 1 : 0 }}
                      />
                      {config.showCursorTrail && (
                        <>
                          <Box mt={1}>
                            <Typography variant="body2" color="text.secondary" mb={1}>轨迹长度 ({Math.round(config.cursorTrailLengthMs)}ms)</Typography>
                            <Slider min={0} max={2000} step={10} value={config.cursorTrailLengthMs} onChange={(_, v) => updateConfig({ cursorTrailLengthMs: v as number })} />
                          </Box>
                          <Box mt={1}>
                            <Typography variant="body2" color="text.secondary" mb={1}>轨迹粗细 ({config.cursorTrailWidth.toFixed(1)})</Typography>
                            <Slider min={0} max={20} step={0.5} value={config.cursorTrailWidth} onChange={(_, v) => updateConfig({ cursorTrailWidth: v as number })} />
                          </Box>
                          <Box mt={1}>
                            <Typography variant="body2" color="text.secondary" mb={1}>轨迹透明度 ({config.cursorTrailOpacity.toFixed(2)})</Typography>
                            <Slider min={0} max={1} step={0.01} value={config.cursorTrailOpacity} onChange={(_, v) => updateConfig({ cursorTrailOpacity: v as number })} />
                          </Box>
                        </>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>操作反馈时长 ({Math.round(config.cursorClickEffectDuration)}ms)</Typography>
                      <Slider min={60} max={1200} step={10} value={config.cursorClickEffectDuration} onChange={(_, v) => updateConfig({ cursorClickEffectDuration: v as number })} />
                    </Box>
                  </>
                )}

                {selectedElement === 'aiFocus' && (
                  <>
                    <Typography variant="body2" color="text.secondary">AI 着重策略</Typography>
                    <Stack spacing={0.5}>
                      <FormControlLabel
                        control={(
                          <Checkbox
                            size="small"
                            checked={aiFocusOptions.clearExistingFocusBlocks}
                            onChange={(_, checked) => setAiFocusOptions(prev => ({ ...prev, clearExistingFocusBlocks: checked }))}
                          />
                        )}
                        label={<Typography variant="body2">清除现有着重块</Typography>}
                        sx={{ m: 0 }}
                      />
                      <FormControlLabel
                        control={(
                          <Checkbox
                            size="small"
                            checked={aiFocusOptions.focusBoxSelection}
                            onChange={(_, checked) => setAiFocusOptions(prev => ({ ...prev, focusBoxSelection: checked }))}
                          />
                        )}
                        label={<Typography variant="body2">对鼠标框选部分进行着重</Typography>}
                        sx={{ m: 0 }}
                      />
                      <FormControlLabel
                        control={(
                          <Checkbox
                            size="small"
                            checked={aiFocusOptions.focusCircleMotion}
                            onChange={(_, checked) => setAiFocusOptions(prev => ({ ...prev, focusCircleMotion: checked }))}
                          />
                        )}
                        label={<Typography variant="body2">对鼠标长时间小范围画圈进行着重</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Stack>
                    <Button variant="contained" onClick={handleAutoAddAIFocusBlocks}>
                      一键添加着重
                    </Button>
                  </>
                )}

                {selectedElement === 'clip' && (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      视频文件：{record.absolutePath}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">总时长: {record.durationText}</Typography>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>阴影强度</Typography>
                      <Slider min={0} max={1} step={0.1} value={config.shadowOpacity} onChange={(_, v) => updateConfig({ shadowOpacity: v as number })} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>阴影模糊</Typography>
                      <Slider min={0} max={100} value={config.shadowBlur} onChange={(_, v) => updateConfig({ shadowBlur: v as number })} />
                    </Box>
                  </>
                )}

                {selectedElement === 'log' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Typography variant="body2" color="text.secondary" mb={1}>导出日志</Typography>
                    <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'rgba(0,0,0,0.2)', p: 1, borderRadius: 1 }}>
                      {logs.map((log, index) => (
                        <Typography key={index} variant="caption" display="block" color={log.type === 'error' ? 'error.main' : 'text.primary'} sx={{ mb: 0.5, wordBreak: 'break-all' }}>
                          <span style={{ opacity: 0.5, marginRight: 4 }}>[{log.time}]</span>
                          {log.message}
                        </Typography>
                      ))}
                      {logs.length === 0 && (
                        <Typography variant="caption" color="text.secondary">暂无日志</Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </Stack>
            </Box>
          </Paper>

          {/* Center Panel: Preview */}
          <Paper sx={{ p: 0, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'black', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <Box ref={previewHostRef} sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, overflow: 'hidden' }}>
              <Box
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={finishPreviewPointerInteraction}
                onPointerCancel={finishPreviewPointerInteraction}
                onWheel={handlePreviewWheel}
                sx={{
                  width: aspectRatio >= 1 ? '100%' : 'auto',
                  height: aspectRatio >= 1 ? 'auto' : '100%',
                  aspectRatio: `${aspectRatio}`,
                  maxHeight: '100%',
                  maxWidth: '100%',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  position: 'relative',
                  transform: `scale(${previewScale / 100})`,
                  transformOrigin: 'center center',
                  touchAction: 'none',
                  cursor: isCustomFocusSelected ? (previewDragging ? 'grabbing' : 'crosshair') : 'default'
                }}
              >
                <canvas
                  ref={(node) => {
                    previewCanvasRef.current = node;
                    if (!exportingRef.current) {
                      canvasRef.current = node;
                    }
                  }}
                  style={{ width: '100%', height: '100%', display: 'block', borderRadius: 8 }}
                />

                {isCustomFocusSelected && (
                  <Box sx={{ position: 'absolute', left: 12, top: 12, px: 1.2, py: 0.8, borderRadius: 1.2, bgcolor: 'rgba(15,23,42,0.78)', border: '1px solid rgba(96,165,250,0.35)', pointerEvents: 'none', zIndex: 9 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#bfdbfe', fontWeight: 600 }}>
                      自定义放大：拖拽调整中心点，滚轮调整比例
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'rgba(226,232,240,0.92)', fontFamily: 'monospace' }}>
                      X {(selectedBlock.customCenterX ?? DEFAULT_CUSTOM_FOCUS_CENTER).toFixed(3)} · Y {(selectedBlock.customCenterY ?? DEFAULT_CUSTOM_FOCUS_CENTER).toFixed(3)} · Z {(selectedBlock.zoomScale ?? 1).toFixed(2)}
                    </Typography>
                  </Box>
                )}

                {mediaLoading && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
                    <Stack spacing={2} alignItems="center">
                      <CircularProgress />
                      <Typography>素材加载中...</Typography>
                    </Stack>
                  </Box>
                )}

                {error && !mediaLoading && (
                  <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, bgcolor: 'rgba(220, 38, 38, 0.9)', p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                    <Typography color="white" variant="body2">{error}</Typography>
                    <Button size="small" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', minWidth: 60 }} variant="outlined" onClick={() => setError('')}>关闭</Button>
                  </Box>
                )}

                {exporting && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.85)', px: 4 }}>
                    <Typography variant="h6" mb={2}>{exportMessage}</Typography>
                    <LinearProgress variant="determinate" value={exportProgress} sx={{ width: '100%', height: 10, borderRadius: 5 }} />
                    <Typography variant="body2" mt={1}>{Math.round(exportProgress)}%</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Playback Controls Overlay */}
            <Box sx={{ px: 1.5, py: 1, bgcolor: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'center', gap: 1.4, minWidth: 0 }}>
              <IconButton color="primary" onClick={handlePlayToggle} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                {playing ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {formatDuration(playhead)} / {formatDuration(totalDurationSec)}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Box sx={{ width: 180, display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                <VolumeUpIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Slider
                  size="small"
                  min={0}
                  max={200}
                  step={1}
                  value={systemVolume}
                  onChange={(_, v) => setSystemVolume(v as number)}
                  sx={{ minWidth: 0 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 34, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {systemVolume}%
                </Typography>
              </Box>
              <Box sx={{ width: 180, display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                <MicIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Slider
                  size="small"
                  min={0}
                  max={200}
                  step={1}
                  value={micVolume}
                  onChange={(_, v) => setMicVolume(v as number)}
                  sx={{ minWidth: 0 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 34, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {micVolume}%
                </Typography>
              </Box>
              <Box sx={{ width: 220, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Tooltip title={`预览比例 ${previewScale}%`}>
                  <VisibilityIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </Tooltip>
                <Slider
                  size="small"
                  min={25}
                  max={200}
                  step={1}
                  value={previewScale}
                  onChange={(_, v) => setPreviewScale(v as number)}
                  sx={{ minWidth: 0 }}
                />
              </Box>
              <Typography variant="caption" color={previewFps >= 30 ? '#4ade80' : '#facc15'} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                FPS: {previewFps} {previewFps >= 30 ? '(流畅)' : ''}
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 1.5, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" textTransform="uppercase">编辑面板</Typography>
              <RadioGroup
                value={panelBlockType}
                onChange={(_, value) => setPanelBlockType(value as EditBlockType)}
                row
                sx={{ minHeight: 32, flexWrap: 'nowrap' }}
              >
                <FormControlLabel value="cut" control={<Radio size="small" sx={{ p: 0.5 }} />} label={<Typography variant="body2">裁切</Typography>} sx={{ mr: 1, whiteSpace: 'nowrap' }} />
                <FormControlLabel value="focus" control={<Radio size="small" sx={{ p: 0.5 }} />} label={<Typography variant="body2">着重</Typography>} sx={{ mr: 0, whiteSpace: 'nowrap' }} />
              </RadioGroup>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
              {selectedBlock ? (
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      label="开始(秒)"
                      type="number"
                      value={formatTwoDecimals(selectedBlock.startSec)}
                      onChange={(e) => {
                        const value = parseInputNumber(e.target.value);
                        if (value === null) return;
                        updateSelectedBlockStart(value);
                      }}
                    />
                    <TextField
                      size="small"
                      fullWidth
                      label="结束(秒)"
                      type="number"
                      value={formatTwoDecimals(selectedBlock.endSec)}
                      onChange={(e) => {
                        const value = parseInputNumber(e.target.value);
                        if (value === null) return;
                        updateSelectedBlockEnd(value);
                      }}
                    />
                  </Stack>
                  <TextField
                    size="small"
                    label="时长(秒)"
                    type="number"
                    value={formatTwoDecimals(selectedBlock.endSec - selectedBlock.startSec)}
                    onChange={(e) => {
                      const value = parseInputNumber(e.target.value);
                      if (value === null) return;
                      updateSelectedBlockDuration(value);
                    }}
                  />
                {selectedBlock.type === 'focus' && (
                  <>
                    <FormControl component="fieldset" size="small">
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>放大模式</FormLabel>
                      <Stack direction="row" spacing={1}>
                        {[
                          { value: 'follow', label: '跟随鼠标' },
                          { value: 'fixed', label: '固定画面' },
                          { value: 'custom', label: '自定义' }
                        ].map((option) => {
                          const selected = (selectedBlock.zoomMode || 'fixed') === option.value;
                          return (
                            <Button
                              key={option.value}
                              size="small"
                              variant={selected ? 'contained' : 'outlined'}
                              onClick={() => {
                                const zoomMode = resolveFocusZoomMode(option.value);
                                updateTimelineBlock(selectedBlock.id, block => {
                                  if (block.type !== 'focus') return block;
                                  return {
                                    ...block,
                                    zoomMode,
                                    zoomScale: zoomMode === 'follow'
                                      ? clamp(block.zoomScale, 1, MAX_FOLLOW_FOCUS_ZOOM_SCALE)
                                      : clamp(block.zoomScale, 1, MAX_CUSTOM_FOCUS_ZOOM_SCALE),
                                    customCenterX: block.customCenterX ?? DEFAULT_CUSTOM_FOCUS_CENTER,
                                    customCenterY: block.customCenterY ?? DEFAULT_CUSTOM_FOCUS_CENTER
                                  };
                                });
                              }}
                              sx={{
                                minWidth: 0,
                                px: 1.4,
                                borderRadius: 999,
                                textTransform: 'none',
                                whiteSpace: 'nowrap',
                                color: selected ? '#0f172a' : 'rgba(255,255,255,0.88)',
                                bgcolor: selected ? '#93c5fd' : 'transparent',
                                borderColor: 'rgba(148,163,184,0.35)',
                                boxShadow: 'none',
                                '&:hover': {
                                  borderColor: selected ? '#93c5fd' : 'rgba(148,163,184,0.55)',
                                  bgcolor: selected ? '#93c5fd' : 'rgba(255,255,255,0.06)',
                                  boxShadow: 'none'
                                }
                              }}
                            >
                              {option.label}
                            </Button>
                          );
                        })}
                      </Stack>
                    </FormControl>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                      <FormControlLabel
                        control={(
                          <Switch
                            size="small"
                            checked={selectedBlock.breakoutScreenBounds ?? DEFAULT_FOCUS_BREAKOUT_SCREEN_BOUNDS}
                            onChange={(_, checked) => {
                              updateTimelineBlock(
                                selectedBlock.id,
                                block => (block.type === 'focus' ? { ...block, breakoutScreenBounds: checked } : block)
                              );
                            }}
                          />
                        )}
                        label={<Typography variant="body2">画面突破边界</Typography>}
                      />
                      <FormControlLabel
                        control={(
                          <Switch
                            size="small"
                            checked={selectedBlock.hideCamera ?? false}
                            onChange={(_, checked) => {
                              updateTimelineBlock(
                                selectedBlock.id,
                                block => (block.type === 'focus' ? { ...block, hideCamera: checked } : block)
                              );
                            }}
                          />
                        )}
                        label={<Typography variant="body2">隐藏摄像头</Typography>}
                      />
                    </Stack>
                    {!(selectedBlock.hideCamera ?? false) && (
                      <TextField
                        size="small"
                        label="摄像头变化比例"
                        type="number"
                        inputProps={{ min: 0.1, max: 2, step: 0.1 }}
                        value={selectedBlock.cameraZoomScale}
                        onChange={(e) => {
                          const value = parseInputNumber(e.target.value);
                          if (value === null) return;
                          const cameraZoomScale = clamp(value, 0.1, 2);
                          updateTimelineBlock(selectedBlock.id, block => (block.type === 'focus' ? { ...block, cameraZoomScale } : block));
                        }}
                      />
                    )}
                    <TextField
                      size="small"
                      label="放大比例"
                      type="number"
                      disabled={selectedBlock.zoomMode === 'fixed'}
                      inputProps={{
                        min: 1,
                        max: selectedBlock.zoomMode === 'custom' ? MAX_CUSTOM_FOCUS_ZOOM_SCALE : MAX_FOLLOW_FOCUS_ZOOM_SCALE,
                        step: 0.1
                      }}
                      value={selectedBlock.zoomScale}
                      onChange={(e) => {
                        const value = parseInputNumber(e.target.value);
                        if (value === null) return;
                        const zoomScale = clamp(
                          value,
                          1,
                          selectedBlock.zoomMode === 'custom' ? MAX_CUSTOM_FOCUS_ZOOM_SCALE : MAX_FOLLOW_FOCUS_ZOOM_SCALE
                        );
                        updateTimelineBlock(selectedBlock.id, block => (block.type === 'focus' ? { ...block, zoomScale } : block));
                      }}
                    />
                    {selectedBlock.zoomMode === 'fixed' && (
                      <TextField
                        size="small"
                        label="边距参数"
                        type="number"
                        inputProps={{ min: 0, step: 10 }}
                        value={selectedBlock.fixedMargin ?? 60}
                        onChange={(e) => {
                          const fixedMargin = Math.max(0, Number(e.target.value) || 0);
                          updateTimelineBlock(selectedBlock.id, block => (block.type === 'focus' ? { ...block, fixedMargin } : block));
                        }}
                      />
                    )}
                    {selectedBlock.zoomMode === 'custom' && (
                      <>
                        <Stack direction="row" spacing={1}>
                          <TextField
                            size="small"
                            fullWidth
                            label="中心点 X"
                            type="number"
                            inputProps={{ min: 0, max: 1, step: 0.001 }}
                            value={selectedBlock.customCenterX ?? DEFAULT_CUSTOM_FOCUS_CENTER}
                            onChange={(e) => {
                              const value = parseInputNumber(e.target.value);
                              if (value === null) return;
                              updateTimelineBlock(selectedBlock.id, block => (
                                block.type === 'focus' ? { ...block, customCenterX: clamp(value, 0, 1) } : block
                              ));
                            }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            label="中心点 Y"
                            type="number"
                            inputProps={{ min: 0, max: 1, step: 0.001 }}
                            value={selectedBlock.customCenterY ?? DEFAULT_CUSTOM_FOCUS_CENTER}
                            onChange={(e) => {
                              const value = parseInputNumber(e.target.value);
                              if (value === null) return;
                              updateTimelineBlock(selectedBlock.id, block => (
                                block.type === 'focus' ? { ...block, customCenterY: clamp(value, 0, 1) } : block
                              ));
                            }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          可在左侧预览区域拖拽调整中心点，并使用鼠标滚轮微调放大比例。
                        </Typography>
                      </>
                    )}
                    <TextField
                      size="small"
                      label="过渡时长(秒)"
                      type="number"
                      inputProps={{ min: 0, max: 2, step: 0.1 }}
                      value={selectedBlock.transitionDurationSec}
                      onChange={(e) => {
                        const value = parseInputNumber(e.target.value);
                        if (value === null) return;
                        const transitionDurationSec = clamp(value, 0, 2);
                        updateTimelineBlock(selectedBlock.id, block => (block.type === 'focus' ? { ...block, transitionDurationSec } : block));
                      }}
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel id="focus-transition-curve-label">过渡曲线</InputLabel>
                      <Select
                        labelId="focus-transition-curve-label"
                        label="过渡曲线"
                        value={selectedBlock.transitionCurve}
                        onChange={(e) => {
                          const transitionCurve = e.target.value as TransitionCurveType;
                          updateTimelineBlock(selectedBlock.id, block => (block.type === 'focus' ? { ...block, transitionCurve } : block));
                        }}
                      >
                        {FOCUS_CURVE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value} sx={{ display: 'flex', alignItems: 'center' }}>
                            <CurveIcon type={option.value} />
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl component="fieldset" size="small">
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>3D变换</FormLabel>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.8 }}>
                        {FOCUS_3D_ANCHOR_OPTIONS.map((option) => {
                          const selected = (selectedBlock.transform3dAnchor ?? 'none') === option.value;
                          return (
                            <ToggleButton
                              key={option.value}
                              value={option.value}
                              selected={selected}
                              onClick={() => {
                                updateTimelineBlock(
                                  selectedBlock.id,
                                  block => (block.type === 'focus' ? { ...block, transform3dAnchor: option.value } : block)
                                );
                              }}
                              sx={{
                                minHeight: 34,
                                px: 0.6,
                                py: 0.4,
                                borderColor: 'rgba(148,163,184,0.35)',
                                color: selected ? '#93c5fd' : 'text.secondary',
                                justifyContent: 'center',
                                gap: 0.5,
                                '&.Mui-selected': {
                                  bgcolor: 'rgba(37,99,235,0.24)',
                                  borderColor: 'rgba(96,165,250,0.7)',
                                  color: '#bfdbfe'
                                }
                              }}
                            >
                              <Focus3DAnchorIcon grid={option.grid} />
                              <Typography variant="caption" sx={{ fontSize: 10.5 }}>{option.label}</Typography>
                            </ToggleButton>
                          );
                        })}
                      </Box>
                    </FormControl>
                    {(selectedBlock.transform3dAnchor ?? 'none') !== 'none' && (
                      <TextField
                        size="small"
                        label="3D强度(z轴角度)"
                        type="number"
                        inputProps={{ min: 1, max: 75, step: 1 }}
                        value={selectedBlock.transform3dStrength ?? 18}
                        onChange={(e) => {
                          const value = parseInputNumber(e.target.value);
                          if (value === null) return;
                          const transform3dStrength = clamp(value, 1, 75);
                          updateTimelineBlock(
                            selectedBlock.id,
                            block => (block.type === 'focus' ? { ...block, transform3dStrength } : block)
                          );
                        }}
                      />
                    )}
                  </>
                )}
                {selectedBlock.type === 'cut' && (
                  <>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="cut-transition-type-label">过渡效果</InputLabel>
                      <Select
                        labelId="cut-transition-type-label"
                        label="过渡效果"
                        value={selectedBlock.transitionType}
                        onChange={(e) => {
                          const transitionType = e.target.value as CutTransitionType;
                          updateTimelineBlock(selectedBlock.id, block => (
                            block.type === 'cut'
                              ? { ...block, transitionType }
                              : block
                          ));
                        }}
                      >
                        {CUT_TRANSITION_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="过渡时长(秒)"
                      type="number"
                      inputProps={{ min: 0, max: MAX_CUT_TRANSITION_DURATION_SEC, step: 0.05 }}
                      value={selectedBlock.transitionDurationSec}
                      disabled={selectedBlock.transitionType === 'none'}
                      onChange={(e) => {
                        const value = parseInputNumber(e.target.value);
                        if (value === null) return;
                        const nextDuration = clamp(
                          value,
                          0,
                          MAX_CUT_TRANSITION_DURATION_SEC
                        );
                        updateTimelineBlock(selectedBlock.id, block => (
                          block.type === 'cut'
                            ? { ...block, transitionDurationSec: nextDuration }
                            : block
                        ));
                      }}
                    />
                  </>
                )}
                  <Button color="error" variant="outlined" onClick={deleteSelectedBlock}>删除当前块</Button>
                </Stack>
              ) : (
                <Box sx={{ height: '100%', borderRadius: 1, border: '1px dashed rgba(148,163,184,0.35)', display: 'grid', placeItems: 'center', color: 'text.disabled', fontSize: 13 }}>
                  点击下方编辑轨道中的块后可编辑参数
                </Box>
              )}
            </Box>
          </Paper>
        </Box>

        <Paper sx={{ height: 180, minHeight: 160, p: 1.5, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" color="text.secondary">时间轨道 (Timeline)</Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip
                title={(
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      裁切
                    </Typography>
                    <Typography variant="body2">
                      被标注的部分将被裁切掉，不会播放。
                    </Typography>
                  </Box>
                )}
              >
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<ContentCutIcon />}
                  onClick={() => addTimelineBlock('cut')}
                  sx={{
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 999,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: 'rgba(239,68,68,0.18)',
                    color: '#fca5a5',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: 'rgba(239,68,68,0.28)',
                      boxShadow: 'none'
                    }
                  }}
                >
                  裁切
                </Button>
              </Tooltip>
              <Tooltip
                title={(
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      放大着重
                    </Typography>
                    <Typography variant="body2">
                      被标注的部分会进行放大。
                    </Typography>
                  </Box>
                )}
              >
                <Button
                  color="primary"
                  variant="contained"
                  startIcon={<CenterFocusStrongIcon />}
                  onClick={() => addTimelineBlock('focus')}
                  sx={{
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 999,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: 'rgba(34,197,94,0.18)',
                    color: '#86efac',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: 'rgba(34,197,94,0.28)',
                      boxShadow: 'none'
                    }
                  }}
                >
                  放大着重
                </Button>
              </Tooltip>
              <Tooltip title="放大轨道">
                <IconButton onClick={() => setTimelineZoom(prev => clamp(prev + 0.25, 1, 4))} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }}>
                  <ZoomInIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="缩小轨道">
                <IconButton onClick={() => setTimelineZoom(prev => clamp(prev - 0.25, 1, 4))} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }}>
                  <ZoomOutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Box 
              ref={timelineScrollContainerRef}
              sx={{ height: '100%', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1, p: 1, overflow: 'auto' }}
            >
              <Box
                ref={timelineTrackRef}
                onClick={handleTimelineTrackClick}
                sx={{
                  width: `${Math.max(100, timelineZoom * 100)}%`,
                  minWidth: '100%',
                  minHeight: 20,
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                <Stack spacing={1}>

                  <Box sx={{ height: 54, bgcolor: 'rgba(15,23,42,0.9)', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
                    <Typography variant="caption" sx={{ position: 'absolute', left: 10, top: 4, opacity: 0.6 }}>编辑轨道</Typography>
                    {timelineBlocks.map((block) => {
                      const duration = totalDurationSec || 1;
                      const leftPercent = (block.startSec / duration) * 100;
                      const widthPercent = ((block.endSec - block.startSec) / duration) * 100;
                      const selected = selectedBlockId === block.id;
                      const isCut = block.type === 'cut';
                      const hasTransition = isCut && block.transitionType !== 'none' && block.transitionDurationSec > 0;
                      return (
                        <Box
                          key={block.id}
                          onMouseDown={(event) => handleBlockMouseDown(event, block.id, 'move')}
                          onClick={(event) => event.stopPropagation()}
                          sx={{
                            position: 'absolute',
                            left: `${leftPercent}%`,
                            width: `${Math.max(widthPercent, 0.6)}%`,
                            top: 20,
                            height: 30,
                            borderRadius: 0.8,
                            bgcolor: isCut ? 'rgba(239,68,68,0.8)' : 'rgba(37,99,235,0.8)',
                            border: selected ? '2px solid #f8fafc' : '1px solid rgba(255,255,255,0.55)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 600,
                            userSelect: 'none',
                            cursor: blockDragState ? 'grabbing' : 'grab'
                          }}
                        >
                          {isCut ? '裁切' : '着重'}
                          <Box
                            onMouseDown={(event) => handleBlockMouseDown(event, block.id, 'resize-left')}
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              cursor: 'ew-resize',
                              bgcolor: hasTransition ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.25)',
                              borderRight: hasTransition ? '1px dashed rgba(15,23,42,0.65)' : 'none'
                            }}
                          />
                          <Box
                            onMouseDown={(event) => handleBlockMouseDown(event, block.id, 'resize-right')}
                            sx={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              cursor: 'ew-resize',
                              bgcolor: hasTransition ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.25)',
                              borderLeft: hasTransition ? '1px solid rgba(255,255,255,0.9)' : 'none'
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Stack>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: '#ef4444',
                    left: `${(playhead / (totalDurationSec || 1)) * 100}%`,
                    zIndex: 20,
                    pointerEvents: 'none'
                  }}
                />
              </Box>
            </Box>
          </Box>
          <Slider
            min={0}
            max={totalDurationSec || 100}
            step={0.05}
            value={playhead}
            onChange={(_, v) => {
              const nextTime = v as number;
              handleSeek(nextTime);
              syncSelectedBlockWithTime(nextTime);
            }}
            sx={{ mt: 0.5, '& .MuiSlider-thumb': { bgcolor: '#ef4444' } }}
          />
        </Paper>

      </Box>

      {/* Hidden Videos for Canvas source */}
      <video
        ref={screenVideoRef}
        src={toFileUrl(record.screenVideoPath)}
        preload="auto"
        loop
        style={{ display: 'none' }}
        onLoadedData={checkMediaReady}
        onCanPlay={checkMediaReady}
        onLoadedMetadata={handleMetadata}
        onError={handleError}
        onPlaying={handleScreenPlaying}
        onSeeked={() => {
          if (!playingRef.current) requestAnimationFrame(renderFrame);
        }}
      />
      <video
        ref={cameraVideoRef}
        src={toFileUrl(record.cameraVideoPath)}
        preload="auto"
        loop
        muted
        style={{ display: 'none' }}
        onLoadedData={checkMediaReady}
        onCanPlay={checkMediaReady}
        onError={handleError}
        onSeeked={() => {
          if (!playingRef.current) requestAnimationFrame(renderFrame);
        }}
      />
      <audio
        ref={micAudioRef}
        src={toFileUrl(record.micAudioPath)}
        preload="auto"
        loop
        style={{ display: 'none' }}
        onLoadedData={checkMediaReady}
        onCanPlay={checkMediaReady}
        onError={() => {
          setMediaLoading(false);
          setError('音频资源加载失败，请检查麦克风文件是否存在');
        }}
      />
    </Box>
  );
};

export default HistoryDetail;
