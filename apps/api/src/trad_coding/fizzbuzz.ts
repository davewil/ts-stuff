import { match, P } from 'ts-pattern'
import * as readline from 'node:readline/promises'
import range from './helpers.ts'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const myFizz = (await rl.question('Your fizz is? ')) || 'fizz'
const myBuzz = (await rl.question('Your buzz is? ')) || 'buzz'
rl.close()

function fizzbuzz(n: number, fizz: string = myFizz, buzz: string = myBuzz): string {
  return match([n % 3, n % 5] as const)
    .with([0, 0], () => `${fizz}${buzz}`)
    .with([0, P._], () => `${fizz}`)
    .with([P._, 0], () => `${buzz}`)
    .otherwise(() => 'pity the fool')
}

for (const i of range(1, 21).reverse()) console.log(fizzbuzz(i))
