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
