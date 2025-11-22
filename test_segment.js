const { Segment } = require('segment');
const segment = new Segment();
segment.useDefault();

const text = "Hello World! 这是React Hooks的测试。Testing mixed languages.";
const result = segment.doSegment(text, { simple: true });

console.log('Original:', text);
console.log('Segmented:', result);
