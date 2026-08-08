# Finanzas — registro de gastos diarios

App web (PWA) para llevar tus ingresos y egresos, con balance mensual,
métricas por categoría y por mes. Sin frameworks ni build step: HTML/CSS/JS
puro + [Supabase](https://supabase.com) para guardar los datos en la nube.

## 1. Crear el proyecto en Supabase (gratis)

1. Ve a **https://supabase.com** → *Start your project* → crea una cuenta
   (con tu correo `jhonymoraxmk@gmail.com` o con GitHub).
2. Crea un proyecto nuevo. Elige cualquier nombre (ej. `finanzas`) y una
   contraseña de base de datos (guárdala, no la necesitarás para esta app
   pero Supabase la pide).
3. Espera ~2 minutos a que se aprovisione.
4. En el menú lateral ve a **SQL Editor** → **New query**.
5. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este
   proyecto, copia todo su contenido, pégalo en el editor y dale **Run**.
   Esto crea la tabla `transactions` con seguridad a nivel de fila (RLS) —
   cada usuario solo puede ver y editar sus propias transacciones.
6. Ve a **Project Settings** (ícono de engranaje) → **API**.
7. Copia dos valores:
   - **Project URL** (algo como `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (una cadena larga que empieza con `eyJ...`)
8. Habilita el login por enlace mágico: **Authentication** → **Providers** →
   confirma que **Email** esté habilitado (viene activado por defecto).
   También en **Authentication** → **URL Configuration**, agrega la URL
   donde vas a desplegar la app (ej. `https://finanzas-tuusuario.vercel.app`)
   en **Redirect URLs**, para que el enlace mágico funcione en producción.

## 2. Conectar la app a Supabase

Abre [`js/config.js`](js/config.js) y pega tus dos valores:

```js
window.FINANZAS_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  OWNER_EMAIL: 'jhonymoraxmk@gmail.com'
};
```

Sin esto, la app funciona en **modo local** (guarda solo en ese navegador,
útil para probar el diseño, pero no sincroniza entre dispositivos).

## 3. Desplegar en Vercel (gratis)

**Opción simple — arrastrar y soltar:**
1. Ve a **https://vercel.com** → crea una cuenta (con GitHub es lo más
   rápido).
2. En el dashboard, busca la opción de subir una carpeta directamente
   (*Add New* → *Project* → *Deploy without Git*), o:

**Opción recomendada — con GitHub (permite actualizar después):**
1. Crea un repositorio nuevo en GitHub y sube esta carpeta:
   ```bash
   cd /Users/admin/finanzas
   git add -A
   git commit -m "Finanzas: primera versión"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/finanzas.git
   git push -u origin main
   ```
2. En Vercel: **Add New** → **Project** → conecta tu cuenta de GitHub →
   selecciona el repo `finanzas`.
3. Como es HTML plano, Vercel lo detecta como sitio estático automáticamente
   — no hace falta configurar ningún *build command*. Dale **Deploy**.
4. En 1 minuto tendrás una URL tipo `https://finanzas-tuusuario.vercel.app`.
5. Vuelve a Supabase → **Authentication** → **URL Configuration** y agrega
   esa URL a **Redirect URLs** (paso que quedó pendiente arriba).

## 4. Primer uso

1. Abre la URL desplegada (o `index.html` local).
2. Ingresa tu correo → te llega un enlace mágico → ábrelo desde el mismo
   dispositivo → quedas logueado.
3. Desde ahí, tanto tu celular como tu computador van a mostrar las mismas
   transacciones (todas viven en Supabase).
4. En iPhone/Android puedes "Agregar a pantalla de inicio" desde el
   navegador para que se comporte como una app instalada (PWA).

## Funcionalidad incluida

- **Resumen**: balance neto del mes, ingresos/egresos, equivalente en USD
  (tasa de cambio actualizada cada hora), lista de transacciones agrupada
  por día, con comparación contra el mes anterior.
- **Nueva transacción**: egreso/ingreso, monto, fecha, categoría (9
  categorías), nota opcional.
- **Editar / eliminar**: toca cualquier transacción de la lista para
  editarla o eliminarla.
- **Métricas**: desglose de gastos por categoría (con barras y %) y gráfico
  de egresos de los últimos 6 meses — toca cualquier mes para saltar a él.
- **Navegación por mes** con flechas `<` `>` en la parte superior.

## Estructura del proyecto

```
finanzas/
├── index.html            Estructura de la app
├── manifest.json          Config de PWA (instalable)
├── sw.js                   Service worker (offline, solo en producción)
├── css/style.css           Todos los estilos
├── js/
│   ├── config.js            ← AQUÍ van tus claves de Supabase
│   ├── categories.js         Categorías + iconos
│   ├── db.js                  Capa de datos (Supabase o localStorage)
│   ├── rates.js                Tasa de cambio COP → USD
│   └── app.js                   Lógica de la interfaz
└── supabase/schema.sql     SQL para crear la tabla + seguridad
```
