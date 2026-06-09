import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import sucursalesRouter from './routes/sucursales.js'
import librosRouter from './routes/libros.js'
import prestamosRouter from './routes/prestamos.js'
import usuariosRouter from './routes/usuarios.js'
import prestamosNodosCRUDRouter from './routes/prestamosNodosCRUD.js'
import { MI_NODO, nodos } from './db/pool.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/sucursales', sucursalesRouter)
app.use('/api/libros', librosRouter)
app.use('/api/prestamos', prestamosRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/prestamos-nodos', prestamosNodosCRUDRouter)

const PORT = 3001
const server = app.listen(PORT, () => {
  const nodo = nodos[MI_NODO]
  console.log(`API corriendo en http://localhost:${PORT}`)
  console.log(`Nodo ${MI_NODO} — ${nodo?.nombre ?? '?'} (${nodo?.host ?? 'IP no definida'})`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ El puerto ${PORT} ya está en uso.`)
    console.error(`   Hay otra instancia del servidor corriendo. Libéralo con:`)
    console.error(`   lsof -ti:${PORT} | xargs kill -9\n`)
    process.exit(1)
  }
  throw err
})
