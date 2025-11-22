declare module 'segment' {
    export class Segment {
        useDefault(): void;
        doSegment(text: string, options?: any): any[];
    }
    export function useDefault(): void;
}
