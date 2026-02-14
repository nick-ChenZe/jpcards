import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {AuthLayout} from './components/AuthLayout';
import {LoginForm} from './components/LoginForm';
import {ExplorePage} from './components/pages/ExplorePage';
import {FriendPage} from './components/pages/FriendPage';
import {HistoryPage} from './components/pages/HistoryPage';
import {SettingPage} from './components/pages/SettingPage';
import {SignUpForm} from './components/SignUpForm';
import {Toaster} from './components/ui/sonner';

function App () {
    return (
        <BrowserRouter>
            <div className="h-screen w-screen">
                <Routes>
                    {/* 需要认证的路由，带底部导航 */}
                    <Route element={<AuthLayout />}>
                        <Route path="/explore" element={<ExplorePage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/friend" element={<FriendPage />} />
                        <Route path="/setting" element={<SettingPage />} />
                    </Route>

                    {/* 公开路由 */}
                    <Route
                        path="/login"
                        element={
                            <div className="flex h-full w-full items-center justify-center">
                                <LoginForm />
                            </div>
                        }
                    />
                    <Route
                        path="/sign-up"
                        element={
                            <div className="flex h-full w-full items-center justify-center">
                                <SignUpForm />
                            </div>
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
