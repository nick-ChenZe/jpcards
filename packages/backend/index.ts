import express, { Request, Response } from 'express'
import cors from 'cors'
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { initializeDb } from './src/database/index.js'
import cardsRouter from './src/routes/cards.js'
import chatRouter from './src/routes/chat.js'
import imageRouter from './src/routes/image.js'
import {auth} from './src/routes/auth.js'

const app = express()
const port = 8000

// app.use(
//   cors({
//     origin: "http://localhost:5173", // Replace with your frontend's origin
//     methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
//     credentials: true, // Allow credentials (cookies, authorization headers, etc.)
//   })
// );

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(cors())
app.use(express.json())

initializeDb().catch((err) => {
  console.error('Failed to initialize the database', err)
  process.exit(1)
})

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the backend!')
})

app.all('/api/*splat', async (req: Request, res: Response) => {
 	const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    return res.status(401).json({error: 'Unauthorized'});
  }
	return res.json(session);
})
app.use('/api/cards', cardsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/image', imageRouter)  

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`)
})