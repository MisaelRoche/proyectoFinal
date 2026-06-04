-- =============================================================
-- LIMPIEZA — Eliminar tablas de Usuario de este nodo
-- Ejecutar en Nodos 2, 3, 5 y 6
-- Los usuarios ahora viven en Nodo 1 (Perfil) y Nodo 4 (Acceso)
-- =============================================================

-- Ajustar USE según el nodo:
-- Nodo 2: USE biblioteca_nodo2;
-- Nodo 3: USE biblioteca_nodo3;
-- Nodo 5: USE biblioteca_nodo5;
-- Nodo 6: USE biblioteca_nodo6;

DROP TABLE IF EXISTS UsuarioAcceso;
DROP TABLE IF EXISTS UsuarioPerfil;

-- Verificación: no debe mostrar tablas de Usuario
SHOW TABLES LIKE 'Usuario%';
