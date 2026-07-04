#!/bin/bash
# Script para build do ContaMEI no macOS (evitando travas de sincronização do Dropbox)

set -e

# Caminho do projeto atual (Dropbox)
PROJECT_DIR="$(pwd)"
TEMP_DIR="/tmp/contamei-build"

echo "=== Iniciando build do ContaMEI para macOS ==="
echo "Diretório do projeto: $PROJECT_DIR"
echo "Diretório temporário de build: $TEMP_DIR"

# Limpa build anterior se houver no temp
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copia arquivos relevantes do projeto para o temp (ignorando node_modules e builds anteriores)
echo "Copiando arquivos do projeto para pasta temporária..."
cp -R src public electron package.json package-lock.json vite.config.js index.html eslint.config.js "$TEMP_DIR/"

# Navega para a pasta temporária
cd "$TEMP_DIR"

# Instala dependências e compila o app para macOS
echo "Instalando dependências..."
npm install

echo "Compilando assets (Vite)..."
npm run build

echo "Empacotando aplicativo para macOS (electron-builder)..."
npx electron-builder --mac --publish never

# Cria o diretório de destino se não existir no Dropbox
mkdir -p "$PROJECT_DIR/dist-electron"

# Copia o artefato de volta para a pasta do Dropbox
echo "Copiando artefatos compilados de volta para a pasta do projeto..."
cp -R dist-electron/*.dmg "$PROJECT_DIR/dist-electron/" 2>/dev/null || cp -R dist-electron/*.zip "$PROJECT_DIR/dist-electron/" || true
cp -R dist-electron/mac* "$PROJECT_DIR/dist-electron/" 2>/dev/null || true

# Limpeza
echo "Limpando diretório temporário..."
rm -rf "$TEMP_DIR"

echo "=== Build concluído com sucesso! Artefatos salvos em dist-electron/ ==="
