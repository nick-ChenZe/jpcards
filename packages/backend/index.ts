import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initializeDb } from './db'
import cardsRouter from './src/routes/cards'
import chatRouter from './src/routes/chat'
import imageRouter from './src/routes/image'

dotenv.config()

const app = express()
const port = 8000

app.use(cors())
app.use(express.json())

initializeDb().catch((err) => {
  console.error('Failed to initialize the database', err)
  process.exit(1)
})

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the backend!')
})

app.use('/api/cards', cardsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/image', imageRouter)

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`)
})