# Aurea Internal Platform Backend (`backoffice-be-aurea-internal`)

API backend para el **Backoffice Interno de Aurea** (`platform`), encargado de la administración central de planes, precios, catálogo de módulos dinámicos, tenants y auditoría global de la plataforma.

---

## 🚀 Requisitos Previos

- Node.js >= 20.x
- MongoDB (Cluster Aurea o réplica local)
- npm / npx

---

## 🛠️ Instalación y Configuración

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/aurea-io/backoffice-be-aurea-internal.git
   cd backoffice-be-aurea-internal
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```

4. Generar cliente Prisma y sincronizar índices en MongoDB:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Aprovisionar usuario inicial `platform_owner`:
   ```bash
   npm run seed
   ```

---

## 🧪 Testing y Compilación

```bash
npm test        # Ejecutar tests con Vitest
npm run build   # Compilar aplicación NestJS
npm run start   # Iniciar servidor
```
