const fs = require('fs');
const path = require('path');

// Colores para la consola
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Función para buscar recursivamente archivos .js
function getJsFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getJsFiles(fullPath, files);
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Función principal
function fixEphemeral() {
  const srcDir = path.join(__dirname, 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.log('La carpeta src/ no existe.');
    return;
  }
  
  const jsFiles = getJsFiles(srcDir);
  const modifiedFiles = [];
  
  for (const file of jsFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Reemplazar ephemeral: true por flags: 64
    if (/ephemeral:\s*true/.test(content)) {
      content = content.replace(/ephemeral:\s*true/g, 'flags: 64');
      modified = true;
    }
    
    // Reemplazar ephemeral: false por flags: 0
    if (/ephemeral:\s*false/.test(content)) {
      content = content.replace(/ephemeral:\s*false/g, 'flags: 0');
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      modifiedFiles.push(file);
    }
  }
  
  if (modifiedFiles.length > 0) {
    console.log(`${GREEN}Archivos modificados:${RESET}`);
    modifiedFiles.forEach(file => {
      console.log(`${GREEN}  - ${file}${RESET}`);
    });
  } else {
    console.log('No se encontraron archivos con "ephemeral" para modificar.');
  }
}

fixEphemeral();
