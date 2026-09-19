import type {
  AuthSessionResponse,
  Cart,
  Car,
  CarPhoto,
  Category,
  CreditTransaction,
  Generation,
  LoginInput,
  Order,
  ProductWithRelations,
  RegisterInput,
  Seller,
  SellerGeneration,
  SellerStats,
  User,
  VehicleModel,
} from '@carvision/shared';
import { getSessionToken } from './session';

// Oxiridagi "/" olib tashlanadi (aks holda `//api/...` bo'lib qoladi). Production build'da
// VITE_API_URL berilmasa localhost'ga emas, shu domenning o'ziga (`/api/...`) so'rov ketadi.
const BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8787' : '')).replace(/\/+$/, '');

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfter?: number
  ) {
    super(message);
  }
}

function authHeader(): string | null {
  const token = getSessionToken();
  if (token) return `Bearer ${token}`;
  return null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const auth = authHeader();
  if (auth) headers.set('Authorization', auth);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE}${path}`, {
    signal: init.signal ?? AbortSignal.timeout(35000),
    ...init,
    headers,
  });

  if (!response.ok) {
    let code = 'request_error';
    let message = `Soʻrov bajarilmadi (${response.status})`;
    let fields: Record<string, string> | undefined;
    let retryAfter: number | undefined;

    const retryHeader = response.headers.get('Retry-After');
    if (retryHeader) retryAfter = Number(retryHeader);

    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        fields?: Record<string, string>;
        retryAfter?: number;
      };
      code = body.error ?? code;
      message = body.message ?? message;
      fields = body.fields;
      if (body.retryAfter) retryAfter = body.retryAfter;
    } catch {}

    if (
      response.status === 401 &&
      !path.startsWith('/api/auth/login') &&
      !path.startsWith('/api/auth/register') &&
      !path.startsWith('/api/auth/login-available')
    ) {
      window.dispatchEvent(new Event('carvision:session-expired'));
    }

    throw new ApiRequestError(response.status, code, message, fields, retryAfter);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const api = {
  register: (data: RegisterInput) => post<AuthSessionResponse>('/api/auth/register', data),
  login: (data: LoginInput) => post<AuthSessionResponse>('/api/auth/login', data),
  logout: () => post<void>('/api/auth/logout'),
  loginAvailable: (login: string) =>
    get<{ available: boolean; reason?: string }>(`/api/auth/login-available?login=${encodeURIComponent(login)}`),

  me: () => get<{ user: User; seller: Seller | null }>('/api/me'),
  updateMe: (patchBody: { name?: string; phone?: string }) =>
    patch<{ user: User }>('/api/me', patchBody),
  changePassword: (body: { current_password?: string; new_password?: string }) =>
    post<{ ok: boolean }>('/api/me/password', body),

  categories: () => get<{ categories: Category[] }>('/api/categories'),
  vehicleModels: () => get<{ vehicle_models: VehicleModel[] }>('/api/vehicle-models'),

  createCar: (body: {
    vehicle_model_id?: string | null;
    year?: number | null;
    color?: string | null;
  }) => post<{ car: Car }>('/api/cars', body),
  cars: () => get<{ cars: Car[] }>('/api/cars'),
  car: (id: string) => get<{ car: Car }>(`/api/cars/${id}`),

  uploadCarPhoto: (carId: string, blob: Blob, angle: string) => {
    const form = new FormData();
    form.append('angle', angle);
    form.append('file', blob, `${angle}.jpg`);
    return request<{ photo: CarPhoto; photos_count: number }>(`/api/cars/${carId}/photos`, {
      method: 'POST',
      body: form,
    });
  },
  deleteCarPhoto: (carId: string, photoId: string) =>
    del<{ ok: boolean }>(`/api/cars/${carId}/photos/${photoId}`),

  generate: (body: {
    car_id: string;
    photo_url?: string;
    options: Record<string, string>;
    free_text?: string;
  }) => post<{ generation: Generation }>('/api/generations', body),
  generations: () => get<{ generations: Generation[] }>('/api/generations'),

  products: (params: {
    categories?: string[];
    vehicle_model_id?: string;
    search?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.categories?.length) query.set('categories', params.categories.join(','));
    if (params.vehicle_model_id) query.set('vehicle_model_id', params.vehicle_model_id);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    return get<{ products: ProductWithRelations[] }>(`/api/products?${query.toString()}`);
  },
  product: (id: string) => get<{ product: ProductWithRelations }>(`/api/products/${id}`),

  cart: () => get<{ cart: Cart }>('/api/cart'),
  addToCart: (productId: string, quantity = 1) =>
    post<{ cart: Cart }>('/api/cart/items', { product_id: productId, quantity }),
  setCartQuantity: (itemId: string, quantity: number) =>
    patch<{ cart: Cart }>(`/api/cart/items/${itemId}`, { quantity }),
  removeCartItem: (itemId: string) => del<{ cart: Cart }>(`/api/cart/items/${itemId}`),

  createOrder: (body: { phone: string; note?: string }) =>
    post<{ orders: Order[] }>('/api/orders', body),
  orders: () => get<{ orders: Order[] }>('/api/orders'),
  cancelOrder: (id: string) => post<{ order: Order }>(`/api/orders/${id}/cancel`),

  sellerProfile: () => get<{ seller: Seller }>('/api/seller/profile'),
  updateSellerProfile: (body: {
    business_name?: string;
    description?: string | null;
    phone?: string | null;
    address?: string | null;
  }) => patch<{ seller: Seller }>('/api/seller/profile', body),
  sellerStats: () => get<{ stats: SellerStats }>('/api/seller/stats'),
  sellerProducts: () => get<{ products: ProductWithRelations[] }>('/api/seller/products'),
  createSellerProduct: (body: Record<string, unknown>) =>
    post<{ product: ProductWithRelations }>('/api/seller/products', body),
  updateSellerProduct: (id: string, body: Record<string, unknown>) =>
    patch<{ product: ProductWithRelations }>(`/api/seller/products/${id}`, body),
  deleteSellerProduct: (id: string) => del<{ ok: boolean }>(`/api/seller/products/${id}`),
  restoreSellerProduct: (id: string) => post<{ ok: boolean }>(`/api/seller/products/${id}/restore`),
  uploadSellerProductImage: (blob: Blob) => {
    const form = new FormData();
    form.append('file', blob, 'product.jpg');
    return request<{ image_url: string }>('/api/seller/products/image', {
      method: 'POST',
      body: form,
    });
  },

  sellerOrders: () => get<{ orders: Order[] }>('/api/seller/orders'),
  updateOrderStatus: (id: string, status: string) =>
    patch<{ order: Order }>(`/api/seller/orders/${id}`, { status }),

  sellerCredits: () => get<{ credits: number; transactions: CreditTransaction[] }>('/api/seller/credits'),
  purchaseCredits: (packageId: string) =>
    post<{ seller: Seller }>('/api/seller/credits/purchase', { package_id: packageId }),
  sellerGenerations: () => get<{ generations: SellerGeneration[] }>('/api/seller/generations'),
  sellerGenerate: (blob: Blob, prompt: string, productId?: string) => {
    const form = new FormData();
    form.append('file', blob, 'source.jpg');
    form.append('prompt', prompt);
    if (productId) form.append('product_id', productId);
    return request<{ generation: SellerGeneration }>('/api/seller/generate', {
      method: 'POST',
      body: form,
    });
  },
};
