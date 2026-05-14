// Two more puzzles. What order will these print in?

// ── Puzzle 1: the Promise executor body
console.log('1');
new Promise((resolve) => {
  console.log('2');
  resolve();
  console.log('3');
}).then(() => console.log('4'));
console.log('5');


// ── Puzzle 2: two parallel .then chains
Promise.resolve().then(() => console.log('A1'))
                 .then(() => console.log('A2'))
                 .then(() => console.log('A3'));

Promise.resolve().then(() => console.log('B1'))
                 .then(() => console.log('B2'))
                 .then(() => console.log('B3'));
