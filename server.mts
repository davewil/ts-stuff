import { createServer } from 'node:http'

const hostname = '127.0.0.1'
const port = 3003

const server = createServer((_req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('Hello, World!')
})

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`)
})


type Server = {a: number, b: string}
type Server2 = {a: number; b: string}


const a = {} as const
const b = [1,2,3] as const


let d = 1 as const
const c = 1 as const


type A = 'pending' | 'approved' | 'rejected'}