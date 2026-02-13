import {Settings} from 'lucide-react';
import {signOut} from '@/lib/auth';
import {Button} from '../ui/button';
import {useNavigate} from 'react-router-dom';

export const SettingPage = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="px-4 py-3 pb-20">
            <div className="mx-auto max-w-3xl">
                <h1 className="mb-4 text-xl font-bold">设置</h1>
                <div className="flex flex-col items-center justify-center py-20">
                    <Settings className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">设置页面即将上线</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        更多个性化设置敬请期待
                    </p>
                    <Button variant="outline" className="mt-6" onClick={handleLogout}>
                        退出登录
                    </Button>
                </div>
            </div>
        </div>
    );
};
