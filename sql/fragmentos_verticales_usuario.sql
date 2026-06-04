-- =============================================================
-- MIGRACIÓN: Fragmentación Vertical de Usuario
-- Convierte la tabla única `Usuario` en 2 fragmentos verticales:
--   · UsuarioPerfil  (identidad + ubicación) — acceso en Q1-Q6
--   · UsuarioAcceso  (email + multas)        — cluster de alto acceso Q4, Q6
--
-- Fundamentación: convergencia de BEA, MAC, MFA y MAA
--   F1 = {A1(id), A4(email), A9(multas)}  → UsuarioAcceso
--   F2 = {A1(id), A2(nombre), A3(apellidos), A5(telefono),
--          A6(direccion), A7(id_sucursal), A8(fecha_registro)} → UsuarioPerfil
--
-- Ejecutar en CADA NODO (ajustar el USE según corresponda):
--   USE biblioteca_nodoN;
--
-- Este script asume que la tabla Usuario EXISTE y tiene datos.
-- Si vas a recrear la BD desde cero, usa directamente el nodoN.sql actualizado.
-- =============================================================

-- Paso 1: Crear Fragmento Vertical 1 (sin AUTO_INCREMENT, se copiará el PK existente)
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL,
  fecha_registro       DATE,
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

-- Paso 2: Crear Fragmento Vertical 2
CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 3: Migrar datos desde la tabla original (orden importante: padre antes que hijo)
INSERT IGNORE INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT IGNORE INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 4: Verificar que la migración está completa antes de eliminar la tabla original
-- Ejecutar manualmente y comprobar que los counts coinciden:
-- SELECT COUNT(*) FROM Usuario;
-- SELECT COUNT(*) FROM UsuarioPerfil;
-- SELECT COUNT(*) FROM UsuarioAcceso;

-- Paso 5: Eliminar tabla original (¡solo después de verificar el paso 4!)
-- DROP TABLE Usuario;

-- Verificación de la reconstrucción completa (equivalente a SELECT * FROM Usuario):
-- SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
--        up.id_sucursal_registro, up.fecha_registro,
--        ua.email, ua.multas_acumuladas
-- FROM UsuarioPerfil up
-- JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario
-- ORDER BY up.id_usuario;
