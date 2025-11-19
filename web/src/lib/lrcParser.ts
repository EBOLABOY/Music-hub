export interface LyricLine {
    time: number;
    text: string;
}

export function parseLrc(lrc: string): LyricLine[] {
    if (!lrc) return [];

    const lines = lrc.split('\n');
    const lyrics: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/g;

    for (const line of lines) {
        const matches = [...line.matchAll(timeRegex)];
        if (matches.length === 0) continue;

        const text = line.replace(timeRegex, '').trim();
        if (!text) continue;

        for (const match of matches) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[4]
                ? parseInt(match[4].padEnd(3, '0'), 10)
                : 0;

            const time = minutes * 60 + seconds + milliseconds / 1000;
            lyrics.push({ time, text });
        }
    }

    return lyrics.sort((a, b) => a.time - b.time);
}
