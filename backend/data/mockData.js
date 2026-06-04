export const db = {
  sucursales: [
    { id_sucursal: 1, nombre: 'Mexicali Centro',       ciudad: 'Mexicali',  direccion: 'Av. Obregón 120',        telefono: '686-555-0101', responsable: 'Lic. Carmen Robles'  },
    { id_sucursal: 2, nombre: 'Tijuana',                ciudad: 'Tijuana',   direccion: 'Blvd. Agua Caliente 88', telefono: '664-555-0202', responsable: 'Lic. Jorge Mendoza' },
    { id_sucursal: 3, nombre: 'Ensenada',               ciudad: 'Ensenada',  direccion: 'Av. Ruiz 450',           telefono: '646-555-0303', responsable: 'Lic. Patricia Soto' },
    { id_sucursal: 4, nombre: 'Mexicali Universidad',   ciudad: 'Mexicali',  direccion: 'Calzada UABC 200',       telefono: '686-555-0404', responsable: 'Dr. Ramón Castillo' },
    { id_sucursal: 5, nombre: 'Rosarito',               ciudad: 'Rosarito',  direccion: 'Blvd. Benito Juárez 33', telefono: '661-555-0505', responsable: 'Lic. Sofía Guerrero'},
    { id_sucursal: 6, nombre: 'Tecate',                 ciudad: 'Tecate',    direccion: 'Calle Principal 77',     telefono: '665-555-0606', responsable: 'Lic. Héctor Vázquez'},
  ],

  categorias: [
    { id_categoria: 1, nombre: 'Literatura',     descripcion: 'Novelas, cuentos y poesía' },
    { id_categoria: 2, nombre: 'Ciencias',       descripcion: 'Biología, física, química' },
    { id_categoria: 3, nombre: 'Historia',       descripcion: 'Historia universal y de México' },
    { id_categoria: 4, nombre: 'Tecnología',     descripcion: 'Computación e ingeniería' },
    { id_categoria: 5, nombre: 'Derecho',        descripcion: 'Leyes y jurisprudencia' },
    { id_categoria: 6, nombre: 'Arte y Cultura', descripcion: 'Pintura, música y arquitectura' },
  ],

  libros: [
    { id_libro: 1,  isbn: '978-607-01-0001-1', titulo: 'Pedro Páramo',                    autor: 'Juan Rulfo',               editorial: 'RM Editorial',  anio: 1955, id_categoria: 1, paginas: 124,  idioma: 'Español', costo: 180.00 },
    { id_libro: 2,  isbn: '978-607-01-0002-2', titulo: 'Cien años de soledad',            autor: 'Gabriel García Márquez',   editorial: 'Alfaguara',     anio: 1967, id_categoria: 1, paginas: 471,  idioma: 'Español', costo: 320.00 },
    { id_libro: 3,  isbn: '978-607-01-0003-3', titulo: 'Biología Celular',                autor: 'Bruce Alberts',            editorial: 'Médica Panamericana', anio: 2015, id_categoria: 2, paginas: 850, idioma: 'Español', costo: 650.00 },
    { id_libro: 4,  isbn: '978-607-01-0004-4', titulo: 'Física Universitaria Vol. 1',     autor: 'Sears & Zemansky',         editorial: 'Pearson',       anio: 2018, id_categoria: 2, paginas: 700,  idioma: 'Español', costo: 590.00 },
    { id_libro: 5,  isbn: '978-607-01-0005-5', titulo: 'Historia de México',              autor: 'Enrique Krauze',           editorial: 'Tusquets',      anio: 2010, id_categoria: 3, paginas: 340,  idioma: 'Español', costo: 260.00 },
    { id_libro: 6,  isbn: '978-607-01-0006-6', titulo: 'La Conquista de México',          autor: 'Hugh Thomas',              editorial: 'Planeta',       anio: 1994, id_categoria: 3, paginas: 912,  idioma: 'Español', costo: 420.00 },
    { id_libro: 7,  isbn: '978-607-01-0007-7', titulo: 'El Lenguaje de Programación C',  autor: 'Kernighan & Ritchie',      editorial: 'Prentice Hall', anio: 1988, id_categoria: 4, paginas: 288,  idioma: 'Español', costo: 380.00 },
    { id_libro: 8,  isbn: '978-607-01-0008-8', titulo: 'Algoritmos y Estructuras de Datos', autor: 'Thomas Cormen',         editorial: 'MIT Press',     anio: 2009, id_categoria: 4, paginas: 1292, idioma: 'Español', costo: 750.00 },
    { id_libro: 9,  isbn: '978-607-01-0009-9', titulo: 'Derecho Constitucional Mexicano', autor: 'Felipe Tena Ramírez',    editorial: 'Porrúa',        anio: 2016, id_categoria: 5, paginas: 620,  idioma: 'Español', costo: 480.00 },
    { id_libro: 10, isbn: '978-607-01-0010-0', titulo: 'Teoría General del Derecho',     autor: 'Norberto Bobbio',          editorial: 'Debate',        anio: 2012, id_categoria: 5, paginas: 290,  idioma: 'Español', costo: 310.00 },
    { id_libro: 11, isbn: '978-607-01-0011-1', titulo: 'El Arte de México',              autor: 'Teresa del Conde',          editorial: 'FCE',           anio: 2008, id_categoria: 6, paginas: 410,  idioma: 'Español', costo: 390.00 },
    { id_libro: 12, isbn: '978-607-01-0012-2', titulo: 'Arquitectura Prehispánica',      autor: 'Paul Gendrop',              editorial: 'Trillas',       anio: 2001, id_categoria: 6, paginas: 220,  idioma: 'Español', costo: 240.00 },
  ],

  // 72 registros: cada libro (1-12) en cada sucursal (1-6)
  // Variamos copias_totales (2-5) y copias_disponibles para dar realismo
  inventario: (() => {
    const copiasTotales = [3, 4, 2, 5, 2, 3, 2, 3, 4, 2, 3, 4]
    const ubicaciones   = ['Estante A', 'Estante B', 'Estante C', 'Sala Estudio', 'Estante D', 'Estante E']
    const inv = []
    let id = 1
    for (let libro = 1; libro <= 12; libro++) {
      for (let suc = 1; suc <= 6; suc++) {
        const total = copiasTotales[libro - 1]
        // Reducir disponibles aleatoriamente (1 copia prestada en algunos)
        const prestadas = (libro + suc) % 3 === 0 ? 1 : 0
        inv.push({
          id_inventario: id++,
          id_libro: libro,
          id_sucursal: suc,
          copias_totales: total,
          copias_disponibles: Math.max(0, total - prestadas),
          ubicacion_fisica: `${ubicaciones[suc - 1]} ${libro}`,
        })
      }
    }
    return inv
  })(),

  usuarios: [
    { id_usuario: 1,  nombre: 'María',    apellidos: 'González Herrera',  email: 'mgonzalez@email.com',  telefono: '686-111-0001', id_sucursal_registro: 1, fecha_registro: '2023-01-15', multas_acumuladas: 0.00   },
    { id_usuario: 2,  nombre: 'Carlos',   apellidos: 'Ramírez López',     email: 'cramirez@email.com',   telefono: '664-111-0002', id_sucursal_registro: 2, fecha_registro: '2023-03-22', multas_acumuladas: 25.00  },
    { id_usuario: 3,  nombre: 'Fernanda', apellidos: 'Torres Ávila',      email: 'ftorres@email.com',    telefono: '646-111-0003', id_sucursal_registro: 3, fecha_registro: '2023-05-10', multas_acumuladas: 0.00   },
    { id_usuario: 4,  nombre: 'Luis',     apellidos: 'Morales Fuentes',   email: 'lmorales@email.com',   telefono: '686-111-0004', id_sucursal_registro: 4, fecha_registro: '2023-06-01', multas_acumuladas: 50.00  },
    { id_usuario: 5,  nombre: 'Ana',      apellidos: 'Castillo Vega',     email: 'acastillo@email.com',  telefono: '661-111-0005', id_sucursal_registro: 5, fecha_registro: '2023-07-14', multas_acumuladas: 0.00   },
    { id_usuario: 6,  nombre: 'Roberto',  apellidos: 'Sánchez Mendoza',   email: 'rsanchez@email.com',   telefono: '665-111-0006', id_sucursal_registro: 6, fecha_registro: '2023-08-30', multas_acumuladas: 0.00   },
    { id_usuario: 7,  nombre: 'Laura',    apellidos: 'Díaz Contreras',    email: 'ldiaz@email.com',      telefono: '686-111-0007', id_sucursal_registro: 1, fecha_registro: '2023-09-05', multas_acumuladas: 75.00  },
    { id_usuario: 8,  nombre: 'Miguel',   apellidos: 'Reyes Espinoza',    email: 'mreyes@email.com',     telefono: '664-111-0008', id_sucursal_registro: 2, fecha_registro: '2023-10-18', multas_acumuladas: 0.00   },
    { id_usuario: 9,  nombre: 'Paola',    apellidos: 'Flores Gutiérrez',  email: 'pflores@email.com',    telefono: '686-111-0009', id_sucursal_registro: 4, fecha_registro: '2024-01-07', multas_acumuladas: 0.00   },
    { id_usuario: 10, nombre: 'Diego',    apellidos: 'Vargas Ontiveros',  email: 'dvargas@email.com',    telefono: '646-111-0010', id_sucursal_registro: 3, fecha_registro: '2024-02-20', multas_acumuladas: 0.00   },
  ],

  prestamos: [
    // Activos (8)
    { id_prestamo: 1,  id_usuario: 1,  id_libro: 2,  id_sucursal: 1, fecha_prestamo: '2026-04-20', fecha_devolucion_esperada: '2026-05-20', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 2,  id_usuario: 3,  id_libro: 5,  id_sucursal: 3, fecha_prestamo: '2026-04-25', fecha_devolucion_esperada: '2026-05-25', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 3,  id_usuario: 5,  id_libro: 7,  id_sucursal: 5, fecha_prestamo: '2026-05-01', fecha_devolucion_esperada: '2026-06-01', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 4,  id_usuario: 8,  id_libro: 11, id_sucursal: 2, fecha_prestamo: '2026-05-05', fecha_devolucion_esperada: '2026-06-05', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 5,  id_usuario: 9,  id_libro: 3,  id_sucursal: 4, fecha_prestamo: '2026-05-08', fecha_devolucion_esperada: '2026-06-08', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 6,  id_usuario: 6,  id_libro: 9,  id_sucursal: 6, fecha_prestamo: '2026-04-30', fecha_devolucion_esperada: '2026-05-30', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 7,  id_usuario: 10, id_libro: 1,  id_sucursal: 3, fecha_prestamo: '2026-05-02', fecha_devolucion_esperada: '2026-06-02', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    { id_prestamo: 8,  id_usuario: 4,  id_libro: 8,  id_sucursal: 4, fecha_prestamo: '2026-05-10', fecha_devolucion_esperada: '2026-06-10', fecha_devolucion_real: null, estatus: 'activo',   multa: 0  },
    // Vencidos (4)
    { id_prestamo: 9,  id_usuario: 2,  id_libro: 4,  id_sucursal: 2, fecha_prestamo: '2026-03-01', fecha_devolucion_esperada: '2026-04-01', fecha_devolucion_real: null, estatus: 'vencido',  multa: 50 },
    { id_prestamo: 10, id_usuario: 7,  id_libro: 6,  id_sucursal: 1, fecha_prestamo: '2026-03-10', fecha_devolucion_esperada: '2026-04-10', fecha_devolucion_real: null, estatus: 'vencido',  multa: 75 },
    { id_prestamo: 11, id_usuario: 4,  id_libro: 10, id_sucursal: 4, fecha_prestamo: '2026-02-15', fecha_devolucion_esperada: '2026-03-15', fecha_devolucion_real: null, estatus: 'vencido',  multa: 50 },
    { id_prestamo: 12, id_usuario: 2,  id_libro: 12, id_sucursal: 2, fecha_prestamo: '2026-03-20', fecha_devolucion_esperada: '2026-04-20', fecha_devolucion_real: null, estatus: 'vencido',  multa: 25 },
    // Devueltos (3)
    { id_prestamo: 13, id_usuario: 1,  id_libro: 5,  id_sucursal: 1, fecha_prestamo: '2026-01-10', fecha_devolucion_esperada: '2026-02-10', fecha_devolucion_real: '2026-02-08', estatus: 'devuelto', multa: 0  },
    { id_prestamo: 14, id_usuario: 3,  id_libro: 7,  id_sucursal: 3, fecha_prestamo: '2026-02-01', fecha_devolucion_esperada: '2026-03-01', fecha_devolucion_real: '2026-03-01', estatus: 'devuelto', multa: 0  },
    { id_prestamo: 15, id_usuario: 5,  id_libro: 2,  id_sucursal: 5, fecha_prestamo: '2026-01-20', fecha_devolucion_esperada: '2026-02-20', fecha_devolucion_real: '2026-02-19', estatus: 'devuelto', multa: 0  },
  ],
}
