# Pasos para ejecutar tu nodo — Biblioteca BC

**✅ Credenciales MySQL ya están configuradas en todos los nodos.**

Solo ejecuta los siguientes pasos en tu PC. **Sustituye N por tu número de nodo (1-6).**

---

## Paso 1: Cargar base de datos

Ejecuta el script SQL de tu nodo (sustituye N por tu número):

```bash
mysql -u root -p < sql/nodoN.sql
```

Ejemplo para Nodo 2:
```bash
mysql -u root -p < sql/nodo2.sql
```

---

## Paso 2: Configurar backend

```bash
cd backend
```

Edita o crea el archivo `.env` con una sola línea:
```
MI_NODO=N
```

Sustituye N por tu número de nodo (1, 2, 3, 4, 5 o 6).

Instala dependencias (si no lo hiciste):
```bash
npm install
```

Inicia el backend:
```bash
npm run dev
```

Deberías ver:
```
API corriendo en http://localhost:3001
Nodo N — [nombre_sucursal] ([IP_tailscale])
```

---

## Paso 3: Iniciar frontend (terminal nueva)

Desde la carpeta raíz del proyecto:

```bash
cd frontend
npm install    # si no lo hiciste
npm run dev
```

Abre http://localhost:5173 en el navegador.

---

## Resumen de IPs y usuarios

| Nodo | Sucursal | IP Tailscale | Usuario MySQL | Contraseña |
|------|----------|-------------|---------------|------------|
| 1 | Mexicali Centro | 100.127.191.53 | `biblioteca` | Biblioteca123! |
| 2 | Tijuana | 100.88.250.105 | `bibliotecaNodo2` | nodo2. |
| 3 | Ensenada | 100.121.240.118 | `bibliotecaNodo3` | nodo3. |
| 4 | Mexicali Universidad | 100.67.56.91 | `biblioteca_nodo4` | Biblioteca123! |
| 5 | Rosarito | 100.95.94.48 | `bibliotecaNodo5` | nodo5. |
| 6 | Tecate | 100.114.254.124 | `bibliotecaNodo6` | nodo6. |

---

## Si algo falla

**"Access denied for user"**
→ Revisá que el usuario MySQL exista y tenga GRANT (Paso 1)

**"Can't reach host"**
→ Verificá que Tailscale está activo: `ping 100.127.191.53`

**"No such file or directory: sql/nodoN.sql"**
→ Asegurate de estar en la carpeta raíz del proyecto

**Puerto 3001 ya está en uso**
→ Cierra la otra instancia del backend o mata el proceso:
```bash
lsof -ti:3001 | xargs kill -9
```

---

## ¿Preguntas?

Lee `GUIA_EJECUCION.md` para más detalles sobre la arquitectura, fragmentación y endpoints del API.
