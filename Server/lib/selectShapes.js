// FOLLO PERF
// Reusable Prisma select shapes — use these instead of
// include: { assignee: true } which fetches all fields

export const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
};

export const userSelectMinimal = {
  id: true,
  name: true,
  image: true,
};

export const taskListSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  type: true,
  dueDate: true,
  plannedStartDate: true,
  plannedEndDate: true,
  actualStartDate: true,
  actualEndDate: true,
  slaStatus: true,
  slaClockStartedAt: true,
  assigneeId: true,
  projectId: true,
  completionWeight: true,
  extensionStatus: true,
  extensionRequestedAt: true,
  isDelayed: true,
  delayDays: true,
  sortOrder: true,
  createdAt: true,
  baselineDueDate: true,
  baselinePlannedStart: true,
  baselinePlannedEnd: true,
  assignee: { select: userSelect },
  createdBy: { select: userSelect },
  predecessors: {
    select: {
      id: true,
      predecessor: { select: { id: true, title: true, status: true } },
    },
  },
  successors: {
    select: {
      id: true,
      successor: { select: { id: true, title: true, status: true } },
    },
  },
  _count: { select: { comments: true, activities: true } },
};

export const taskDetailSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  type: true,
  dueDate: true,
  plannedStartDate: true,
  plannedEndDate: true,
  actualStartDate: true,
  actualEndDate: true,
  slaStatus: true,
  slaClockStartedAt: true,
  slaClockPausedAt: true,
  slaTotalPausedMs: true,
  slaBreachCount: true,
  slaOnTimeCount: true,
  assigneeId: true,
  createdById: true,
  projectId: true,
  completionWeight: true,
  completionNotes: true,
  completionPhotos: true,
  declarationConfirmed: true,
  isDelayed: true,
  delayDays: true,
  delayReason: true,
  submittedAt: true,
  submittedById: true,
  approvedAt: true,
  approvedById: true,
  rejectedAt: true,
  rejectedById: true,
  rejectionReason: true,
  blockerRaisedAt: true,
  blockerRaisedById: true,
  blockerDescription: true,
  blockerResolvedAt: true,
  blockerResolvedById: true,
  requiresPhotoOnBlock: true,
  extensionStatus: true,
  extensionRequestedAt: true,
  extensionRequestedById: true,
  extensionReason: true,
  extensionProposedDate: true,
  extensionOriginalDueDate: true,
  extensionApprovedAt: true,
  extensionApprovedById: true,
  extensionDeniedAt: true,
  extensionDeniedById: true,
  baselineDueDate: true,
  baselinePlannedStart: true,
  baselinePlannedEnd: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: userSelect,
  },
  createdBy: {
    select: userSelect,
  },
  project: {
    select: {
      id: true,
      name: true,
      workspaceId: true,
      status: true,
      progress: true,
      workspace: {
        select: {
          id: true,
          members: { select: { userId: true, role: true } },
        },
      },
      members: { select: { userId: true, role: true } },
    },
  },
  comments: {
    select: {
      id: true,
      content: true,
      url: true,
      type: true,
      fileKey: true,
      thumbnailUrl: true,
      duration: true,
      sizeBytes: true,
      fileName: true,
      muxPlaybackId: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  predecessors: {
    select: {
      id: true,
      lagDays: true,
      predecessor: {
        select: { id: true, title: true, status: true, plannedEndDate: true },
      },
    },
  },
  successors: {
    select: {
      id: true,
      lagDays: true,
      successor: {
        select: { id: true, title: true, status: true, plannedStartDate: true },
      },
    },
  },
  activities: {
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
  slaEvents: {
    select: {
      id: true,
      type: true,
      triggeredBy: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  },
};

export const commentSelect = {
  id: true,
  content: true,
  type: true,
  url: true,
  fileKey: true,
  thumbnailUrl: true,
  duration: true,
  sizeBytes: true,
  fileName: true,
  muxPlaybackId: true,
  muxAssetId: true,
  muxUploadId: true,
  createdAt: true,
  userId: true,
  user: { select: userSelect },
};

export const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
  metadata: true,
};

export const projectListSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  priority: true,
  progress: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  workspaceId: true,
  ownerId: true,
};

// FOLLO AUTH-FIX: Separate shapes for WorkspaceMember vs ProjectMember
// WorkspaceMember does NOT have isActive field
export const workspaceMemberSelect = {
  id: true,
  role: true,
  userId: true,
  user: { select: userSelect },
};

export const memberSelect = {
  id: true,
  role: true,
  userId: true,
  isActive: true,
  user: { select: userSelect },
};
