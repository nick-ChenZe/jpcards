import type {CSSProperties} from 'react';

// Hand-drawn centre lines, in the writing order of 抽 / 签 / 中.
const characters = [
    [
        'M2 8.5 Q5 8 8 7.6',
        'M5.3 3 L5.6 20.5 Q5.6 22 3.8 20.8',
        'M1.5 15.5 L8 12',
        'M10 8 L10.3 21',
        'M10 8 L21 7.5 L20.6 20.8',
        'M15.5 2.5 L15.6 20.3',
        'M10.5 14 L20.5 13.6',
        'M10.4 20.7 L20.6 20.3'
    ],
    [
        'M5 2 L2 7',
        'M4 4.5 L10 4.2',
        'M7 5 L8.3 7',
        'M15 2 L12 6.7',
        'M14 4.5 L21 4.1',
        'M17.5 5 L19 7',
        'M11.7 8 Q8.5 12 2 14',
        'M12 8 Q15.5 12 22 13.5',
        'M7.5 13.2 L16.5 12.9',
        'M6 15.5 L7.7 18',
        'M11.5 14.7 L12.1 18',
        'M18.5 15 L15.7 19.4',
        'M3 21.4 Q12 20.8 21 21'
    ],
    ['M3 7 L3.5 16', 'M3 7 L20.5 6.7 L20 15.5', 'M3.5 15.7 L20 15.5', 'M12 2 L12.2 22']
];

export function DrawWriting () {
    let stroke = 0;
    return (
        <svg className="draw-writing" viewBox="0 0 92 26" aria-hidden="true" fill="none">
            {characters.map((paths, character) => (
                <g key={character} transform={`translate(${character * 29} 1)`}>
                    {paths.map((d) => (
                        <path
                            key={d}
                            d={d}
                            pathLength={1}
                            style={{'--stroke-order': stroke++} as CSSProperties}
                        />
                    ))}
                </g>
            ))}
            <circle className="draw-ink-dot" cx={89} cy={21} r={1.2} />
        </svg>
    );
}
