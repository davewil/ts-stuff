function factorial(n: number): number {
  if (n < 0)
    throw new Error("Number must be positive")

  if (n === 0)
    return 1

  return n * factorial(n - 1)
}

try {
  factorial(-1)
}
catch (err) {
  console.log(err)
}
console.log(factorial(0))
console.log(factorial(1))
console.log(factorial(6))
