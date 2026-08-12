"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import Konva from "konva";
import { Check, Eraser, Minus, PenLine, RotateCcw } from "lucide-react";
import { createId } from "@/lib/ids";
import { eraseStrokesAt, getInkPath } from "@/lib/ink";
import { getFontFamilyCss } from "@/lib/fonts";
import { traceImageShape } from "@/lib/image-style";
import { useBookStore } from "@/store/book-store";
import type {
  ImageElement,
  InkElement,
  InkPoint,
  InkStroke,
  PatternElement,
  SceneElement,
  ScenePage,
} from "@/types/book";

interface CanvasStageProps {
  page?: ScenePage;
  readOnly?: boolean;
  maxHeight?: number;
  className?: string;
  onImageFocus?: (element: ImageElement) => void;
}

function useCanvasImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.onerror = () => setImage(null);
    next.src = src;
    return () => {
      next.onload = null;
      next.onerror = null;
    };
  }, [src]);
  return image;
}

function ImageNode({ element, draggable }: { element: ImageElement; draggable: boolean }) {
  const image = useCanvasImage(element.src);
  const imageRef = useRef<Konva.Image>(null);
  const ratio = image ? image.width / image.height : 1;
  const frameRatio = element.width / element.height;
  let drawWidth = element.width;
  let drawHeight = element.height;
  let drawX = 0;
  let drawY = 0;
  let crop;

  if (image && element.fit === "contain") {
    if (ratio > frameRatio) {
      drawHeight = element.width / ratio;
      drawY = (element.height - drawHeight) / 2;
    } else {
      drawWidth = element.height * ratio;
      drawX = (element.width - drawWidth) / 2;
    }
  } else if (image && element.fit === "cover") {
    if (ratio > frameRatio) {
      const cropWidth = image.height * frameRatio;
      crop = { x: (image.width - cropWidth) / 2, y: 0, width: cropWidth, height: image.height };
    } else {
      const cropHeight = image.width / frameRatio;
      crop = { x: 0, y: (image.height - cropHeight) / 2, width: image.width, height: cropHeight };
    }
  }

  const filters = useMemo(() => {
    if (element.filter === "grayscale") return [Konva.Filters.Grayscale];
    if (element.filter === "sepia") return [Konva.Filters.Sepia];
    if (element.filter === "blur") return [Konva.Filters.Blur];
    if (element.filter === "contrast") return [Konva.Filters.Contrast];
    return [];
  }, [element.filter]);

  useEffect(() => {
    const node = imageRef.current;
    if (!node || !image) return;
    if (filters.length) node.cache({ pixelRatio: 1 });
    else node.clearCache();
    node.getLayer()?.batchDraw();
  }, [element.height, element.width, filters, image]);

  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={draggable}
      clipFunc={(context) => traceImageShape(context, element.shape, element.width, element.height)}
    >
      <Rect width={element.width} height={element.height} fill="#f1f1ef" />
      {image ? (
        <KonvaImage
          ref={imageRef}
          image={image}
          x={drawX}
          y={drawY}
          width={drawWidth}
          height={drawHeight}
          crop={crop}
          filters={filters}
          blurRadius={element.filter === "blur" ? 12 : 0}
          contrast={element.filter === "contrast" ? 24 : 0}
        />
      ) : (
        <Text
          width={element.width}
          height={element.height}
          text="正在载入照片"
          fill="#8a8a86"
          align="center"
          verticalAlign="middle"
          fontSize={24}
        />
      )}
      <Rect width={element.width} height={element.height} fill="transparent" />
    </Group>
  );
}

