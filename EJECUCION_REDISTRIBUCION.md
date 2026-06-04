# Ejecución de la Redistribución de Usuario — Por Nodo

> **Qué hace este cambio:** mueve `UsuarioPerfil` y `UsuarioAcceso` fuera del fragmento horizontal por sucursal.
> Después de aplicar este plan, los 10 usuarios viven solo en 2 nodos:
> - **Nodo 1** → `UsuarioPerfil` (identidad + ubicación)
> - **Nodo 4** → `UsuarioAcceso` (email + multas)
> - **Nodos 2, 3, 5, 6** → SIN tablas de Usuario (consultan remotamente)
>
> El plan completo con justificación está en `PLAN_REDISTRIBUCION_USUARIO.md`.

---

## Paso 0 — Para TODOS los nodos (sin excepción)

### 0.1 Traer los cambios de código

Desde la raíz del proyecto:

```bash
git pull origin develop
```

### 0.2 Verificar que llegaron los archivos nuevos

```bash
ls sql/usuarios_nodo1_perfil.sql sql/usuarios_nodo4_acceso.sql sql/remove_usuarios_otros_nodos.sql
```

Si los 3 archivos aparecen, todo OK. Si falta alguno → vuelve a hacer `git pull`.

### 0.3 Verificar tu `backend/.env`

Debe tener UNA línea con tu número de nodo:

```
MI_NODO=N
```

Donde N es **1, 2, 3, 4, 5 o 6** (tu nodo).

### 0.4 Identificar qué tipo de nodo eres

| Tu nodo | Vas a la sección |
|---------|------------------|
| **1** (Mexicali Centro) | **A** — almacena `UsuarioPerfil` |
| **4** (Mexicali Universidad) | **B** — almacena `UsuarioAcceso` |
| **2, 3, 5, 6** (Tijuana / Ensenada / Rosarito / Tecate) | **C** — sin tablas de Usuario |

---

## SECCIÓN A — Nodo 1 (Mexicali Centro)

> Almacena el fragmento `UsuarioPerfil` con los 10 usuarios de toda la red.

### A.1 Ejecutar el nuevo script SQL

Desde la raíz del proyecto:

```bash
mysql -u root -p < sql/usuarios_nodo1_perfil.sql
```

> El script primero hace `DROP TABLE` de `UsuarioAcceso` y `UsuarioPerfil` (porque ya no debe existir el Acceso aquí), luego crea la nueva `UsuarioPerfil` con los 10 usuarios.

### A.2 Verificar

```bash
mysql -u root -p -e "USE biblioteca_nodo1; SELECT COUNT(*) FROM UsuarioPerfil; SHOW TABLES LIKE 'Usuario%';"
```

**Resultado esperado:**
- `COUNT(*)` → `10`
- `SHOW TABLES` → solo `UsuarioPerfil` (NO debe aparecer `UsuarioAcceso`)

### A.3 Verificar distribución por sucursal

```bash
mysql -u root -p -e "USE biblioteca_nodo1; SELECT id_sucursal_registro, COUNT(*) FROM UsuarioPerfil GROUP BY id_sucursal_registro ORDER BY id_sucursal_registro;"
```

**Esperado:** suc 1→2, suc 2→2, suc 3→2, suc 4→2, suc 5→1, suc 6→1.

### A.4 Reiniciar backend

```bash
cd backend
npm install    # solo si no lo habías hecho
npm run dev
```

Debes ver: `Nodo 1 — Mexicali Centro (100.127.191.53)`.

### A.5 Probar endpoints (en otra terminal)

```bash
curl http://localhost:3001/api/usuarios | head -c 500
curl http://localhost:3001/api/usuarios/2
curl http://localhost:3001/api/usuarios/8/prestamos
```

→ Salta a la **sección D (verificación end-to-end)**.

---

## SECCIÓN B — Nodo 4 (Mexicali Universidad)

> Almacena el fragmento `UsuarioAcceso` con los 10 usuarios de toda la red.

### B.1 Ejecutar el nuevo script SQL

```bash
mysql -u root -p < sql/usuarios_nodo4_acceso.sql
```

