import express from 'express'
import cors from 'cors'
import sucursalesRouter from './routes/sucursales.js'
import librosRouter from './routes/libros.js'
import prestamosRouter from './routes/prestamos.js'
import usuariosRouter from './routes/usuarios.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/sucursales', sucursalesRouter)
app.use('/api/libros', librosRouter)
app.use('/api/prestamos', prestamosRouter)
app.use('/api/usuarios', usuariosRouter)

const PORT = 3001
app.listen(PORT, () => console.log(`API corriendo en http://localhost:${PORT}`))
