import {Users} from 'lucide-react';

export const FriendPage = () => {
    return (
        <div className="px-4 py-3 pb-20">
            <div className="mx-auto max-w-3xl">
                <h1 className="mb-4 text-xl font-bold">好友</h1>
                <div className="flex flex-col items-center justify-center py-20">
                    <Users className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">好友功能即将上线</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        在这里你可以添加好友，互相分享学习进度
                    </p>
                </div>
            </div>
        </div>
    );
};