> El script primero hace `DROP TABLE` de `UsuarioAcceso` y `UsuarioPerfil` (porque ya no debe existir el Perfil aquí), luego crea la nueva `UsuarioAcceso` SIN FK (la FK no se puede mantener entre nodos distintos).

### B.2 (Si no lo habías hecho) cargar LibroAdmin

```bash
mysql -u root -p < sql/nodo4_libro_admin.sql
```

### B.3 Verificar

```bash
mysql -u root -p -e "USE biblioteca_nodo4; SELECT COUNT(*) FROM UsuarioAcceso; SHOW TABLES LIKE 'Usuario%';"
```

**Resultado esperado:**
- `COUNT(*)` → `10`
- `SHOW TABLES` → solo `UsuarioAcceso` (NO debe aparecer `UsuarioPerfil`)

### B.4 Verificar usuarios con multas

```bash
mysql -u root -p -e "USE biblioteca_nodo4; SELECT id_usuario, email, multas_acumuladas FROM UsuarioAcceso WHERE multas_acumuladas > 0;"
```

**Esperado:** 3 filas — Carlos (25), Luis (50), Laura (75).

### B.5 Reiniciar backend

```bash
cd backend
npm install
npm run dev
```

Debes ver: `Nodo 4 — Mexicali Universidad (100.67.56.91)`.

### B.6 Probar endpoints

```bash
curl http://localhost:3001/api/usuarios | head -c 500
curl http://localhost:3001/api/usuarios/7   # Laura — debe mostrar multa 75
```

→ Salta a la **sección D (verificación end-to-end)**.

---

## SECCIÓN C — Nodos 2, 3, 5, 6

> Estos nodos NO almacenan tablas de Usuario. Las consultas a usuario van remotas a Nodo 1 y Nodo 4.

### C.1 Eliminar las tablas Usuario locales

Reemplaza `N` por tu número de nodo (2, 3, 5 o 6):

```bash
mysql -u root -p -e "
  USE biblioteca_nodoN;
  DROP TABLE IF EXISTS UsuarioAcceso;
  DROP TABLE IF EXISTS UsuarioPerfil;
  SHOW TABLES LIKE 'Usuario%';
"
```

**Ejemplo para Nodo 2:**
```bash
mysql -u root -p -e "
  USE biblioteca_nodo2;
  DROP TABLE IF EXISTS UsuarioAcceso;
  DROP TABLE IF EXISTS UsuarioPerfil;
  SHOW TABLES LIKE 'Usuario%';
"
```

**Resultado esperado:** `Empty set` — ninguna tabla `Usuario%` debe aparecer.

### C.2 Verificar que las otras tablas siguen intactas

```bash
mysql -u root -p -e "USE biblioteca_nodoN; SHOW TABLES;"
```

**Esperado:** `Categoria`, `Sucursal`, `Libro`, `Inventario`, `Prestamo` (5 tablas). **NO** debe aparecer `UsuarioPerfil` ni `UsuarioAcceso`.

### C.3 Reiniciar backend

```bash
cd backend
npm install
npm run dev
```

Debes ver: `Nodo N — [tu sucursal] (tu IP Tailscale)`.

### C.4 Probar endpoints (van remotos a Nodo 1 y Nodo 4)

```bash
# Listar usuarios — va a Nodo 1 + Nodo 4 en paralelo
curl http://localhost:3001/api/usuarios | head -c 500

# Buscar un usuario específico — debe funcionar aunque no estén en local
curl http://localhost:3001/api/usuarios/5

# Verificar existencia (Q5) — solo va a Nodo 1
curl http://localhost:3001/api/usuarios/5/prestamos
```

> Si Nodo 1 o Nodo 4 están caídos, las consultas remotas fallarán. Coordinen el orden de arranque: **Nodo 1 y Nodo 4 primero**, luego los demás.

---

## SECCIÓN D — Verificación end-to-end (todos los nodos)

Estos chequeos se pueden correr desde cualquier nodo una vez que Nodo 1 y Nodo 4 estén arriba.

### D.1 Lista completa de usuarios

