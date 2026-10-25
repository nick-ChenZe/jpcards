declare module 'kuromoji' {
    interface KuromojiToken {
        surface_form: string;
        reading?: string;
        pronunciation?: string;
    }

    interface KuromojiTokenizer {
        tokenize: (text: string) => KuromojiToken[];
    }

    interface KuromojiBuilder {
        build: (callback: (err: Error | null, tokenizer: KuromojiTokenizer) => void) => void;
    }

    function builder (options: {dicPath: string;}): KuromojiBuilder;

    export {builder};
}

declare module 'kuromoji/src/loader/DictionaryLoader.js' {
    class DictionaryLoader {
        constructor(dicPath: string);
        load(callback: (err: Error | null, dic: unknown) => void): void;
    }
    export = DictionaryLoader;
}

declare module 'kuromoji/src/Tokenizer.js' {
    class Tokenizer {
        constructor(dic: unknown);
        tokenize(text: string): Array<{
            surface_form: string;
            reading?: string;
            pronunciation?: string;
        }>;
    }
    export = Tokenizer;
}
