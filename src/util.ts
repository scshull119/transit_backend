export function chunkArray(inputArray, chunkSize) {
    const chunks = [];
    let inputArrayCopy = [...inputArray];
    while (inputArrayCopy.length) {
        let chunk = inputArrayCopy.slice(0, 10);
        inputArrayCopy = inputArrayCopy.slice(10);
        chunks.push(chunk);
    }
    return chunks;
}
