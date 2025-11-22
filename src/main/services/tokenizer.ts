import { Segment } from 'segment';

class TokenizerService {
    private segment: any;
    private stopWords: Set<string>;

    constructor() {
        // @ts-ignore
        this.segment = new Segment();
        // Use default dictionary
        this.segment.useDefault();

        // Comprehensive Chinese Stop Words List
        const cnStopWords = ["的", "了", "是", "我", "你", "他"];

        const enStopWords = ["a", "the", "is", "of", "and"];

        this.stopWords = new Set([...cnStopWords, ...enStopWords]);
    }

    public tokenize(text: string): string {
        if (!text) return '';

        // Remove HTML tags and common markdown symbols
        let cleanText = text.replace(/<[^>]+>/g, ' ');
        cleanText = cleanText.replace(/[*#`_~\[\]()]/g, ' ');

        // Segment
        const result = this.segment.doSegment(cleanText, {
            simple: true // Return string array
        });

        // Filter and Join
        return result
            .filter((word: string) => {
                const w = word.trim();
                // Filter out stop words and single punctuation
                return w.length > 0 && !this.stopWords.has(w.toLowerCase()) && !/^[\p{P}\p{S}]$/u.test(w);
            })
            .map((word: string) => word.toLowerCase()) // Normalize to lowercase for index
            .join(' ');
    }
}

export const tokenizerService = new TokenizerService();
