import type { Project, TreeNode, RequestItem, FolderItem, HttpMethod } from '../types';

export type NodeType = 'project' | 'folder' | 'request';

export interface NodeRef {
  projectId: string;
  nodeId: string;
  nodeType: NodeType;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function findRequest(projects: Project[], requestId: string): {
  ref: NodeRef;
  request: RequestItem;
} | null {
  for (const project of projects) {
    const found = walkNodes(project.children, requestId);
    if (found) {
      return { ref: { projectId: project.id, nodeId: requestId, nodeType: 'request' }, request: found };
    }
  }
  return null;
}

function walkNodes(nodes: TreeNode[], requestId: string): RequestItem | null {
  for (const node of nodes) {
    if (node.type === 'request' && node.data.id === requestId) return node.data;
    if (node.type === 'folder') {
      const found = walkNodes(node.data.children, requestId);
      if (found) return found;
    }
  }
  return null;
}

export function findFolder(projects: Project[], folderId: string): NodeRef | null {
  for (const project of projects) {
    if (project.id === folderId) {
      return { projectId: project.id, nodeId: folderId, nodeType: 'project' };
    }
    const ref = walkFolders(project.id, project.children, folderId);
    if (ref) return ref;
  }
  return null;
}

function walkFolders(projectId: string, nodes: TreeNode[], folderId: string): NodeRef | null {
  for (const node of nodes) {
    if (node.type === 'folder') {
      if (node.data.id === folderId) {
        return { projectId, nodeId: folderId, nodeType: 'folder' };
      }
      const ref = walkFolders(projectId, node.data.children, folderId);
      if (ref) return ref;
    }
  }
  return null;
}

function getChildrenList(projects: Project[], ref: NodeRef): TreeNode[] | null {
  if (ref.nodeType === 'project') {
    const project = projects.find((p) => p.id === ref.projectId);
    return project?.children ?? null;
  }
  const project = projects.find((p) => p.id === ref.projectId);
  if (!project) return null;
  const folder = findFolderNode(project.children, ref.nodeId);
  return folder?.data.children ?? null;
}

function findFolderNode(nodes: TreeNode[], folderId: string): { type: 'folder'; data: FolderItem } | null {
  for (const node of nodes) {
    if (node.type === 'folder') {
      if (node.data.id === folderId) return node;
      const found = findFolderNode(node.data.children, folderId);
      if (found) return found;
    }
  }
  return null;
}

export function addRequestTo(
  projects: Project[],
  parent: NodeRef,
  request: RequestItem
): Project[] {
  return mapChildren(projects, parent, (children) => [
    ...children,
    { type: 'request' as const, data: request },
  ]);
}

export function addFolderTo(
  projects: Project[],
  parent: NodeRef,
  folder: FolderItem
): Project[] {
  return mapChildren(projects, parent, (children) => [
    ...children,
    { type: 'folder' as const, data: folder },
  ]);
}

function mapChildren(
  projects: Project[],
  parent: NodeRef,
  fn: (children: TreeNode[]) => TreeNode[]
): Project[] {
  return projects.map((project) => {
    if (parent.nodeType === 'project' && project.id === parent.nodeId) {
      return { ...project, children: fn(project.children) };
    }
    if (project.id !== parent.projectId) return project;
    return {
      ...project,
      children: mapNodeChildren(project.children, parent.nodeId, fn),
    };
  });
}

function mapNodeChildren(
  nodes: TreeNode[],
  folderId: string,
  fn: (children: TreeNode[]) => TreeNode[]
): TreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      if (node.data.id === folderId) {
        return { ...node, data: { ...node.data, children: fn(node.data.children) } };
      }
      return {
        ...node,
        data: {
          ...node.data,
          children: mapNodeChildren(node.data.children, folderId, fn),
        },
      };
    }
    return node;
  });
}

export function updateRequestInTree(
  projects: Project[],
  requestId: string,
  patch: Partial<RequestItem>
): Project[] {
  return projects.map((project) => ({
    ...project,
    children: patchRequestNodes(project.children, requestId, patch),
  }));
}