function PatternNode({ element, draggable }: { element: PatternElement; draggable: boolean }) {
  const gap = Math.max(14, element.spacing * element.scale);
  const nodes: React.ReactNode[] = [];
  const columns = Math.min(28, Math.ceil(element.width / gap) + 1);
  const rows = Math.min(28, Math.ceil(element.height / gap) + 1);

  if (element.pattern === "dots") {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        nodes.push(
          <Circle key={`${row}-${column}`} x={column * gap} y={row * gap} radius={gap * 0.12} fill={element.foreground} />,
        );
      }
    }
  }
  if (element.pattern === "grid") {
    for (let column = 0; column < columns; column += 1) {
      nodes.push(<Line key={`v-${column}`} points={[column * gap, 0, column * gap, element.height]} stroke={element.foreground} strokeWidth={1.5} />);
    }
    for (let row = 0; row < rows; row += 1) {
      nodes.push(<Line key={`h-${row}`} points={[0, row * gap, element.width, row * gap]} stroke={element.foreground} strokeWidth={1.5} />);
    }
  }
  if (element.pattern === "stripes") {
    for (let column = -rows; column < columns; column += 1) {
      nodes.push(<Line key={column} points={[column * gap, element.height, column * gap + element.height, 0]} stroke={element.foreground} strokeWidth={Math.max(3, gap * 0.16)} />);
    }
  }
  if (element.pattern === "checker") {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((row + column) % 2 === 0) nodes.push(<Rect key={`${row}-${column}`} x={column * gap} y={row * gap} width={gap} height={gap} fill={element.foreground} />);
      }
    }
  }
  if (element.pattern === "waves") {
    for (let row = 0; row < rows; row += 1) {
      const points: number[] = [];
      for (let x = 0; x <= element.width + gap; x += gap / 2) {
        points.push(x, row * gap + Math.sin((x / gap) * Math.PI) * gap * 0.18);
      }
      nodes.push(<Line key={row} points={points} stroke={element.foreground} strokeWidth={2.5} tension={0.45} />);
    }
  }
  if (element.pattern === "frame") {
    nodes.push(<Rect key="frame" x={2} y={2} width={element.width - 4} height={element.height - 4} stroke={element.foreground} strokeWidth={3} />);
  }

  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={draggable}
      clipX={0}
      clipY={0}
      clipWidth={element.width}
      clipHeight={element.height}
    >
      <Rect width={element.width} height={element.height} fill={element.background === "transparent" ? "rgba(255,255,255,0.001)" : element.background} />
      {nodes}
      <Rect width={element.width} height={element.height} fill="transparent" />
    </Group>
  );
}

function InkNode({ element, draggable }: { element: InkElement; draggable: boolean }) {
  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={draggable}
    >
      {element.strokes.map((stroke) => (
        <Path key={stroke.id} data={getInkPath(stroke.points, stroke.size)} fill={stroke.color} opacity={stroke.opacity} listening={false} />
      ))}
      <Rect width={element.width} height={element.height} fill="rgba(255,255,255,0.001)" />
    </Group>
  );
}

