export type PageId =
  | 'landing'
  | 'login'
  | 'register'
  | 'student-dashboard'
  | 'ai-chat'
  | 'book-search'
  | 'book-details'
  | 'borrowed-books'
  | 'recommendations'
  | 'digital-library'
  | 'student-profile'
  | 'admin-dashboard'
  | 'book-management'
  | 'student-management'
  | 'reports'
  | 'settings';

export type AiMode = 'auto' | 'online' | 'offline';

export interface User {
  id: number;
  full_name: string;
  email: string;
  student_id: string | null;
  department: string;
  year_of_study: string;
  role: 'student' | 'admin';
  avatar_url: string | null;
  status: 'active' | 'suspended';
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description: string;
  shelf_prefix: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category_id: number;
  category_name?: string;
  department: string;
  subject: string;
  publisher: string;
  publish_year: number;
  total_copies: number;
  available_copies: number;
  shelf_location: string;
  description: string;
  qr_code_data: string;
  active_reservations?: number;
  relevanceScore?: number;
  recommendationReason?: string;
  created_at: string;
}

export interface Loan {
  id: number;
  book_id: number;
  user_id: number;
  title: string;
  author: string;
  isbn: string;
  department?: string;
  shelf_location?: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
  renewal_count: number;
  notes?: string;
}

export interface Reservation {
  id: number;
  book_id: number;
  user_id: number;
  title: string;
  author: string;
  isbn: string;
  available_copies: number;
  shelf_location: string;
  reserved_at: string;
  expires_at: string;
  status: 'active' | 'fulfilled' | 'cancelled' | 'expired';
}

export interface DigitalResource {
  id: number;
  title: string;
  author: string;
  department: string;
  subject: string;
  resource_type: 'pdf' | 'lecture_notes' | 'paper' | 'ebook';
  file_name: string;
  file_size_kb: number;
  access_role: 'all' | 'student' | 'admin';
  download_count: number;
  description: string;
  content_summary: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'due_soon' | 'overdue' | 'reservation';
  is_read: number;
  created_at: string;
}

export interface ChatMessage {
  id: string | number;
  role: 'user' | 'assistant';
  message: string;
  agent_used?: string;
  ai_mode?: 'online' | 'offline';
  fallbackUsed?: boolean;
  fallbackReason?: string;
  created_at: string;
  books?: Book[];
  digitalResources?: DigitalResource[];
  loans?: Array<{
    id: number;
    book_id: number;
    title: string;
    due_date: string;
    status: string;
    days_remaining: number;
  }>;
  suggestedActions?: Array<{ label: string; view: string; entityId?: number }>;
}

export interface ChatSessionSummary {
  session_id: string;
  first_prompt: string | null;
  last_active: string;
  message_count: number;
}
