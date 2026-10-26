import sealFox24 from '@/assets/brand/seal-fox-24.svg';
import sealFoxEmpty from '@/assets/brand/seal-fox-empty.svg';
import {cn} from '@/lib/utils';

/** 24px 角印。缺墨处透明，可压在纸、插画或朱钮上。 */
export function SealFoxMark ({className}: {className?: string;}) {
    return (
        <img
            className={cn('seal-fox-mark', className)}
            src={sealFox24}
            width={24}
            height={24}
            alt=""
            draggable={false}
        />
    );
}

/** 空态侧影。只淡入一次，不循环。 */
export function SealFoxEmpty ({className}: {className?: string;}) {
    return (
        <img
            className={cn('seal-empty-silhouette', className)}
            src={sealFoxEmpty}
            width={132}
            height={148}
            alt=""
            draggable={false}
        />
    );
}