export default function CanvasStage({ page: pageOverride, readOnly = false, maxHeight = 760, className, onImageFocus }: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [container, setContainer] = useState<{ width: number; height: number } | null>(null);
  const [inkMode, setInkMode] = useState<"pen" | "eraser">("pen");
  const [inkColor, setInkColor] = useState("#111111");
  const [inkSize, setInkSize] = useState(12);
  const [draftStrokes, setDraftStrokes] = useState<InkStroke[]>([]);
  const drawingRef = useRef(false);

  const { book, activePageId, selectedElementId, tool, selectElement, updateElement, addInk, setTool } = useBookStore();
  const page = pageOverride ?? book.document.pages.find((item) => item.id === activePageId) ?? book.document.pages[0];
  const selected = page.elements.find((element) => element.id === selectedElementId);
  const measuredContainer = container ?? { width: 320, height: Math.min(maxHeight, 480) };
  const scale = Math.min((measuredContainer.width - 4) / page.width, (measuredContainer.height - 4) / page.height);
  const stageWidth = Math.max(120, page.width * scale);
  const stageHeight = Math.max(120, page.height * scale);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainer({ width: entry.contentRect.width, height: Math.min(maxHeight, Math.max(300, entry.contentRect.height || maxHeight)) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [maxHeight]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage || readOnly || tool !== "select" || !selectedElementId) {
      transformer?.nodes([]);
      return;
    }
    const node = stage.findOne(`#${selectedElementId}`);
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedElementId, page.elements, readOnly, tool]);

  useEffect(() => {
    if (tool !== "ink") setDraftStrokes([]);
  }, [tool]);

  useEffect(() => {
    layerRef.current?.draw();
  }, [page.id, page.elements, stageHeight, stageWidth]);

  const updateFromNode = (element: SceneElement, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateElement(
      element.id,
      {
        x: node.x(),
        y: node.y(),
        width: Math.max(24, element.width * scaleX),
        height: Math.max(24, element.height * scaleY),
        rotation: node.rotation(),
      } as Partial<SceneElement>,
      true,
    );
  };

  const pagePoint = () => {
    const point = stageRef.current?.getPointerPosition();
    return point ? { x: point.x / scale, y: point.y / scale } : null;
  };

  const handlePointerDown = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (readOnly) return;
    if (tool !== "ink") {
      if (event.target === event.target.getStage()) selectElement(null);
      return;
    }
    const point = pagePoint();
    if (!point) return;
    drawingRef.current = true;
    if (inkMode === "eraser") {
      setDraftStrokes((strokes) => eraseStrokesAt(strokes, point.x, point.y, inkSize * 2.4));
      return;
    }
    const pressure = event.evt.pressure > 0 ? event.evt.pressure : 0.5;
    setDraftStrokes((strokes) => [
      ...strokes,
      { id: createId("stroke"), color: inkColor, size: inkSize, opacity: 1, points: [{ ...point, pressure }] },
    ]);
  };

  const handlePointerMove = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (!drawingRef.current || tool !== "ink") return;
    const point = pagePoint();
    if (!point) return;
    if (inkMode === "eraser") {
      setDraftStrokes((strokes) => eraseStrokesAt(strokes, point.x, point.y, inkSize * 2.4));
      return;
    }
    const pressure = event.evt.pressure > 0 ? event.evt.pressure : 0.5;
    setDraftStrokes((strokes) => {
      const next = strokes.slice();
      const current = next.at(-1);
      if (!current) return strokes;
      next[next.length - 1] = { ...current, points: [...current.points, { ...point, pressure }] };
      return next;
    });
  };

  const finishInk = () => {
    const allPoints = draftStrokes.flatMap((stroke) => stroke.points);
    if (!allPoints.length) {
      setTool("select");
      return;
    }
    const padding = Math.max(inkSize * 2, 20);
    const minX = Math.max(0, Math.min(...allPoints.map((point) => point.x)) - padding);
    const minY = Math.max(0, Math.min(...allPoints.map((point) => point.y)) - padding);
    const maxX = Math.min(page.width, Math.max(...allPoints.map((point) => point.x)) + padding);
    const maxY = Math.min(page.height, Math.max(...allPoints.map((point) => point.y)) + padding);
    addInk({
      id: createId("ink"),
      type: "ink",
      x: minX,
      y: minY,
      width: Math.max(30, maxX - minX),
      height: Math.max(30, maxY - minY),
      rotation: 0,
      opacity: 1,
      strokes: draftStrokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ ...point, x: point.x - minX, y: point.y - minY })),
      })),
    });
    setDraftStrokes([]);
    setTool("select");
  };

  const renderedElements = useMemo(
    () =>
      page.elements.map((element) => {
        if (element.type === "image") return <ImageNode key={element.id} element={element} draggable={!readOnly} />;
        if (element.type === "pattern") return <PatternNode key={element.id} element={element} draggable={!readOnly} />;
        if (element.type === "ink") return <InkNode key={element.id} element={element} draggable={!readOnly} />;
        return (
          <Text
            key={element.id}
            id={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rotation={element.rotation}
            opacity={element.opacity}
            text={element.text}
            fontSize={element.fontSize}
            fontFamily={getFontFamilyCss(element.fontFamily)}
            fontStyle={element.fontWeight >= 600 ? "bold" : "normal"}
            fill={element.color}
            align={element.align}
            lineHeight={element.lineHeight}
            verticalAlign="top"
            draggable={!readOnly}
          />
        );
      }),
    [page.elements, readOnly],
  );

  return (
    <div ref={containerRef} className={`canvas-stage-shell ${className ?? ""}`} data-testid="canvas-shell">
      {container ? <div className="canvas-stage-frame" style={{ width: stageWidth, height: stageHeight }}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { drawingRef.current = false; }}
          onPointerLeave={() => { drawingRef.current = false; }}
        >
          <Layer ref={layerRef}>
            <Rect width={page.width} height={page.height} fill="#ffffff" listening={!readOnly} />
            <Group
              onClick={(event) => {
                const id = event.target.findAncestor("Group")?.id() || event.target.id();
                if (readOnly) {
                  const image = page.elements.find((element): element is ImageElement => element.id === id && element.type === "image" && !element.decorative);
                  if (image) onImageFocus?.(image);
                  return;
                }
                if (tool !== "select") return;
                if (id) selectElement(id);
              }}
              onTap={(event) => {
                const id = event.target.findAncestor("Group")?.id() || event.target.id();
                if (readOnly) {
                  const image = page.elements.find((element): element is ImageElement => element.id === id && element.type === "image" && !element.decorative);
                  if (image) onImageFocus?.(image);
                  return;
                }
                if (tool !== "select") return;
                if (id) selectElement(id);
              }}
              onDblClick={(event) => {
                if (!onImageFocus) return;
                const id = event.target.findAncestor("Group")?.id() || event.target.id();
                const image = page.elements.find((element): element is ImageElement => element.id === id && element.type === "image");
                if (image) onImageFocus(image);
              }}
              onDragEnd={(event) => {
                const element = page.elements.find((item) => item.id === event.target.id());
                if (element) updateElement(element.id, { x: event.target.x(), y: event.target.y() } as Partial<SceneElement>, true);
              }}
              onTransformEnd={(event) => {
                const element = page.elements.find((item) => item.id === event.target.id());
                if (element) updateFromNode(element, event.target);
              }}
            >
              {renderedElements}
            </Group>
            {tool === "ink" && draftStrokes.map((stroke) => (
              <Path key={stroke.id} data={getInkPath(stroke.points, stroke.size)} fill={stroke.color} opacity={stroke.opacity} listening={false} />
            ))}
            {!readOnly && tool === "select" && selected && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={selected.type === "image" || selected.type === "ink"}
                anchorSize={16 / scale}
                anchorCornerRadius={8 / scale}
                borderStroke="#2563eb"
                borderStrokeWidth={2 / scale}
                anchorFill="#ffffff"
                anchorStroke="#2563eb"
                anchorStrokeWidth={2 / scale}
                boundBoxFunc={(oldBox, newBox) => newBox.width < 24 || newBox.height < 24 ? oldBox : newBox}
              />
            )}
          </Layer>
        </Stage>
      </div> : <div className="canvas-loading">正在准备白页</div>}
      {tool === "ink" && !readOnly && (
        <div className="ink-toolbar" role="toolbar" aria-label="手写工具">
          <button className={inkMode === "pen" ? "active" : ""} onClick={() => setInkMode("pen")} title="画笔"><PenLine size={17} /></button>
          <button className={inkMode === "eraser" ? "active" : ""} onClick={() => setInkMode("eraser")} title="橡皮擦"><Eraser size={17} /></button>
          <input type="color" value={inkColor} onChange={(event) => setInkColor(event.target.value)} aria-label="笔迹颜色" />
          <Minus size={16} />
          <input type="range" min="3" max="36" value={inkSize} onChange={(event) => setInkSize(Number(event.target.value))} aria-label="笔迹粗细" />
          <button onClick={() => setDraftStrokes((strokes) => strokes.slice(0, -1))} disabled={!draftStrokes.length} title="撤销笔画"><RotateCcw size={17} /></button>
          <button className="done" onClick={finishInk} title="完成手写"><Check size={17} />完成</button>
        </div>
      )}
    </div>
  );
}
