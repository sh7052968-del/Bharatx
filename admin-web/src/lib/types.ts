export type AdminRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'SECURITY_ADMIN'
  | 'BUSINESS_ADMIN'
  | 'FINANCE_ADMIN'
  | 'CONTENT_MODERATOR'
  | 'SUPPORT_ADMIN'
  | 'CUSTOM_ADMIN'
  | 'DEPT_ADMIN'
  | 'BUSINESS_MANAGER'
  | 'AGENT'
  | 'MEMBER';

export type AdminModuleId =
  | 'overview'
  | 'users'
  | 'admins'
  | 'roles'
  | 'features'
  | 'business'
  | 'moderation'
  | 'finance'
  | 'notifications'
  | 'analytics'
  | 'settings'
  | 'audit'
  | 'developer';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: AdminRole;
  mfaEnabled: boolean;
  permissions?: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  PLATFORM_ADMIN: 'Platform Admin',
  SECURITY_ADMIN: 'Security Admin',
  BUSINESS_ADMIN: 'Business Admin',
  FINANCE_ADMIN: 'Finance Admin',
  CONTENT_MODERATOR: 'Content Moderator',
  SUPPORT_ADMIN: 'Customer Support Admin',
  CUSTOM_ADMIN: 'Custom Admin',
  DEPT_ADMIN: 'Department Admin',
  BUSINESS_MANAGER: 'Business Manager',
  AGENT: 'Support Agent',
  MEMBER: 'Member',
};

export const ROLE_VISIBLE_MODULES: Record<AdminRole, AdminModuleId[]> = {
  SUPER_ADMIN: [
    'overview',
    'users',
    'admins',
    'roles',
    'features',
    'business',
    'moderation',
    'finance',
    'notifications',
    'analytics',
    'settings',
    'audit',
    'developer',
  ],
  PLATFORM_ADMIN: [
    'overview',
    'users',
    'features',
    'business',
    'notifications',
    'analytics',
    'settings',
    'developer',
  ],
  SECURITY_ADMIN: ['overview', 'users', 'admins', 'moderation', 'settings', 'audit'],
  BUSINESS_ADMIN: ['overview', 'business', 'moderation', 'analytics'],
  FINANCE_ADMIN: ['overview', 'finance', 'analytics', 'audit'],
  CONTENT_MODERATOR: ['overview', 'users', 'business', 'moderation', 'audit'],
  SUPPORT_ADMIN: ['overview', 'users', 'moderation', 'notifications'],
  CUSTOM_ADMIN: ['overview'],
  DEPT_ADMIN: ['overview', 'users', 'features', 'business', 'notifications', 'settings', 'audit'],
  BUSINESS_MANAGER: ['overview', 'business'],
  AGENT: ['overview', 'users', 'moderation'],
  MEMBER: [],
};

export type ClientNavTab =
  | 'chats'
  | 'contacts'
  | 'communities'
  | 'calls'
  | 'business'
  | 'status'
  | 'settings';

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    presenceStatus?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
  };
}

export interface Conversation {
  id: string;
  type: 'PRIVATE' | 'GROUP' | 'SUPPORT';
  title: string | null;
  isEncrypted: boolean;
  disappearingTtlSeconds: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  unreadCount?: number;
  lastMessage?: Message;
  group?: {
    id: string;
    announcementsOnly: boolean;
  } | null;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'SYSTEM';
  plaintextBody: string | null;
  ciphertext: string | null;
  nonce: string | null;
  mediaUrl?: string | null;
  deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  isPinned: boolean;
  isStarred?: boolean;
  replyToId?: string | null;
  reactions?: MessageReaction[];
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface UserContact {
  id: string;
  userId: string;
  contactUserId: string;
  nickname?: string | null;
  createdAt: string;
  contactUser: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    presenceStatus: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
  };
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  announcements?: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
  }>;
}

export interface CallRecord {
  id: string;
  callType: 'VOICE' | 'VIDEO' | 'GROUP';
  callerId: string;
  status: 'RINGING' | 'ACTIVE' | 'ENDED' | 'MISSED' | 'DECLINED';
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  caller?: {
    id: string;
    displayName: string;
    username: string;
  };
  participants?: Array<{
    userId: string;
    status: string;
    user?: {
      displayName: string;
    };
  }>;
}

export interface BusinessProfile {
  id: string;
  ownerId: string;
  businessName: string;
  category: string;
  description: string | null;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  greetingMessage?: string | null;
  awayMessage?: string | null;
  workingHours?: string | null;
  createdAt: string;
}

export interface ProductItem {
  id: string;
  businessId: string;
  sku: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  inStock: boolean;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  businessId: string;
  customerUserId?: string | null;
  customerName: string;
  labels: string[];
  createdAt: string;
  notes?: Array<{
    id: string;
    note: string;
    createdAt: string;
  }>;
}

export interface OrderInquiry {
  id: string;
  businessId: string;
  customerUserId: string;
  productId: string;
  quantity: number;
  totalCents: number;
  status: 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED';
  createdAt: string;
  product?: ProductItem;
}

export interface QuickReply {
  id: string;
  businessId: string;
  shortcut: string;
  message: string;
}

export interface StatusUpdate {
  id: string;
  userId: string;
  userName: string;
  type: 'TEXT' | 'IMAGE';
  content: string;
  background?: string;
  createdAt: string;
  expiresAt: string;
  viewsCount: number;
}

