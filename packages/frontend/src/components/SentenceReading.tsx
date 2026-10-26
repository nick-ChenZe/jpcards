import {kanaReading, readingWordGroups, readingWords} from '../lib/readingPresentation';

export function SentenceReading ({sentenceHtml, reading, tokens, activeIndex}: {
    sentenceHtml?: string;
    reading?: string;
    tokens: unknown;
    activeIndex: number | null;
}) {
    const words = readingWords(sentenceHtml, tokens);
    if (words) {
        return (
            <div className="sentence-reading font-japanese" lang="ja" aria-label="日语句子">
                {readingWordGroups(words).map((group) => (
                    <span className="reading-run" key={group[0]}>
                        {group.map((index) => {
                            const word = words[index];
                            return (
                                <span
                                    className="reading-word"
                                    key={`${index}-${word.surface}`}
                                    data-active={index === activeIndex || undefined}
                                >
                                    <ruby>
                                        {word.surface}
                                        <rp>（</rp>
                                        <rt>{word.annotation || '\u00a0'}</rt>
                                        <rp>）</rp>
                                    </ruby>
                                </span>
                            );
                        })}
                    </span>
                ))}
            </div>
        );
    }
    if (sentenceHtml) {
        return (
            <div
                className="sentence-reading reading-fallback font-japanese"
                lang="ja"
                dangerouslySetInnerHTML={{__html: sentenceHtml}}
            />
        );
    }
    const kana = kanaReading(reading);
    return kana ? <p className="sentence-reading reading-fallback font-japanese" lang="ja">{kana}</p> : null;
}
