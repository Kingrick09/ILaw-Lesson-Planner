/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  email: string;
  name: string;
  daysLeft?: number;
  active?: boolean;
}

export interface Curriculum {
  id: string;
  email: string;
  subject: string;
  grade: string;
  duration: string;
  competency: string;
  objective: string;
  context: string;
  lessonPlan: string;
  presentation: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  name?: string;
  daysLeft?: number;
  active?: boolean;
  expired?: boolean;
  isInactive?: boolean;
  error?: string;
  isFallback?: boolean;
  errorDetails?: string;
}

export interface PaymentPlan {
  id: string;
  name: string;
  tagline: string;
  pricePhp: number;
  amountInCents: number;
  days: number;
  durationLabel: string;
  popular?: boolean;
  features: string[];
}

export interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  checkoutId?: string;
  isSimulated?: boolean;
  message?: string;
}

export interface PaymentActivationRequest {
  id: string;
  email: string;
  name: string;
  planId: string;
  planName: string;
  pricePhp: number;
  days: number;
  referenceNumber: string;
  receiptImage?: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  adminRemarks?: string;
}
