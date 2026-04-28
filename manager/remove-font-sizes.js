import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stylesDir = path.join(__dirname, 'src', 'styles');

// Read all CSS files
const files = fs.readdirSync(stylesDir).filter(file => file.endsWith('.css'));

let totalRemoved = 0;
const report = [];

files.forEach(file => {
  const filePath = path.join(stylesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  let removedCount = 0;
  
  // Remove standalone font-size declarations
  // This regex matches font-size lines but preserves them in comments and special contexts
  content = content.replace(/^(\s*)font-size:\s*[^;]+;?\s*$/gm, (match, indent) => {
    removedCount++;
    return ''; // Remove the line
  });
  
  // Clean up multiple empty lines (max 2 consecutive)
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (originalContent !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    report.push(`${file}: ${removedCount} font-size declarations removed`);
    totalRemoved += removedCount;
  }
});

report.forEach(line => );