function patchRequestNodes(nodes: TreeNode[], requestId: string, patch: Partial<RequestItem>): TreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'request' && node.data.id === requestId) {
      return { ...node, data: { ...node.data, ...patch } };
    }
    if (node.type === 'folder') {
      return {
        ...node,
        data: {
          ...node.data,
          children: patchRequestNodes(node.data.children, requestId, patch),
        },
      };
    }
    return node;
  });
}

export function renameNodeInTree(projects: Project[], ref: NodeRef, name: string): Project[] {
  if (ref.nodeType === 'project') {
    return projects.map((p) => (p.id === ref.nodeId ? { ...p, name } : p));
  }
  if (ref.nodeType === 'folder') {
    return projects.map((project) => ({
      ...project,
      children: renameFolderNode(project.children, ref.nodeId, name),
    }));
  }
  return updateRequestInTree(projects, ref.nodeId, { name });
}

function renameFolderNode(nodes: TreeNode[], folderId: string, name: string): TreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      if (node.data.id === folderId) {
        return { ...node, data: { ...node.data, name } };
      }
      return {
        ...node,
        data: { ...node.data, children: renameFolderNode(node.data.children, folderId, name) },
      };
    }
    return node;
  });
}

export function deleteNodeFromTree(projects: Project[], ref: NodeRef): Project[] {
  if (ref.nodeType === 'project') {
    return projects.filter((p) => p.id !== ref.nodeId);
  }
  return projects.map((project) => ({
    ...project,
    children: deleteFromNodes(project.children, ref),
  }));
}

function deleteFromNodes(nodes: TreeNode[], ref: NodeRef): TreeNode[] {
  return nodes
    .filter((node) => {
      const id = node.type === 'folder' ? node.data.id : node.data.id;
      return id !== ref.nodeId;
    })
    .map((node) => {
      if (node.type === 'folder') {
        return {
          ...node,
          data: { ...node.data, children: deleteFromNodes(node.data.children, ref) },
        };
      }
      return node;
    });
}

export function duplicateNodeInTree(projects: Project[], ref: NodeRef): Project[] {
  const node = extractNode(projects, ref);
  if (!node) return projects;

  const parent = getParentRef(projects, ref);
  if (!parent) return projects;

  const cloned = cloneNode(node);
  return addClonedNode(projects, parent, cloned);
}

