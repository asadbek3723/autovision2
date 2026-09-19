import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/ui/States';
import { RequireAuth, RequireRole, GuestOnly } from './auth/guards';

// Marshrut darajasida code-splitting — dastlabki bundle faqat Studio uchun
// kerak bo'lgan kodni yuklaydi, qolgan sahifalar ochilganda so'raladi.
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const StudioPage = lazy(() => import('./pages/StudioPage').then((m) => ({ default: m.StudioPage })));
const CapturePage = lazy(() => import('./pages/CapturePage').then((m) => ({ default: m.CapturePage })));
const ResultPage = lazy(() => import('./pages/ResultPage').then((m) => ({ default: m.ResultPage })));
const MarketplacePage = lazy(() =>
  import('./pages/MarketplacePage').then((m) => ({ default: m.MarketplacePage }))
);
const ProductPage = lazy(() => import('./pages/ProductPage').then((m) => ({ default: m.ProductPage })));
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SellerPage = lazy(() => import('./pages/SellerPage').then((m) => ({ default: m.SellerPage })));
const SellerCreditsPage = lazy(() =>
  import('./pages/seller/SellerCreditsPage').then((m) => ({ default: m.SellerCreditsPage }))
);

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        {/* Faqat mehmonlar uchun — kirgan foydalanuvchi yo'naltiriladi */}
        <Route
          path="/auth"
          element={
            <GuestOnly>
              <AuthPage />
            </GuestOnly>
          }
        />

        {/* Barcha autentifikatsiya talab qiladigan sahifalar */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell>
                <Suspense fallback={<LoadingState />}>
                  <Routes>
                    {/* Oddiy foydalanuvchi sahifalari */}
                    <Route
                      path="/"
                      element={
                        <RequireRole role="user">
                          <StudioPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/capture"
                      element={
                        <RequireRole role="user">
                          <CapturePage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/capture/:id"
                      element={
                        <RequireRole role="user">
                          <CapturePage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/result"
                      element={
                        <RequireRole role="user">
                          <ResultPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/market"
                      element={
                        <RequireRole role="user">
                          <MarketplacePage />
                        </RequireRole>
                      }
                    />
                    <Route path="/product/:id" element={<ProductPage />} />
                    <Route
                      path="/cart"
                      element={
                        <RequireRole role="user">
                          <CartPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/checkout"
                      element={
                        <RequireRole role="user">
                          <CheckoutPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/orders"
                      element={
                        <RequireRole role="user">
                          <OrdersPage />
                        </RequireRole>
                      }
                    />
                    <Route path="/profile" element={<ProfilePage />} />

                    {/* Sotuvchi sahifalari */}
                    <Route
                      path="/seller"
                      element={
                        <RequireRole role="seller">
                          <SellerPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/seller/credits"
                      element={
                        <RequireRole role="seller">
                          <SellerCreditsPage />
                        </RequireRole>
                      }
                    />
                  </Routes>
                </Suspense>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
    </Suspense>
  );
}
