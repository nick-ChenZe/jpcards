import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {AuthLayout} from './components/AuthLayout';
import {LoginForm} from './components/LoginForm';
import {AdminCardsPage} from './components/pages/AdminCardsPage';
import {ExplorePage} from './components/pages/ExplorePage';
import {FriendPage} from './components/pages/FriendPage';
import {HistoryDetailPage} from './components/pages/HistoryDetailPage';
import {HistoryPage} from './components/pages/HistoryPage';
import {SettingPage} from './components/pages/SettingPage';
import {ProductIntro} from './components/ProductIntro';
import {SignUpForm} from './components/SignUpForm';
import {Toaster} from './components/ui/sonner';

function App () {
    return (
        <BrowserRouter>
            <div className="hiyori-root">
                <Routes>
                    {/* 需要认证的路由，带底部导航 */}
                    <Route element={<AuthLayout />}>
                        <Route path="/explore" element={<ExplorePage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/admin/cards" element={<AdminCardsPage />} />
                        <Route path="/history/:id" element={<HistoryDetailPage />} />
                        <Route path="/friend" element={<FriendPage />} />
                        <Route path="/setting" element={<SettingPage />} />
                    </Route>

                    {/* 公开路由 */}
                    <Route
                        path="/login"
                        element={
                            <ProductIntro>
                                <LoginForm />
                            </ProductIntro>
                        }
                    />
                    <Route
                        path="/sign-up"
                        element={
                            <ProductIntro>
                                <SignUpForm />
                            </ProductIntro>
                        }
                    />

                    {/* 默认重定向到探索页 */}
                    <Route path="*" element={<Navigate to="/explore" replace />} />
                </Routes>
                <Toaster />
            </div>
        </BrowserRouter>
    );
}

export default App;
