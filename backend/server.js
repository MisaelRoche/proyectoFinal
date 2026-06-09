import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import sucursalesRouter from './routes/sucursales.js'
import librosRouter from './routes/libros.js'
import prestamosRouter from './routes/prestamos.js'
import usuariosRouter from './routes/usuarios.js'
import consultaZahidRouter from './routes/consultaZahid.js'
import { MI_NODO, nodos } from './db/pool.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/sucursales', sucursalesRouter)
app.use('/api/libros', librosRouter)
app.use('/api/prestamos', prestamosRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/consulta-zahid', consultaZahidRouter)

const PORT = 3001
app.listen(PORT, () => {
  const nodo = nodos[MI_NODO]
  console.log(`API corriendo en http://localhost:${PORT}`)
  console.log(`Nodo ${MI_NODO} — ${nodo?.nombre ?? '?'} (${nodo?.host ?? 'IP no definida'})`)
})
