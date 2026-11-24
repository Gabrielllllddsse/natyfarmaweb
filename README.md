# NatyfarmaWeb

Sitio público y panel de gestión de la botica Natyfarma.
**Stack:** HTML5 · Less · Bootstrap 5 · Node.js + Express · MySQL.

## 1. Requisitos
- Node.js 18 o superior · MySQL 8 (y MySQL Workbench, opcional) · Visual Studio Code

## 2. Instalación (una sola vez)
1. Abre la carpeta en Visual Studio Code y una terminal en ella.
2. `npm install`
3. Copia `.env.example` como `.env` y escribe la contraseña de tu MySQL en `DB_PASSWORD`.
4. `npm run setup`  → crea la base de datos `natyfarma`, las tablas y los datos de ejemplo.
   (También puedes ejecutar `database/schema.sql` en MySQL Workbench.)
5. `npm start`  → abre http://localhost:3000

## 2b. Instalación con Docker (alternativa)
Solo necesitas Docker Desktop abierto. No hace falta instalar Node.js ni MySQL.
1. En la carpeta del proyecto: `docker compose up -d --build`
2. Abre http://localhost:3000 (la primera vez tarda un poco mientras MySQL se inicia).

- Las contraseñas se toman del archivo `.env` (`DB_PASSWORD` y `JWT_SECRET`); si no existe, se usan valores por defecto.
- La base de datos del contenedor se conecta desde MySQL Workbench en `localhost`, puerto **3307**, usuario `root`.
- Los datos y las fotos de productos se guardan en volúmenes de Docker: no se pierden al apagar.
- Apagar: `docker compose down` · Ver mensajes: `docker compose logs -f app`
- Borrar todo y empezar de cero (elimina ventas y productos): `docker compose down -v`

## 3. Usuarios del panel (http://localhost:3000/panel/)
| Rol | Usuario | Contraseña | Módulos |
|---|---|---|---|
| Administrador | admin | Admin123 | Todos |
| Cajero | cajero | Caja123 | Nueva venta, Historial de ventas |

Cambia las contraseñas en **Usuarios** antes de usarlo en la botica.

**Roles nuevos:** como `admin` entra a **Roles → Nuevo rol**, escribe el nombre (por ejemplo «Almacenero») y marca los módulos que podrá usar. Luego asígnalo a un usuario en **Usuarios**. Administrador y Cajero son roles base y no se eliminan.

Si tu base de datos se creó con una versión anterior (con los roles Farmacéutico y Almacén), ejecuta otra vez `npm run setup`: actualiza la tabla de roles sin borrar ventas ni productos.

## 4. Poner el teléfono y otros datos
Ingresa como `admin` → **Datos del negocio**. Al guardar el teléfono aparecen el botón de WhatsApp y el número en toda la web. Redes sociales: déjalas vacías y no se muestran.

## 5. Agregar productos
Ingresa como `admin` → **Productos → Nuevo producto** (con foto opcional). También puedes crear categorías nuevas. El stock se mueve desde **Inventario** (almacén) o automáticamente con cada venta.

## 6. Estilos con Less
Los estilos están en `public/less/` (variables, mixins, base, animaciones y componentes). Tras editarlos:
- `npm run build:css` compila una vez, o
- `npm run watch:css` compila solo cada vez que guardas.

## 7. Estructura
```
database/   schema.sql, setup.js
server/     index.js, auth.js, db.js, boleta.js, routes/
public/     páginas HTML, css/ (compilado), less/ (fuente), js/, img/, uploads/
panel/      panel interno (index.html + panel.js)
```

## 8. Despliegue gratuito en internet (Render + TiDB Cloud)

El sistema queda en línea las 24 horas con dos servicios gratuitos: **TiDB Cloud Starter** (base de datos compatible con MySQL, 5 GB sin vencimiento) y **Render** (servidor Node.js). Todo se configura con variables de entorno.

**Paso 1. Base de datos en TiDB Cloud**
1. Crear una cuenta en https://tidbcloud.com y un clúster **Starter** (gratuito).
2. Pulsar **Connect**, elegir *Connect With: General* y **Generate Password**.
3. Copiar *HOST*, *PORT* (4000), *USERNAME* (tiene la forma `xxxx.root`) y la contraseña.

**Paso 2. Servidor en Render**
1. Abrir https://render.com/deploy?repo=https://github.com/Gabrielllllddsse/natyfarmaweb e iniciar sesión con GitHub.
2. Completar `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD` con los datos de TiDB.
3. Pulsar **Apply**. Al iniciar, `npm run start:nube` crea las tablas y los usuarios y arranca el sitio.

**A tener en cuenta (plan gratuito)**
- Tras unos 15 minutos sin visitas el servidor se suspende; la siguiente visita tarda cerca de un minuto y luego funciona normal.
- El disco de Render se reinicia en cada despliegue: las **fotos subidas desde el panel** se pierden (las imágenes propias del sitio no). Los datos de la base se conservan.
- Para otro proveedor MySQL que exija certificado propio, se puede agregar la variable `DB_CA` con su contenido.
