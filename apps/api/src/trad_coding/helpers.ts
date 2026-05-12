function range(start: number, end: number): number[] {
    const result: number[] = []
    for (let i = start; i < end; i++) {
        result.push(i)
    }
    return result
}

export default range

