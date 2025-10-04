export type Difficulty = 'Easy' | 'Normal' | 'Hard';

export interface Card {
    id: number;
    japanese: string;
    reading: string;
    meaning: string;
    difficulty: Difficulty;
}

export interface CardCreate {
    japanese: string;
    reading: string;
    meaning: string;
    difficulty?: Difficulty;
}
