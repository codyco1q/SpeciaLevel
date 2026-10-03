"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Download,
  Grid,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  createWhiteboard,
  createWhiteboardFolder,
  deleteWhiteboard,
  deleteWhiteboardFolder,
  duplicateWhiteboard,
  moveWhiteboardToFolder,
  renameWhiteboard,
  saveWhiteboard,
  updateWhiteboardFolder,
  attachWhiteboardToTask,
} from "@/lib/actions/tasks-powerhouse";
import type { TaskRow } from "@/lib/actions/tasks";
import type {
  WhiteboardElement,
  WhiteboardTool,
  WhiteboardViewport,
  WorkspaceWhiteboard,
  WorkspaceWhiteboardFolder,
} from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import {
  findClosestAnchor,
  generateArrowPath,
  getElementAnchorPoint,
  isElementIntersectingBox,
  resolveArrowCoordinates,
  SHAPE_FILL_PRESETS,
  STICKY_COLOR_PRESETS,
  STICKY_SIZES,
  STROKE_COLOR_PRESETS,
} from "./whiteboard-types";
import {
  exportCanvasToJson,
  exportCanvasToPng,
  exportCanvasToSvg,
} from "./whiteboard-export";
import { WhiteboardToolbar } from "./whiteboard-toolbar";
import { WhiteboardSidebar } from "./whiteboard-sidebar";
import { WhiteboardFolderDialog } from "./whiteboard-folder-dialog";
import { WhiteboardAttachDialog } from "./whiteboard-attach-dialog";

export interface WhiteboardWorkspaceProps {
  initialWhiteboards: WorkspaceWhiteboard[];
  initialWhiteboardFolders?: WorkspaceWhiteboardFolder[];
  tasks?: TaskRow[];
  platform: Dictionary["platform"];
  locale: Locale;
  activeBoardIdProp?: string | null;
  onOpenTask?: (taskId: string) => void;
}