```bash
curl -s http://localhost:3001/api/usuarios | python3 -c "import json,sys; data=json.load(sys.stdin); print(f'Total: {len(data)}'); [print(f\"  {u['id_usuario']:2} {u['nombre']:10} {u.get('email','(sin email)'):25} multa={u['multas_acumuladas']}\") for u in data]"
```

**Esperado:** 10 usuarios con email y multa.
- Si `email` viene vacío → Nodo 4 no responde.
- Si la respuesta es `[]` o error → Nodo 1 no responde.

### D.2 Préstamos de un usuario (Q5 — solo Nodo 1)

```bash
curl -s http://localhost:3001/api/usuarios/2/prestamos | head -c 300
```

**Esperado:** lista de préstamos del usuario 2 (Carlos). Funciona aunque Nodo 4 esté caído.

### D.3 Devolver un préstamo (Q4 — UPDATE en Nodo 4)

Solo desde el nodo de la sucursal donde está el préstamo (ej. Nodo 1 tiene préstamo #10):

```bash
curl -X PUT http://localhost:3001/api/prestamos/10/devolver
```

Verifica en Nodo 4 que la multa subió:
```bash
mysql -u root -p -e "USE biblioteca_nodo4; SELECT * FROM UsuarioAcceso WHERE id_usuario = 7;"
```

---

## SECCIÓN E — Rollback (si algo falla)

Si tu nodo quedó en mal estado, recarga el script original de tu nodo:

```bash
mysql -u root -p < sql/nodoN.sql
```

> Nota: los archivos `sql/nodo1.sql`...`sql/nodo6.sql` también fueron modificados por este plan, así que el rollback realmente vuelve a la **nueva** arquitectura, no a la vieja. Para rollback completo a la arquitectura vieja, hay que revertir el commit con git:

```bash
# Solo si decides abortar TODO el cambio:
git log --oneline -10           # encontrá el hash anterior al cambio
git checkout <hash-anterior> -- sql/ backend/
mysql -u root -p < sql/nodoN.sql
```

Y avisar al equipo para que todos hagan rollback al mismo tiempo.

---

## Orden de arranque recomendado

Para que las consultas remotas funcionen desde el inicio:

1. **Primero:** Nodo 1 (Mexicali Centro) — arrancar MySQL y backend
2. **Segundo:** Nodo 4 (Mexicali Universidad) — arrancar MySQL y backend
3. **Después:** Nodos 2, 3, 5, 6 en cualquier orden

Si un Nodo 2/3/5/6 arranca antes que el 1 o el 4, sus consultas de usuario fallarán hasta que el otro esté disponible.

---

## Checklist resumido por integrante

```
TODOS:
[ ] git pull origin develop
[ ] Confirmar que sql/usuarios_nodo1_perfil.sql existe
[ ] backend/.env tiene MI_NODO=tu_número

NODO 1 (Mexicali Centro):
[ ] mysql -u root -p < sql/usuarios_nodo1_perfil.sql
[ ] SELECT COUNT(*) FROM UsuarioPerfil → 10
[ ] SHOW TABLES no muestra UsuarioAcceso
[ ] npm run dev → "Nodo 1 — Mexicali Centro"
[ ] curl /api/usuarios → 10 usuarios

NODO 4 (Mexicali Universidad):
[ ] mysql -u root -p < sql/usuarios_nodo4_acceso.sql
[ ] SELECT COUNT(*) FROM UsuarioAcceso → 10
[ ] SHOW TABLES no muestra UsuarioPerfil
[ ] npm run dev → "Nodo 4 — Mexicali Universidad"
[ ] curl /api/usuarios → 10 usuarios

NODO 2 / 3 / 5 / 6:
[ ] DROP TABLE IF EXISTS UsuarioAcceso; DROP TABLE IF EXISTS UsuarioPerfil;
[ ] SHOW TABLES no muestra ninguna tabla Usuario%
[ ] npm run dev → "Nodo N — [tu sucursal]"
[ ] curl /api/usuarios → 10 usuarios (remoto)
[ ] curl /api/usuarios/:id/prestamos → funciona (Q5 solo Nodo 1)
```
