FROM oven/bun:latest

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json ./
# Si tienes bun.lockb, descomenta la siguiente línea:
# COPY bun.lockb ./

# Instalar dependencias
RUN bun install

# Copiar el resto del código
COPY . .

# Exponer el puerto que usa tu app
EXPOSE 3000

# Comando para arrancar la aplicación
CMD ["bun", "run", "index.ts"]
