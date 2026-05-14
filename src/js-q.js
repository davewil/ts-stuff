// What order will the letters be printed in?
console.log('A');



setTimeout(() => {
  console.log('B');
  Promise.resolve().then(() => {
    console.log('C');
  });
}, 0);

Promise.resolve().then(() => {
  console.log('D');
  setTimeout(() => {
    console.log('E');
  }, 0);
})

Promise.resolve().then(() => {
  console.log('F');
  Promise.resolve().then(() => {
    console.log('G');
  });
})

console.log('H')

