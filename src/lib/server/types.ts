import type { ObjectId } from 'mongodb';

export interface User {
  id?: string;
  _id?: ObjectId | string;
  name: string;
  email: string;
  passwordHash?: string;
  role: 'USER' | 'ADMIN' | 'MENTOR' | 'CREATOR' | string;
  workspaceId?: string;
  status?: 'Active' | 'Access Revoked' | 'Suspended' | 'Pending' | string;
  hasAccess?: boolean;
  allowedNavItems?: string[];
  plan?: 'free' | 'pro' | 'team' | 'yearly' | string;
  subscriptionStatus?: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'EXPIRED';
  subscriptionId?: string;
  subscriptionExpiresAt?: number;
  avatarUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VideoComment {
  id: string;
  text: string;
  author?: string;
  userName?: string;
  authorEmail?: string;
  videoTime?: string;
  timestamp?: number;
  createdAt?: number;
}

export interface VideoEditorData {
  videoId: string;
  cuts?: Array<{ start: number; end: number }>;
  trim?: { start: number; end: number };
  transcription?: string;
  speed?: number;
  updatedAt?: number;
  savedAt?: string | number;
}

export interface Video {
  id?: string;
  _id?: ObjectId | string;
  title: string;
  url?: string;
  courseId?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  mentorEmail?: string;
  hostEmail?: string;
  workspaceId?: string;
  driveFileId?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  duration?: number;
  size?: number;
  status?: 'READY' | 'UPLOADING' | 'PROCESSING' | 'ERROR' | string;
  mimeType?: string;
  isPublic?: boolean;
  shareToken?: string;
  isCompanyShared?: boolean;
  views?: number;
  editorData?: VideoEditorData | Record<string, unknown>;
  comments?: VideoComment[];
  createdAt?: number;
  updatedAt?: number;
}

export interface Workspace {
  id?: string;
  _id?: ObjectId | string;
  name: string;
  ownerId?: string;
  members?: string[];
  plan?: 'free' | 'pro' | 'team' | 'yearly' | string;
  subscriptionStatus?: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'EXPIRED';
  subscriptionId?: string;
  subscriptionExpiresAt?: number;
  createdAt?: number;
}

export interface SubscriptionRecord {
  id?: string;
  _id?: ObjectId | string;
  userId: string;
  userEmail: string;
  workspaceId?: string;
  planId: 'free' | 'pro' | 'team' | 'yearly' | string;
  amount: number;
  currency: string;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  status: 'ACTIVE' | 'CANCELLED' | 'REFUNDED';
  interval: string;
  createdAt: number;
  expiresAt: number;
}

export interface SystemSettings {
  id?: string;
  _id?: ObjectId | string;
  driveRootFolderId?: string;
  maxVideoSizeMb?: number;
  allowPublicSharing?: boolean;
  platformName?: string;
  updatedAt?: number;
}
