import { useState, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { useApp, methodColor } from '../../context/AppContext';
import { ContextMenu, ContextMenuItem } from '../common/ContextMenu';
import type { TreeNode, ContextMenuAction } from '../../types';
import type { NodeRef } from '../../utils/tree';
import {
  folderRef,
  projectRef,
  requestRef,
  canMoveNode,
} from '../../utils/tree';
import { headerRowsFromRecord } from '../../utils/http';
import './ProjectTree.css';

const INDENT = 16;
const DRAG_MIME = 'application/x-egogo-node-ref';

interface MenuState {
  x: number;
  y: number;
  ref: NodeRef;
  kind: 'request' | 'folder' | 'project';
}

function refsEqual(a: NodeRef, b: NodeRef): boolean {
  return (
    a.projectId === b.projectId && a.nodeId === b.nodeId && a.nodeType === b.nodeType
  );
}

function buildMenuItems(
  kind: MenuState['kind'],
  t: ReturnType<typeof import('../../i18n').t>
): ContextMenuItem[] {
  const base: ContextMenuItem[] = [
    { action: 'rename', label: t.contextMenu.rename },
    { action: 'copy', label: t.contextMenu.copy },
    { action: 'duplicate', label: t.contextMenu.duplicate },
    { action: 'delete', label: t.contextMenu.delete, danger: true },
  ];
  if (kind === 'folder' || kind === 'project') {
    return [
      { action: 'addRequest', label: t.contextMenu.addRequest },
      { action: 'addFolder', label: t.contextMenu.addFolder, dividerBefore: true },
      ...base,
    ];
  }
  return base;
}

interface RenameState {
  ref: NodeRef;
  name: string;
}

interface DragHandlers {
  dragSource: NodeRef | null;
  dropTarget: NodeRef | null;
  onDragStart: (ref: NodeRef) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (targetParent: NodeRef) => (e: React.DragEvent) => void;
  onDragLeave: (targetParent: NodeRef) => (e: React.DragEvent) => void;
  onDrop: (targetParent: NodeRef) => (e: React.DragEvent) => void;
  shouldSuppressClick: () => boolean;
}

interface TreeRowProps {
  depth: number;
  label: React.ReactNode;
  name: string;
  icon?: React.ReactNode;
  chevron?: React.ReactNode;
  className?: string;
  nodeRef: NodeRef;
  kind: MenuState['kind'];
  showAdd?: boolean;
  onClick?: () => void;
  onAdd?: () => void;
  renameState: RenameState | null;
  onStartRename: (ref: NodeRef, name: string) => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  draggable?: boolean;
  droppable?: boolean;
  drag?: DragHandlers;
}

function TreeRow({
  depth,
  label,
  name,
  icon,
  chevron,
  className = '',
  nodeRef,
  kind,
  showAdd,
  onClick,
  onAdd,
  renameState,
  onStartRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  draggable = false,
  droppable = false,
  drag,
}: TreeRowProps) {
  const { treeAction, t } = useApp();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const isRenaming = renameState?.ref.nodeId === nodeRef.nodeId;
  const isDragging = drag?.dragSource ? refsEqual(drag.dragSource, nodeRef) : false;
  const isDropTarget =
    droppable && drag?.dropTarget ? refsEqual(drag.dropTarget, nodeRef) : false;

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, ref: nodeRef, kind });
  };

  const handleAction = (action: ContextMenuAction) => {
    if (action === 'rename') {
      onStartRename(nodeRef, name);
      return;
    }
    treeAction(nodeRef, action);
  };

  const handleClick = () => {
    if (drag?.shouldSuppressClick()) return;
    onClick?.();
  };

  return (
    <>
      <div
        className={`tree-item ${className}${isDragging ? ' dragging' : ''}${
          isDropTarget ? ' drop-target' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * INDENT}px` }}
        draggable={draggable && !isRenaming}
        onClick={handleClick}
        onContextMenu={openMenu}
        onDragStart={draggable && drag ? drag.onDragStart(nodeRef) : undefined}
        onDragEnd={draggable && drag ? drag.onDragEnd : undefined}
        onDragOver={droppable && drag ? drag.onDragOver(nodeRef) : undefined}
        onDragLeave={droppable && drag ? drag.onDragLeave(nodeRef) : undefined}
        onDrop={droppable && drag ? drag.onDrop(nodeRef) : undefined}
      >
        <span className="tree-chevron">{chevron ?? <span className="tree-chevron-spacer" />}</span>
        {icon && <span className="tree-icon-wrap">{icon}</span>}
        {isRenaming ? (
          <input
            className="tree-rename-input"
            value={renameState?.name ?? ''}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameCommit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            onBlur={onRenameCommit}
          />
        ) : (
          <span className="tree-label">{label}</span>
        )}
        <div className="tree-item-actions">
          {showAdd && (
            <button
              className="tree-action-btn"
              title={t.contextMenu.addRequest}
              onClick={(e) => {
                e.stopPropagation();
                onAdd?.();
              }}
            >
              <Plus size={14} />
            </button>
          )}
          <button
            className="tree-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              openMenu(e);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenuItems(kind, t)}
          onSelect={handleAction}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

