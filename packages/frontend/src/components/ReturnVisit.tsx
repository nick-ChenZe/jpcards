/** 昨日矮纸砖。不可点，不是主卡，也不提示补签。 */
export function ReturnVisit ({sentence}: {sentence: string;}) {
    return (
        <aside className="return-visit" aria-label="昨日一句">
            <p className="return-visit-kicker">昨日</p>
            <p className="return-visit-sentence" lang="ja">{sentence}</p>
        </aside>
    );
}
