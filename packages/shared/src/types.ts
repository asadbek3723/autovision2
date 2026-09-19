import type { CategorySlug } from './customization.js';

export type UserRole = 'user' | 'seller' | 'admin';

export type OrderStatus = 'new' | 'accepted' | 'installing' | 'completed' | 'cancelled';

export interface User {
  id: string;
  login: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  is_active?: boolean;
  created_at: string;
}

export interface RegisterInput {
  role: UserRole;
  name: string;
  login: string;
  password: string;
  business_name?: string;
  phone?: string;
  address?: string;
}

export interface LoginInput {
  login: string;
  password: string;
}

export interface AuthSessionResponse {
  token: string;
  expires_at: string;
  user: User;
  seller?: Seller | null;
}

export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
  retryAfter?: number;
}

export interface Car {
  id: string;
  user_id: string;
  /** Muqova rasmi — birinchi qabul qilingan kadr */
  image_url: string | null;
  detected_brand: string | null;
  detected_model: string | null;
  vehicle_model_id: string | null;
  year: number | null;
  color: string | null;
  created_at: string;
  photos?: CarPhoto[];
}

export interface CarPhoto {
  id: string;
  car_id: string;
  image_url: string;
  /** CAPTURE_ANGLES dagi burchak id'si */
  angle: string;
  created_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  car_id: string;
  original_image: string;
  generated_image: string | null;
  prompt: string;
  categories: CategorySlug[];
  options: Record<string, string>;
  status: GenerationStatus;
  error: string | null;
  created_at: string;
}

export type GenerationStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface Seller {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  verified: boolean;
  credits: number;
  created_at: string;
}

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  sort_order: number;
}

export interface VehicleModel {
  id: string;
  brand: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
}

export interface Product {
  id: string;
  seller_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  brand: string | null;
  installation_available: boolean;
  installation_price: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductWithRelations extends Product {
  category: Pick<Category, 'id' | 'slug' | 'name'> | null;
  seller: Pick<Seller, 'id' | 'business_name' | 'verified' | 'phone'> | null;
  compatibility: VehicleModel[];
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  product?: ProductWithRelations;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  items: CartItem[];
  total: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name: string;
  product_image_url: string | null;
}

export interface Order {
  id: string;
  user_id: string;
  seller_id: string;
  total: number;
  status: OrderStatus;
  phone: string | null;
  note: string | null;
  created_at: string;
  items: OrderItem[];
  seller?: Pick<Seller, 'id' | 'business_name'> | null;
}

export interface SellerStats {
  products_count: number;
  orders_count: number;
  new_orders_count: number;
  revenue: number;
  low_stock_count: number;
  credits: number;
}

export interface ApiError {
  error: string;
  message: string;
}

/** Sotuvchi AI kredit balansidagi bitta harakat (sotib olish yoki sarflash) */
export interface CreditTransaction {
  id: string;
  seller_id: string;
  type: 'purchase' | 'consume';
  amount: number;
  package_id: string | null;
  created_at: string;
}

/** Sotuvchi o'z mahsuloti uchun AI bilan yaratgan namoyish rasmi */
export interface SellerGeneration {
  id: string;
  seller_id: string;
  product_id: string | null;
  base_image: string;
  prompt: string;
  result_image: string | null;
  status: GenerationStatus;
  error: string | null;
  created_at: string;
}

export interface AuthSession {
  token: string;
  user: User;
}