function RequestRow({
  node,
  depth,
  projectId,
  renameState,
  onStartRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  drag,
}: {
  node: Extract<TreeNode, { type: 'request' }>;
  depth: number;
  projectId: string;
  renameState: RenameState | null;
  onStartRename: (ref: NodeRef, name: string) => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  drag: DragHandlers;
}) {
  const { openTab } = useApp();
  const { data } = node;
  const nodeRef = requestRef(projectId, data.id);

  return (
    <TreeRow
      depth={depth}
      nodeRef={nodeRef}
      kind="request"
      className="request"
      name={data.name}
      renameState={renameState}
      onStartRename={onStartRename}
      onRenameChange={onRenameChange}
      onRenameCommit={onRenameCommit}
      onRenameCancel={onRenameCancel}
      draggable
      drag={drag}
      label={
        <>
          <span className="method-badge" style={{ color: methodColor(data.method) }}>
            {data.method}
          </span>
          <span className="tree-item-name">{data.name}</span>
        </>
      }
      onClick={() =>
        openTab({
          name: data.name,
          method: data.method,
          url: data.url,
          body: data.body ?? '',
          bodyState: data.bodyState,
          params: data.params,
          headerRows: data.headerRows ?? headerRowsFromRecord(data.headers),
          auth: data.auth,
          requestId: data.id,
          projectId,
          kind: 'request',
        })
      }
    />
  );
}