function extractNode(projects: Project[], ref: NodeRef): TreeNode | null {
  if (ref.nodeType === 'project') return null;
  const project = projects.find((p) => p.id === ref.projectId);
  if (!project) return null;
  return findNodeById(project.children, ref.nodeId);
}

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    const nodeId = node.data.id;
    if (nodeId === id) return node;
    if (node.type === 'folder') {
      const found = findNodeById(node.data.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getParentRef(projects: Project[], ref: NodeRef): NodeRef | null {
  for (const project of projects) {
    if (ref.nodeType === 'request' || ref.nodeType === 'folder') {
      if (containsNode(project.children, ref.nodeId)) {
        const folderParent = findParentFolder(project.children, ref.nodeId);
        if (folderParent) {
          return { projectId: project.id, nodeId: folderParent, nodeType: 'folder' };
        }
        return { projectId: project.id, nodeId: project.id, nodeType: 'project' };
      }
    }
  }
  return null;
}

function containsNode(nodes: TreeNode[], id: string): boolean {
  return findNodeById(nodes, id) !== null;
}

function findParentFolder(nodes: TreeNode[], childId: string, parentId?: string): string | null {
  for (const node of nodes) {
    if (node.type === 'folder') {
      if (node.data.children.some((c) => c.data.id === childId)) {
        return node.data.id;
      }
      const found = findParentFolder(node.data.children, childId, node.data.id);
      if (found) return found;
    }
  }
  return null;
}

function cloneNode(node: TreeNode): TreeNode {
  if (node.type === 'request') {
    const id = newId('req');
    return {
      type: 'request',
      data: {
        ...node.data,
        id,
        name: `${node.data.name} (copy)`,
      },
    };
  }
  const id = newId('folder');
  return {
    type: 'folder',
    data: {
      id,
      name: `${node.data.name} (copy)`,
      children: node.data.children.map(cloneNodeDeep),
    },
  };
}

function cloneNodeDeep(node: TreeNode): TreeNode {
  if (node.type === 'request') {
    return {
      type: 'request',
      data: { ...node.data, id: newId('req') },
    };
  }
  return {
    type: 'folder',
    data: {
      ...node.data,
      id: newId('folder'),
      children: node.data.children.map(cloneNodeDeep),
    },
  };
}

function addClonedNode(projects: Project[], parent: NodeRef, node: TreeNode): Project[] {
  return mapChildren(projects, parent, (children) => [...children, node]);
}

function folderContainsFolderId(nodes: TreeNode[], folderId: string): boolean {
  for (const node of nodes) {
    if (node.type === 'folder') {
      if (node.data.id === folderId) return true;
      if (folderContainsFolderId(node.data.children, folderId)) return true;
    }
  }
  return false;
}

function isFolderDescendant(
  projects: Project[],
  ancestorFolderId: string,
  candidateFolderId: string
): boolean {
  for (const project of projects) {
    const ancestor = findFolderNode(project.children, ancestorFolderId);
    if (!ancestor) continue;
    if (folderContainsFolderId(ancestor.data.children, candidateFolderId)) return true;
  }
  return false;
}

export function canMoveNode(
  projects: Project[],
  source: NodeRef,
  targetParent: NodeRef
): boolean {
  if (source.nodeType === 'project') return false;
  if (targetParent.nodeType === 'request') return false;
  if (source.projectId !== targetParent.projectId) return false;

  if (source.nodeType === 'folder' && targetParent.nodeType === 'folder') {
    if (source.nodeId === targetParent.nodeId) return false;
    if (isFolderDescendant(projects, source.nodeId, targetParent.nodeId)) return false;
  }

  const currentParent = getParentRef(projects, source);
  if (!currentParent) return false;
  if (
    currentParent.nodeId === targetParent.nodeId &&
    currentParent.nodeType === targetParent.nodeType
  ) {
    return false;
  }

  return true;
}

export function moveNodeInTree(
  projects: Project[],
  source: NodeRef,
  targetParent: NodeRef
): Project[] | null {
  if (!canMoveNode(projects, source, targetParent)) return null;

  const node = extractNode(projects, source);
  if (!node) return null;

  const without = deleteNodeFromTree(projects, source);
  return mapChildren(without, targetParent, (children) => [...children, node]);
}

export function createDefaultRequest(name = 'New request'): RequestItem {
  return {
    id: newId('req'),
    name,
    method: 'GET' as HttpMethod,
    url: '',
    body: '',
  };
}

export function createDefaultFolder(name = 'New folder'): FolderItem {
  return {
    id: newId('folder'),
    name,
    children: [],
  };
}

export function getNodeForCopy(projects: Project[], ref: NodeRef): unknown | null {
  if (ref.nodeType === 'project') {
    return projects.find((p) => p.id === ref.nodeId) ?? null;
  }
  const project = projects.find((p) => p.id === ref.projectId);
  if (!project) return null;
  return findNodeById(project.children, ref.nodeId);
}

export function projectRef(projectId: string): NodeRef {
  return { projectId, nodeId: projectId, nodeType: 'project' };
}

export function folderRef(projectId: string, folderId: string): NodeRef {
  return { projectId, nodeId: folderId, nodeType: 'folder' };
}

export function requestRef(projectId: string, requestId: string): NodeRef {
  return { projectId, nodeId: requestId, nodeType: 'request' };
}

export function getDefaultSaveParent(projects: Project[]): NodeRef | null {
  if (projects.length === 0) return null;
  return projectRef(projects[0].id);
}
