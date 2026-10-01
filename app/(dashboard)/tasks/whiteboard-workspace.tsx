"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Circle as CircleIcon,
  Eraser,
  Hand,
  LoaderCircle,
  Maximize2,
  MousePointer,
  Move,
  PenTool,
  Plus,
  RotateCcw,
  Square,
  StickyNote,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createWhiteboard,
  deleteWhiteboard,
  saveWhiteboard,
} from "@/lib/actions/tasks-powerhouse";
import type {
  WhiteboardElement,
  WhiteboardTool,
  WhiteboardViewport,
  WorkspaceWhiteboard,
} from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

const STICKY_COLORS = [
  { name: "Yellow", value: "#fef08a", text: "#713f12" },
  { name: "Blue", value: "#bae6fd", text: "#0369a1" },
  { name: "Green", value: "#bbf7d0", text: "#15803d" },
  { name: "Pink", value: "#fbcfe8", text: "#be185d" },
  { name: "Purple", value: "#e9d5ff", text: "#6b21a8" },
];

const STROKE_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#f59e0b", "#0f172a", "#ffffff"];

interface WhiteboardWorkspaceProps {
  initialWhiteboards: WorkspaceWhiteboard[];
  platform: Dictionary["platform"];
  locale: Locale;
}

export function WhiteboardWorkspace({
  initialWhiteboards,
  platform,
}: WhiteboardWorkspaceProps) {
  const t = platform.tasks;
  const ww = t.whiteboardWorkspace || {
    title: "Whiteboards",
    newBoard: "New Whiteboard",
    searchBoards: "Search whiteboards...",
    deleteBoard: "Delete Whiteboard",
    deleteBoardConfirm: "Are you sure you want to delete this whiteboard?",
    toolSelect: "Select / Move",
    toolSticky: "Sticky Note",
    toolText: "Text Box",
    toolRectangle: "Rectangle",
    toolCircle: "Circle",
    toolArrow: "Arrow",
    toolPen: "Freehand Pen",
    clearCanvas: "Clear Canvas",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    resetZoom: "Reset View",
    saved: "All changes saved",
    saving: "Saving...",
    emptyWorkspace: "No whiteboards found. Create a new canvas to start brainstorming.",
  };

  const [boards, setBoards] = useState<WorkspaceWhiteboard[]>(initialWhiteboards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(
    initialWhiteboards.length > 0 ? initialWhiteboards[0].id : null
  );

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  const [tool, setTool] = useState<WhiteboardTool>("select");
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0].value);
  const [strokeColor, setStrokeColor] = useState("#3b82f6");

  const [elements, setElements] = useState<WhiteboardElement[]>(
    activeBoard?.elements_json ?? []
  );
  const [viewport, setViewport] = useState<WhiteboardViewport>(
    activeBoard?.viewport ?? { x: 0, y: 0, zoom: 1 }
  );
  const [boardName, setBoardName] = useState(activeBoard?.name ?? "Whiteboard");

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isPending, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const elementStartRef = useRef({ x: 0, y: 0 });
  const currentDrawingRef = useRef<WhiteboardElement | null>(null);

  const currentBoardIdRef = useRef<string | null>(activeBoardId);
  const pendingBoardSaveRef = useRef<{
    id: string;
    elements: WhiteboardElement[];
    viewport: WhiteboardViewport;
    name: string;
  } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state only when switching to a different whiteboard
  useEffect(() => {
    if (!activeBoardId) {
      currentBoardIdRef.current = null;
      return;
    }

    if (activeBoardId !== currentBoardIdRef.current) {
      // Flush previous pending save immediately before switching
      if (pendingBoardSaveRef.current && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const { id, elements: el, viewport: vp, name: nm } = pendingBoardSaveRef.current;
        pendingBoardSaveRef.current = null;
        void saveWhiteboard(id, el, vp, nm);
      }

      currentBoardIdRef.current = activeBoardId;
      if (activeBoard) {
        setElements(activeBoard.elements_json || []);
        setViewport(activeBoard.viewport || { x: 0, y: 0, zoom: 1 });
        setBoardName(activeBoard.name || "Whiteboard");
        setSelectedElementId(null);
        setEditingElementId(null);
      }
      setSaveStatus("idle");
    }
  }, [activeBoardId, activeBoard]);

  // Clean up timers on unmount and flush pending save
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
      if (pendingBoardSaveRef.current) {
        const { id, elements: el, viewport: vp, name: nm } = pendingBoardSaveRef.current;
        void saveWhiteboard(id, el, vp, nm);
      }
    };
  }, []);

  // Smooth debounced auto-save (2500ms)
  const triggerSave = (
    newElements: WhiteboardElement[],
    newViewport: WhiteboardViewport,
    newName: string
  ) => {
    if (!activeBoardId) return;

    pendingBoardSaveRef.current = {
      id: activeBoardId,
      elements: newElements,
      viewport: newViewport,
      name: newName,
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      if (!pendingBoardSaveRef.current) return;
      const targetId = pendingBoardSaveRef.current.id;
      const saveElements = pendingBoardSaveRef.current.elements;
      const saveViewport = pendingBoardSaveRef.current.viewport;
      const saveName = pendingBoardSaveRef.current.name;
      pendingBoardSaveRef.current = null;

      setSaveStatus("saving");
      const res = await saveWhiteboard(targetId, saveElements, saveViewport, saveName);

      if (res.status === "success") {
        setSaveStatus("saved");
        // Update local boards list silently without resetting active canvas selection
        setBoards((prev) =>
          prev.map((b) =>
            b.id === targetId
              ? { ...b, name: saveName, elements_json: saveElements, viewport: saveViewport }
              : b
          )
        );

        savedStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2500);
      } else {
        setSaveStatus("idle");
      }
    }, 2500);
  };
  const getCanvasCoords = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const x = (clientX - viewport.x) / viewport.zoom;
    const y = (clientY - viewport.y) / viewport.zoom;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    const coords = getCanvasCoords(e);

    if (e.button === 1 || (tool === "select" && (e.target as HTMLElement).tagName === "svg")) {
      isPanningRef.current = true;
      dragStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
      setSelectedElementId(null);
      return;
    }

    if (tool === "select") return;

    const newId = "el_" + Math.random().toString(36).substring(2, 9);
    let newElement: WhiteboardElement | null = null;

    if (tool === "sticky") {
      newElement = {
        id: newId,
        type: "sticky",
        x: coords.x - 100,
        y: coords.y - 80,
        width: 200,
        height: 160,
        text: "New Note",
        color: stickyColor,
      };
    } else if (tool === "text") {
      newElement = {
        id: newId,
        type: "text",
        x: coords.x,
        y: coords.y,
        width: 180,
        height: 40,
        text: "Heading Text",
        color: strokeColor,
      };
    } else if (tool === "rectangle") {
      newElement = {
        id: newId,
        type: "rectangle",
        x: coords.x,
        y: coords.y,
        width: 10,
        height: 10,
        strokeColor,
        strokeWidth: 2,
      };
      currentDrawingRef.current = newElement;
    } else if (tool === "circle") {
      newElement = {
        id: newId,
        type: "circle",
        x: coords.x,
        y: coords.y,
        width: 10,
        height: 10,
        strokeColor,
        strokeWidth: 2,
      };
      currentDrawingRef.current = newElement;
    } else if (tool === "arrow") {
      newElement = {
        id: newId,
        type: "arrow",
        x: coords.x,
        y: coords.y,
        endX: coords.x + 10,
        endY: coords.y + 10,
        strokeColor,
        strokeWidth: 3,
      };
      currentDrawingRef.current = newElement;
    } else if (tool === "pen") {
      newElement = {
        id: newId,
        type: "pen",
        x: coords.x,
        y: coords.y,
        strokeColor,
        strokeWidth: 3,
        points: [{ x: coords.x, y: coords.y }],
      };
      currentDrawingRef.current = newElement;
    }

    if (newElement) {
      const nextElements = [...elements, newElement];
      setElements(nextElements);
      setSelectedElementId(newId);

      if (tool === "sticky" || tool === "text") {
        setTool("select");
        triggerSave(nextElements, viewport, boardName);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      const newVp = { ...viewport, x: newX, y: newY };
      setViewport(newVp);
      return;
    }

    const coords = getCanvasCoords(e);

    if (currentDrawingRef.current) {
      const drawing = currentDrawingRef.current;
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== drawing.id) return el;
          if (el.type === "rectangle" || el.type === "circle") {
            const width = Math.max(10, coords.x - el.x);
            const height = Math.max(10, coords.y - el.y);
            return { ...el, width, height };
          }
          if (el.type === "arrow") {
            return { ...el, endX: coords.x, endY: coords.y };
          }
          if (el.type === "pen") {
            return { ...el, points: [...(el.points || []), { x: coords.x, y: coords.y }] };
          }
          return el;
        })
      );
      return;
    }

    if (isDraggingRef.current && selectedElementId && tool === "select") {
      const dx = (e.clientX - dragStartRef.current.x) / viewport.zoom;
      const dy = (e.clientY - dragStartRef.current.y) / viewport.zoom;

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedElementId) return el;
          return {
            ...el,
            x: elementStartRef.current.x + dx,
            y: elementStartRef.current.y + dy,
          };
        })
      );
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;

    if (currentDrawingRef.current) {
      currentDrawingRef.current = null;
      setTool("select");
      triggerSave(elements, viewport, boardName);
    }

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      triggerSave(elements, viewport, boardName);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: WhiteboardElement) => {
    if (tool !== "select") return;
    e.stopPropagation();

    setSelectedElementId(el.id);
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    elementStartRef.current = { x: el.x, y: el.y };
  };

  const handleTextChange = (id: string, text: string) => {
    const updated = elements.map((el) => (el.id === id ? { ...el, text } : el));
    setElements(updated);
    triggerSave(updated, viewport, boardName);
  };

  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    const updated = elements.filter((el) => el.id !== selectedElementId);
    setElements(updated);
    setSelectedElementId(null);
    setEditingElementId(null);
    triggerSave(updated, viewport, boardName);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(0.3, viewport.zoom * zoomFactor), 3);
    const newVp = { ...viewport, zoom: newZoom };
    setViewport(newVp);
    triggerSave(elements, newVp, boardName);
  };

  const handleZoom = (direction: "in" | "out" | "reset") => {
    let newZoom = viewport.zoom;
    if (direction === "in") newZoom = Math.min(3, viewport.zoom * 1.2);
    if (direction === "out") newZoom = Math.max(0.3, viewport.zoom / 1.2);
    if (direction === "reset") {
      const resetVp = { x: 0, y: 0, zoom: 1 };
      setViewport(resetVp);
      triggerSave(elements, resetVp, boardName);
      return;
    }
    const newVp = { ...viewport, zoom: newZoom };
    setViewport(newVp);
    triggerSave(elements, newVp, boardName);
  };

  const handleCreateNewBoard = () => {
    startTransition(async () => {
      const res = await createWhiteboard(ww.newBoard);
      if (res.status === "success" && res.id) {
        const newBoardObj: WorkspaceWhiteboard = {
          id: res.id,
          organization_id: "",
          name: ww.newBoard,
          elements_json: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          created_by: null,
          updated_at: new Date().toISOString(),
        };
        setBoards([newBoardObj, ...boards]);
        setActiveBoardId(res.id);
      }
    });
  };

  const handleDeleteBoard = (boardId: string) => {
    if (!window.confirm(ww.deleteBoardConfirm)) return;

    startTransition(async () => {
      const res = await deleteWhiteboard(boardId);
      if (res.status === "success") {
        const updated = boards.filter((b) => b.id !== boardId);
        setBoards(updated);
        if (activeBoardId === boardId) {
          setActiveBoardId(updated.length > 0 ? updated[0].id : null);
        }
      }
    });
  };

  const renderElement = (el: WhiteboardElement) => {
    const isSelected = el.id === selectedElementId;
    const isEditing = el.id === editingElementId;

    if (el.type === "sticky") {
      return (
        <g
          key={el.id}
          transform={`translate(${el.x}, ${el.y})`}
          onMouseDown={(e) => handleElementMouseDown(e, el)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingElementId(el.id);
          }}
          className="cursor-move select-none"
        >
          <rect
            width={el.width || 200}
            height={el.height || 160}
            rx={8}
            fill={el.color || "#fef08a"}
            stroke={isSelected ? "#2563eb" : "rgba(0,0,0,0.15)"}
            strokeWidth={isSelected ? 2.5 : 1}
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))"
          />

          {isEditing ? (
            <foreignObject x={10} y={10} width={(el.width || 200) - 20} height={(el.height || 160) - 20}>
              <textarea
                autoFocus
                defaultValue={el.text || ""}
                onBlur={(e) => {
                  handleTextChange(el.id, e.target.value);
                  setEditingElementId(null);
                }}
                className="w-full h-full p-1 bg-transparent border-0 resize-none outline-none text-xs leading-relaxed text-slate-800 font-medium font-sans"
              />
            </foreignObject>
          ) : (
            <foreignObject
              x={12}
              y={12}
              width={(el.width || 200) - 24}
              height={(el.height || 160) - 24}
              className="pointer-events-none"
            >
              <div className="w-full h-full text-xs font-medium leading-relaxed whitespace-pre-wrap text-slate-800 break-words font-sans">
                {el.text || "Double click to write..."}
              </div>
            </foreignObject>
          )}
        </g>
      );
    }

    if (el.type === "text") {
      return (
        <g
          key={el.id}
          transform={`translate(${el.x}, ${el.y})`}
          onMouseDown={(e) => handleElementMouseDown(e, el)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingElementId(el.id);
          }}
          className="cursor-move select-none"
        >
          {isSelected && (
            <rect
              x={-4}
              y={-4}
              width={(el.width || 180) + 8}
              height={(el.height || 40) + 8}
              fill="none"
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              rx={4}
            />
          )}
          {isEditing ? (
            <foreignObject x={0} y={0} width={el.width || 200} height={el.height || 50}>
              <input
                autoFocus
                defaultValue={el.text || ""}
                onBlur={(e) => {
                  handleTextChange(el.id, e.target.value);
                  setEditingElementId(null);
                }}
                className="w-full h-full px-1 bg-transparent border-0 outline-none text-base font-bold text-foreground"
              />
            </foreignObject>
          ) : (
            <text
              x={0}
              y={24}
              fill={el.color || "currentColor"}
              className="text-base font-bold select-none fill-foreground"
            >
              {el.text || "Text Box"}
            </text>
          )}
        </g>
      );
    }

    if (el.type === "rectangle") {
      return (
        <rect
          key={el.id}
          x={el.x}
          y={el.y}
          width={el.width || 50}
          height={el.height || 50}
          rx={4}
          fill="rgba(59, 130, 246, 0.08)"
          stroke={isSelected ? "#2563eb" : el.strokeColor || "#3b82f6"}
          strokeWidth={isSelected ? 3 : el.strokeWidth || 2}
          onMouseDown={(e) => handleElementMouseDown(e, el)}
          className="cursor-move"
        />
      );
    }

    if (el.type === "circle") {
      const rx = (el.width || 50) / 2;
      const ry = (el.height || 50) / 2;
      return (
        <ellipse
          key={el.id}
          cx={el.x + rx}
          cy={el.y + ry}
          rx={Math.max(5, rx)}
          ry={Math.max(5, ry)}
          fill="rgba(59, 130, 246, 0.08)"
          stroke={isSelected ? "#2563eb" : el.strokeColor || "#3b82f6"}
          strokeWidth={isSelected ? 3 : el.strokeWidth || 2}
          onMouseDown={(e) => handleElementMouseDown(e, el)}
          className="cursor-move"
        />
      );
    }

    if (el.type === "arrow") {
      const endX = el.endX ?? el.x + 100;
      const endY = el.endY ?? el.y;
      return (
        <g key={el.id} onMouseDown={(e) => handleElementMouseDown(e, el)} className="cursor-move">
          <line
            x1={el.x}
            y1={el.y}
            x2={endX}
            y2={endY}
            stroke={isSelected ? "#2563eb" : el.strokeColor || "#3b82f6"}
            strokeWidth={isSelected ? 4 : el.strokeWidth || 3}
            strokeLinecap="round"
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    }

    if (el.type === "pen" && el.points && el.points.length > 0) {
      const pathData =
        `M ${el.points[0].x} ${el.points[0].y} ` +
        el.points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");

      return (
        <path
          key={el.id}
          d={pathData}
          fill="none"
          stroke={isSelected ? "#2563eb" : el.strokeColor || "#3b82f6"}
          strokeWidth={isSelected ? 4 : el.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          onMouseDown={(e) => handleElementMouseDown(e, el)}
          className="cursor-move"
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[550px] rounded-xl border border-border bg-card overflow-hidden shadow-sm relative select-none">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-border/60 px-4 flex items-center justify-between gap-4 bg-background/80 backdrop-blur shrink-0 z-20">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {boards.map((b) => (
            <div
              key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`group flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition shrink-0 ${
                b.id === activeBoardId
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{b.name}</span>
              {boards.length > 1 && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition p-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBoard(b.id);
                  }}
                  title={ww.deleteBoard}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleCreateNewBoard}
            disabled={isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{ww.newBoard}</span>
          </Button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-primary">
                <LoaderCircle className="h-3 w-3 animate-spin" /> {ww.saving}
              </span>
            )}
            {saveStatus === "saved" && <span className="text-emerald-500">{ww.saved}</span>}
          </span>
        </div>
      </div>

      {/* Floating Canvas Toolbar */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 rounded-xl border border-border/80 bg-background/90 backdrop-blur shadow-lg">
        <Button
          type="button"
          size="sm"
          variant={tool === "select" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("select")}
          title={ww.toolSelect}
        >
          <MousePointer className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tool === "sticky" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("sticky")}
          title={ww.toolSticky}
        >
          <StickyNote className="h-4 w-4 text-amber-500" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tool === "text" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("text")}
          title={ww.toolText}
        >
          <Type className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tool === "rectangle" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("rectangle")}
          title={ww.toolRectangle}
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tool === "circle" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("circle")}
          title={ww.toolCircle}
        >
          <CircleIcon className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tool === "arrow" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("arrow")}
          title={ww.toolArrow}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tool === "pen" ? "default" : "ghost"}
          className="h-8 w-8 p-0"
          onClick={() => setTool("pen")}
          title={ww.toolPen}
        >
          <PenTool className="h-4 w-4" />
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        {tool === "sticky" && (
          <div className="flex items-center gap-1 px-1">
            {STICKY_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`h-5 w-5 rounded-full border transition ${
                  stickyColor === c.value ? "scale-125 border-primary" : "border-black/10"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setStickyColor(c.value)}
              />
            ))}
          </div>
        )}

        {(tool === "rectangle" || tool === "circle" || tool === "arrow" || tool === "pen" || tool === "text") && (
          <div className="flex items-center gap-1 px-1">
            {STROKE_COLORS.slice(0, 5).map((color) => (
              <button
                key={color}
                type="button"
                className={`h-5 w-5 rounded-full border transition ${
                  strokeColor === color ? "scale-125 border-primary" : "border-black/10"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setStrokeColor(color)}
              />
            ))}
          </div>
        )}

        {selectedElementId && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
            onClick={handleDeleteSelected}
            title="Delete Selected"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Floating Bottom-Right Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 p-1 rounded-xl border border-border/80 bg-background/90 backdrop-blur shadow-lg">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleZoom("out")}
          title={ww.zoomOut}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>

        <button
          type="button"
          onClick={() => handleZoom("reset")}
          className="px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          title={ww.resetZoom}
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleZoom("in")}
          title={ww.zoomIn}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Main Interactive Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-dot-grid cursor-crosshair">
        <svg
          ref={svgRef}
          className="w-full h-full absolute inset-0 cursor-default"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="8"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
            </marker>
          </defs>

          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            {elements.map((el) => renderElement(el))}
          </g>
        </svg>
      </div>
    </div>
  );
}