function FolderRows({
  node,
  depth,
  projectId,
  renameState,
  onStartRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  drag,
}: {
  node: Extract<TreeNode, { type: 'folder' }>;
  depth: number;
  projectId: string;
  renameState: RenameState | null;
  onStartRename: (ref: NodeRef, name: string) => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  drag: DragHandlers;
}) {
  const { treeAction } = useApp();
  const [expanded, setExpanded] = useState(true);
  const nodeRef = folderRef(projectId, node.data.id);

  return (
    <>
      <TreeRow
        depth={depth}
        nodeRef={nodeRef}
        kind="folder"
        className="folder"
        showAdd
        name={node.data.name}
        renameState={renameState}
        onStartRename={onStartRename}
        onRenameChange={onRenameChange}
        onRenameCommit={onRenameCommit}
        onRenameCancel={onRenameCancel}
        draggable
        droppable
        drag={drag}
        chevron={expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        icon={<Folder size={14} className="tree-icon" />}
        label={<span className="tree-item-name">{node.data.name}</span>}
        onClick={() => setExpanded(!expanded)}
        onAdd={() => treeAction(nodeRef, 'addRequest')}
      />
      {expanded &&
        node.data.children.map((child) => (
          <TreeNodeRows
            key={child.data.id}
            node={child}
            depth={depth + 1}
            projectId={projectId}
            renameState={renameState}
            onStartRename={onStartRename}
            onRenameChange={onRenameChange}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
            drag={drag}
          />
        ))}
    </>
  );
}

function TreeNodeRows(props: {
  node: TreeNode;
  depth: number;
  projectId: string;
  renameState: RenameState | null;
  onStartRename: (ref: NodeRef, name: string) => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  drag: DragHandlers;
}) {
  if (props.node.type === 'folder') return <FolderRows {...props} node={props.node} />;
  return <RequestRow {...props} node={props.node} />;
}

export function ProjectTree() {
  const { projects, toggleProject, renameNode, treeAction, moveTreeNode, createProject, t } = useApp();
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const renameStateRef = useRef<RenameState | null>(null);
  const [dragSource, setDragSource] = useState<NodeRef | null>(null);
  const [dropTarget, setDropTarget] = useState<NodeRef | null>(null);
  const suppressClickRef = useRef(false);

  const onStartRename = useCallback((ref: NodeRef, name: string) => {
    const next = { ref, name };
    renameStateRef.current = next;
    setRenameState(next);
  }, []);

  const onRenameChange = useCallback((name: string) => {
    const next = renameStateRef.current ? { ...renameStateRef.current, name } : null;
    renameStateRef.current = next;
    setRenameState(next);
  }, []);

  const onRenameCommit = useCallback(() => {
    const target = renameStateRef.current;
    if (target && target.name.trim()) {
      renameNode(target.ref, target.name.trim());
    }
    setRenameState(null);
    renameStateRef.current = null;
  }, [renameNode]);

  const onRenameCancel = useCallback(() => {
    setRenameState(null);
    renameStateRef.current = null;
  }, []);

  const onDragStart = useCallback(
    (ref: NodeRef) => (e: React.DragEvent) => {
      if ((e.target as HTMLElement).closest('.tree-action-btn')) {
        e.preventDefault();
        return;
      }
      suppressClickRef.current = false;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ref));
      setDragSource(ref);
    },
    []
  );

  const onDragEnd = useCallback(() => {
    suppressClickRef.current = true;
    setDragSource(null);
    setDropTarget(null);
  }, []);

  const onDragOver = useCallback(
    (targetParent: NodeRef) => (e: React.DragEvent) => {
      if (!dragSource || !canMoveNode(projects, dragSource, targetParent)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(targetParent);
    },
    [dragSource, projects]
  );

  const onDragLeave = useCallback(
    (targetParent: NodeRef) => (e: React.DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && e.currentTarget.contains(related)) return;
      setDropTarget((current) =>
        current && refsEqual(current, targetParent) ? null : current
      );
    },
    []
  );

  const onDrop = useCallback(
    (targetParent: NodeRef) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      try {
        const source = JSON.parse(raw) as NodeRef;
        moveTreeNode(source, targetParent);
      } catch {
        // ignore invalid payload
      }
      suppressClickRef.current = true;
      setDragSource(null);
      setDropTarget(null);
    },
    [moveTreeNode]
  );

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  const drag: DragHandlers = {
    dragSource,
    dropTarget,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    shouldSuppressClick,
  };

  return (
    <div className="project-tree-content no-select">
      {projects.length === 0 && (
        <div className="project-tree-empty">
          <span className="project-tree-empty-text">{t.sidebar.noProjects}</span>
          <button className="project-tree-empty-btn" onClick={() => void createProject()}>
            <Plus size={14} />
            <span>{t.sidebar.newProject}</span>
          </button>
        </div>
      )}
      {projects.map((project) => {
        const nodeRef = projectRef(project.id);
        return (
          <div key={project.id} className="project-group">
            <TreeRow
              depth={0}
              nodeRef={nodeRef}
              kind="project"
              className="project"
              showAdd
              name={project.name}
              renameState={renameState}
              onStartRename={onStartRename}
              onRenameChange={onRenameChange}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              droppable
              drag={drag}
              chevron={
                project.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              }
              icon={<FileText size={14} className="tree-icon" />}
              label={<span className="tree-item-name">{project.name}</span>}
              onClick={() => toggleProject(project.id)}
              onAdd={() => treeAction(nodeRef, 'addRequest')}
            />
            {project.expanded &&
              project.children.map((node) => (
                <TreeNodeRows
                  key={node.data.id}
                  node={node}
                  depth={1}
                  projectId={project.id}
                  renameState={renameState}
                  onStartRename={onStartRename}
                  onRenameChange={onRenameChange}
                  onRenameCommit={onRenameCommit}
                  onRenameCancel={onRenameCancel}
                  drag={drag}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