export function WhiteboardWorkspace({
  initialWhiteboards,
  initialWhiteboardFolders = [],
  tasks = [],
  platform,
  locale,
  activeBoardIdProp,
  onOpenTask,
}: WhiteboardWorkspaceProps) {
  // ------ STATE ------
  const [boards, setBoards] = useState<WorkspaceWhiteboard[]>(initialWhiteboards);
  const [folders, setFolders] = useState<WorkspaceWhiteboardFolder[]>(initialWhiteboardFolders);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(
    activeBoardIdProp ?? (initialWhiteboards.length > 0 ? initialWhiteboards[0].id : null)
  );
  const activeBoard = useMemo(() => boards.find((b) => b.id === activeBoardId), [boards, activeBoardId]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<WorkspaceWhiteboardFolder | null>(null);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachingBoardId, setAttachingBoardId] = useState<string | null>(null);

  // Canvas state
  const [tool, setTool] = useState<WhiteboardTool>("select");
  const [elements, setElements] = useState<WhiteboardElement[]>(activeBoard?.elements_json ?? []);
  const [viewport, setViewport] = useState<WhiteboardViewport>(activeBoard?.viewport ?? { x: 0, y: 0, zoom: 1 });
  const [boardName, setBoardName] = useState(activeBoard?.name ?? "Whiteboard");
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [gridMode, setGridMode] = useState<"dots" | "lines" | "none">("dots");

  // Styling defaults
  const [stickyColor, setStickyColor] = useState(STICKY_COLOR_PRESETS[0].value);
  const [shapeFillColor, setShapeFillColor] = useState("rgba(59, 130, 246, 0.15)");
  const [shapeStrokeColor, setShapeStrokeColor] = useState("#3b82f6");
  const [textColor, setTextColor] = useState("#e2e8f0");
  const [pencilColor, setPencilColor] = useState("#3b82f6");
  const [pencilWidth, setPencilWidth] = useState(3);
  const [strokeWidth, setStrokeWidth] = useState(2);

  // History
  const [history, setHistory] = useState<WhiteboardElement[][]>([activeBoard?.elements_json ?? []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Refs
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentBoardIdRef = useRef<string | null>(activeBoardId);
  const pendingSaveRef = useRef<{ id: string; elements: WhiteboardElement[]; viewport: WhiteboardViewport } | null>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const isMarqueeRef = useRef(false);
  const marqueeStartRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const elementStartsRef = useRef<
    Map<string, { x: number; y: number; endX?: number; endY?: number; points?: { x: number; y: number }[] }>
  >(new Map());
  const hasMovedRef = useRef(false);
  const currentDrawingRef = useRef<WhiteboardElement | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedElement = useMemo(
    () => (selectedElementIds.length === 1 ? elements.find((el) => el.id === selectedElementIds[0]) || null : null),
    [elements, selectedElementIds]
  );
  const elementMap = useMemo(() => {
    const map = new Map<string, WhiteboardElement>();
    for (const el of elements) map.set(el.id, el);
    return map;
  }, [elements]);

  // Sync when active board changes from prop
  useEffect(() => {
    if (activeBoardIdProp && activeBoardIdProp !== activeBoardId) {
      setActiveBoardId(activeBoardIdProp);
    }
  }, [activeBoardIdProp, activeBoardId]);

  useEffect(() => {
    setBoards(initialWhiteboards);
    if (!activeBoardId && initialWhiteboards.length > 0) {
      setActiveBoardId(initialWhiteboards[0].id);
    }
  }, [initialWhiteboards, activeBoardId]);

  // Sync when switching active board
  useEffect(() => {
    if (currentBoardIdRef.current && currentBoardIdRef.current !== activeBoardId) {
      // Flush pending save for previous board
      if (pendingSaveRef.current && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const { id, elements: els, viewport: vp } = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void saveWhiteboard(id, els, vp);
      }
    }

    currentBoardIdRef.current = activeBoardId;

    if (activeBoard) {
      const boardElements = Array.isArray(activeBoard.elements_json) ? activeBoard.elements_json : [];
      const boardViewport = activeBoard.viewport || { x: 0, y: 0, zoom: 1 };
      setElements(boardElements);
      setViewport(boardViewport);
      setBoardName(activeBoard.name || "Whiteboard");
      setSelectedElementIds([]);
      setEditingElementId(null);
      setHistory([boardElements]);
      setHistoryIndex(0);
      setSaveStatus("idle");
    } else if (!activeBoardId && boards.length > 0) {
      setActiveBoardId(boards[0].id);
    }
  }, [activeBoardId, activeBoard, boards]);

  // Push to history
  const pushHistory = useCallback((newElements: WhiteboardElement[]) => {
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newElements];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
      setSelectedElementIds([]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
      setSelectedElementIds([]);
    }
  }, [history, historyIndex]);

  // Debounced auto-save
  const triggerAutoSave = useCallback(
    (currentElements: WhiteboardElement[], currentViewport: WhiteboardViewport) => {
      if (!activeBoardId) return;

      pendingSaveRef.current = {
        id: activeBoardId,
        elements: currentElements,
        viewport: currentViewport,
      };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus("saving");

      saveTimeoutRef.current = setTimeout(async () => {
        if (!pendingSaveRef.current) return;
        const targetId = pendingSaveRef.current.id;
        const targetElements = pendingSaveRef.current.elements;
        const targetVp = pendingSaveRef.current.viewport;
        pendingSaveRef.current = null;

        const res = await saveWhiteboard(targetId, targetElements, targetVp);
        if (res.status === "success") {
          setSaveStatus("saved");
          if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
          savedStatusTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
          setBoards((prev) =>
            prev.map((b) =>
              b.id === targetId
                ? { ...b, elements_json: targetElements, viewport: targetVp }
                : b
            )
          );
        } else {
          setSaveStatus("idle");
        }
      }, 1200);
    },
    [activeBoardId]
  );

  const updateElementsState = useCallback(
    (updater: (prev: WhiteboardElement[]) => WhiteboardElement[], addToHistory = true) => {
      setElements((prev) => {
        const next = updater(prev);
        if (addToHistory) pushHistory(next);
        triggerAutoSave(next, viewport);
        return next;
      });
    },
    [pushHistory, triggerAutoSave, viewport]
  );

  // Board CRUD
  const handleCreateBoard = async (folderId?: string) => {
    startTransition(async () => {
      const name = `Whiteboard ${boards.length + 1}`;
      const res = await createWhiteboard(name, folderId);
      if (res.status === "success" && res.id) {
        const starter: WhiteboardElement[] = [
          {
            id: "el_" + Math.random().toString(36).substring(2, 8),
            type: "sticky",
            x: 120,
            y: 120,
            width: 220,
            height: 160,
            text: "💡 Brainstorming Note\nStart adding ideas, shapes & lines!",
            color: "#fef08a",
          },
        ];
        const newBoard: WorkspaceWhiteboard = {
          id: res.id,
          organization_id: "",
          name,
          folder_id: folderId || null,
          task_id: null,
          elements_json: starter,
          viewport: { x: 0, y: 0, zoom: 1 },
          created_by: null,
          updated_at: new Date().toISOString(),
        };
        setBoards((prev) => [newBoard, ...prev]);
        setActiveBoardId(res.id);
        setElements(starter);
        setViewport({ x: 0, y: 0, zoom: 1 });
        setBoardName(name);
        setHistory([starter]);
        setHistoryIndex(0);
        await saveWhiteboard(res.id, starter, { x: 0, y: 0, zoom: 1 });
      }
    });
  };

  const handleRenameBoard = async (board: WorkspaceWhiteboard) => {
    const newName = window.prompt("Enter new whiteboard name:", board.name);
    if (!newName || newName.trim() === "" || newName === board.name) return;
    startTransition(async () => {
      const res = await renameWhiteboard(board.id, newName.trim());
      if (res.status === "success") {
        setBoards((prev) =>
          prev.map((b) => (b.id === board.id ? { ...b, name: newName.trim() } : b))
        );
        if (board.id === activeBoardId) setBoardName(newName.trim());
      }
    });
  };

  const handleDuplicateBoard = async (boardId: string) => {
    startTransition(async () => {
      const source = boards.find((b) => b.id === boardId);
      const res = await duplicateWhiteboard(boardId);
      if (res.status === "success" && res.id) {
        const duplicated: WorkspaceWhiteboard = {
          id: res.id,
          organization_id: source?.organization_id || "",
          name: source ? `${source.name} (Copy)` : "Whiteboard (Copy)",
          folder_id: source?.folder_id || null,
          task_id: source?.task_id || null,
          elements_json: source?.elements_json || [],
          viewport: source?.viewport || { x: 0, y: 0, zoom: 1 },
          created_by: null,
          updated_at: new Date().toISOString(),
        };
        setBoards((prev) => [duplicated, ...prev]);
        setActiveBoardId(res.id);
      }
    });
  };

  const handleMoveBoard = async (board: WorkspaceWhiteboard, folderId: string | null) => {
    startTransition(async () => {
      const res = await moveWhiteboardToFolder(board.id, folderId);
      if (res.status === "success") {
        setBoards((prev) =>
          prev.map((b) => (b.id === board.id ? { ...b, folder_id: folderId } : b))
        );
      }
    });
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm("Are you sure you want to delete this whiteboard?")) return;
    startTransition(async () => {
      const res = await deleteWhiteboard(boardId);
      if (res.status === "success") {
        setBoards((prev) => prev.filter((b) => b.id !== boardId));
        if (activeBoardId === boardId) {
          const remaining = boards.filter((b) => b.id !== boardId);
          setActiveBoardId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    });
  };

  // Folder Actions
  const handleSaveFolder = async (name: string, color: string) => {
    if (editingFolder) {
      const res = await updateWhiteboardFolder(editingFolder.id, name, color);
      if (res.status === "success") {
        setFolders((prev) =>
          prev.map((f) => (f.id === editingFolder.id ? { ...f, name, color } : f))
        );
      }
    } else {
      const res = await createWhiteboardFolder(name, color);
      if (res.status === "success" && res.id) {
        const newFolder: WorkspaceWhiteboardFolder = {
          id: res.id,
          organization_id: "",
          name,
          color,
          created_at: new Date().toISOString(),
        };
        setFolders((prev) => [...prev, newFolder]);
      }
    }
    setEditingFolder(null);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm("Delete folder? Canvases inside will become unorganized.")) return;
    startTransition(async () => {
      const res = await deleteWhiteboardFolder(folderId);
      if (res.status === "success") {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setBoards((prev) => prev.map((b) => (b.folder_id === folderId ? { ...b, folder_id: null } : b)));
        if (selectedFolderId === folderId) setSelectedFolderId("all");
      }
    });
  };

  // Attach board to task
  const handleAttachBoard = (board: WorkspaceWhiteboard) => {
    setAttachingBoardId(board.id);
    setAttachDialogOpen(true);
  };

  const handleSaveAttachment = async (taskId: string | null) => {
    if (!attachingBoardId) return;
    if (taskId) {
      const res = await attachWhiteboardToTask(taskId, attachingBoardId);
      if (res.status === "success") {
        setBoards((prev) =>
          prev.map((b) => (b.id === attachingBoardId ? { ...b, task_id: taskId } : b))
        );
      }
    } else {
      setBoards((prev) =>
        prev.map((b) => (b.id === attachingBoardId ? { ...b, task_id: null } : b))
      );
    }
  };

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - viewport.x) / viewport.zoom;
      const y = (clientY - rect.top - viewport.y) / viewport.zoom;
      return { x, y };
    },
    [viewport]
  );

  // Selection & drag handlers
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Right click (button 2) or Middle click (button 1) or Hand tool: Canvas Panning
    if (e.button === 2 || e.button === 1 || tool === "hand") {
      isPanningRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Only process left click (button 0) for drawing, selecting, and moving
    if (e.button !== 0) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    hasMovedRef.current = false;

    if (tool === "eraser") {
      // Find element clicked
      const targetEl = e.target as SVGElement;
      const elId = targetEl.getAttribute("data-element-id");
      if (elId) {
        updateElementsState((prev) => prev.filter((item) => item.id !== elId));
        setSelectedElementIds((prev) => prev.filter((id) => id !== elId));
      }
      return;
    }

    if (tool === "select") {
      const targetEl = e.target as SVGElement;
      const elId = targetEl.getAttribute("data-element-id");
      if (elId) {
        let nextSelectedIds: string[];
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Toggle selection with Shift or Ctrl
          nextSelectedIds = selectedElementIds.includes(elId)
            ? selectedElementIds.filter((id) => id !== elId)
            : [...selectedElementIds, elId];
        } else {
          // If already in selection, keep multi-selection intact so dragging moves all selected together
          if (selectedElementIds.includes(elId)) {
            nextSelectedIds = selectedElementIds;
          } else {
            nextSelectedIds = [elId];
          }
        }

        setSelectedElementIds(nextSelectedIds);
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };

        // Save starting coordinates for all selected elements
        const starts = new Map<
          string,
          { x: number; y: number; endX?: number; endY?: number; points?: { x: number; y: number }[] }
        >();
        for (const item of elements) {
          if (nextSelectedIds.includes(item.id)) {
            starts.set(item.id, {
              x: item.x,
              y: item.y,
              endX: item.endX,
              endY: item.endY,
              points: item.points ? item.points.map((p) => ({ ...p })) : undefined,
            });
          }
        }
        elementStartsRef.current = starts;
      } else {
        // Clicked on empty canvas
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedElementIds([]);
          setEditingElementId(null);
        }
        // Start multi-select marquee box
        isMarqueeRef.current = true;
        marqueeStartRef.current = { x, y };
        setMarqueeBox({ startX: x, startY: y, currentX: x, currentY: y });
      }
      return;
    }

    // Creating new element
    const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    let newEl: WhiteboardElement;

    if (tool === "sticky") {
      const defSize = STICKY_SIZES.md;
      newEl = {
        id,
        type: "sticky",
        x: x - defSize.width / 2,
        y: y - defSize.height / 2,
        width: defSize.width,
        height: defSize.height,
        text: "New sticky note...",
        color: stickyColor,
      };
      updateElementsState((prev) => [...prev, newEl]);
      setSelectedElementIds([id]);
      setEditingElementId(id);
      setTool("select");
      isDraggingRef.current = false;
      return;
    } else if (tool === "text") {
      newEl = {
        id,
        type: "text",
        x,
        y,
        text: "Click to edit text",
        color: textColor,
        fontSize: 20,
      };
      updateElementsState((prev) => [...prev, newEl]);
      setSelectedElementIds([id]);
      setEditingElementId(id);
      setTool("select");
      isDraggingRef.current = false;
      return;
    } else if (tool === "rectangle" || tool === "circle" || tool === "diamond") {
      newEl = {
        id,
        type: tool,
        x,
        y,
        width: 1,
        height: 1,
        fillColor: shapeFillColor,
        strokeColor: shapeStrokeColor,
        strokeWidth,
      };
    } else if (tool === "arrow" || tool === "line") {
      // Find anchor at start
      const startBinding = findClosestAnchor({ x, y }, elements);
      const startPoint = startBinding
        ? getElementAnchorPoint(elements.find((el) => el.id === startBinding.elementId)!, startBinding.anchor)
        : { x, y };

      newEl = {
        id,
        type: tool,
        x: startPoint.x,
        y: startPoint.y,
        endX: startPoint.x + 1,
        endY: startPoint.y + 1,
        strokeColor: shapeStrokeColor,
        strokeWidth: 2,
        arrowStyle: "straight",
        startBinding: startBinding || undefined,
      };
    } else if (tool === "pencil" || tool === "highlighter") {
      newEl = {
        id,
        type: tool,
        x,
        y,
        points: [{ x, y }],
        strokeColor: tool === "highlighter" ? "rgba(234, 179, 8, 0.45)" : pencilColor,
        strokeWidth: tool === "highlighter" ? 14 : pencilWidth,
      };
    } else {
      return;
    }

    currentDrawingRef.current = newEl;
    setElements((prev) => [...prev, newEl]);
    setSelectedElementIds([id]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // Right-click or middle-click or hand-tool canvas panning
    if (isPanningRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setViewport((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Marquee multi-selection box
    if (isMarqueeRef.current) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setMarqueeBox((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));

      const minX = Math.min(marqueeStartRef.current.x, x);
      const maxX = Math.max(marqueeStartRef.current.x, x);
      const minY = Math.min(marqueeStartRef.current.y, y);
      const maxY = Math.max(marqueeStartRef.current.y, y);
      const rect = { minX, minY, maxX, maxY };

      const hits = elements.filter((el) => isElementIntersectingBox(el, rect)).map((el) => el.id);
      setSelectedElementIds(hits);
      return;
    }

    if (!isDraggingRef.current) return;
    hasMovedRef.current = true;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    // Drawing new shape/arrow/pencil
    if (currentDrawingRef.current) {
      const cur = currentDrawingRef.current;
      if (cur.type === "rectangle" || cur.type === "circle" || cur.type === "diamond") {
        const width = Math.max(10, Math.abs(x - cur.x));
        const height = Math.max(10, Math.abs(y - cur.y));
        const updated = { ...cur, width, height };
        currentDrawingRef.current = updated;
        setElements((prev) => prev.map((el) => (el.id === cur.id ? updated : el)));
      } else if (cur.type === "arrow" || cur.type === "line") {
        const endBinding = findClosestAnchor({ x, y }, elements, cur.startBinding?.elementId);
        const endPoint = endBinding
          ? getElementAnchorPoint(elements.find((el) => el.id === endBinding.elementId)!, endBinding.anchor)
          : { x, y };

        const updated = {
          ...cur,
          endX: endPoint.x,
          endY: endPoint.y,
          endBinding: endBinding || undefined,
        };
        currentDrawingRef.current = updated;
        setElements((prev) => prev.map((el) => (el.id === cur.id ? updated : el)));
      } else if (cur.type === "pencil" || cur.type === "highlighter") {
        const points = [...(cur.points || []), { x, y }];
        const updated = { ...cur, points };
        currentDrawingRef.current = updated;
        setElements((prev) => prev.map((el) => (el.id === cur.id ? updated : el)));
      }
      return;
    }

    // Dragging selected element(s)
    if (selectedElementIds.length > 0 && tool === "select") {
      const dx = (e.clientX - dragStartRef.current.x) / viewport.zoom;
      const dy = (e.clientY - dragStartRef.current.y) / viewport.zoom;

      setElements((prev) =>
        prev.map((el) => {
          const start = elementStartsRef.current.get(el.id);
          if (!start) return el;
          if (el.type === "arrow" || el.type === "line") {
            return {
              ...el,
              x: start.x + dx,
              y: start.y + dy,
              endX: start.endX !== undefined ? start.endX + dx : undefined,
              endY: start.endY !== undefined ? start.endY + dy : undefined,
            };
          }
          if (el.points && start.points) {
            return {
              ...el,
              x: start.x + dx,
              y: start.y + dy,
              points: start.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }
          return {
            ...el,
            x: start.x + dx,
            y: start.y + dy,
          };
        })
      );
    }
  };

  const handlePointerUp = () => {
    isPanningRef.current = false;
    if (isMarqueeRef.current) {
      isMarqueeRef.current = false;
      setMarqueeBox(null);
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (currentDrawingRef.current) {
        const finished = currentDrawingRef.current;
        currentDrawingRef.current = null;
        updateElementsState((prev) => prev.map((el) => (el.id === finished.id ? finished : el)));
        setTool("select");
      } else if (hasMovedRef.current) {
        updateElementsState((prev) => [...prev]);
      }
      hasMovedRef.current = false;
    }
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.1), 5);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newX = mouseX - ((mouseX - viewport.x) * nextZoom) / viewport.zoom;
      const newY = mouseY - ((mouseY - viewport.y) * nextZoom) / viewport.zoom;
      const newViewport = { x: newX, y: newY, zoom: nextZoom };
      setViewport(newViewport);
      triggerAutoSave(elements, newViewport);
    } else {
      setViewport((prev) => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleZoom = (direction: "in" | "out" | "reset") => {
    setViewport((prev) => {
      let nextZoom = prev.zoom;
      if (direction === "in") nextZoom = Math.min(prev.zoom * 1.2, 5);
      if (direction === "out") nextZoom = Math.max(prev.zoom / 1.2, 0.1);
      if (direction === "reset") return { x: 0, y: 0, zoom: 1 };
      const newViewport = { ...prev, zoom: nextZoom };
      triggerAutoSave(elements, newViewport);
      return newViewport;
    });
  };

  // Element modification
  const handleUpdateSelected = (updates: Partial<WhiteboardElement>) => {
    if (selectedElementIds.length === 0) return;
    updateElementsState((prev) =>
      prev.map((el) => (selectedElementIds.includes(el.id) ? { ...el, ...updates } : el))
    );
  };

  const handleDeleteSelected = () => {
    if (selectedElementIds.length === 0) return;
    updateElementsState((prev) => prev.filter((el) => !selectedElementIds.includes(el.id)));
    setSelectedElementIds([]);
  };

  const handleDuplicateSelected = () => {
    if (selectedElementIds.length === 0) return;
    const newIds: string[] = [];
    const duplicatedElements: WhiteboardElement[] = [];

    for (const el of elements) {
      if (selectedElementIds.includes(el.id)) {
        const newId = `el_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newIds.push(newId);
        duplicatedElements.push({
          ...el,
          id: newId,
          x: el.x + 20,
          y: el.y + 20,
          endX: el.endX !== undefined ? el.endX + 20 : undefined,
          endY: el.endY !== undefined ? el.endY + 20 : undefined,
          points: el.points ? el.points.map((p) => ({ x: p.x + 20, y: p.y + 20 })) : undefined,
        });
      }
    }

    updateElementsState((prev) => [...prev, ...duplicatedElements]);
    setSelectedElementIds(newIds);
  };

  const handleLayerChange = (direction: "front" | "back") => {
    if (selectedElementIds.length === 0) return;
    updateElementsState((prev) => {
      const selected = prev.filter((el) => selectedElementIds.includes(el.id));
      const unselected = prev.filter((el) => !selectedElementIds.includes(el.id));
      return direction === "front" ? [...unselected, ...selected] : [...selected, ...unselected];
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedElementIds(elements.map((el) => el.id));
      } else if (e.key === "Escape") {
        setSelectedElementIds([]);
        setEditingElementId(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementIds.length > 0 && !editingElementId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === "v" || e.key === "V") {
        setTool("select");
      } else if (e.key === "h" || e.key === "H") {
        setTool("hand");
      } else if (e.key === "s" || e.key === "S") {
        setTool("sticky");
      } else if (e.key === "t" || e.key === "T") {
        setTool("text");
      } else if (e.key === "r" || e.key === "R") {
        setTool("rectangle");
      } else if (e.key === "o" || e.key === "O") {
        setTool("circle");
      } else if (e.key === "d" || e.key === "D") {
        setTool("diamond");
      } else if (e.key === "a" || e.key === "A") {
        setTool("arrow");
      } else if (e.key === "p" || e.key === "P") {
        setTool("pencil");
      } else if (e.key === "e" || e.key === "E") {
        setTool("eraser");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementIds, editingElementId, elements, handleUndo, handleRedo]);

  // Export handlers
  const handleExport = (format: "png" | "svg" | "json") => {
    if (!svgRef.current) return;
    const name = activeBoard?.name || "whiteboard";
    if (format === "png") {
      exportCanvasToPng(svgRef.current, name);
    } else if (format === "svg") {
      exportCanvasToSvg(svgRef.current, name);
    } else if (format === "json") {
      exportCanvasToJson(elements, name);
    }
  };

  // Render individual SVG elements
  const renderElement = (el: WhiteboardElement) => {
    const isSelected = selectedElementIds.includes(el.id);

    if (el.type === "sticky") {
      const isEditing = editingElementId === el.id;
      return (
        <g
          key={el.id}
          transform={`translate(${el.x}, ${el.y})`}
          data-element-id={el.id}
          className="cursor-move group"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingElementId(el.id);
          }}
        >
          {/* Note drop shadow & shape */}
          <rect
            width={el.width || 180}
            height={el.height || 180}
            rx={8}
            ry={8}
            fill={el.color || "#fef08a"}
            stroke={isSelected ? "#3b82f6" : "rgba(0,0,0,0.08)"}
            strokeWidth={isSelected ? 2 : 1}
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.07))"
            data-element-id={el.id}
          />
          {/* Content inside sticky */}
          <foreignObject
            x={12}
            y={12}
            width={(el.width || 180) - 24}
            height={(el.height || 180) - 24}
            className="pointer-events-none"
          >
            {isEditing ? (
              <textarea
                autoFocus
                defaultValue={el.text}
                data-element-id={el.id}
                onBlur={(e) => {
                  handleUpdateSelected({ text: e.target.value });
                  setEditingElementId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingElementId(null);
                }}
                className="w-full h-full bg-transparent resize-none border-none outline-none font-sans text-xs text-neutral-900 leading-relaxed pointer-events-auto p-0"
              />
            ) : (
              <div className="w-full h-full text-xs text-neutral-900 font-sans break-words whitespace-pre-wrap select-none leading-relaxed overflow-hidden">
                {el.text || "Double-click to write..."}
              </div>
            )}
          </foreignObject>
        </g>
      );
    }

    if (el.type === "rectangle") {
      return (
        <rect
          key={el.id}
          x={el.x}
          y={el.y}
          width={el.width || 100}
          height={el.height || 60}
          rx={6}
          ry={6}
          fill={el.fillColor || "rgba(59, 130, 246, 0.1)"}
          stroke={isSelected ? "#3b82f6" : el.strokeColor || "#3b82f6"}
          strokeWidth={isSelected ? Math.max((el.strokeWidth || 2), 2) + 1 : el.strokeWidth || 2}
          strokeDasharray={el.strokeStyle === "dashed" ? "6 4" : el.strokeStyle === "dotted" ? "2 3" : undefined}
          data-element-id={el.id}
          className="cursor-move"
        />
      );
    }

    if (el.type === "circle") {
      const rx = (el.width || 100) / 2;
      const ry = (el.height || 100) / 2;
      return (
        <ellipse
          key={el.id}
          cx={el.x + rx}
          cy={el.y + ry}
          rx={rx}
          ry={ry}
          fill={el.fillColor || "rgba(16, 185, 129, 0.1)"}
          stroke={isSelected ? "#3b82f6" : el.strokeColor || "#10b981"}
          strokeWidth={isSelected ? Math.max((el.strokeWidth || 2), 2) + 1 : el.strokeWidth || 2}
          strokeDasharray={el.strokeStyle === "dashed" ? "6 4" : el.strokeStyle === "dotted" ? "2 3" : undefined}
          data-element-id={el.id}
          className="cursor-move"
        />
      );
    }

    if (el.type === "diamond") {
      const w = el.width || 100;
      const h = el.height || 80;
      const points = `${el.x + w / 2},${el.y} ${el.x + w},${el.y + h / 2} ${el.x + w / 2},${el.y + h} ${el.x},${el.y + h / 2}`;
      return (
        <polygon
          key={el.id}
          points={points}
          fill={el.fillColor || "rgba(168, 85, 247, 0.1)"}
          stroke={isSelected ? "#3b82f6" : el.strokeColor || "#a855f7"}
          strokeWidth={isSelected ? Math.max((el.strokeWidth || 2), 2) + 1 : el.strokeWidth || 2}
          data-element-id={el.id}
          className="cursor-move"
        />
      );
    }

    if (el.type === "text") {
      const isEditing = editingElementId === el.id;
      return (
        <g
          key={el.id}
          transform={`translate(${el.x}, ${el.y})`}
          data-element-id={el.id}
          className="cursor-move"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingElementId(el.id);
          }}
        >
          {isEditing ? (
            <foreignObject x={0} y={0} width={300} height={100}>
              <input
                autoFocus
                defaultValue={el.text}
                onBlur={(e) => {
                  handleUpdateSelected({ text: e.target.value });
                  setEditingElementId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setEditingElementId(null);
                }}
                style={{ fontSize: `${el.fontSize || 20}px`, color: el.color || "#ffffff" }}
                className="bg-transparent border-b border-primary outline-none font-sans font-medium w-full"
              />
            </foreignObject>
          ) : (
            <text
              x={0}
              y={el.fontSize || 20}
              fill={el.color || "#ffffff"}
              fontSize={el.fontSize || 20}
              fontWeight={el.fontWeight || "normal"}
              fontStyle={el.fontStyle || "normal"}
              fontFamily="sans-serif"
              data-element-id={el.id}
              className={cn("select-none", isSelected && "underline decoration-primary")}
            >
              {el.text || "Text"}
            </text>
          )}
        </g>
      );
    }

    if (el.type === "arrow" || el.type === "line") {
      const coords = resolveArrowCoordinates(el, elementMap);
      const isCurved = el.arrowStyle === "curved";
      const isOrthogonal = el.arrowStyle === "orthogonal";
      const pathData = isCurved
        ? generateArrowPath(coords.x1, coords.y1, coords.x2, coords.y2, "curved")
        : isOrthogonal
        ? generateArrowPath(coords.x1, coords.y1, coords.x2, coords.y2, "orthogonal")
        : `M ${coords.x1} ${coords.y1} L ${coords.x2} ${coords.y2}`;

      return (
        <g key={el.id} data-element-id={el.id} className="cursor-move">
          <path
            d={pathData}
            fill="none"
            stroke={isSelected ? "#3b82f6" : el.strokeColor || "#3b82f6"}
            strokeWidth={isSelected ? Math.max((el.strokeWidth || 2), 2) + 1 : el.strokeWidth || 2}
            markerEnd={el.type === "arrow" ? "url(#arrowhead)" : undefined}
            data-element-id={el.id}
          />
        </g>
      );
    }

    if (el.type === "pencil" || el.type === "highlighter" || el.type === "pen") {
      const pts = el.points || [];
      if (pts.length < 2) return null;
      const d = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
      return (
        <path
          key={el.id}
          d={d}
          fill="none"
          stroke={el.strokeColor || "#3b82f6"}
          strokeWidth={el.strokeWidth || (el.type === "highlighter" ? 14 : 3)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={el.type === "highlighter" ? 0.45 : 1}
          data-element-id={el.id}
          className="cursor-move"
        />
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden relative select-none transition-all",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none bg-background"
          : "h-[calc(100vh-14rem)] min-h-[650px] rounded-xl border border-border bg-card shadow-sm"
      )}
    >
      {/* Sidebar */}
      {sidebarOpen && (
        <WhiteboardSidebar
          boards={boards}
          folders={folders}
          activeBoardId={activeBoardId}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onSelectBoard={setActiveBoardId}
          onCreateBoard={handleCreateBoard}
          onRenameBoard={handleRenameBoard}
          onDuplicateBoard={handleDuplicateBoard}
          onMoveBoard={handleMoveBoard}
          onAttachBoard={handleAttachBoard}
          onDeleteBoard={handleDeleteBoard}
          onCreateFolder={() => {
            setEditingFolder(null);
            setFolderDialogOpen(true);
          }}
          onEditFolder={(folder) => {
            setEditingFolder(folder);
            setFolderDialogOpen(true);
          }}
          onDeleteFolder={handleDeleteFolder}
        />
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-dot-grid">
        {/* Top bar */}
        <div className="h-12 border-b border-border/60 bg-background/80 backdrop-blur-md px-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>

            {activeBoard ? (
              <Input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                onBlur={() => {
                  if (activeBoard && boardName.trim() && boardName !== activeBoard.name) {
                    renameWhiteboard(activeBoard.id, boardName.trim());
                    setBoards((prev) =>
                      prev.map((b) => (b.id === activeBoard.id ? { ...b, name: boardName.trim() } : b))
                    );
                  }
                }}
                className="h-8 font-semibold text-xs border-transparent hover:border-border focus:border-border max-w-[200px]"
              />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">Whiteboard Workspace</span>
            )}

            {activeBoard?.task_id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 px-2 text-primary border-primary/30 hover:bg-primary/10"
                onClick={() => onOpenTask && onOpenTask(activeBoard.task_id!)}
              >
                <Sparkles className="h-3 w-3" /> Attached to Task
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Undo / Redo */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={historyIndex <= 0 || !activeBoard}
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={historyIndex >= history.length - 1 || !activeBoard}
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>

            <div className="h-4 w-[1px] bg-border mx-1" />

            {/* Recenter View */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
              title="Reset View (0, 0)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Canvas"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>

            {/* Grid selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Grid Pattern">
                  <Grid className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => setGridMode("dots")}>Dot Grid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGridMode("lines")}>Line Grid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGridMode("none")}>Blank Canvas</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5 shadow-xs" disabled={!activeBoard}>
                  <Download className="h-3 w-3" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 text-xs">
                <DropdownMenuItem onClick={() => handleExport("png")}>Export as PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("svg")}>Export as SVG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Floating Toolbar */}
        {activeBoard && (
          <WhiteboardToolbar
            tool={tool}
            setTool={setTool}
            selectedElement={selectedElement}
            selectedCount={selectedElementIds.length}
            stickyColor={stickyColor}
            setStickyColor={setStickyColor}
            shapeFillColor={shapeFillColor}
            setShapeFillColor={setShapeFillColor}
            shapeStrokeColor={shapeStrokeColor}
            setShapeStrokeColor={setShapeStrokeColor}
            textColor={textColor}
            setTextColor={setTextColor}
            pencilColor={pencilColor}
            setPencilColor={setPencilColor}
            pencilWidth={pencilWidth}
            setPencilWidth={setPencilWidth}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            onUpdateSelected={handleUpdateSelected}
            onDuplicateSelected={handleDuplicateSelected}
            onDeleteSelected={handleDeleteSelected}
            onLayerChange={handleLayerChange}
          />
        )}

        {/* Interactive SVG Canvas */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex-1 relative overflow-hidden bg-background select-none cursor-default",
            tool === "hand" && "cursor-grab active:cursor-grabbing",
            tool === "eraser" && "cursor-crosshair",
            (tool === "pencil" || tool === "highlighter") && "cursor-crosshair"
          )}
        >
          {!activeBoard && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-background/90 backdrop-blur-xs">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3 shadow-xs">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No Whiteboard Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">
                Select a canvas from the sidebar or create a new whiteboard to start brainstorming, drawing, and diagramming.
              </p>
              <Button
                type="button"
                size="sm"
                className="gap-2 shadow-xs"
                onClick={() => handleCreateBoard()}
              >
                <Plus className="h-4 w-4" />
                <span>Create New Whiteboard</span>
              </Button>
            </div>
          )}

          <svg
            ref={svgRef}
            className="w-full h-full absolute inset-0 touch-none"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <defs>
              {/* Dot Grid pattern */}
              <pattern
                id="wb-dots"
                x={viewport.x % (24 * viewport.zoom)}
                y={viewport.y % (24 * viewport.zoom)}
                width={24 * viewport.zoom}
                height={24 * viewport.zoom}
                patternUnits="userSpaceOnUse"
              >
                <circle cx={2} cy={2} r={1 * Math.min(viewport.zoom, 1.5)} fill="rgba(148, 163, 184, 0.25)" />
              </pattern>

              {/* Line Grid pattern */}
              <pattern
                id="wb-lines"
                x={viewport.x % (24 * viewport.zoom)}
                y={viewport.y % (24 * viewport.zoom)}
                width={24 * viewport.zoom}
                height={24 * viewport.zoom}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${24 * viewport.zoom} 0 L 0 0 0 ${24 * viewport.zoom}`}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeWidth="1"
                />
              </pattern>

              {/* Arrow Head Marker */}
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
            </defs>

            {/* Grid Background */}
            {gridMode === "dots" && <rect width="100%" height="100%" fill="url(#wb-dots)" />}
            {gridMode === "lines" && <rect width="100%" height="100%" fill="url(#wb-lines)" />}

            {/* Viewport Transform Layer */}
            <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
              {elements.map((el) => renderElement(el))}

              {/* Marquee Selection Rectangle */}
              {marqueeBox && (
                <rect
                  x={Math.min(marqueeBox.startX, marqueeBox.currentX)}
                  y={Math.min(marqueeBox.startY, marqueeBox.currentY)}
                  width={Math.abs(marqueeBox.currentX - marqueeBox.startX)}
                  height={Math.abs(marqueeBox.currentY - marqueeBox.startY)}
                  fill="rgba(59, 130, 246, 0.12)"
                  stroke="#3b82f6"
                  strokeWidth={1.5 / viewport.zoom}
                  strokeDasharray="4 4"
                  className="pointer-events-none"
                />
              )}
            </g>
          </svg>
        </div>

        {/* Bottom Zoom & Status Bar */}
        <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl border border-border/80 bg-background/90 backdrop-blur-md shadow-lg text-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={() => handleZoom("out")}
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center font-mono font-medium text-[11px]">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={() => handleZoom("in")}
            title="Zoom In (Ctrl +)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={() => handleZoom("reset")}
            title="Reset Zoom"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          <div className="h-3.5 w-[1px] bg-border mx-1" />

          <div className="flex items-center gap-1 pr-1 text-[11px] text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === "idle" && <span>{elements.length} elements</span>}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <WhiteboardFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onSave={handleSaveFolder}
        folder={editingFolder}
      />

      <WhiteboardAttachDialog
        open={attachDialogOpen}
        onOpenChange={setAttachDialogOpen}
        tasks={tasks}
        currentTaskId={activeBoard?.task_id || null}
        onAttach={handleSaveAttachment}
      />
    </div>
  );
}
